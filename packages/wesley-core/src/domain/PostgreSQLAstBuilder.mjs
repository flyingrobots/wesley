/**
 * PostgreSQL AST Builder using @supabase/pg-parser
 * Converts Wesley Domain IR to PostgreSQL AST using the official parser
 * This ensures we generate syntactically correct SQL
 */

// We would use: import { parse, deparse } from '@supabase/pg-parser';
// For now, we'll show the structure

export class PostgreSQLAstBuilder {
  constructor() {
    this.statements = [];
  }
  
  /**
   * Build PostgreSQL AST from Wesley Domain IR
   * Using pg-parser's AST structure
   */
  buildFromSchema(schema) {
    const ast = {
      version: 160001, // PostgreSQL 16
      stmts: []
    };
    
    // Build CREATE TABLE statements
    for (const table of schema.getTables()) {
      ast.stmts.push(this.buildCreateTableStmt(table));
      
      // Add indexes
      for (const field of table.getFields()) {
        if (field.isIndexed()) {
          ast.stmts.push(this.buildCreateIndexStmt(table, field));
        }
      }
      
      // Add RLS policies
      const rlsConfig = table.directives?.['@rls'];
      if (rlsConfig) {
        ast.stmts.push(this.buildEnableRLSStmt(table));
        ast.stmts.push(...this.buildRLSPolicies(table, rlsConfig));
      }
    }
    
    return ast;
  }
  
  /**
   * Build CREATE TABLE statement AST node
   * Following pg-parser's AST structure
   */
  buildCreateTableStmt(table) {
    return {
      stmt: {
        CreateStmt: {
          relation: {
            RangeVar: {
              schemaname: null,
              relname: table.name,
              inh: true,
              relpersistence: 'p',
              location: 0
            }
          },
          tableElts: this.buildTableElements(table),
          inhRelations: null,
          partbound: null,
          partspec: null,
          ofTypename: null,
          constraints: null,
          options: null,
          oncommit: 0,
          tablespacename: null,
          accessMethod: null,
          if_not_exists: true
        }
      }
    };
  }
  
  /**
   * Build table elements (columns and constraints)
   */
  buildTableElements(table) {
    const elements = [];
    
    for (const field of table.getFields()) {
      if (field.isVirtual()) continue;
      
      elements.push({
        ColumnDef: {
          colname: field.name,
          typeName: this.buildTypeName(field),
          inhcount: 0,
          is_local: true,
          is_not_null: field.nonNull,
          is_from_type: false,
          storage: null,
          raw_default: field.getDefault() ? this.buildDefaultExpr(field.getDefault()) : null,
          cooked_default: null,
          identity: null,
          identitySequence: null,
          generated: null,
          collClause: null,
          collOid: 0,
          constraints: this.buildColumnConstraints(field),
          fdwoptions: null,
          location: 0
        }
      });
    }
    
    // Add table constraints
    elements.push(...this.buildTableConstraints(table));
    
    return elements;
  }
  
  /**
   * Build type name AST node
   */
  buildTypeName(field) {
    const typeMap = {
      'ID': ['pg_catalog', 'uuid'],
      'String': ['pg_catalog', 'text'],
      'Int': ['pg_catalog', 'int4'],
      'BigInt': ['pg_catalog', 'int8'],
      'Float': ['pg_catalog', 'float8'],
      'Boolean': ['pg_catalog', 'bool'],
      'DateTime': ['pg_catalog', 'timestamptz'],
      'JSON': ['pg_catalog', 'jsonb']
    };
    
    const [schema, typename] = typeMap[field.type] || ['pg_catalog', 'text'];
    
    return {
      TypeName: {
        names: [
          { String: { sval: schema } },
          { String: { sval: typename } }
        ],
        typeOid: 0,
        setof: false,
        pct_type: false,
        typmods: null,
        typemod: -1,
        arrayBounds: null,
        location: 0
      }
    };
  }
  
  /**
   * Build default expression AST
   */
  buildDefaultExpr(defaultValue) {
    if (defaultValue.expr) {
      // For SQL expressions like "gen_random_uuid()" or "now()"
      return {
        FuncCall: {
          funcname: this.parseFunctionName(defaultValue.expr),
          args: null,
          agg_order: null,
          agg_filter: null,
          over: null,
          agg_within_group: false,
          agg_star: false,
          agg_distinct: false,
          func_variadic: false,
          funcformat: 0,
          location: 0
        }
      };
    } else if (defaultValue.value !== undefined) {
      // For literal values
      return {
        A_Const: {
          val: this.buildConstValue(defaultValue.value),
          location: 0
        }
      };
    }
    
    return null;
  }
  
  /**
   * Build column constraints
   */
  buildColumnConstraints(field) {
    const constraints = [];
    
    if (field.isPrimaryKey()) {
      constraints.push({
        Constraint: {
          contype: 'CONSTR_PRIMARY',
          conname: null,
          deferrable: false,
          initdeferred: false,
          location: 0,
          is_no_inherit: false,
          raw_expr: null,
          cooked_expr: null,
          generated_when: null,
          nulls_not_distinct: false,
          keys: null,
          including: null,
          exclusions: null,
          options: null,
          indexname: null,
          indexspace: null,
          reset_default_tblspc: false,
          access_method: null,
          where_clause: null,
          pktable: null,
          fk_attrs: null,
          pk_attrs: null,
          fk_matchtype: null,
          fk_upd_action: null,
          fk_del_action: null,
          fk_del_set_cols: null,
          old_conpfeqop: null,
          old_pktable_oid: 0,
          skip_validation: false,
          initially_valid: true
        }
      });
    }
    
    if (field.isUnique()) {
      constraints.push({
        Constraint: {
          contype: 'CONSTR_UNIQUE',
          conname: null,
          deferrable: false,
          initdeferred: false,
          location: 0
        }
      });
    }
    
    const fkRef = field.getForeignKeyRef();
    if (fkRef) {
      const [refTable, refColumn] = fkRef.split('.');
      constraints.push({
        Constraint: {
          contype: 'CONSTR_FOREIGN',
          pktable: {
            RangeVar: {
              schemaname: null,
              relname: refTable,
              inh: true,
              relpersistence: 'p',
              location: 0
            }
          },
          pk_attrs: [{ String: { sval: refColumn || 'id' } }],
          fk_matchtype: 'FKCONSTR_MATCH_SIMPLE',
          fk_upd_action: 'FKCONSTR_ACTION_NOACTION',
          fk_del_action: 'FKCONSTR_ACTION_NOACTION'
        }
      });
    }
    
    // Check constraints for @sensitive fields
    if (field.directives?.['@sensitive'] && field.name.includes('password')) {
      constraints.push({
        Constraint: {
          contype: 'CONSTR_CHECK',
          conname: `${field.name}_check`,
          raw_expr: {
            FuncCall: {
              funcname: [{ String: { sval: 'char_length' } }],
              args: [{
                ColumnRef: {
                  fields: [{ String: { sval: field.name } }],
                  location: 0
                }
              }]
            }
          }
        }
      });
    }
    
    return constraints;
  }
  
  /**
   * Build table-level constraints
   */
  buildTableConstraints(table) {
    const constraints = [];
    
    // Add composite primary keys, unique constraints, etc.
    // This would be expanded based on directives
    
    return constraints;
  }
  
  /**
   * Build CREATE INDEX statement
   */
  buildCreateIndexStmt(table, field) {
    return {
      stmt: {
        IndexStmt: {
          idxname: `${table.name}_${field.name}_idx`,
          relation: {
            RangeVar: {
              schemaname: null,
              relname: table.name,
              inh: true,
              relpersistence: 'p',
              location: 0
            }
          },
          accessMethod: 'btree',
          tableSpace: null,
          indexParams: [{
            IndexElem: {
              name: field.name,
              expr: null,
              indexcolname: null,
              collation: null,
              opclass: null,
              opclassopts: null,
              ordering: 0,
              nulls_ordering: 0
            }
          }],
          indexIncludingParams: null,
          options: null,
          whereClause: null,
          excludeOpNames: null,
          idxcomment: null,
          indexOid: 0,
          oldNumber: 0,
          oldCreateSubid: 0,
          oldFirstRelfilelocatorSubid: 0,
          unique: false,
          nulls_not_distinct: false,
          primary: false,
          isconstraint: false,
          deferrable: false,
          initdeferred: false,
          transformed: false,
          concurrent: false,
          if_not_exists: true,
          reset_default_tblspc: false
        }
      }
    };
  }
  
  /**
   * Build ALTER TABLE ENABLE RLS statement
   */
  buildEnableRLSStmt(table) {
    return {
      stmt: {
        AlterTableStmt: {
          relation: {
            RangeVar: {
              schemaname: null,
              relname: table.name,
              inh: true,
              relpersistence: 'p',
              location: 0
            }
          },
          cmds: [{
            AlterTableCmd: {
              subtype: 'AT_EnableRowSecurity',
              name: null,
              num: 0,
              newowner: null,
              def: null,
              behavior: 0,
              missing_ok: false,
              recurse: true
            }
          }],
          objtype: 'OBJECT_TABLE',
          missing_ok: false
        }
      }
    };
  }
  
  /**
   * Build RLS policy statements
   */
  buildRLSPolicies(table, rlsConfig) {
    const policies = [];
    
    // Create policy for each operation
    const operations = ['select', 'insert', 'update', 'delete'];
    
    for (const op of operations) {
      if (rlsConfig[op]) {
        policies.push({
          stmt: {
            CreatePolicyStmt: {
              policy_name: `${table.name}_${op}_policy`,
              table: {
                RangeVar: {
                  schemaname: null,
                  relname: table.name,
                  inh: true,
                  relpersistence: 'p',
                  location: 0
                }
              },
              cmd_name: op.toUpperCase(),
              permissive: true,
              roles: null, // null means all roles
              qual: this.parseExpression(rlsConfig[op]),
              with_check: op !== 'select' ? this.parseExpression(rlsConfig[op]) : null
            }
          }
        });
      }
    }
    
    return policies;
  }
  
  /**
   * Parse expression string to AST
   * This is simplified - pg-parser would handle this properly
   */
  parseExpression(expr) {
    // This would use pg-parser to properly parse the expression
    // For now, return a simplified representation
    if (expr === 'true') {
      return { A_Const: { val: { Boolean: { boolval: true } } } };
    }
    if (expr === 'false') {
      return { A_Const: { val: { Boolean: { boolval: false } } } };
    }
    
    // For auth.uid() expressions
    if (expr.includes('auth.uid()')) {
      return {
        FuncCall: {
          funcname: [
            { String: { sval: 'auth' } },
            { String: { sval: 'uid' } }
          ],
          args: null
        }
      };
    }
    
    // Would parse complex expressions properly with pg-parser
    return { A_Expr: { kind: 'AEXPR_OP' } };
  }
  
  /**
   * Convert AST back to SQL using pg-parser's deparse
   */
  toSQL(ast) {
    // This would use: return deparse(ast);
    // For demonstration, we'll return a placeholder
    return '-- SQL would be generated here using pg-parser deparse()';
  }
  
  // Helper methods
  
  parseFunctionName(expr) {
    // Extract function name from expression like "gen_random_uuid()"
    const match = expr.match(/^(\w+)\(/);
    if (match) {
      return [{ String: { sval: match[1] } }];
    }
    return [{ String: { sval: expr } }];
  }
  
  buildConstValue(value) {
    if (typeof value === 'string') {
      return { String: { sval: value } };
    }
    if (typeof value === 'number') {
      return { Integer: { ival: value } };
    }
    if (typeof value === 'boolean') {
      return { Boolean: { boolval: value } };
    }
    return { Null: {} };
  }
}