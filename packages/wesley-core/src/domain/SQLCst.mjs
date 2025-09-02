/**
 * SQL CST (Concrete Syntax Tree) Domain Model
 * Preserves all syntactic details for SQL generation
 * GraphQL AST → Domain IR → SQL CST → SQL Text
 */

// ═══════════════════════════════════════════════════════════════════
// CST NODE BASE CLASSES
// ═══════════════════════════════════════════════════════════════════

export class CSTNode {
  constructor(type) {
    this.type = type;
    this.children = [];
    this.tokens = [];
    this.leadingWhitespace = '';
    this.trailingWhitespace = '';
    this.comments = [];
  }
  
  addChild(child) {
    this.children.push(child);
    return this;
  }
  
  addToken(token) {
    this.tokens.push(token);
    return this;
  }
  
  addComment(comment) {
    this.comments.push(comment);
    return this;
  }
  
  render() {
    // Override in subclasses
    throw new Error('render() must be implemented');
  }
}

export class Token {
  constructor(type, value) {
    this.type = type;
    this.value = value;
    this.leadingSpace = '';
    this.trailingSpace = '';
  }
  
  render() {
    return this.leadingSpace + this.value + this.trailingSpace;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SQL PROGRAM CST (ROOT)
// ═══════════════════════════════════════════════════════════════════

export class SQLProgramCST extends CSTNode {
  constructor() {
    super('SQLProgram');
    this.statements = [];
  }
  
  addStatement(statement) {
    this.statements.push(statement);
    return this;
  }
  
  render() {
    return this.statements
      .map(stmt => stmt.render())
      .join('\n\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// CREATE TABLE CST
// ═══════════════════════════════════════════════════════════════════

export class CreateTableCST extends CSTNode {
  constructor(tableName) {
    super('CreateTable');
    this.createToken = new Token('KEYWORD', 'CREATE');
    this.tableToken = new Token('KEYWORD', 'TABLE');
    this.ifNotExistsTokens = null;
    this.tableName = new IdentifierCST(tableName);
    this.leftParen = new Token('PUNCTUATION', '(');
    this.rightParen = new Token('PUNCTUATION', ')');
    this.semicolon = new Token('PUNCTUATION', ';');
    this.columnDefs = [];
    this.constraints = [];
  }
  
  setIfNotExists() {
    this.ifNotExistsTokens = [
      new Token('KEYWORD', 'IF'),
      new Token('KEYWORD', 'NOT'),
      new Token('KEYWORD', 'EXISTS')
    ];
    return this;
  }
  
  addColumn(columnDef) {
    this.columnDefs.push(columnDef);
    return this;
  }
  
  addConstraint(constraint) {
    this.constraints.push(constraint);
    return this;
  }
  
  render() {
    let sql = this.createToken.render() + ' ' + this.tableToken.render();
    
    if (this.ifNotExistsTokens) {
      sql += ' ' + this.ifNotExistsTokens.map(t => t.render()).join(' ');
    }
    
    sql += ' ' + this.tableName.render() + ' ' + this.leftParen.render() + '\n';
    
    const items = [...this.columnDefs, ...this.constraints];
    sql += items.map((item, idx) => {
      const comma = idx < items.length - 1 ? ',' : '';
      return '  ' + item.render() + comma;
    }).join('\n');
    
    sql += '\n' + this.rightParen.render() + this.semicolon.render();
    
    return sql;
  }
}

// ═══════════════════════════════════════════════════════════════════
// COLUMN DEFINITION CST
// ═══════════════════════════════════════════════════════════════════

export class ColumnDefinitionCST extends CSTNode {
  constructor(name, dataType) {
    super('ColumnDefinition');
    this.columnName = new IdentifierCST(name);
    this.dataType = new DataTypeCST(dataType);
    this.constraints = [];
  }
  
  addConstraint(constraint) {
    this.constraints.push(constraint);
    return this;
  }
  
  render() {
    let sql = this.columnName.render() + ' ' + this.dataType.render();
    
    if (this.constraints.length > 0) {
      sql += ' ' + this.constraints.map(c => c.render()).join(' ');
    }
    
    return sql;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DATA TYPE CST
// ═══════════════════════════════════════════════════════════════════

export class DataTypeCST extends CSTNode {
  constructor(typeName, parameters = []) {
    super('DataType');
    this.typeName = new Token('TYPE', typeName);
    this.parameters = parameters;
  }
  
  render() {
    let sql = this.typeName.render();
    
    if (this.parameters.length > 0) {
      sql += '(' + this.parameters.join(', ') + ')';
    }
    
    return sql;
  }
}

// ═══════════════════════════════════════════════════════════════════
// IDENTIFIER CST
// ═══════════════════════════════════════════════════════════════════

export class IdentifierCST extends CSTNode {
  constructor(name, quoted = true) {
    super('Identifier');
    this.name = name;
    this.quoted = quoted;
  }
  
  render() {
    if (this.quoted) {
      return '"' + this.name + '"';
    }
    return this.name;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONSTRAINT CST NODES
// ═══════════════════════════════════════════════════════════════════

export class NotNullConstraintCST extends CSTNode {
  constructor() {
    super('NotNullConstraint');
    this.notToken = new Token('KEYWORD', 'NOT');
    this.nullToken = new Token('KEYWORD', 'NULL');
  }
  
  render() {
    return this.notToken.render() + ' ' + this.nullToken.render();
  }
}

export class DefaultConstraintCST extends CSTNode {
  constructor(expression) {
    super('DefaultConstraint');
    this.defaultToken = new Token('KEYWORD', 'DEFAULT');
    this.expression = new ExpressionCST(expression);
  }
  
  render() {
    return this.defaultToken.render() + ' ' + this.expression.render();
  }
}

export class PrimaryKeyConstraintCST extends CSTNode {
  constructor(columns = []) {
    super('PrimaryKeyConstraint');
    this.primaryToken = new Token('KEYWORD', 'PRIMARY');
    this.keyToken = new Token('KEYWORD', 'KEY');
    this.columns = columns.map(c => new IdentifierCST(c));
  }
  
  render() {
    let sql = this.primaryToken.render() + ' ' + this.keyToken.render();
    
    if (this.columns.length > 0) {
      sql += ' (' + this.columns.map(c => c.render()).join(', ') + ')';
    }
    
    return sql;
  }
}

export class ForeignKeyConstraintCST extends CSTNode {
  constructor(column, refTable, refColumn) {
    super('ForeignKeyConstraint');
    this.foreignToken = new Token('KEYWORD', 'FOREIGN');
    this.keyToken = new Token('KEYWORD', 'KEY');
    this.column = new IdentifierCST(column);
    this.referencesToken = new Token('KEYWORD', 'REFERENCES');
    this.refTable = new IdentifierCST(refTable);
    this.refColumn = new IdentifierCST(refColumn);
    this.onDelete = null;
    this.onUpdate = null;
  }
  
  setOnDelete(action) {
    this.onDelete = {
      onToken: new Token('KEYWORD', 'ON'),
      deleteToken: new Token('KEYWORD', 'DELETE'),
      action: new Token('KEYWORD', action)
    };
    return this;
  }
  
  render() {
    let sql = this.foreignToken.render() + ' ' + this.keyToken.render();
    sql += ' (' + this.column.render() + ')';
    sql += ' ' + this.referencesToken.render();
    sql += ' ' + this.refTable.render();
    sql += '(' + this.refColumn.render() + ')';
    
    if (this.onDelete) {
      sql += ' ' + this.onDelete.onToken.render();
      sql += ' ' + this.onDelete.deleteToken.render();
      sql += ' ' + this.onDelete.action.render();
    }
    
    return sql;
  }
}

// ═══════════════════════════════════════════════════════════════════
// RLS POLICY CST
// ═══════════════════════════════════════════════════════════════════

export class CreatePolicyCST extends CSTNode {
  constructor(policyName, tableName) {
    super('CreatePolicy');
    this.createToken = new Token('KEYWORD', 'CREATE');
    this.policyToken = new Token('KEYWORD', 'POLICY');
    this.policyName = new IdentifierCST(policyName);
    this.onToken = new Token('KEYWORD', 'ON');
    this.tableName = new IdentifierCST(tableName);
    this.forCommand = null;
    this.usingClause = null;
    this.withCheckClause = null;
    this.semicolon = new Token('PUNCTUATION', ';');
  }
  
  setForCommand(command) {
    this.forCommand = {
      forToken: new Token('KEYWORD', 'FOR'),
      command: new Token('KEYWORD', command)
    };
    return this;
  }
  
  setUsing(expression) {
    this.usingClause = {
      usingToken: new Token('KEYWORD', 'USING'),
      leftParen: new Token('PUNCTUATION', '('),
      expression: new ExpressionCST(expression),
      rightParen: new Token('PUNCTUATION', ')')
    };
    return this;
  }
  
  setWithCheck(expression) {
    this.withCheckClause = {
      withToken: new Token('KEYWORD', 'WITH'),
      checkToken: new Token('KEYWORD', 'CHECK'),
      leftParen: new Token('PUNCTUATION', '('),
      expression: new ExpressionCST(expression),
      rightParen: new Token('PUNCTUATION', ')')
    };
    return this;
  }
  
  render() {
    let sql = this.createToken.render() + ' ' + this.policyToken.render();
    sql += ' ' + this.policyName.render();
    sql += ' ' + this.onToken.render() + ' ' + this.tableName.render();
    
    if (this.forCommand) {
      sql += '\n  ' + this.forCommand.forToken.render();
      sql += ' ' + this.forCommand.command.render();
    }
    
    if (this.usingClause) {
      sql += '\n  ' + this.usingClause.usingToken.render();
      sql += ' ' + this.usingClause.leftParen.render();
      sql += this.usingClause.expression.render();
      sql += this.usingClause.rightParen.render();
    }
    
    if (this.withCheckClause) {
      sql += '\n  ' + this.withCheckClause.withToken.render();
      sql += ' ' + this.withCheckClause.checkToken.render();
      sql += ' ' + this.withCheckClause.leftParen.render();
      sql += this.withCheckClause.expression.render();
      sql += this.withCheckClause.rightParen.render();
    }
    
    sql += this.semicolon.render();
    
    return sql;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPRESSION CST
// ═══════════════════════════════════════════════════════════════════

export class ExpressionCST extends CSTNode {
  constructor(expression) {
    super('Expression');
    this.expression = expression;
  }
  
  render() {
    // For now, just return the expression as-is
    // In a full implementation, this would parse and render the expression tree
    return this.expression;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CREATE FUNCTION CST
// ═══════════════════════════════════════════════════════════════════

export class CreateFunctionCST extends CSTNode {
  constructor(functionName) {
    super('CreateFunction');
    this.createOrReplaceTokens = [
      new Token('KEYWORD', 'CREATE'),
      new Token('KEYWORD', 'OR'),
      new Token('KEYWORD', 'REPLACE'),
      new Token('KEYWORD', 'FUNCTION')
    ];
    this.functionName = new IdentifierCST(functionName, false);
    this.parameters = [];
    this.returnType = null;
    this.language = null;
    this.body = null;
    this.securityDefiner = false;
    this.searchPath = null;
  }
  
  addParameter(name, type, defaultValue = null) {
    this.parameters.push({
      name: new IdentifierCST(name, false),
      type: new DataTypeCST(type),
      default: defaultValue
    });
    return this;
  }
  
  setReturns(type) {
    this.returnType = new DataTypeCST(type);
    return this;
  }
  
  setLanguage(lang) {
    this.language = new Token('IDENTIFIER', lang);
    return this;
  }
  
  setBody(body) {
    this.body = body;
    return this;
  }
  
  render() {
    let sql = this.createOrReplaceTokens.map(t => t.render()).join(' ');
    sql += ' ' + this.functionName.render();
    
    // Parameters
    sql += '(';
    sql += this.parameters.map(p => {
      let param = p.name.render() + ' ' + p.type.render();
      if (p.default) {
        param += ' DEFAULT ' + p.default;
      }
      return param;
    }).join(', ');
    sql += ')';
    
    // Return type
    sql += '\nRETURNS ' + this.returnType.render();
    
    // Language
    sql += '\nLANGUAGE ' + this.language.render();
    
    // Security definer
    if (this.securityDefiner) {
      sql += '\nSECURITY DEFINER';
    }
    
    // Search path
    if (this.searchPath) {
      sql += '\nSET search_path = ' + this.searchPath;
    }
    
    // Body
    sql += '\nAS $$\n';
    sql += this.body;
    sql += '\n$$;';
    
    return sql;
  }
}