/**
 * Foreign Key AST tests (Node test runner)
 * Validates that FK constraints are correctly represented in the AST
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PostgreSQLAstBuilder } from '../../src/domain/PostgreSQLAstBuilder.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';

test('AST contains FK constraint for posts.author_id -> users.id', () => {
  const schema = new Schema({
    users: new Table({
      name: 'users',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true, directives: { '@primaryKey': {} } }),
        email: new Field({ name: 'email', type: 'String', nonNull: true })
      }
    }),
    posts: new Table({
      name: 'posts',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true, directives: { '@primaryKey': {} } }),
        author_id: new Field({ name: 'author_id', type: 'ID', nonNull: true, directives: { '@foreignKey': { ref: 'users.id' } } }),
        title: new Field({ name: 'title', type: 'String', nonNull: true })
      }
    })
  });

  const builder = new PostgreSQLAstBuilder();
  const ast = builder.buildFromSchema(schema);

  const postsCreate = ast.stmts.find(s => s.stmt?.CreateStmt?.relation?.RangeVar?.relname === 'posts');
  assert(postsCreate, 'posts CreateStmt exists');

  const authorCol = postsCreate.stmt.CreateStmt.tableElts.find(
    e => e.ColumnDef?.colname === 'author_id'
  );
  assert(authorCol, 'author_id column exists');
  const fk = authorCol.ColumnDef.constraints.find(
    c => c.Constraint?.contype === 'CONSTR_FOREIGN'
  );
  assert(fk, 'FK constraint exists on posts.author_id');
  assert.deepEqual(fk.Constraint.fk_attrs, [{ String: { sval: 'author_id' } }]);
  assert.deepEqual(fk.Constraint.pk_attrs, [{ String: { sval: 'id' } }]);
  assert.equal(fk.Constraint.pktable.RangeVar.relname, 'users');
});

test('AST has two FK constraints on orders table for customer_id and product_id', () => {
  const schema = new Schema({
    orders: new Table({
      name: 'orders',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true, directives: { '@primaryKey': {} } }),
        customer_id: new Field({ name: 'customer_id', type: 'ID', nonNull: true, directives: { '@foreignKey': { ref: 'customers.id' } } }),
        product_id: new Field({ name: 'product_id', type: 'ID', nonNull: true, directives: { '@foreignKey': { ref: 'products.id' } } })
      }
    })
  });

  const builder = new PostgreSQLAstBuilder();
  const ast = builder.buildFromSchema(schema);

  const ordersCreate = ast.stmts.find(s => s.stmt?.CreateStmt?.relation?.RangeVar?.relname === 'orders');
  assert(ordersCreate, 'orders CreateStmt exists');

  const customerCol = ordersCreate.stmt.CreateStmt.tableElts.find(e => e.ColumnDef?.colname === 'customer_id');
  const productCol = ordersCreate.stmt.CreateStmt.tableElts.find(e => e.ColumnDef?.colname === 'product_id');
  const customerFK = customerCol?.ColumnDef?.constraints?.find(c => c.Constraint?.contype === 'CONSTR_FOREIGN');
  const productFK = productCol?.ColumnDef?.constraints?.find(c => c.Constraint?.contype === 'CONSTR_FOREIGN');
  assert(customerFK, 'customer_id FK exists');
  assert(productFK, 'product_id FK exists');
  assert.equal(customerFK.Constraint.pktable.RangeVar.relname, 'customers');
  assert.equal(productFK.Constraint.pktable.RangeVar.relname, 'products');
});
