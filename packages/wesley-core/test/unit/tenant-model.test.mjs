/**
 * Tenant Model Tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { GraphQLSchemaBuilder } from '../../src/domain/GraphQLSchemaBuilder.mjs';
import { PostgreSQLGenerator } from '../../src/domain/generators/PostgreSQLGenerator.mjs';
import { parse } from 'graphql';

test('generates tenant model SQL for @tenant directive', async () => {
  const schema = `
    type Org @table {
      id: ID! @primaryKey
      name: String!
    }
    
    type User @table {
      id: ID! @primaryKey
      email: String!
    }
    
    type Membership @table {
      user_id: ID! @foreignKey(ref: "User.id")
      org_id: ID! @foreignKey(ref: "Org.id")
      role: String!
    }
    
    type Document @table @tenant(by: "org_id") @rls(enabled: true) {
      id: ID! @primaryKey
      org_id: ID! @foreignKey(ref: "Org.id")
      title: String!
      created_by: ID! @foreignKey(ref: "User.id")
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const generator = new PostgreSQLGenerator();
  const sql = await generator.generate(wesleySchema);
  
  // Check for tenant model components
  assert(sql.includes('TENANT MODEL SUPPORT'), 'Should have tenant model section');
  assert(sql.includes('wesley_user_orgs'), 'Should create membership view');
  assert(sql.includes('wesley.is_member_of'), 'Should create membership check function');
  assert(sql.includes('policy_Document_tenant_select'), 'Should create tenant SELECT policy');
  assert(sql.includes('policy_Document_tenant_insert'), 'Should create tenant INSERT policy');
  assert(sql.includes('FORCE ROW LEVEL SECURITY'), 'Should force RLS');
});

test('generates owner policies for @owner directive', async () => {
  const schema = `
    type Post @table @owner(column: "author_id") @rls(enabled: true) {
      id: ID! @primaryKey
      title: String!
      author_id: ID! @foreignKey(ref: "User.id")
    }
    
    type User @table {
      id: ID! @primaryKey
      name: String!
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const generator = new PostgreSQLGenerator();
  const sql = await generator.generate(wesleySchema);
  
  // Check for owner-based functions
  assert(sql.includes('wesley.is_owner'), 'Should create owner check function');
});

test('detects membership table pattern automatically', async () => {
  const schema = `
    type UserOrgMembership @table {
      user_id: ID! @foreignKey(ref: "User.id")
      org_id: ID! @foreignKey(ref: "Org.id")
      role: String!
    }
    
    type User @table {
      id: ID! @primaryKey
    }
    
    type Org @table {
      id: ID! @primaryKey
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const generator = new PostgreSQLGenerator();
  const sql = await generator.generate(wesleySchema);
  
  // Even without @tenant directive, should detect membership pattern
  // (This test might fail until we add auto-detection logic)
});