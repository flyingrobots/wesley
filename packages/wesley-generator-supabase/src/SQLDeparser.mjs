/**
 * SQLDeparser - Custom PostgreSQL AST to SQL deparser
 * 
 * The @supabase/pg-parser only provides parsing (SQL -> AST) but no deparser (AST -> SQL).
 * This custom deparser handles the Supabase parser's AST format and converts it back to SQL.
 */

export class SQLDeparser {
  constructor() {
    this.indentLevel = 0;
    this.indentSize = 2;
  }

  /**
   * Main deparse method - converts AST back to SQL
   */
  deparse(ast) {
    if (!ast || !Array.isArray(ast)) {
      throw new Error('Invalid AST: expected array of statements');
    }

    const statements = [];
    for (const stmt of ast) {
      if (stmt && typeof stmt === 'object') {
        const sql = this.deparseStatement(stmt);
        if (sql) {
          statements.push(sql);
        }
      }
    }

    return statements.join('\n\n');
  }

  /**
   * Deparse a single statement
   */
  deparseStatement(stmt) {
    if (!stmt || typeof stmt !== 'object') {
      return '';
    }

    // Handle different statement types
    switch (true) {
      case this.isCreateTable(stmt):
        return this.deparseCreateTable(stmt);
      case this.isCreateIndex(stmt):
        return this.deparseCreateIndex(stmt);
      case this.isCreatePolicy(stmt):
        return this.deparseCreatePolicy(stmt);
      case this.isAlterTable(stmt):
        return this.deparseAlterTable(stmt);
      case this.isComment(stmt):
        return this.deparseComment(stmt);
      default:
        console.warn('SQLDeparser: Unknown statement type:', Object.keys(stmt));
        return '';
    }
  }

  /**
   * Check if statement is CREATE TABLE
   */
  isCreateTable(stmt) {
    return stmt.CreateStmt || stmt.create_table || stmt.createStmt;
  }

  /**
   * Check if statement is CREATE INDEX
   */
  isCreateIndex(stmt) {
    return stmt.IndexStmt || stmt.create_index || stmt.indexStmt;
  }

  /**
   * Check if statement is CREATE POLICY
   */
  isCreatePolicy(stmt) {
    return stmt.CreatePolicyStmt || stmt.create_policy || stmt.createPolicyStmt;
  }

  /**
   * Check if statement is ALTER TABLE
   */
  isAlterTable(stmt) {
    return stmt.AlterTableStmt || stmt.alter_table || stmt.alterTableStmt;
  }

  /**
   * Check if statement is COMMENT
   */
  isComment(stmt) {
    return stmt.CommentStmt || stmt.comment || stmt.commentStmt;
  }

  /**
   * Deparse CREATE TABLE statement
   */
  deparseCreateTable(stmt) {
    const createStmt = stmt.CreateStmt || stmt.create_table || stmt.createStmt;
    if (!createStmt) return '';

    const parts = ['CREATE TABLE'];
    
    // Handle IF NOT EXISTS
    if (createStmt.if_not_exists) {
      parts.push('IF NOT EXISTS');
    }

    // Table name
    const tableName = this.deparseRangeVar(createStmt.relation);
    parts.push(tableName);

    // Column definitions
    if (createStmt.tableElts && Array.isArray(createStmt.tableElts)) {
      const columns = [];
      const constraints = [];

      for (const elt of createStmt.tableElts) {
        if (this.isColumnDef(elt)) {
          columns.push(this.deparseColumnDef(elt));
        } else if (this.isConstraint(elt)) {
          constraints.push(this.deparseConstraint(elt));
        }
      }

      const allDefs = [...columns, ...constraints];
      if (allDefs.length > 0) {
        parts.push(`(\n${this.indent(allDefs.join(',\n'))}\n)`);
      }
    }

    return parts.join(' ') + ';';
  }

  /**
   * Check if element is a column definition
   */
  isColumnDef(elt) {
    return elt.ColumnDef || elt.column_def || elt.columnDef;
  }

  /**
   * Check if element is a constraint
   */
  isConstraint(elt) {
    return elt.Constraint || elt.constraint;
  }

  /**
   * Deparse column definition
   */
  deparseColumnDef(elt) {
    const colDef = elt.ColumnDef || elt.column_def || elt.columnDef;
    if (!colDef) return '';

    const parts = [];

    // Column name
    parts.push(this.quoteIdentifier(colDef.colname));

    // Data type
    if (colDef.typeName) {
      parts.push(this.deparseTypeName(colDef.typeName));
    }

    // Column constraints
    if (colDef.constraints && Array.isArray(colDef.constraints)) {
      for (const constraint of colDef.constraints) {
        const constraintSql = this.deparseConstraint(constraint);
        if (constraintSql) {
          parts.push(constraintSql);
        }
      }
    }

    return parts.join(' ');
  }

  /**
   * Deparse type name
   */
  deparseTypeName(typeName) {
    if (!typeName) return '';

    const names = typeName.names || [];
    if (names.length === 0) return '';

    // Extract type name from the names array
    let typeStr = '';
    for (const name of names) {
      if (name.String) {
        typeStr += (typeStr ? '.' : '') + name.String.str;
      }
    }

    // Handle array types
    if (typeName.arrayBounds && typeName.arrayBounds.length > 0) {
      typeStr += '[]';
    }

    // Handle type modifiers (like varchar(255))
    if (typeName.typmods && Array.isArray(typeName.typmods)) {
      const mods = typeName.typmods.map(mod => {
        if (mod.A_Const && mod.A_Const.val) {
          return mod.A_Const.val.Integer || mod.A_Const.val.String?.str || '';
        }
        return '';
      }).filter(Boolean);
      
      if (mods.length > 0) {
        typeStr += `(${mods.join(', ')})`;
      }
    }

    return typeStr;
  }

  /**
   * Deparse constraint
   */
  deparseConstraint(constraint) {
    const constr = constraint.Constraint || constraint.constraint || constraint;
    if (!constr) return '';

    switch (constr.contype) {
      case 'CONSTR_NOTNULL':
      case 1: // CONSTR_NOTNULL
        return 'NOT NULL';
      
      case 'CONSTR_NULL':
      case 2: // CONSTR_NULL
        return 'NULL';
      
      case 'CONSTR_DEFAULT':
      case 3: // CONSTR_DEFAULT
        if (constr.raw_expr) {
          return `DEFAULT ${this.deparseExpr(constr.raw_expr)}`;
        }
        return '';
      
      case 'CONSTR_PRIMARY':
      case 4: // CONSTR_PRIMARY
        return 'PRIMARY KEY';
      
      case 'CONSTR_UNIQUE':
      case 5: // CONSTR_UNIQUE
        return 'UNIQUE';
      
      case 'CONSTR_FOREIGN':
      case 7: // CONSTR_FOREIGN
        return this.deparseForeignKey(constr);
      
      case 'CONSTR_CHECK':
      case 6: // CONSTR_CHECK
        if (constr.raw_expr) {
          return `CHECK (${this.deparseExpr(constr.raw_expr)})`;
        }
        return '';
      
      default:
        console.warn('SQLDeparser: Unknown constraint type:', constr.contype);
        return '';
    }
  }

  /**
   * Deparse foreign key constraint
   */
  deparseForeignKey(constr) {
    if (!constr.pktable) return '';

    const parts = ['REFERENCES'];
    
    // Referenced table
    parts.push(this.deparseRangeVar(constr.pktable));
    
    // Referenced columns
    if (constr.pk_attrs && Array.isArray(constr.pk_attrs)) {
      const columns = constr.pk_attrs.map(attr => this.quoteIdentifier(attr.String?.str || '')).filter(Boolean);
      if (columns.length > 0) {
        parts.push(`(${columns.join(', ')})`);
      }
    }
    
    // ON DELETE/UPDATE actions
    if (constr.fk_del_action) {
      parts.push(`ON DELETE ${this.deparseReferenceAction(constr.fk_del_action)}`);
    }
    if (constr.fk_upd_action) {
      parts.push(`ON UPDATE ${this.deparseReferenceAction(constr.fk_upd_action)}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Deparse reference action (CASCADE, RESTRICT, etc.)
   */
  deparseReferenceAction(action) {
    const actions = {
      'a': 'NO ACTION',
      'r': 'RESTRICT', 
      'c': 'CASCADE',
      'n': 'SET NULL',
      'd': 'SET DEFAULT'
    };
    return actions[action] || 'NO ACTION';
  }

  /**
   * Deparse CREATE INDEX statement
   */
  deparseCreateIndex(stmt) {
    const indexStmt = stmt.IndexStmt || stmt.create_index || stmt.indexStmt;
    if (!indexStmt) return '';

    const parts = ['CREATE'];
    
    // UNIQUE index
    if (indexStmt.unique) {
      parts.push('UNIQUE');
    }
    
    parts.push('INDEX');
    
    // CONCURRENTLY
    if (indexStmt.concurrent) {
      parts.push('CONCURRENTLY');
    }
    
    // IF NOT EXISTS
    if (indexStmt.if_not_exists) {
      parts.push('IF NOT EXISTS');
    }
    
    // Index name
    if (indexStmt.idxname) {
      parts.push(this.quoteIdentifier(indexStmt.idxname));
    }
    
    // ON table
    parts.push('ON');
    parts.push(this.deparseRangeVar(indexStmt.relation));
    
    // USING method
    if (indexStmt.accessMethod) {
      parts.push(`USING ${indexStmt.accessMethod}`);
    }
    
    // Index elements
    if (indexStmt.indexParams && Array.isArray(indexStmt.indexParams)) {
      const columns = indexStmt.indexParams.map(param => this.deparseIndexElem(param)).filter(Boolean);
      if (columns.length > 0) {
        parts.push(`(${columns.join(', ')})`);
      }
    }
    
    return parts.join(' ') + ';';
  }

  /**
   * Deparse index element
   */
  deparseIndexElem(param) {
    if (!param || !param.IndexElem) return '';
    
    const elem = param.IndexElem;
    let result = '';
    
    if (elem.name) {
      result = this.quoteIdentifier(elem.name);
    } else if (elem.expr) {
      result = this.deparseExpr(elem.expr);
    }
    
    // Collation
    if (elem.collation && Array.isArray(elem.collation)) {
      const collName = elem.collation.map(c => c.String?.str).filter(Boolean).join('.');
      if (collName) {
        result += ` COLLATE ${collName}`;
      }
    }
    
    // Sort order
    if (elem.ordering) {
      switch (elem.ordering) {
        case 1: // SORTBY_ASC
          result += ' ASC';
          break;
        case 2: // SORTBY_DESC
          result += ' DESC';
          break;
      }
    }
    
    // NULLS FIRST/LAST
    if (elem.nulls_ordering) {
      switch (elem.nulls_ordering) {
        case 1: // SORTBY_NULLS_FIRST
          result += ' NULLS FIRST';
          break;
        case 2: // SORTBY_NULLS_LAST
          result += ' NULLS LAST';
          break;
      }
    }
    
    return result;
  }

  /**
   * Deparse CREATE POLICY statement
   */
  deparseCreatePolicy(stmt) {
    const policyStmt = stmt.CreatePolicyStmt || stmt.create_policy || stmt.createPolicyStmt;
    if (!policyStmt) return '';

    const parts = ['CREATE POLICY'];
    
    // Policy name
    if (policyStmt.policy_name) {
      parts.push(this.quoteIdentifier(policyStmt.policy_name));
    }
    
    // ON table
    parts.push('ON');
    parts.push(this.deparseRangeVar(policyStmt.table));
    
    // AS PERMISSIVE/RESTRICTIVE
    if (policyStmt.permissive !== undefined) {
      parts.push('AS');
      parts.push(policyStmt.permissive ? 'PERMISSIVE' : 'RESTRICTIVE');
    }
    
    // FOR command
    if (policyStmt.cmd_name) {
      parts.push('FOR');
      parts.push(policyStmt.cmd_name.toUpperCase());
    }
    
    // TO roles
    if (policyStmt.roles && Array.isArray(policyStmt.roles)) {
      const roles = policyStmt.roles.map(role => this.deparseRoleSpec(role)).filter(Boolean);
      if (roles.length > 0) {
        parts.push('TO');
        parts.push(roles.join(', '));
      }
    }
    
    // USING expression
    if (policyStmt.qual) {
      parts.push('USING');
      parts.push(`(${this.deparseExpr(policyStmt.qual)})`);
    }
    
    // WITH CHECK expression
    if (policyStmt.with_check) {
      parts.push('WITH CHECK');
      parts.push(`(${this.deparseExpr(policyStmt.with_check)})`);
    }
    
    return parts.join(' ') + ';';
  }

  /**
   * Deparse role specification
   */
  deparseRoleSpec(role) {
    if (role.RoleSpec) {
      if (role.RoleSpec.rolename) {
        return this.quoteIdentifier(role.RoleSpec.rolename);
      }
      if (role.RoleSpec.roletype === 1) { // ROLESPEC_PUBLIC
        return 'PUBLIC';
      }
    }
    return '';
  }

  /**
   * Deparse expression
   */
  deparseExpr(expr) {
    if (!expr) return '';

    // Handle different expression types
    if (expr.A_Const) {
      return this.deparseAConst(expr.A_Const);
    } else if (expr.ColumnRef) {
      return this.deparseColumnRef(expr.ColumnRef);
    } else if (expr.A_Expr) {
      return this.deparseAExpr(expr.A_Expr);
    } else if (expr.FuncCall) {
      return this.deparseFuncCall(expr.FuncCall);
    } else if (expr.BoolExpr) {
      return this.deparseBoolExpr(expr.BoolExpr);
    }

    // Fallback for unknown expressions
    console.warn('SQLDeparser: Unknown expression type:', Object.keys(expr));
    return '';
  }

  /**
   * Deparse constant value
   */
  deparseAConst(aConst) {
    if (!aConst.val) return '';

    if (aConst.val.Integer !== undefined) {
      return aConst.val.Integer.toString();
    } else if (aConst.val.Float) {
      return aConst.val.Float.str;
    } else if (aConst.val.String) {
      return `'${aConst.val.String.str.replace(/'/g, "''")}'`;
    } else if (aConst.val.Null) {
      return 'NULL';
    }

    return '';
  }

  /**
   * Deparse column reference
   */
  deparseColumnRef(colRef) {
    if (!colRef.fields || !Array.isArray(colRef.fields)) return '';

    const fields = colRef.fields.map(field => {
      if (field.String) {
        return this.quoteIdentifier(field.String.str);
      }
      return '';
    }).filter(Boolean);

    return fields.join('.');
  }

  /**
   * Deparse A_Expr (arithmetic/comparison expressions)
   */
  deparseAExpr(aExpr) {
    if (!aExpr.name || !Array.isArray(aExpr.name)) return '';

    const operator = aExpr.name.map(n => n.String?.str).filter(Boolean).join('.');
    const left = aExpr.lexpr ? this.deparseExpr(aExpr.lexpr) : '';
    const right = aExpr.rexpr ? this.deparseExpr(aExpr.rexpr) : '';

    if (left && right) {
      return `${left} ${operator} ${right}`;
    } else if (right) {
      return `${operator} ${right}`;
    }

    return '';
  }

  /**
   * Deparse function call
   */
  deparseFuncCall(funcCall) {
    if (!funcCall.funcname || !Array.isArray(funcCall.funcname)) return '';

    const funcName = funcCall.funcname.map(n => n.String?.str).filter(Boolean).join('.');
    const args = [];

    if (funcCall.args && Array.isArray(funcCall.args)) {
      for (const arg of funcCall.args) {
        const argSql = this.deparseExpr(arg);
        if (argSql) {
          args.push(argSql);
        }
      }
    }

    return `${funcName}(${args.join(', ')})`;
  }

  /**
   * Deparse boolean expression
   */
  deparseBoolExpr(boolExpr) {
    if (!boolExpr.args || !Array.isArray(boolExpr.args)) return '';

    const args = boolExpr.args.map(arg => this.deparseExpr(arg)).filter(Boolean);
    
    switch (boolExpr.boolop) {
      case 0: // AND_EXPR
        return args.join(' AND ');
      case 1: // OR_EXPR
        return args.join(' OR ');
      case 2: // NOT_EXPR
        return `NOT (${args.join(' AND ')})`;
      default:
        return args.join(' AND ');
    }
  }

  /**
   * Deparse RangeVar (table reference)
   */
  deparseRangeVar(rangeVar) {
    if (!rangeVar) return '';

    let result = '';
    
    if (rangeVar.schemaname) {
      result += this.quoteIdentifier(rangeVar.schemaname) + '.';
    }
    
    if (rangeVar.relname) {
      result += this.quoteIdentifier(rangeVar.relname);
    }

    return result;
  }

  /**
   * Quote identifier if needed
   */
  quoteIdentifier(name) {
    if (!name) return '';
    
    // Check if identifier needs quoting
    if (/^[a-z_][a-z0-9_]*$/.test(name) && !this.isReservedWord(name)) {
      return name;
    }
    
    return `"${name.replace(/"/g, '""')}"`;
  }

  /**
   * Check if word is reserved in PostgreSQL
   */
  isReservedWord(word) {
    const reserved = new Set([
      'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop',
      'alter', 'table', 'index', 'view', 'function', 'procedure', 'trigger',
      'schema', 'database', 'user', 'role', 'grant', 'revoke', 'primary', 'key',
      'foreign', 'references', 'unique', 'not', 'null', 'default', 'check',
      'constraint', 'order', 'by', 'group', 'having', 'limit', 'offset',
      'union', 'intersect', 'except', 'all', 'distinct', 'as', 'in', 'exists',
      'between', 'like', 'ilike', 'similar', 'to', 'and', 'or', 'not', 'is',
      'true', 'false', 'unknown'
    ]);
    
    return reserved.has(word.toLowerCase());
  }

  /**
   * Add indentation
   */
  indent(text) {
    const spaces = ' '.repeat(this.indentSize);
    return text.split('\n').map(line => spaces + line).join('\n');
  }

  /**
   * Deparse ALTER TABLE statement
   */
  deparseAlterTable(stmt) {
    // Stub implementation - can be expanded if needed
    return 'ALTER TABLE ...;';
  }

  /**
   * Deparse COMMENT statement
   */
  deparseComment(stmt) {
    // Stub implementation - can be expanded if needed
    return 'COMMENT ON ...;';
  }
}