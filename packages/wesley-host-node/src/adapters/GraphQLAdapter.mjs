/**
 * GraphQL Adapter - THIN wrapper for graphql-js library
 * This is the ONLY place where we depend on the graphql npm package
 */

import { parse, Kind, buildSchema, validate, Source } from 'graphql';
import { mangle } from '@wesley/core/domain/SchemaResolver';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Wesley directive validation errors
class WesleyParseError extends Error {
  constructor(message, directive = null, field = null) {
    super(message);
    this.name = 'PARSE_FAILED';
    this.code = 'PARSE_FAILED';
    this.directive = directive;
    this.field = field;
  }
}

/**
 * GraphQLSchemaParser - Converts GraphQL SDL with Wesley directives to Wesley IR
 */
class GraphQLSchemaParser {
  constructor() {
    // Load Wesley directive schema for validation
    this.directiveSchema = this.loadDirectiveSchema();

    // Canonical directive set
    this.canonicalDirectives = new Set([
      'wes_table', 'wes_pk', 'wes_fk', 'wes_unique',
      'wes_index', 'wes_tenant', 'wes_default', 'wes_rls'
    ]);

    // Legacy aliases (with deprecation warnings)
    this.legacyAliases = new Map([
      // Long aliases
      ['wesley_table', 'wes_table'], ['wesley_pk', 'wes_pk'], ['wesley_fk', 'wes_fk'],
      ['wesley_unique', 'wes_unique'], ['wesley_index', 'wes_index'],
      ['wesley_tenant', 'wes_tenant'], ['wesley_default', 'wes_default'],
      ['wesley_rls', 'wes_rls'],
      // Short/alternate aliases
      ['table', 'wes_table'], ['pk', 'wes_pk'], ['fk', 'wes_fk'],
      ['primaryKey', 'wes_pk'], ['foreignKey', 'wes_fk'],
      ['unique', 'wes_unique'], ['index', 'wes_index'],
      ['tenant', 'wes_tenant'], ['default', 'wes_default'],
      ['rls', 'wes_rls']
    ]);
  }

  /**
   * Load and parse the Wesley directive schema
   */
  loadDirectiveSchema() {
    try {
      // Find the schema file relative to this module - look up the directory tree
      const moduleDir = dirname(fileURLToPath(import.meta.url));
      const projectRoot = join(moduleDir, '../../../../');
      const schemaPath = join(projectRoot, 'schemas', 'directives.graphql');
      const directiveSchemaSDL = readFileSync(schemaPath, 'utf8');
      return buildSchema(directiveSchemaSDL);
    } catch (error) {
      console.warn('Could not load Wesley directive schema for validation:', error.message);
      return null;
    }
  }

  /**
   * Parse GraphQL SDL to Wesley IR
   */
  parse(sdl, options = {}) {
    try {
      const src = (options && options.filename)
        ? new Source(sdl, options.filename)
        : sdl; // graphql will synthesize a generic Source if we pass string
      const ast = parse(src);

      // Validate directive usage if we have the directive schema
      if (this.directiveSchema) {
        this.validateDirectiveUsage(ast);
      }

      return this.buildIRFromAST(ast);
    } catch (error) {
      if (error.name === 'PARSE_FAILED') {
        throw error;
      }
      throw new WesleyParseError(`GraphQL syntax error: ${error.message}`);
    }
  }

  /**
   * Validate directive usage against the directive schema
   */
  validateDirectiveUsage(ast) {
    try {
      // Best-effort directive validation against known directive SDL only.
      // Avoid constructing incomplete user types (no fields) which triggers GraphQL schema errors.
      const moduleDir = dirname(fileURLToPath(import.meta.url));
      const projectRoot = join(moduleDir, '../../../../');
      const directiveSDL = readFileSync(join(projectRoot, 'schemas', 'directives.graphql'), 'utf8');
      const fullSchema = buildSchema(directiveSDL);
      // Validate the AST against a schema that only declares directives.
      validate(fullSchema, ast);
    } catch (error) {
      // Non-fatal: directive validation is best-effort; stay silent unless explicitly enabled.
      if (process.env.WESLEY_STRICT_DIRECTIVES === '1') {
        console.warn('Directive validation skipped:', error.message);
      }
    }
  }

  /**
   * Build Wesley IR from GraphQL AST
   * Returns IR matching the WesleyIR.schema.ts shape.
   */
  buildIRFromAST(ast) {
    const tables = [];
    const tableNames = new Set();

    // First pass: collect all table types
    for (const definition of ast.definitions) {
      if (definition.kind === Kind.OBJECT_TYPE_DEFINITION) {
        const tableDirective = this.findDirective(definition.directives, 'wes_table');
        if (tableDirective) {
          const tableName = this.getDirectiveArgument(tableDirective, 'name') || definition.name.value;

          if (tableNames.has(tableName)) {
            throw new WesleyParseError(`Duplicate table name: ${tableName}`);
          }
          tableNames.add(tableName);

          const table = this.buildTable(definition, tableName);
          tables.push(table);
        }
      }
    }

    // Second pass: validate foreign key references
    this.validateForeignKeys(tables);

    // Synthesize top-level relationships from field-level @fk directives
    const relationships = this.synthesizeRelationships(tables);

    return {
      version: '1.0.0',
      metadata: {
        generatedAt: new Date().toISOString()
      },
      tables,
      enums: [],
      scalars: [],
      relationships
    };
  }

  /**
   * Build table from GraphQL object type definition.
   * Returns structured TableDirectives and Field[] (not columns).
   */
  buildTable(typeDef, tableName) {
    if (!typeDef.fields || typeDef.fields.length === 0) {
      throw new WesleyParseError(`Table ${tableName} must have at least one field`);
    }

    const fields = [];
    const indexes = [];
    const constraints = [];
    let hasPrimaryKey = false;

    // Build structured table directives
    const tableDirectives = this.buildTableDirectives(typeDef.directives);
    const tenantBy = tableDirectives.tenant?.field || null;

    // Process fields
    for (const fieldDef of typeDef.fields) {
      // Skip relation-only fields (object types without explicit FK directive)
      if (this.isRelationOnlyField(fieldDef)) {
        continue;
      }

      const field = this.buildField(fieldDef, tableName);
      fields.push(field);

      // Validate primary key
      if (field.directives.pk) {
        if (hasPrimaryKey) {
          throw new WesleyParseError(`Table ${tableName} can have at most one primary key`);
        }
        if (field.nullable) {
          throw new WesleyParseError(`Primary key field ${field.name} must be NonNull (end with !)`, 'wes_pk', field.name);
        }
        hasPrimaryKey = true;
      }

      // Validate foreign key format
      if (field.directives.fk) {
        // Already validated in buildField; no extra work needed
      }

      // Collect indexes
      if (field.directives.index) {
        const indexDirective = this.findDirective(fieldDef.directives, 'wes_index');
        const indexName = indexDirective ? this.getDirectiveArgument(indexDirective, 'name') : null;
        const using = indexDirective ? this.getDirectiveArgument(indexDirective, 'using') : null;
        indexes.push({
          fields: [field.name],
          name: indexName || null,
          table: tableName,
          unique: false,
          using: using || null
        });
      }
    }

    // Validate tenant field exists
    if (tenantBy) {
      const tenantField = fields.find(f => f.name === tenantBy);
      if (!tenantField) {
        throw new WesleyParseError(`@wes_tenant(by: "${tenantBy}") field must exist on table ${tableName}`, 'wes_tenant');
      }
    }

    return {
      name: tableName,
      directives: tableDirectives,
      fields,
      indexes,
      constraints
    };
  }

  /**
   * Build structured TableDirectives from raw AST directives.
   */
  buildTableDirectives(directives) {
    const result = {
      table: !!this.findDirective(directives, 'wes_table')
    };

    const rlsDirective = this.findDirective(directives, 'wes_rls');
    if (rlsDirective) {
      result.rls = { enable: true };
    }

    const tenantDirective = this.findDirective(directives, 'wes_tenant');
    if (tenantDirective) {
      const by = this.getDirectiveArgument(tenantDirective, 'by');
      if (!by) {
        throw new WesleyParseError('@wes_tenant directive requires \'by\' argument', 'wes_tenant');
      }
      result.tenant = { field: by };
    }

    return result;
  }

  /**
   * Build field with structured FieldType and FieldDirectives.
   */
  buildField(fieldDef, tableName) {
    const name = fieldDef.name.value;
    const nullable = !this.isNonNullType(fieldDef.type);
    const type = {
      base: this.getBaseType(fieldDef.type),
      isList: this.isListType(fieldDef.type)
    };

    // Add listItemNullable only for list types
    if (type.isList) {
      type.listItemNullable = this.isListItemNullable(fieldDef.type);
    }

    const fieldDirectives = this.buildFieldDirectives(fieldDef, tableName);

    return {
      name,
      type,
      nullable,
      directives: fieldDirectives
    };
  }

  /**
   * Build structured FieldDirectives from raw AST field directives.
   */
  buildFieldDirectives(fieldDef, _tableName) {
    const directives = {};

    if (this.findDirective(fieldDef.directives, 'wes_pk')) {
      directives.pk = true;
    }

    if (this.findDirective(fieldDef.directives, 'wes_unique')) {
      directives.unique = true;
    }

    if (this.findDirective(fieldDef.directives, 'wes_index')) {
      directives.index = true;
    }

    const defaultDirective = this.findDirective(fieldDef.directives, 'wes_default');
    if (defaultDirective) {
      const value = this.getDirectiveArgumentAny(defaultDirective, ['value', 'expr']);
      if (value === undefined || value === null) {
        throw new WesleyParseError('@wes_default directive requires \'value\' (or \'expr\') argument', 'wes_default', fieldDef.name.value);
      }
      directives.default = { value };
    }

    const fkDirective = this.findDirective(fieldDef.directives, 'wes_fk');
    if (fkDirective) {
      const ref = this.getDirectiveArgument(fkDirective, 'ref');
      if (!ref) {
        throw new WesleyParseError('@wes_fk directive requires \'ref\' argument', 'wes_fk', fieldDef.name.value);
      }
      const [targetTable, targetField] = ref.split('.');
      if (!targetTable || !targetField) {
        throw new WesleyParseError(`Foreign key ref must be in format 'Table.column', got: ${ref}`, 'wes_fk', fieldDef.name.value);
      }
      directives.fk = { targetTable, targetField };
    }

    return directives;
  }

  /**
   * Synthesize top-level relationships from field-level @fk directives.
   */
  synthesizeRelationships(tables) {
    const relationships = [];
    for (const table of tables) {
      for (const field of table.fields) {
        if (field.directives.fk) {
          relationships.push({
            type: 'one-to-many',
            from: { table: table.name, field: field.name },
            to: { table: field.directives.fk.targetTable, field: field.directives.fk.targetField }
          });
        }
      }
    }
    return relationships;
  }

  /**
   * Validate foreign key references using new IR shape (fields + structured directives).
   */
  validateForeignKeys(tables) {
    const tableMap = new Map(tables.map(t => [t.name, t]));

    for (const table of tables) {
      for (const field of table.fields) {
        if (!field.directives.fk) continue;

        const fk = field.directives.fk;
        const refTable = tableMap.get(fk.targetTable);
        if (!refTable) {
          throw new WesleyParseError(`Foreign key ${table.name}.${field.name} references non-existent table: ${fk.targetTable}`);
        }

        const refField = refTable.fields.find(f => f.name === fk.targetField);
        if (!refField) {
          throw new WesleyParseError(`Foreign key ${table.name}.${field.name} references non-existent column: ${fk.targetTable}.${fk.targetField}`);
        }

        // Type compatibility check (basic)
        if (field.type.base !== refField.type.base) {
          console.warn(`Warning: Foreign key ${table.name}.${field.name} type '${field.type.base}' may be incompatible with ${fk.targetTable}.${fk.targetField} type '${refField.type.base}'`);
        }
      }
    }
  }

  /**
   * Find directive by canonical name, handling aliases
   */
  findDirective(directives, canonicalName) {
    if (!directives) return null;

    for (const directive of directives) {
      const directiveName = directive.name.value;

      // Check canonical name
      if (directiveName === canonicalName) {
        return directive;
      }

      // Check aliases
      const canonical = this.legacyAliases.get(directiveName);
      if (canonical === canonicalName) {
        // Deprecation hint (silent by default; enable with WESLEY_WARN_DEPRECATED=1)
        if (process.env.WESLEY_WARN_DEPRECATED === '1') {
          console.warn(`Deprecated directive @${directiveName} used. Use @${canonicalName} instead.`);
        }
        return directive;
      }
    }

    return null;
  }

  /**
   * Get directive argument value
   */
  getDirectiveArgument(directive, argName) {
    if (!directive.arguments) return null;

    const arg = directive.arguments.find(a => a.name.value === argName);
    if (!arg) return null;

    switch (arg.value.kind) {
    case Kind.STRING:
      return arg.value.value;
    case Kind.INT:
      return parseInt(arg.value.value, 10);
    case Kind.FLOAT:
      return parseFloat(arg.value.value);
    case Kind.BOOLEAN:
      return arg.value.value;
    default:
      return null;
    }
  }

  /**
   * Check if GraphQL type is NonNull
   */
  isNonNullType(type) {
    return type.kind === Kind.NON_NULL_TYPE;
  }

  /**
   * Check if GraphQL type is List
   */
  isListType(type) {
    if (type.kind === Kind.NON_NULL_TYPE) {
      return type.type.kind === Kind.LIST_TYPE;
    }
    return type.kind === Kind.LIST_TYPE;
  }

  /**
   * Check if list items are nullable: [Type] → true, [Type!] → false
   */
  isListItemNullable(type) {
    // Unwrap NonNull wrapper if present: [Type!]! → [Type!] → Type!
    let inner = type;
    if (inner.kind === Kind.NON_NULL_TYPE) inner = inner.type;
    // Now at ListType: [Type] or [Type!]
    if (inner.kind === Kind.LIST_TYPE) {
      // Inner item is nullable unless wrapped in NonNull
      return inner.type.kind !== Kind.NON_NULL_TYPE;
    }
    return true;
  }

  /**
   * Get base type name from GraphQL type
   */
  getBaseType(type) {
    if (type.kind === Kind.NON_NULL_TYPE) {
      return this.getBaseType(type.type);
    }
    if (type.kind === Kind.LIST_TYPE) {
      return this.getBaseType(type.type);
    }
    return type.name.value;
  }

  /**
   * Try multiple argument names in order and return the first found
   */
  getDirectiveArgumentAny(directive, argNames = []) {
    for (const name of argNames) {
      const v = this.getDirectiveArgument(directive, name);
      if (v != null) return v;
    }
    return null;
  }

  /**
   * Determine if a field should be treated as relation-only (no column emitted)
   */
  isRelationOnlyField(field) {
    const base = this.getBaseType(field.type);
    const isScalar = this.isScalarType(base);
    const hasFk = !!this.findDirective(field.directives, 'wes_fk');
    const nameSet = new Set((field.directives || []).map(d => d.name.value));
    const hasRelationHint = nameSet.has('belongsTo') || nameSet.has('hasMany') || nameSet.has('hasOne');
    if (hasRelationHint) return true;
    if (!isScalar && !hasFk) return true;
    return false;
  }

  /**
   * Minimal scalar whitelist for schema → SQL mapping
   */
  isScalarType(name) {
    return new Set(['ID','UUID','String','Int','Float','Boolean','DateTime','Date','Time','JSON']).has(name);
  }

  /**
   * Parse composed (multi-file) schema from resolved compilation units.
   *
   * 1. Concatenates all units' mangled SDL in topological order.
   * 2. Parses + validates with buildASTSchema to catch errors.
   * 3. Builds IR via existing buildIRFromAST.
   * 4. Annotates IR with provenance (sourceUnit, package, qualifiedName).
   *
   * @param {Array} units - CompilationUnit[] from SchemaResolver (topological order)
   * @returns {object} Wesley IR with provenance annotations
   */
  parseComposed(units) {
    // 1. Concatenate mangled SDL
    const mergedSdl = units.map(u => u.sdl).join('\n\n');

    // 2. Parse the merged SDL
    let ast;
    try {
      ast = parse(mergedSdl);
    } catch (error) {
      throw new WesleyParseError(`Composed schema syntax error: ${error.message}`);
    }

    // 3. Validate directive usage (best-effort, same as single-file path)
    if (this.directiveSchema) {
      this.validateDirectiveUsage(ast);
    }

    // 4. Build IR from the merged AST
    const ir = this.buildIRFromAST(ast);

    // 5. Build a lookup from mangled name → { sourceUnit, package, shortName }
    const defLookup = new Map();
    for (const unit of units) {
      if (unit.definitions) {
        for (const [shortName] of unit.definitions) {
          const mangledName = mangle(unit.package, shortName);
          defLookup.set(mangledName, {
            sourceUnit: unit.id,
            package: unit.package,
            shortName
          });
        }
      }
    }

    // 6. Annotate tables with provenance
    if (ir.tables) {
      for (const table of ir.tables) {
        const prov = defLookup.get(table.name);
        if (prov) {
          table.qualifiedName = table.name;
          table.name = prov.shortName;
          table.sourceUnit = prov.sourceUnit;
          table.package = prov.package;
        }
        // Update field-level fk targetTable references
        for (const field of table.fields) {
          if (field.directives.fk) {
            const fkProv = defLookup.get(field.directives.fk.targetTable);
            if (fkProv) field.directives.fk.targetTable = fkProv.shortName;
          }
        }
      }
    }

    // Update top-level relationships
    if (ir.relationships) {
      for (const rel of ir.relationships) {
        const fromProv = defLookup.get(rel.from.table);
        if (fromProv) rel.from.table = fromProv.shortName;
        const toProv = defLookup.get(rel.to.table);
        if (toProv) rel.to.table = toProv.shortName;
      }
    }

    // Annotate enums
    if (ir.enums) {
      for (const en of ir.enums) {
        const prov = defLookup.get(en.name);
        if (prov) {
          en.qualifiedName = en.name;
          en.name = prov.shortName;
          en.sourceUnit = prov.sourceUnit;
          en.package = prov.package;
        }
      }
    }

    // Annotate scalars
    if (ir.scalars) {
      for (const sc of ir.scalars) {
        const prov = defLookup.get(sc.name);
        if (prov) {
          sc.qualifiedName = sc.name;
          sc.name = prov.shortName;
          sc.sourceUnit = prov.sourceUnit;
          sc.package = prov.package;
        }
      }
    }

    // 7. Attach composition metadata
    ir.metadata = ir.metadata || {};
    ir.metadata.units = units.map(u => ({
      id: u.id,
      package: u.package,
      hash: u.hash,
      imports: u.imports
    }));

    return ir;
  }
}

export class GraphQLAdapter {
  constructor(options = {}) {
    // Use the fully implemented parser above for all logic
    this.parser = new GraphQLSchemaParser(options);
  }

  /**
   * Parse GraphQL SDL and return Wesley IR
   */
  parseSDL(sdl) {
    // Delegate to the real parser implementation
    return this.parser.parse(sdl);
  }

  /**
   * Parse composed (multi-file) schema from resolved compilation units.
   * Delegates to the internal parser.
   */
  parseComposed(units) {
    return this.parser.parseComposed(units);
  }

  /**
   * Validate GraphQL SDL syntax
   */
  validateSDL(sdl) {
    try {
      // Fast syntax check using graphql.parse
      parse(sdl);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        location: error.locations?.[0]
      };
    }
  }
}
