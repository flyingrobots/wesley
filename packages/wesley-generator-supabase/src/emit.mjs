/**
 * Supabase Generator Emit Functions
 * Side-effect free exports for lazy loading
 */

import { SQLDeparser } from './SQLDeparser.mjs';

/**
 * Emit PostgreSQL DDL
 */
export function emitDDL({ schema }) {
  const deparser = new SQLDeparser();
  
  // For now, create a simple test table
  const ast = [{
    CreateStmt: {
      relation: {
        relname: 'test_table',
        schemaname: 'public'
      },
      tableElts: [
        {
          ColumnDef: {
            colname: 'id',
            typeName: {
              names: [{ String: { str: 'uuid' } }]
            },
            constraints: [
              { Constraint: { contype: 4 } } // PRIMARY KEY
            ]
          }
        },
        {
          ColumnDef: {
            colname: 'name',
            typeName: {
              names: [{ String: { str: 'text' } }]
            }
          }
        }
      ]
    }
  }];
  
  const sql = deparser.deparse(ast);
  
  return {
    label: 'ddl',
    files: [
      {
        name: 'schema.sql',
        content: sql
      }
    ]
  };
}

/**
 * Emit RLS policies
 */
export function emitRLS({ schema }) {
  return {
    label: 'rls',
    files: [
      {
        name: 'rls.sql',
        content: '-- RLS policies will be generated here'
      }
    ]
  };
}

/**
 * Emit migrations
 */
export function emitMigrations({ schema }) {
  return {
    label: 'migrations',
    files: [
      {
        name: '001_initial.sql',
        content: '-- Initial migration'
      }
    ]
  };
}

/**
 * Emit pgTAP tests
 */
export function emitPgTap({ schema }) {
  return {
    label: 'pgtap',
    files: [
      {
        name: 'tests.sql',
        content: "SELECT plan(1);\nSELECT ok(true, 'Test passes');\nSELECT * FROM finish();"
      }
    ]
  };
}