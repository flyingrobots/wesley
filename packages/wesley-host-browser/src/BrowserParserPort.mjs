/**
 * BrowserParserPort — minimal, dependency-free ParserPort for browser
 * Parses a subset of GraphQL SDL sufficient for smoke/alpha demos:
 * - type Object @wes_table { field: Type! @wes_pk @wes_fk(ref: "T.c") @wes_unique @wes_default(value:"...") }
 * Limitations: not a full GraphQL parser; designed to be tiny and safe.
 *
 * Emits the canonical WesleyIR shape: structured FieldType, FieldDirectives,
 * TableDirectives, plus backward-compat shim properties.
 */

function stripComments(s) {
  return s.replace(/#.*/g, '');
}

function parseRawDirectives(head) {
  const out = {};
  const dirRe = /@([A-Za-z_][A-Za-z0-9_]*)(\(([^)]*)\))?/g;
  let m;
  while ((m = dirRe.exec(head)) !== null) {
    const name = m[1];
    const argsStr = m[3] || '';
    const args = {};
    argsStr.split(',').map(s => s.trim()).filter(Boolean).forEach(pair => {
      const mm = pair.match(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
      if (mm) {
        let val = mm[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        args[mm[1]] = val;
      }
    });
    out[name] = args;
  }
  return out;
}

const SCALAR_SET = new Set(['ID','UUID','String','Int','Float','Boolean','DateTime','Date','Time','JSON']);

function parseFields(body) {
  const lines = body.split(/\r?\n|\r/).map(s => s.trim()).filter(Boolean);
  const fields = [];
  for (const line of lines) {
    if (line.startsWith('}')) break;

    const m = line.match(/^([A-Za-z_]\w*)\s*:\s*(.+)$/);
    if (!m) continue;
    const name = m[1];
    const remainder = m[2].trim();

    let typeSpec = remainder;
    let head = '';
    const atIndex = remainder.indexOf('@');
    if (atIndex !== -1) {
      typeSpec = remainder.substring(0, atIndex).trim();
      head = remainder.substring(atIndex);
    }

    const rawDirs = parseRawDirectives(head);

    const base = typeSpec.replace(/[[\]!]/g, '');
    const isScalar = SCALAR_SET.has(base);
    const hasFk = rawDirs['wes_fk'] || rawDirs['wesley_fk'] || rawDirs['fk'];
    if (!isScalar && !hasFk) continue;

    const nullable = !typeSpec.endsWith('!');
    const isList = typeSpec.includes('[');

    // Build structured FieldDirectives
    const directives = {};
    if (rawDirs['wes_pk'] || rawDirs['wesley_pk'] || rawDirs['pk']) {
      directives.pk = true;
    }
    if (rawDirs['wes_unique'] || rawDirs['wesley_unique'] || rawDirs['unique']) {
      directives.unique = true;
    }
    if (rawDirs['wes_index'] || rawDirs['wesley_index'] || rawDirs['index']) {
      directives.index = true;
    }
    const defaultDir = rawDirs['wes_default'] || rawDirs['wesley_default'] || rawDirs['default'];
    if (defaultDir) {
      directives.default = { value: defaultDir.value || defaultDir.expr };
    }
    const fkDir = rawDirs['wes_fk'] || rawDirs['wesley_fk'] || rawDirs['fk'];
    if (fkDir?.ref) {
      const [targetTable, targetField] = fkDir.ref.split('.');
      if (targetTable && targetField) {
        directives.fk = { targetTable, targetField };
      }
    }

    fields.push({
      name,
      type: { base, isList },
      nullable,
      directives
    });
  }
  return fields;
}

export class BrowserParserPort {
  async parse(sdl) {
    if (typeof sdl !== 'string') throw new Error('Schema must be a string');
    const input = stripComments(sdl);
    const tables = [];
    const typeRe = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^{]*)\{([\s\S]*?)\}/g;
    let m;
    while ((m = typeRe.exec(input)) !== null) {
      const name = m[1];
      const head = m[2] || '';
      const body = m[3] || '';
      const rawDirs = parseRawDirectives(head);

      const fields = parseFields(body);
      const indexes = [];
      const constraints = [];

      // Build structured TableDirectives
      const tableDirectives = { table: true };
      const tenantDir = rawDirs['wes_tenant'] || rawDirs['tenant'];
      if (tenantDir?.by) {
        tableDirectives.tenant = { field: tenantDir.by };
      }
      if (rawDirs['wes_rls'] || rawDirs['rls']) {
        tableDirectives.rls = { enable: true };
      }

      // Build indexes from field directives
      for (const f of fields) {
        if (f.directives.index) {
          indexes.push({ fields: [f.name], name: null, table: name, unique: false, using: null });
        }
      }

      const table = { name, directives: tableDirectives, fields, indexes, constraints };

      tables.push(table);
    }
    return {
      version: '1.0.0',
      metadata: { generatedAt: new Date().toISOString() },
      tables,
      enums: [],
      scalars: [],
      relationships: [],
      toJSON() { return { version: '1.0.0', tables }; }
    };
  }
}
