/**
 * RPC Function Generator V2
 * Generates PostgreSQL functions from Wesley schema mutations/queries.
 */

import { CreateFunctionStatement, ParameterDeclaration } from '../SQLAst.mjs';

export class RPCFunctionGeneratorV2 {
  constructor(evidenceMap, options = {}) {
    this.evidenceMap = evidenceMap;
    this.paramStrategy = options.paramStrategy || 'jsonb';
  }

  async generate(schema) {
    const functions = [];

    for (const table of schema.getTables()) {
      if (table.directives?.['@noRPC']) continue;

      functions.push(this.generateCreateFunction(table));
      functions.push(this.generateUpdateFunction(table));
      functions.push(this.generateDeleteFunction(table));
      functions.push(this.generateListFunction(table));
    }

    return functions.filter(Boolean).join('\n\n');
  }

  generateCreateFunction(table) {
    const funcName = `create_${this.toSnakeCase(table.name)}`;
    const tableName = table.name;
    const returnType = tableName;

    const func = new CreateFunctionStatement(funcName);

    if (this.paramStrategy === 'jsonb') {
      func.addParameter(new ParameterDeclaration('input', 'jsonb'));
    } else {
      for (const field of table.getFields()) {
        if (field.isVirtual() || field.isPrimaryKey()) continue;
        func.addParameter(new ParameterDeclaration(
          this.toSnakeCase(field.name),
          this.getSQLType(field)
        ));
      }
    }

    func.returns(returnType);
    func.language('plpgsql');
    func.securityDefiner(true);
    func.searchPath('public');

    const ownerColumn = this.getOwnerColumn(table);

    let body;
    if (this.paramStrategy === 'jsonb') {
      body = `
DECLARE
  new_record ${returnType};
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO "${tableName}"
  SELECT * FROM jsonb_populate_record(null::${tableName}, input)
  ${ownerColumn ? `OVERRIDING (${ownerColumn}) VALUES (auth.uid())` : ''}
  RETURNING * INTO new_record;

  RETURN new_record;
END;`;
    } else {
      const fields = table.getFields().filter(f => !f.isVirtual() && !f.isPrimaryKey());
      const fieldNames = fields.map(f => `"${f.name}"`).join(', ');
      const fieldValues = fields.map(f => this.toSnakeCase(f.name)).join(', ');

      body = `
DECLARE
  new_record ${returnType};
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO "${tableName}" (${fieldNames})
  VALUES (${fieldValues})
  ${ownerColumn ? `OVERRIDING (${ownerColumn}) VALUES (auth.uid())` : ''}
  RETURNING * INTO new_record;

  RETURN new_record;
END;`;
    }

    func.body(body);

    const grantRoles = table.directives?.['@grant']?.roles || ['authenticated'];
    const sql = func.toSQL();
    const grants = grantRoles.map(role => `GRANT EXECUTE ON FUNCTION ${funcName} TO ${role};`).join('\n');

    return sql + '\n\n' + grants;
  }

  generateUpdateFunction(table) {
    const funcName = `update_${this.toSnakeCase(table.name)}`;
    const tableName = table.name;
    const returnType = tableName;

    const func = new CreateFunctionStatement(funcName);

    const pkField = table.getFields().find(f => f.isPrimaryKey());
    if (!pkField) return null;

    func.addParameter(new ParameterDeclaration('id', this.getSQLType(pkField)));

    if (this.paramStrategy === 'jsonb') {
      func.addParameter(new ParameterDeclaration('updates', 'jsonb'));
    } else {
      for (const field of table.getFields()) {
        if (field.isVirtual() || field.isPrimaryKey()) continue;
        func.addParameter(new ParameterDeclaration(
          this.toSnakeCase(field.name),
          this.getSQLType(field)
        ));
      }
    }

    func.returns(returnType);
    func.language('plpgsql');
    func.securityDefiner(true);

    const ownerColumn = this.getOwnerColumn(table);

    let body;
    if (this.paramStrategy === 'jsonb') {
      body = `
DECLARE
  updated_record ${returnType};
BEGIN
  UPDATE "${tableName}"
  SET ${this.generateJsonbUpdateSet(table)}
  WHERE "${pkField.name}" = id
  ${ownerColumn ? `AND "${ownerColumn}" = auth.uid()` : ''}
  RETURNING * INTO updated_record;

  IF updated_record IS NULL THEN
    RAISE EXCEPTION 'Record not found or unauthorized';
  END IF;

  RETURN updated_record;
END;`;
    } else {
      const fields = table.getFields().filter(f => !f.isVirtual() && !f.isPrimaryKey());
      const setClause = fields.map(f => `"${f.name}" = ${this.toSnakeCase(f.name)}`).join(', ');

      body = `
DECLARE
  updated_record ${returnType};
BEGIN
  UPDATE "${tableName}"
  SET ${setClause}
  WHERE "${pkField.name}" = id
  ${ownerColumn ? `AND "${ownerColumn}" = auth.uid()` : ''}
  RETURNING * INTO updated_record;

  IF updated_record IS NULL THEN
    RAISE EXCEPTION 'Record not found or unauthorized';
  END IF;

  RETURN updated_record;
END;`;
    }

    func.body(body);

    const grantRoles = table.directives?.['@grant']?.roles || ['authenticated'];
    const sql = func.toSQL();
    const grants = grantRoles.map(role => `GRANT EXECUTE ON FUNCTION ${funcName} TO ${role};`).join('\n');

    return sql + '\n\n' + grants;
  }

  generateDeleteFunction(table) {
    const funcName = `delete_${this.toSnakeCase(table.name)}`;
    const tableName = table.name;
    const returnType = 'boolean';

    const func = new CreateFunctionStatement(funcName);

    const pkField = table.getFields().find(f => f.isPrimaryKey());
    if (!pkField) return null;

    func.addParameter(new ParameterDeclaration('id', this.getSQLType(pkField)));
    func.returns(returnType);
    func.language('plpgsql');
    func.securityDefiner(true);

    const ownerColumn = this.getOwnerColumn(table);

    const body = `
BEGIN
  DELETE FROM "${tableName}"
  WHERE "${pkField.name}" = id
  ${ownerColumn ? `AND "${ownerColumn}" = auth.uid()` : ''};

  RETURN FOUND;
END;`;

    func.body(body);

    const grantRoles = table.directives?.['@grant']?.roles || ['authenticated'];
    const sql = func.toSQL();
    const grants = grantRoles.map(role => `GRANT EXECUTE ON FUNCTION ${funcName} TO ${role};`).join('\n');

    return sql + '\n\n' + grants;
  }

  generateListFunction(table) {
    const funcName = `list_${this.toSnakeCase(table.name)}`;
    const tableName = table.name;
    const returnType = `SETOF ${tableName}`;

    const func = new CreateFunctionStatement(funcName);
    func.addParameter(new ParameterDeclaration('filters', 'jsonb', 'null'));
    func.returns(returnType);
    func.language('plpgsql');
    func.securityDefiner(true);

    const body = `
BEGIN
  RETURN QUERY
  SELECT * FROM "${tableName}"
  WHERE (filters IS NULL OR to_jsonb("${tableName}".*) @> filters);
END;`;

    func.body(body);

    const grantRoles = table.directives?.['@grant']?.roles || ['authenticated', 'anon'];
    const sql = func.toSQL();
    const grants = grantRoles.map(role => `GRANT EXECUTE ON FUNCTION ${funcName} TO ${role};`).join('\n');

    return sql + '\n\n' + grants;
  }

  getOwnerColumn(table) {
    const ownerDirective = table.directives?.['@owner'];
    if (ownerDirective?.column) {
      return ownerDirective.column;
    }

    const rlsConfig = table.directives?.['@rls'];
    if (rlsConfig?.insert?.includes('auth.uid()')) {
      const match = /auth\.uid\(\)\s*=\s*"?(\w+)"?/.exec(rlsConfig.insert);
      if (match) return match[1];
    }

    for (const field of table.getFields()) {
      if (['user_id', 'owner_id', 'created_by', 'author_id'].includes(field.name)) {
        return field.name;
      }
    }

    return null;
  }

  generateJsonbUpdateSet(table) {
    const fields = table.getFields().filter(f => !f.isVirtual() && !f.isPrimaryKey());
    return fields.map(f => `"${f.name}" = COALESCE(updates->>'${f.name}', "${f.name}")`).join(',\n    ');
  }

  getSQLType(field) {
    const typeMap = {
      ID: 'uuid',
      String: 'text',
      Int: 'integer',
      Float: 'double precision',
      Boolean: 'boolean',
      DateTime: 'timestamptz',
      JSON: 'jsonb'
    };

    const baseType = typeMap[field.type] || 'text';
    return field.list ? `${baseType}[]` : baseType;
  }

  toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}
