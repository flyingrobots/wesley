/**
 * RLS Presets Tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { RLSPresets } from '../src/domain/RLSPresets.mjs';
import { GraphQLSchemaBuilder } from '../src/domain/GraphQLSchemaBuilder.mjs';
import { PostgreSQLGenerator } from '../src/domain/generators/PostgreSQLGenerator.mjs';
import { parse } from 'graphql';

test('generates owner preset RLS policies', async () => {
  const schema = `
    type Post @table 
      @rls(enabled: true, preset: "owner") {
      id: ID! @primaryKey
      title: String!
      created_by: ID! @foreignKey(ref: "User.id")
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
  
  // Check for owner-based policies
  assert(sql.includes('auth.uid() = created_by'), 'Should use owner column in policies');
  assert(sql.includes('FOR SELECT'), 'Should have SELECT policy');
  assert(sql.includes('FOR INSERT'), 'Should have INSERT policy');
  assert(sql.includes('FOR UPDATE'), 'Should have UPDATE policy');
  assert(sql.includes('FOR DELETE'), 'Should have DELETE policy');
});

test('generates tenant preset with auto-detection', async () => {
  const schema = `
    type Organization @table {
      id: ID! @primaryKey
      name: String!
    }
    
    type Membership @table {
      user_id: ID! @foreignKey(ref: "User.id")
      org_id: ID! @foreignKey(ref: "Organization.id")
      role: String!
    }
    
    type Document @table 
      @rls(enabled: true, preset: "tenant") {
      id: ID! @primaryKey
      org_id: ID! @foreignKey(ref: "Organization.id")
      title: String!
    }
    
    type User @table {
      id: ID! @primaryKey
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const generator = new PostgreSQLGenerator();
  const sql = await generator.generate(wesleySchema);
  
  // Check for tenant helper functions
  assert(sql.includes('wesley.is_member_of'), 'Should create membership check function');
  assert(sql.includes('wesley.has_role_in'), 'Should create role check function');
  
  // Check it detected org_id column
  assert(sql.includes('is_member_of(org_id)'), 'Should use detected org_id column');
});

test('generates public-read preset', async () => {
  const schema = `
    type BlogPost @table 
      @rls(enabled: true, preset: "public-read") {
      id: ID! @primaryKey
      title: String!
      content: String!
      author_id: ID! @foreignKey(ref: "User.id")
    }
    
    type User @table {
      id: ID! @primaryKey
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const generator = new PostgreSQLGenerator();
  const sql = await generator.generate(wesleySchema);
  
  // Check for public read, owner write
  assert(sql.includes('USING (true)'), 'Should allow public SELECT');
  assert(sql.includes('auth.uid() = author_id'), 'Should restrict writes to owner');
});

test('supports preset with custom options', async () => {
  const schema = `
    type Document @table 
      @rls(
        enabled: true, 
        preset: {
          name: "owner",
          options: {
            owner_column: "document_owner"
          }
        }
      ) {
      id: ID! @primaryKey
      title: String!
      document_owner: ID! @foreignKey(ref: "User.id")
    }
    
    type User @table {
      id: ID! @primaryKey
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const generator = new PostgreSQLGenerator();
  const sql = await generator.generate(wesleySchema);
  
  // Check it uses custom owner column
  assert(sql.includes('auth.uid() = document_owner'), 'Should use custom owner column');
});

test('lists all available presets', () => {
  const presets = new RLSPresets();
  const list = presets.list();
  
  assert(list.find(p => p.name === 'owner'), 'Should have owner preset');
  assert(list.find(p => p.name === 'tenant'), 'Should have tenant preset');
  assert(list.find(p => p.name === 'public-read'), 'Should have public-read preset');
  assert(list.find(p => p.name === 'authenticated'), 'Should have authenticated preset');
  assert(list.find(p => p.name === 'admin-only'), 'Should have admin-only preset');
  assert(list.find(p => p.name === 'soft-delete'), 'Should have soft-delete preset');
  assert(list.find(p => p.name === 'hierarchical'), 'Should have hierarchical preset');
});

test('validates required options', () => {
  const presets = new RLSPresets();
  
  assert.throws(() => {
    presets.apply('owner', 'test_table', {});
  }, /requires option: owner_column/);
  
  assert.throws(() => {
    presets.apply('tenant', 'test_table', { tenant_column: 'org_id' });
  }, /requires option: membership_table/);
});

test('generates pgTAP tests for presets', () => {
  const presets = new RLSPresets();
  
  const tests = presets.generateTests('owner', 'posts', {
    owner_column: 'author_id'
  });
  
  assert(tests.includes('Owner can select their records'), 'Should test owner access');
  assert(tests.includes('Non-owner cannot see other records'), 'Should test non-owner restriction');
});

test('handles custom preset registration', () => {
  const presets = new RLSPresets();
  
  presets.register('custom-preset', {
    description: 'Custom security pattern',
    requires: ['custom_field'],
    policies: {
      select: '{custom_field} = true',
      insert: 'false',
      update: 'false', 
      delete: 'false'
    },
    helperFunctions: [],
    indexes: ['{custom_field}']
  });
  
  assert(presets.has('custom-preset'), 'Should register custom preset');
  
  const sql = presets.generateSQL('custom-preset', 'test_table', {
    custom_field: 'is_public'
  });
  
  assert(sql.includes('is_public = true'), 'Should use custom field in policy');
});