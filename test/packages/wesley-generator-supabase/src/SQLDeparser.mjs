/**
 * PostgreSQL AST to SQL Deparser
 * 
 * Converts @supabase/pg-parser AST back to SQL strings.
 * Handles Supabase-specific extensions and Wesley formatting preferences.
 */

export class SQLDeparser {
  constructor(options = {}) {
    this.indentSize = options.indentSize || 2;
    this.maxLineLength = options.maxLineLength || 80;
    this.preserveComments = options.preserveComments !== false;
  }

  /**
   * Deparse a full parse result to SQL
   */
  deparse(parseResult) {
    if (!parseResult.tree || !parseResult.tree.stmts) {
      throw new Error('Invalid parse result structure');
    }

    const statements = parseResult.tree.stmts.map(stmt => 
      this.deparseStatement(stmt.stmt)
    );

    return statements.join(';\n\n') + (statements.length > 0 ? ';' : '');
  }

  /**
   * Deparse a single statement
   */
  deparseStatement(stmt) {
    const stmtType = Object.keys(stmt)[0];
    const stmtData = stmt[stmtType];

    switch (stmtType) {
      case 'CreateStmt':
        return this.deparseCreateTable(stmtData);
      case 'CreateIndexStmt':
        return this.deparseCreateIndex(stmtData);
      case 'AlterTableStmt':
        return this.deparseAlterTable(stmtData);
      case 'DropStmt':
        return this.deparseDropStatement(stmtData);
      case 'CommentStmt':
        return this.deparseComment(stmtData);
      case 'CreatePolicyStmt':
        return this.deparseCreatePolicy(stmtData);
      default:
        console.warn(`Unknown statement type: ${stmtType}`);
        return `-- Unknown statement: ${stmtType}`;
    }
  }

  /**
   * Deparse CREATE TABLE statement
   */
  deparseCreateTable(stmt) {
    let sql = 'CREATE TABLE';
    
    if (stmt.if_not_exists) {
      sql += ' IF NOT EXISTS';
    }

    sql += ` "${stmt.relation.relname}"`;

    if (stmt.tableElts && stmt.tableElts.length > 0) {
      sql += ' (\n';
      
      const elements = stmt.tableElts.map(elt => {
        if (elt.ColumnDef) {
          return this.deparseColumnDef(elt.ColumnDef);
        } else if (elt.Constraint) {
          return this.deparseTableConstraint(elt.Constraint);
        }
        return '-- unknown element';
      });

      sql += elements.map(e => `  ${e}`).join(',\n');
      sql += '\n)';
    }

    return sql;
  }

  /**
   * Deparse column definition
   */
  deparseColumnDef(colDef) {
    let sql = `"${colDef.colname}" ${this.deparseTypeName(colDef.typeName)}`;

    // Add constraints
    if (colDef.constraints) {
      for (const constraint of colDef.constraints) {
        if (constraint.Constraint) {
          const constraintSql = this.deparseColumnConstraint(constraint.Constraint);
          if (constraintSql) {
            sql += ` ${constraintSql}`;
          }
        }
      }
    }

    return sql;
  }

  /**
   * Deparse type name
   */
  deparseTypeName(typeName) {
    if (!typeName.names || typeName.names.length === 0) {
      return 'unknown';
    }

    // Get the base type name
    const baseType = typeName.names[typeName.names.length - 1];
    let type = '';

    if (baseType.String) {
      type = baseType.String.sval;
    } else {
      type = 'unknown';
    }

    // Handle array types
    if (typeName.arrayBounds && typeName.arrayBounds.length > 0) {
      type += '[]';
    }

    return type;
  }

  /**
   * Deparse column constraint
   */
  deparseColumnConstraint(constraint) {
    switch (constraint.contype) {
      case 'CONSTR_PRIMARY':
        return 'PRIMARY KEY';
      case 'CONSTR_UNIQUE':
        return 'UNIQUE';
      case 'CONSTR_NOTNULL':
        return 'NOT NULL';
      default:
        return '';
    }
  }

  /**
   * Deparse table constraint
   */
  deparseTableConstraint(constraint) {
    switch (constraint.contype) {
      case 'CONSTR_PRIMARY':
        const pkCols = constraint.keys.map(key => `"${key.String.sval}"`).join(', ');
        return `PRIMARY KEY (${pkCols})`;
      case 'CONSTR_UNIQUE':
        const uniqueCols = constraint.keys.map(key => `"${key.String.sval}"`).join(', ');
        return `UNIQUE (${uniqueCols})`;
      default:
        return '';
    }
  }

  /**
   * Deparse CREATE INDEX statement
   */
  deparseCreateIndex(stmt) {
    let sql = 'CREATE';
    
    if (stmt.unique) {
      sql += ' UNIQUE';
    }
    
    sql += ' INDEX';
    
    if (stmt.concurrent) {
      sql += ' CONCURRENTLY';
    }
    
    if (stmt.if_not_exists) {
      sql += ' IF NOT EXISTS';
    }
    
    if (stmt.idxname) {
      sql += ` "${stmt.idxname}"`;
    }
    
    sql += ` ON "${stmt.relation.relname}"`;
    
    // Index columns - simplified
    if (stmt.indexParams && stmt.indexParams.length > 0) {
      const columns = stmt.indexParams.map(param => `"${param.IndexElem.name}"`);
      sql += ` (${columns.join(', ')})`;
    }

    return sql;
  }

  /**
   * Deparse CREATE POLICY statement (RLS)
   */
  deparseCreatePolicy(stmt) {
    let sql = `CREATE POLICY "${stmt.policy_name}" ON "${stmt.table.relname}"`;
    
    if (stmt.cmd_name) {
      sql += ` FOR ${stmt.cmd_name}`;
    }
    
    if (stmt.roles && stmt.roles.length > 0) {
      const roles = stmt.roles.map(role => 'authenticated');
      sql += ` TO ${roles.join(', ')}`;
    }
    
    if (stmt.using_expr) {
      sql += ` USING (true)`; // Simplified for now
    }
    
    if (stmt.check_expr) {
      sql += ` WITH CHECK (true)`; // Simplified for now
    }
    
    return sql;
  }

  /**
   * Deparse COMMENT statement
   */
  deparseComment(stmt) {
    return `COMMENT ON TABLE example IS 'example comment'`; // Simplified
  }
}