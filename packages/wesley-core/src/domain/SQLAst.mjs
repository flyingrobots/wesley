/**
 * SQL AST Domain Model
 * Represents SQL constructs as an abstract syntax tree
 * This enables proper transformation and manipulation without string templates
 */

export class SQLAst {
  constructor() {
    this.statements = [];
  }
  
  addStatement(statement) {
    this.statements.push(statement);
    return this;
  }
  
  toSQL() {
    return this.statements.map(s => s.toSQL()).join('\n\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// TABLE STATEMENTS
// ═══════════════════════════════════════════════════════════════════

export class CreateTableStatement {
  constructor(tableName) {
    this.tableName = tableName;
    this.columns = [];
    this.constraints = [];
    this.ifNotExists = true;
  }
  
  addColumn(column) {
    this.columns.push(column);
    return this;
  }
  
  addConstraint(constraint) {
    this.constraints.push(constraint);
    return this;
  }
  
  toSQL() {
    const parts = [];
    parts.push(`CREATE TABLE${this.ifNotExists ? ' IF NOT EXISTS' : ''} "${this.tableName}" (`);
    
    const items = [
      ...this.columns.map(c => '  ' + c.toSQL()),
      ...this.constraints.map(c => '  ' + c.toSQL())
    ];
    
    parts.push(items.join(',\n'));
    parts.push(');');
    
    return parts.join('\n');
  }
}

export class AlterTableStatement {
  constructor(tableName) {
    this.tableName = tableName;
    this.operations = [];
  }
  
  addOperation(operation) {
    this.operations.push(operation);
    return this;
  }
  
  toSQL() {
    return this.operations
      .map(op => `ALTER TABLE "${this.tableName}" ${op.toSQL()};`)
      .join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// COLUMN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export class ColumnDefinition {
  constructor(name, dataType) {
    this.name = name;
    this.dataType = dataType;
    this.constraints = [];
  }
  
  notNull() {
    this.constraints.push('NOT NULL');
    return this;
  }
  
  defaultValue(expr) {
    this.constraints.push(`DEFAULT ${expr}`);
    return this;
  }
  
  unique() {
    this.constraints.push('UNIQUE');
    return this;
  }
  
  primaryKey() {
    this.constraints.push('PRIMARY KEY');
    return this;
  }
  
  references(table, column = 'id') {
    this.constraints.push(`REFERENCES "${table}"("${column}")`);
    return this;
  }
  
  check(expr) {
    this.constraints.push(`CHECK (${expr})`);
    return this;
  }
  
  toSQL() {
    const parts = [`"${this.name}" ${this.dataType}`];
    if (this.constraints.length > 0) {
      parts.push(this.constraints.join(' '));
    }
    return parts.join(' ');
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONSTRAINTS
// ═══════════════════════════════════════════════════════════════════

export class PrimaryKeyConstraint {
  constructor(columns) {
    this.columns = Array.isArray(columns) ? columns : [columns];
  }
  
  toSQL() {
    return `PRIMARY KEY (${this.columns.map(c => `"${c}"`).join(', ')})`;
  }
}

export class ForeignKeyConstraint {
  constructor(column, refTable, refColumn = 'id') {
    this.column = column;
    this.refTable = refTable;
    this.refColumn = refColumn;
    this.onDelete = 'NO ACTION';
    this.onUpdate = 'NO ACTION';
  }
  
  cascade() {
    this.onDelete = 'CASCADE';
    return this;
  }
  
  setNull() {
    this.onDelete = 'SET NULL';
    return this;
  }
  
  toSQL() {
    return `FOREIGN KEY ("${this.column}") REFERENCES "${this.refTable}"("${this.refColumn}") ` +
           `ON DELETE ${this.onDelete} ON UPDATE ${this.onUpdate}`;
  }
}

export class UniqueConstraint {
  constructor(columns) {
    this.columns = Array.isArray(columns) ? columns : [columns];
  }
  
  toSQL() {
    return `UNIQUE (${this.columns.map(c => `"${c}"`).join(', ')})`;
  }
}

export class CheckConstraint {
  constructor(name, expression) {
    this.name = name;
    this.expression = expression;
  }
  
  toSQL() {
    return `CONSTRAINT "${this.name}" CHECK (${this.expression})`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// INDEX STATEMENTS
// ═══════════════════════════════════════════════════════════════════

export class CreateIndexStatement {
  constructor(indexName, tableName, columns) {
    this.indexName = indexName;
    this.tableName = tableName;
    this.columns = Array.isArray(columns) ? columns : [columns];
    this.unique = false;
    this.ifNotExists = true;
    this.where = null;
  }
  
  setUnique() {
    this.unique = true;
    return this;
  }
  
  whereClause(condition) {
    this.where = condition;
    return this;
  }
  
  toSQL() {
    let sql = `CREATE ${this.unique ? 'UNIQUE ' : ''}INDEX`;
    sql += this.ifNotExists ? ' IF NOT EXISTS' : '';
    sql += ` "${this.indexName}" ON "${this.tableName}"`;
    sql += ` (${this.columns.map(c => `"${c}"`).join(', ')})`;
    
    if (this.where) {
      sql += ` WHERE ${this.where}`;
    }
    
    return sql + ';';
  }
}

// ═══════════════════════════════════════════════════════════════════
// RLS POLICY STATEMENTS
// ═══════════════════════════════════════════════════════════════════

export class EnableRLSStatement {
  constructor(tableName) {
    this.tableName = tableName;
  }
  
  toSQL() {
    return `ALTER TABLE "${this.tableName}" ENABLE ROW LEVEL SECURITY;`;
  }
}

export class CreatePolicyStatement {
  constructor(policyName, tableName) {
    this.policyName = policyName;
    this.tableName = tableName;
    this.command = 'ALL'; // ALL, SELECT, INSERT, UPDATE, DELETE
    this.permissive = true;
    this.roles = [];
    this.using = null;
    this.withCheck = null;
  }
  
  forCommand(command) {
    this.command = command;
    return this;
  }
  
  toRoles(roles) {
    this.roles = Array.isArray(roles) ? roles : [roles];
    return this;
  }
  
  usingExpression(expr) {
    this.using = expr;
    return this;
  }
  
  withCheckExpression(expr) {
    this.withCheck = expr;
    return this;
  }
  
  restrictive() {
    this.permissive = false;
    return this;
  }
  
  toSQL() {
    let sql = `CREATE POLICY "${this.policyName}" ON "${this.tableName}"`;
    
    if (this.permissive === false) {
      sql += ' AS RESTRICTIVE';
    }
    
    sql += ` FOR ${this.command}`;
    
    if (this.roles.length > 0) {
      sql += ` TO ${this.roles.join(', ')}`;
    }
    
    if (this.using) {
      sql += `\n  USING (${this.using})`;
    }
    
    if (this.withCheck) {
      sql += `\n  WITH CHECK (${this.withCheck})`;
    }
    
    return sql + ';';
  }
}

// ═══════════════════════════════════════════════════════════════════
// FUNCTION STATEMENTS
// ═══════════════════════════════════════════════════════════════════

export class CreateFunctionStatement {
  constructor(functionName) {
    this.functionName = functionName;
    this.parameters = [];
    this.returnType = 'void';
    this.language = 'plpgsql';
    this.body = '';
    this.securityDefiner = false;
    this.searchPath = null;
    this.volatility = null; // IMMUTABLE, STABLE, VOLATILE
  }
  
  addParameter(name, type, defaultValue = null) {
    this.parameters.push({ name, type, defaultValue });
    return this;
  }
  
  returns(type) {
    this.returnType = type;
    return this;
  }
  
  setBody(body) {
    this.body = body;
    return this;
  }
  
  setSecurityDefiner() {
    this.securityDefiner = true;
    return this;
  }
  
  setSearchPath(path) {
    this.searchPath = path;
    return this;
  }
  
  stable() {
    this.volatility = 'STABLE';
    return this;
  }
  
  immutable() {
    this.volatility = 'IMMUTABLE';
    return this;
  }
  
  toSQL() {
    const params = this.parameters
      .map(p => {
        let param = `${p.name} ${p.type}`;
        if (p.defaultValue !== null) {
          param += ` DEFAULT ${p.defaultValue}`;
        }
        return param;
      })
      .join(', ');
    
    let sql = `CREATE OR REPLACE FUNCTION ${this.functionName}(${params})\n`;
    sql += `RETURNS ${this.returnType}\n`;
    sql += `LANGUAGE ${this.language}\n`;
    
    if (this.volatility) {
      sql += `${this.volatility}\n`;
    }
    
    if (this.securityDefiner) {
      sql += 'SECURITY DEFINER\n';
    }
    
    if (this.searchPath) {
      sql += `SET search_path = ${this.searchPath}\n`;
    }
    
    sql += 'AS $$\n';
    sql += this.body;
    sql += '\n$$;';
    
    return sql;
  }
}

// ═══════════════════════════════════════════════════════════════════
// GRANT STATEMENTS
// ═══════════════════════════════════════════════════════════════════

export class GrantStatement {
  constructor() {
    this.privileges = [];
    this.objectType = 'TABLE';
    this.objectName = null;
    this.roles = [];
  }
  
  grant(privileges) {
    this.privileges = Array.isArray(privileges) ? privileges : [privileges];
    return this;
  }
  
  on(objectType, objectName) {
    this.objectType = objectType;
    this.objectName = objectName;
    return this;
  }
  
  to(roles) {
    this.roles = Array.isArray(roles) ? roles : [roles];
    return this;
  }
  
  toSQL() {
    const privs = this.privileges.join(', ');
    const roles = this.roles.join(', ');
    return `GRANT ${privs} ON ${this.objectType} ${this.objectName} TO ${roles};`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMMENT STATEMENTS
// ═══════════════════════════════════════════════════════════════════

export class CommentStatement {
  constructor(objectType, objectName, comment) {
    this.objectType = objectType;
    this.objectName = objectName;
    this.comment = comment;
  }
  
  toSQL() {
    return `COMMENT ON ${this.objectType} ${this.objectName} IS '${this.comment}';`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ALTER OPERATIONS
// ═══════════════════════════════════════════════════════════════════

export class AddColumnOperation {
  constructor(column) {
    this.column = column;
    this.ifNotExists = true;
  }
  
  toSQL() {
    const ifNotExists = this.ifNotExists ? 'IF NOT EXISTS ' : '';
    return `ADD COLUMN ${ifNotExists}${this.column.toSQL()}`;
  }
}

export class DropColumnOperation {
  constructor(columnName) {
    this.columnName = columnName;
    this.ifExists = true;
    this.cascade = false;
  }
  
  withCascade() {
    this.cascade = true;
    return this;
  }
  
  toSQL() {
    const ifExists = this.ifExists ? 'IF EXISTS ' : '';
    const cascade = this.cascade ? ' CASCADE' : '';
    return `DROP COLUMN ${ifExists}"${this.columnName}"${cascade}`;
  }
}

export class AlterColumnTypeOperation {
  constructor(columnName, newType) {
    this.columnName = columnName;
    this.newType = newType;
    this.using = null;
  }
  
  usingExpression(expr) {
    this.using = expr;
    return this;
  }
  
  toSQL() {
    let sql = `ALTER COLUMN "${this.columnName}" TYPE ${this.newType}`;
    if (this.using) {
      sql += ` USING ${this.using}`;
    }
    return sql;
  }
}