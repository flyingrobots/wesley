/**
 * Foreign Key AST Roundtrip Test
 * Validates that FK constraints work correctly with pg-parser
 */

import { describe, it, expect } from 'vitest';
import { PostgreSQLAstBuilder } from '../../src/domain/PostgreSQLAstBuilder.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';
import pgParser from '@supabase/pg-parser';

describe('Foreign Key AST Roundtrip', () => {
  it('should generate valid FK constraints that pg-parser can round-trip', () => {
    // Create a schema with FK relationships
    const schema = new Schema({
      users: new Table({
        name: 'users',
        fields: {
          id: new Field({
            name: 'id',
            type: 'ID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          email: new Field({
            name: 'email',
            type: 'String',
            nonNull: true
          })
        }
      }),
      posts: new Table({
        name: 'posts',
        fields: {
          id: new Field({
            name: 'id',
            type: 'ID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          author_id: new Field({
            name: 'author_id',
            type: 'ID',
            nonNull: true,
            directives: { '@foreignKey': { ref: 'users.id' } }
          }),
          title: new Field({
            name: 'title',
            type: 'String',
            nonNull: true
          })
        }
      })
    });
    
    // Build AST
    const builder = new PostgreSQLAstBuilder();
    const ast = builder.buildCreateTableStatements(schema);
    
    // Find the posts table statement
    const postsTable = ast.find(stmt => 
      stmt.CreateStmt && stmt.CreateStmt.relation.relname === 'posts'
    );
    
    expect(postsTable).toBeDefined();
    
    // Find FK constraint
    const fkConstraint = postsTable.CreateStmt.tableElts.find(elt => 
      elt.Constraint && elt.Constraint.contype === 'CONSTR_FOREIGN'
    );
    
    expect(fkConstraint).toBeDefined();
    expect(fkConstraint.Constraint.fk_attrs).toEqual([
      { String: { sval: 'author_id' } }
    ]);
    expect(fkConstraint.Constraint.pk_attrs).toEqual([
      { String: { sval: 'id' } }
    ]);
    expect(fkConstraint.Constraint.pktable.RangeVar.relname).toBe('users');
    
    // Test deparse (round-trip)
    const sql = pgParser.deparse(ast);
    expect(sql).toContain('FOREIGN KEY');
    expect(sql).toContain('author_id');
    expect(sql).toContain('REFERENCES');
    expect(sql).toContain('users');
    
    // Parse it back and verify structure
    const reparsed = pgParser.parse(sql);
    expect(reparsed.error).toBeUndefined();
    
    const reparsedPosts = reparsed.stmts.find(s => 
      s.stmt.CreateStmt && s.stmt.CreateStmt.relation.relname === 'posts'
    );
    
    const reparsedFK = reparsedPosts.stmt.CreateStmt.tableElts.find(elt => 
      elt.Constraint && elt.Constraint.contype === 'CONSTR_FOREIGN'
    );
    
    expect(reparsedFK.Constraint.fk_attrs).toEqual(fkConstraint.Constraint.fk_attrs);
    expect(reparsedFK.Constraint.pk_attrs).toEqual(fkConstraint.Constraint.pk_attrs);
  });
  
  it('should handle table-level vs column-level FK constraints', () => {
    const schema = new Schema({
      orders: new Table({
        name: 'orders',
        fields: {
          id: new Field({
            name: 'id',
            type: 'ID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          customer_id: new Field({
            name: 'customer_id',
            type: 'ID',
            nonNull: true,
            directives: { '@foreignKey': { ref: 'customers.id' } }
          }),
          product_id: new Field({
            name: 'product_id', 
            type: 'ID',
            nonNull: true,
            directives: { '@foreignKey': { ref: 'products.id' } }
          })
        }
      })
    });
    
    const builder = new PostgreSQLAstBuilder();
    const ast = builder.buildCreateTableStatements(schema);
    
    const ordersTable = ast.find(stmt => 
      stmt.CreateStmt && stmt.CreateStmt.relation.relname === 'orders'
    );
    
    // Should have 2 FK constraints at table level
    const fkConstraints = ordersTable.CreateStmt.tableElts.filter(elt => 
      elt.Constraint && elt.Constraint.contype === 'CONSTR_FOREIGN'
    );
    
    expect(fkConstraints).toHaveLength(2);
    
    // Verify each FK has correct fk_attrs
    const customerFK = fkConstraints.find(c => 
      c.Constraint.fk_attrs[0].String.sval === 'customer_id'
    );
    const productFK = fkConstraints.find(c => 
      c.Constraint.fk_attrs[0].String.sval === 'product_id'
    );
    
    expect(customerFK).toBeDefined();
    expect(productFK).toBeDefined();
    expect(customerFK.Constraint.pktable.RangeVar.relname).toBe('customers');
    expect(productFK.Constraint.pktable.RangeVar.relname).toBe('products');
  });
});