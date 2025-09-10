/**
 * Operation Registry Tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { OperationRegistry } from '../../src/domain/OperationRegistry.mjs';
import { GraphQLSchemaBuilder } from '../../src/domain/GraphQLSchemaBuilder.mjs';
import { parse } from 'graphql';

test('harvests CRUD operations from tables', () => {
  const schema = `
    type User @table {
      id: ID! @primaryKey
      email: String! @unique
      name: String!
    }
    
    type Post @table {
      id: ID! @primaryKey
      title: String!
      author_id: ID! @foreignKey(ref: "User.id")
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const registry = new OperationRegistry();
  const harvested = registry.harvest(wesleySchema);
  
  // Check User operations
  assert(harvested.tables.User, 'Should harvest User table');
  assert.equal(harvested.tables.User.operations.length, 6, 'Should generate 6 CRUD operations');
  
  const userOps = harvested.tables.User.operations;
  assert(userOps.find(op => op.name === 'findOneUser'), 'Should have findOne operation');
  assert(userOps.find(op => op.name === 'findManyUser'), 'Should have findMany operation');
  assert(userOps.find(op => op.name === 'createUser'), 'Should have create operation');
  assert(userOps.find(op => op.name === 'updateUser'), 'Should have update operation');
  assert(userOps.find(op => op.name === 'deleteUser'), 'Should have delete operation');
  assert(userOps.find(op => op.name === 'upsertUser'), 'Should have upsert operation');
  
  // Check operation details
  const createOp = userOps.find(op => op.name === 'createUser');
  assert.equal(createOp.type, 'mutation');
  assert.equal(createOp.category, 'create');
  assert(createOp.generated, 'Should be marked as generated');
  assert(createOp.sql.includes('INSERT INTO'), 'Should have SQL template');
});

test('harvests explicit RPC operations', () => {
  const schema = `
    type User @table {
      id: ID! @primaryKey
      email: String!
    }
    
    type Query {
      getUserByEmail(email: String!): User @rpc(
        sql: "SELECT * FROM user WHERE email = $1"
      )
      
      searchUsers(term: String!): [User!]! @rpc(
        sql: "SELECT * FROM user WHERE name ILIKE $1"
      )
    }
    
    type Mutation {
      deactivateUser(id: ID!): Boolean! @rpc(
        sql: "UPDATE user SET active = false WHERE id = $1"
      )
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  // Simulate adding RPC operations to schema
  wesleySchema.queries = [
    {
      name: 'getUserByEmail',
      args: [{ name: 'email', type: 'String', nonNull: true }],
      returnType: { base: 'User', nonNull: false },
      directives: { '@rpc': { sql: 'SELECT * FROM user WHERE email = $1' } }
    },
    {
      name: 'searchUsers',
      args: [{ name: 'term', type: 'String', nonNull: true }],
      returnType: { base: 'User', list: true, nonNull: true, itemNonNull: true },
      directives: { '@rpc': { sql: 'SELECT * FROM user WHERE name ILIKE $1' } }
    }
  ];
  
  wesleySchema.mutations = [
    {
      name: 'deactivateUser',
      args: [{ name: 'id', type: 'ID', nonNull: true }],
      returnType: { base: 'Boolean', nonNull: true },
      directives: { '@rpc': { sql: 'UPDATE user SET active = false WHERE id = $1' } }
    }
  ];
  
  const registry = new OperationRegistry();
  const harvested = registry.harvest(wesleySchema);
  
  assert.equal(harvested.queries.length, 2, 'Should harvest 2 queries');
  assert.equal(harvested.mutations.length, 1, 'Should harvest 1 mutation');
  
  const getByEmail = harvested.queries.find(q => q.name === 'getUserByEmail');
  assert.equal(getByEmail.type, 'query');
  assert.equal(getByEmail.args.length, 1);
  assert.equal(getByEmail.args[0].name, 'email');
  assert.equal(getByEmail.args[0].required, true);
});

test('extracts table fields and relationships', () => {
  const schema = `
    type User @table {
      id: ID! @primaryKey
      email: String! @unique @email
      posts: [Post!]! @hasMany
    }
    
    type Post @table {
      id: ID! @primaryKey
      title: String!
      author_id: ID! @foreignKey(ref: "User.id") @index
      author: User! @belongsTo
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const registry = new OperationRegistry();
  const harvested = registry.harvest(wesleySchema);
  
  // Check User fields
  const userFields = harvested.tables.User.fields;
  assert.equal(userFields.length, 3);
  
  const emailField = userFields.find(f => f.name === 'email');
  assert(emailField.isUnique, 'Email should be unique');
  assert(emailField.directives['@email'], 'Should have email directive');
  
  // Check relationships
  const userRels = harvested.tables.User.relationships;
  assert(userRels.find(r => r.type === 'hasMany' && r.field === 'posts'));
  
  const postRels = harvested.tables.Post.relationships;
  assert(postRels.find(r => r.type === 'belongsTo' && r.field === 'author'));
  assert(postRels.find(r => r.type === 'foreignKey' && r.field === 'author_id'));
});

test('calculates operation complexity', () => {
  const registry = new OperationRegistry();
  
  const simpleOp = {
    name: 'getUser',
    args: [{ name: 'id' }],
    returnType: { type: 'User' }
  };
  
  const complexOp = {
    name: 'searchUsers',
    args: [
      { name: 'term' },
      { name: 'limit' },
      { name: 'offset' }
    ],
    returnType: { type: 'User', list: true },
    directives: {
      '@auth': { roles: ['admin'] },
      '@rateLimit': { limit: 100 }
    }
  };
  
  const simpleComplexity = registry.calculateComplexity(simpleOp);
  const complexComplexity = registry.calculateComplexity(complexOp);
  
  assert(simpleComplexity < complexComplexity, 'Complex op should have higher complexity');
  assert.equal(simpleComplexity, 1.5); // 1 base + 0.5 for 1 arg
  assert.equal(complexComplexity, 6); // 1 base + 1.5 for 3 args + 2 for list + 1 for auth + 0.5 for rate limit
});

test('exports for Watson integration', () => {
  const schema = `
    type User @table {
      id: ID! @primaryKey
      email: String!
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const registry = new OperationRegistry();
  registry.harvest(wesleySchema);
  
  const watsonExport = registry.exportForWatson();
  
  assert(watsonExport.operations, 'Should have operations');
  assert(watsonExport.metadata, 'Should have metadata');
  assert.equal(watsonExport.metadata.generator, 'wesley');
  
  const createOp = watsonExport.operations.find(op => op.name === 'createUser');
  assert(createOp.signature, 'Should have operation signature');
  assert(createOp.signature.includes('input: UserCreateInput!'));
  assert(createOp.signature.includes(': User!'));
});

test('filters operations by criteria', () => {
  const schema = `
    type User @table {
      id: ID! @primaryKey
    }
    
    type Post @table {
      id: ID! @primaryKey
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const registry = new OperationRegistry();
  registry.harvest(wesleySchema);
  
  // Filter mutations
  const mutations = registry.filter(op => op.type === 'mutation');
  assert(mutations.length > 0, 'Should have mutations');
  assert(mutations.every(op => op.type === 'mutation'), 'All should be mutations');
  
  // Filter User operations
  const userOps = registry.getTableOperations('User');
  assert(userOps.length === 6, 'Should have 6 User operations');
  assert(userOps.every(op => op.name.includes('User')), 'All should be User operations');
});

test('generates summary statistics', () => {
  const schema = `
    type User @table {
      id: ID! @primaryKey
    }
    
    type Post @table {
      id: ID! @primaryKey
    }
  `;
  
  const ast = parse(schema);
  const builder = new GraphQLSchemaBuilder();
  const wesleySchema = builder.buildFromAST(ast);
  
  const registry = new OperationRegistry();
  registry.harvest(wesleySchema);
  
  const json = registry.toJSON();
  
  assert(json.summary, 'Should have summary');
  assert.equal(json.summary.tables, 2, 'Should have 2 tables');
  assert.equal(json.summary.totalOperations, 12, 'Should have 12 total operations (6 per table)');
  assert.equal(json.summary.generatedOperations, 12, 'All should be generated');
  assert.equal(json.summary.customOperations, 0, 'None should be custom');
  
  assert(json.summary.complexityStats, 'Should have complexity stats');
  assert(json.summary.complexityStats.min >= 0, 'Min complexity should be non-negative');
  assert(json.summary.complexityStats.max >= json.summary.complexityStats.min, 'Max should be >= min');
});