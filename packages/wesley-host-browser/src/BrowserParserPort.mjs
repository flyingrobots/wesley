/**
 * BrowserParserPort — minimal, dependency-free ParserPort for browser
 * Parses a subset of GraphQL SDL sufficient for smoke/alpha demos:
 * - type Object @wes_table { field: Type! @wes_pk @wes_fk(ref: "T.c") @wes_unique @wes_default(value:"...") }
 * Limitations: not a full GraphQL parser; designed to be tiny and safe.
 */

function stripComments(s) {
  return s.replace(/#.*/g, '');
}

function parseDirectives(head) {
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

function parseFields(body) {
  // Crude splitter: one field per line; ignore relations (no scalar) unless directive forces column.
  const lines = body.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const fields = [];
  for (const line of lines) {
    if (line.startsWith('}')) break;
    // name: Type! @dir(args)
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^@]+?)(\s+@.+)?$/);
    if (!m) continue;
    const name = m[1];
    const typeSpec = m[2].trim();
    const head = m[3] || '';
    const directives = parseDirectives(head);
    // detect scalar vs relation (very small whitelist)
    const base = typeSpec.replace(/[\[\]!]/g, '');
    const scalar = new Set(['ID','UUID','String','Int','Float','Boolean','DateTime','Date','Time','JSON']).has(base);
    const hasFk = directives['wes_fk'] || directives['wesley_fk'] || directives['fk'];
    if (!scalar && !hasFk) continue; // relation-only
    const nullable = !typeSpec.endsWith('!');
    const pgType = (() => {
      switch (base) {
        case 'ID':
        case 'UUID': return 'uuid';
        case 'String': return 'text';
        case 'Int': return 'integer';
        case 'Float': return 'double precision';
        case 'Boolean': return 'boolean';
        case 'DateTime': return 'timestamptz';
        case 'Date': return 'date';
        case 'Time': return 'time with time zone';
        case 'JSON': return 'jsonb';
        default: return 'text';
      }
    })();
    const column = { name, type: pgType, nullable, directives };
    if (directives['wes_default']?.value || directives['wes_default']?.expr) {
      column.default = directives['wes_default'].value || directives['wes_default'].expr;
    }
    if (directives['wes_unique']) column.unique = true;
    fields.push(column);
  }
  return fields;
}

export class BrowserParserPort {
  async parse(sdl) {
    if (typeof sdl !== 'string') throw new Error('Schema must be a string');
    const input = stripComments(sdl);
    const tables = [];
    const typeRe = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^\{]*)\{([\s\S]*?)\}/g;
    let m;
    while ((m = typeRe.exec(input)) !== null) {
      const name = m[1];
      const head = m[2] || '';
      const body = m[3] || '';
      const directives = parseDirectives(head);
      const hasWesTable = directives['wes_table'] || directives['wesley_table'] || directives['table'];
      if (!hasWesTable) continue;
      const columns = parseFields(body);
      // primary key detection
      let primaryKey = null;
      for (const c of columns) {
        if (c.directives['wes_pk'] || c.directives['wesley_pk'] || c.directives['pk']) { primaryKey = c.name; break; }
      }
      tables.push({ name, columns, primaryKey, directives });
    }
    return {
      tables,
      toJSON() { return { tables }; }
    };
  }
}

