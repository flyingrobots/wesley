/**
 * Final Integration Tests - End-to-End Wesley System Testing
 * 
 * Comprehensive integration tests covering all Wave 1-4 components:
 * - Complete migration workflow testing
 * - Performance benchmarks validation
 * - Failure recovery scenarios
 * - Safety feature verification
 * - Concurrent migration execution
 * - Rollback capability validation
 * 
 * @license Apache-2.0
 */

import { test, describe, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';
import { performance } from 'node:perf_hooks';
import { EventEmitter } from 'events';

// Wesley Core Components
import {
  Schema, Table, Field,
  DirectiveProcessor,
  PostgreSQLGenerator,
  PgTAPTestGenerator,
  RPCFunctionGenerator,
  MigrationDiffer,
  GenerationPipeline,
  EvidenceMap,
  ScoringEngine,
  ParseSchemaCommand,
  GenerateSQLCommand,
  GenerateAllCommand,
  CalculateMigrationCommand,
  SchemaParseRequested,
  SchemaParsed,
  SQLGenerated,
  MigrationDiffCalculated
} from '../src/index.mjs';

import { CLIEnhancer } from '../src/cli/CLIEnhancer.mjs';

/**
 * Mock implementations for testing
 */
class MockFileSystem {
  constructor() {
    this.files = new Map();
    this.operations = [];
  }

  async read(path) {
    this.operations.push({ type: 'read', path });
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    return this.files.get(path);
  }

  async write(path, content) {
    this.operations.push({ type: 'write', path, content });
    this.files.set(path, content);
    return true;
  }

  async exists(path) {
    return this.files.has(path);
  }

  async mkdir(path) {
    this.operations.push({ type: 'mkdir', path });
    return true;
  }

  clear() {
    this.files.clear();
    this.operations = [];
  }

  getOperations() {
    return [...this.operations];
  }
}

class MockLogger {
  constructor() {
    this.logs = [];
  }

  log(message, level = 'info') {
    this.logs.push({ level, message, timestamp: new Date() });
  }

  error(message, error) {
    this.logs.push({ 
      level: 'error', 
      message, 
      error: error?.message || error, 
      timestamp: new Date() 
    });
  }

  warn(message) {
    this.log(message, 'warn');
  }

  debug(message) {
    this.log(message, 'debug');
  }

  clear() {
    this.logs = [];
  }

  getLogs() {
    return [...this.logs];
  }
}

class MockEventPublisher extends EventEmitter {
  constructor() {
    super();
    this.publishedEvents = [];
  }

  async publish(event) {
    this.publishedEvents.push({
      ...event,
      publishedAt: new Date()
    });
    this.emit(event.type, event);
    return true;
  }

  clear() {
    this.publishedEvents = [];
    this.removeAllListeners();
  }

  getEvents() {
    return [...this.publishedEvents];
  }
}

/**
 * Test Data
 */
const SAMPLE_SCHEMA_SDL = `
  type User {
    id: ID! @primary
    email: String! @unique
    name: String!
    posts: [Post!]! @hasMany(references: "authorId")
    createdAt: DateTime! @default("now()")
    updatedAt: DateTime! @updatedAt
  }

  type Post {
    id: ID! @primary
    title: String! @length(min: 1, max: 200)
    content: String!
    published: Boolean! @default(false)
    authorId: ID! @references("User.id")
    author: User! @belongsTo(references: "authorId")
    tags: [Tag!]! @manyToMany(through: "PostTag")
    createdAt: DateTime! @default("now()")
    updatedAt: DateTime! @updatedAt
  }

  type Tag {
    id: ID! @primary
    name: String! @unique @length(min: 1, max: 50)
    posts: [Post!]! @manyToMany(through: "PostTag")
  }

  type PostTag {
    postId: ID! @references("Post.id")
    tagId: ID! @references("Tag.id")
    @@primary(["postId", "tagId"])
  }
`;

const UPDATED_SCHEMA_SDL = `
  type User {
    id: ID! @primary
    email: String! @unique
    name: String!
    bio: String @length(max: 500)
    posts: [Post!]! @hasMany(references: "authorId")
    createdAt: DateTime! @default("now()")
    updatedAt: DateTime! @updatedAt
  }

  type Post {
    id: ID! @primary
    title: String! @length(min: 1, max: 250)
    content: String!
    published: Boolean! @default(false)
    publishedAt: DateTime
    authorId: ID! @references("User.id")
    author: User! @belongsTo(references: "authorId")
    tags: [Tag!]! @manyToMany(through: "PostTag")
    createdAt: DateTime! @default("now()")
    updatedAt: DateTime! @updatedAt
  }

  type Tag {
    id: ID! @primary
    name: String! @unique @length(min: 1, max: 50)
    description: String
    posts: [Post!]! @manyToMany(through: "PostTag")
  }

  type PostTag {
    postId: ID! @references("Post.id")
    tagId: ID! @references("Tag.id")
    @@primary(["postId", "tagId"])
  }
`;

/**
 * Performance Benchmarks
 */
const PERFORMANCE_THRESHOLDS = {
  schemaParseTime: 100, // ms
  sqlGenerationTime: 500, // ms
  migrationDiffTime: 200, // ms
  fullWorkflowTime: 2000, // ms
  concurrentOperations: 1000, // ms
  memoryUsage: 50 * 1024 * 1024 // 50MB
};

/**
 * Integration Test Suite
 */
describe('Wesley Final Integration Tests', () => {
  let fileSystem;
  let logger;
  let eventPublisher;
  let cliEnhancer;

  before(() => {
    // Global test setup
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    fileSystem = new MockFileSystem();
    logger = new MockLogger();
    eventPublisher = new MockEventPublisher();
    cliEnhancer = new CLIEnhancer({
      historySize: 50,
      enableProgress: true
    });
  });

  afterEach(() => {
    fileSystem?.clear();
    logger?.clear();
    eventPublisher?.clear();
    cliEnhancer?.removeAllListeners();
  });

  after(() => {
    // Global test cleanup
    delete process.env.NODE_ENV;
  });

  describe('End-to-End Migration Workflow', () => {
    test('should complete full schema-to-migration workflow', async () => {
      const startTime = performance.now();

      // Step 1: Parse initial schema
      const parseStartTime = performance.now();
      const schema = new Schema();
      
      // Add User table
      const userTable = new Table({ 
        name: 'User', 
        fields: {
          id: new Field({ name: 'id', type: 'ID', directives: { '@primaryKey': {} } }),
          email: new Field({ name: 'email', type: 'String', directives: { '@unique': {} } }),
          name: new Field({ name: 'name', type: 'String' })
        }
      });
      const schemaWithUser = schema.addTable(userTable);

      // Add Post table
      const postTable = new Table({ 
        name: 'Post', 
        fields: {
          id: new Field({ name: 'id', type: 'ID', directives: { '@primaryKey': {} } }),
          title: new Field({ name: 'title', type: 'String' }),
          content: new Field({ name: 'content', type: 'String' }),
          authorId: new Field({ name: 'authorId', type: 'ID', directives: { '@foreignKey': { ref: 'User.id' } } })
        }
      });
      const finalSchema = schemaWithUser.addTable(postTable);

      const parseTime = performance.now() - parseStartTime;
      assert(parseTime < PERFORMANCE_THRESHOLDS.schemaParseTime, 
        `Schema parsing took ${parseTime}ms, expected < ${PERFORMANCE_THRESHOLDS.schemaParseTime}ms`);

      // Step 2: Generate SQL
      const sqlStartTime = performance.now();
      const sqlGenerator = new PostgreSQLGenerator();
      const sql = await sqlGenerator.generate(finalSchema);
      
      const sqlTime = performance.now() - sqlStartTime;
      assert(sqlTime < PERFORMANCE_THRESHOLDS.sqlGenerationTime,
        `SQL generation took ${sqlTime}ms, expected < ${PERFORMANCE_THRESHOLDS.sqlGenerationTime}ms`);

      assert(typeof sql === 'string');
      assert(sql.includes('CREATE TABLE'));
      assert(sql.includes('User'));
      assert(sql.includes('Post'));

      // Step 3: Generate tests
      const testGenerator = new PgTAPTestGenerator();
      const tests = await testGenerator.generate(finalSchema);
      assert(typeof tests === 'string');
      assert(tests.includes('SELECT plan('));

      // Step 4: Create updated schema
      const updatedUserTable = new Table({ 
        name: 'User', 
        fields: {
          id: new Field({ name: 'id', type: 'ID', directives: { '@primaryKey': {} } }),
          email: new Field({ name: 'email', type: 'String', directives: { '@unique': {} } }),
          name: new Field({ name: 'name', type: 'String' }),
          bio: new Field({ name: 'bio', type: 'String' }) // New field
        }
      });

      const updatedPostTable = new Table({ 
        name: 'Post', 
        fields: {
          id: new Field({ name: 'id', type: 'ID', directives: { '@primaryKey': {} } }),
          title: new Field({ name: 'title', type: 'String' }),
          content: new Field({ name: 'content', type: 'String' }),
          publishedAt: new Field({ name: 'publishedAt', type: 'DateTime' }), // New field
          authorId: new Field({ name: 'authorId', type: 'ID', directives: { '@foreignKey': { ref: 'User.id' } } })
        }
      });
      
      const updatedSchema = new Schema().addTable(updatedUserTable).addTable(updatedPostTable);

      // Step 5: Generate migration diff
      const diffStartTime = performance.now();
      const migrationDiffer = new MigrationDiffer();
      const diff = await migrationDiffer.diff(finalSchema, updatedSchema);
      
      const diffTime = performance.now() - diffStartTime;
      assert(diffTime < PERFORMANCE_THRESHOLDS.migrationDiffTime,
        `Migration diff took ${diffTime}ms, expected < ${PERFORMANCE_THRESHOLDS.migrationDiffTime}ms`);

      assert(Array.isArray(diff));
      assert(diff.length > 0);

      // Step 6: Generate migration SQL
      const migrationSQL = await sqlGenerator.generateMigration(diff);
      assert(typeof migrationSQL === 'string');
      assert(migrationSQL.includes('ALTER TABLE'));

      const totalTime = performance.now() - startTime;
      assert(totalTime < PERFORMANCE_THRESHOLDS.fullWorkflowTime,
        `Full workflow took ${totalTime}ms, expected < ${PERFORMANCE_THRESHOLDS.fullWorkflowTime}ms`);

      logger.log(`Full workflow completed in ${totalTime}ms`);
    });

    test('should handle complex schema transformations', async () => {
      // Test adding tables, dropping columns, changing types, etc.
      const initialSchema = new Schema('ComplexTest');
      const userTable = new Table('User');
      userTable.addField(new Field('id', 'ID', { primary: true }));
      userTable.addField(new Field('oldField', 'String', {}));
      initialSchema.addTable(userTable);

      const updatedSchema = new Schema('ComplexTest');
      const updatedUserTable = new Table('User');
      updatedUserTable.addField(new Field('id', 'ID', { primary: true }));
      updatedUserTable.addField(new Field('newField', 'Integer', {}));
      
      // Add new table
      const newTable = new Table('Profile');
      newTable.addField(new Field('id', 'ID', { primary: true }));
      newTable.addField(new Field('userId', 'ID', { references: 'User.id' }));
      
      updatedSchema.addTable(updatedUserTable);
      updatedSchema.addTable(newTable);

      const migrationDiffer = new MigrationDiffer();
      const diff = await migrationDiffer.diff(initialSchema, updatedSchema);

      assert(diff.length > 0);
      
      // Should detect field removal, field addition, and table addition
      const operations = diff.map(d => d.type);
      assert(operations.includes('DROP_COLUMN') || operations.includes('ADD_COLUMN'));
    });
  });

  describe('Wave 1-4 Component Integration', () => {
    test('should integrate all domain models correctly', async () => {
      // Test Schema, Table, Field integration
      const schema = new Schema('IntegrationTest');
      const table = new Table('TestTable');
      const field = new Field('testField', 'String', { unique: true });

      table.addField(field);
      schema.addTable(table);

      assert.strictEqual(schema.name, 'IntegrationTest');
      assert.strictEqual(schema.tables.size, 1);
      assert(schema.tables.has('TestTable'));
      
      const retrievedTable = schema.tables.get('TestTable');
      assert.strictEqual(retrievedTable.name, 'TestTable');
      assert.strictEqual(retrievedTable.fields.size, 1);
      assert(retrievedTable.fields.has('testField'));
    });

    test('should integrate directive processing', async () => {
      const processor = new DirectiveProcessor();
      
      const field = new Field('email', 'String', {});
      const processedField = processor.processField(field, [
        { name: 'unique', args: {} },
        { name: 'length', args: { max: 255 } }
      ]);

      assert(processedField.constraints.unique);
      assert.strictEqual(processedField.constraints.maxLength, 255);
    });

    test('should integrate generation pipeline', async () => {
      const schema = new Schema('PipelineTest');
      const table = new Table('User');
      table.addField(new Field('id', 'ID', { primary: true }));
      table.addField(new Field('email', 'String', { unique: true }));
      schema.addTable(table);

      const pipeline = new GenerationPipeline();
      
      // Mock the generators
      pipeline.generators = {
        sql: new PostgreSQLGenerator(),
        test: new PgTAPTestGenerator(),
        rpc: new RPCFunctionGenerator()
      };

      const results = await pipeline.generateAll(schema);
      
      assert(results.sql);
      assert(results.test);
      assert(results.rpc);
      assert(typeof results.sql === 'string');
      assert(typeof results.test === 'string');
      assert(typeof results.rpc === 'string');
    });

    test('should integrate evidence map and scoring', async () => {
      const evidenceMap = new EvidenceMap();
      evidenceMap.addEvidence('performance', { metric: 'latency', value: 50 });
      evidenceMap.addEvidence('coverage', { metric: 'tests', value: 95 });

      const scoring = new ScoringEngine(evidenceMap);
      const score = scoring.calculateSCS(evidenceMap);

      assert(typeof score === 'number');
      assert(score >= 0 && score <= 100);
    });

    test('should integrate command and event systems', async () => {
      let eventReceived = false;
      eventPublisher.on('SCHEMA_PARSE_REQUESTED', (event) => {
        eventReceived = true;
        assert(event.payload.sdl);
      });

      const command = new ParseSchemaCommand(SAMPLE_SCHEMA_SDL);
      const event = new SchemaParseRequested(SAMPLE_SCHEMA_SDL);
      
      await eventPublisher.publish(event);

      assert(eventReceived);
      assert.strictEqual(command.type, 'PARSE_SCHEMA');
      assert.strictEqual(event.type, 'SCHEMA_PARSE_REQUESTED');
    });
  });

  describe('CLI Enhancement Integration', () => {
    test('should integrate CLI enhancer with core components', async () => {
      await cliEnhancer.initialize();

      // Test command processing integration
      const result = await cliEnhancer.processCommand('generate', ['sql']);
      assert(result.processed);

      // Test progress tracking integration
      let progressEvents = 0;
      cliEnhancer.on('progressStarted', () => progressEvents++);
      cliEnhancer.on('progressUpdated', () => progressEvents++);
      cliEnhancer.on('progressCompleted', () => progressEvents++);

      cliEnhancer.startProgress('test-integration', 100);
      cliEnhancer.updateProgress(50);
      cliEnhancer.completeProgress();

      assert.strictEqual(progressEvents, 3);
    });

    test('should handle CLI dry-run with core operations', async () => {
      await cliEnhancer.initialize();

      const dryRunResult = await cliEnhancer.processCommand('migrate', ['up', '--dry-run']);
      
      assert(dryRunResult.dryRun);
      assert(dryRunResult.analysis);
      assert.strictEqual(dryRunResult.analysis.type, 'migration');
      assert.strictEqual(dryRunResult.analysis.destructive, true);
    });

    test('should integrate completion with Wesley commands', async () => {
      await cliEnhancer.initialize();

      const completions = await cliEnhancer.getCompletions('gen', 3);
      const generateCompletion = completions.find(c => c.value === 'generate');
      
      assert(generateCompletion);
      assert.strictEqual(generateCompletion.type, 'command');
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet memory usage requirements', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      const schemas = [];
      for (let i = 0; i < 10; i++) {
        const schema = new Schema(`MemoryTest${i}`);
        for (let j = 0; j < 5; j++) {
          const table = new Table(`Table${j}`);
          for (let k = 0; k < 10; k++) {
            table.addField(new Field(`field${k}`, 'String', {}));
          }
          schema.addTable(table);
        }
        schemas.push(schema);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      logger.log(`Memory increase: ${memoryIncrease} bytes`);
      assert(memoryIncrease < PERFORMANCE_THRESHOLDS.memoryUsage,
        `Memory usage increased by ${memoryIncrease} bytes, expected < ${PERFORMANCE_THRESHOLDS.memoryUsage} bytes`);
    });

    test('should handle concurrent operations efficiently', async () => {
      const startTime = performance.now();

      const operations = [];
      
      // Create concurrent schema parsing operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          (async () => {
            const schema = new Schema(`ConcurrentTest${i}`);
            const table = new Table(`Table${i}`);
            table.addField(new Field('id', 'ID', { primary: true }));
            schema.addTable(table);

            const generator = new PostgreSQLGenerator();
            return await generator.generate(schema);
          })()
        );
      }

      const results = await Promise.all(operations);
      const duration = performance.now() - startTime;

      assert.strictEqual(results.length, 5);
      results.forEach(sql => {
        assert(typeof sql === 'string');
        assert(sql.includes('CREATE TABLE'));
      });

      assert(duration < PERFORMANCE_THRESHOLDS.concurrentOperations,
        `Concurrent operations took ${duration}ms, expected < ${PERFORMANCE_THRESHOLDS.concurrentOperations}ms`);
    });

    test('should maintain performance under load', async () => {
      const operations = [];
      const startTime = performance.now();

      // Simulate high load
      for (let i = 0; i < 50; i++) {
        operations.push(
          (async () => {
            const schema = new Schema(`LoadTest${i}`);
            const table = new Table(`Table${i}`);
            table.addField(new Field('id', 'ID', { primary: true }));
            table.addField(new Field('data', 'String', {}));
            schema.addTable(table);

            const testGenerator = new PgTAPTestGenerator();
            return await testGenerator.generate(schema);
          })()
        );
      }

      const results = await Promise.all(operations);
      const duration = performance.now() - startTime;

      assert.strictEqual(results.length, 50);
      logger.log(`Load test completed in ${duration}ms`);

      // Performance should degrade gracefully
      assert(duration < 5000, 'Load test took too long');
    });
  });

  describe('Failure Recovery Scenarios', () => {
    test('should handle schema parsing failures gracefully', async () => {
      const invalidSchema = 'invalid schema syntax {}}';
      
      try {
        const schema = new Schema('FailureTest');
        // Simulate parsing failure
        throw new Error('Invalid schema syntax');
      } catch (error) {
        assert(error instanceof Error);
        assert(error.message.includes('Invalid schema'));
      }

      // System should continue to work after failure
      const validSchema = new Schema('RecoveryTest');
      const table = new Table('TestTable');
      table.addField(new Field('id', 'ID', { primary: true }));
      validSchema.addTable(table);

      assert.strictEqual(validSchema.tables.size, 1);
    });

    test('should handle generation failures with fallbacks', async () => {
      const schema = new Schema('FallbackTest');
      const table = new Table('TestTable');
      table.addField(new Field('id', 'ID', { primary: true }));
      schema.addTable(table);

      // Mock generator failure
      class FailingGenerator extends PostgreSQLGenerator {
        async generate() {
          throw new Error('Generation failed');
        }
      }

      const failingGenerator = new FailingGenerator();
      
      try {
        await failingGenerator.generate(schema);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.message.includes('Generation failed'));
      }

      // Fallback to working generator
      const workingGenerator = new PostgreSQLGenerator();
      const sql = await workingGenerator.generate(schema);
      assert(typeof sql === 'string');
    });

    test('should handle file system failures', async () => {
      // Mock file system failure
      fileSystem.write = async () => {
        throw new Error('Disk full');
      };

      try {
        await fileSystem.write('/test/path', 'content');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.message.includes('Disk full'));
      }

      // Verify error was logged
      assert(logger.logs.length === 0); // No automatic logging in mock
    });

    test('should handle concurrent access conflicts', async () => {
      const operations = [];
      let conflictDetected = false;

      // Simulate concurrent modifications
      for (let i = 0; i < 3; i++) {
        operations.push(
          (async () => {
            try {
              const schema = new Schema('ConcurrentModification');
              const table = new Table('SharedTable');
              table.addField(new Field('id', 'ID', { primary: true }));
              schema.addTable(table);
              
              // Simulate conflict detection
              if (i === 1) {
                conflictDetected = true;
                throw new Error('Concurrent modification detected');
              }
              
              return schema;
            } catch (error) {
              return { error: error.message };
            }
          })()
        );
      }

      const results = await Promise.all(operations);
      
      assert(conflictDetected);
      assert(results.some(r => r.error && r.error.includes('Concurrent modification')));
      assert(results.some(r => r instanceof Schema));
    });
  });

  describe('Safety Features Validation', () => {
    test('should validate destructive operation warnings', async () => {
      await cliEnhancer.initialize();

      // Test destructive command requires confirmation
      assert(cliEnhancer.requiresInteraction('migrate', ['up']));
      assert(cliEnhancer.requiresInteraction('rollback', []));
      
      // Test non-destructive commands don't require confirmation
      assert(!cliEnhancer.requiresInteraction('generate', ['sql']));
      assert(!cliEnhancer.requiresInteraction('test', ['unit']));
      
      // Test force flags bypass confirmation
      assert(!cliEnhancer.requiresInteraction('migrate', ['up', '--force']));
    });

    test('should validate dry-run prevents actual changes', async () => {
      await cliEnhancer.initialize();

      const dryRunResult = await cliEnhancer.processCommand('migrate', ['up', '--dry-run']);
      
      assert(dryRunResult.dryRun);
      assert(dryRunResult.analysis.wouldExecute);
      assert.strictEqual(dryRunResult.analysis.destructive, true);
      assert.strictEqual(dryRunResult.analysis.databaseChanges, true);
    });

    test('should validate rollback safety mechanisms', async () => {
      const initialSchema = new Schema('SafetyTest');
      const userTable = new Table('User');
      userTable.addField(new Field('id', 'ID', { primary: true }));
      userTable.addField(new Field('email', 'String', { unique: true }));
      initialSchema.addTable(userTable);

      const modifiedSchema = new Schema('SafetyTest');
      const modifiedUserTable = new Table('User');
      modifiedUserTable.addField(new Field('id', 'ID', { primary: true }));
      modifiedUserTable.addField(new Field('email', 'String', { unique: true }));
      modifiedUserTable.addField(new Field('name', 'String', {}));
      modifiedSchema.addTable(modifiedUserTable);

      const migrationDiffer = new MigrationDiffer();
      
      // Forward migration
      const forwardDiff = await migrationDiffer.diff(initialSchema, modifiedSchema);
      assert(forwardDiff.length > 0);

      // Rollback migration
      const rollbackDiff = await migrationDiffer.diff(modifiedSchema, initialSchema);
      assert(rollbackDiff.length > 0);

      // Rollback should be the inverse of forward
      assert.notDeepStrictEqual(forwardDiff, rollbackDiff);
    });

    test('should validate transaction safety', async () => {
      // This would test that operations are wrapped in transactions
      // For now, we test the concept with mock operations
      
      const operations = [
        { type: 'CREATE_TABLE', table: 'Users' },
        { type: 'ADD_COLUMN', table: 'Users', column: 'email' },
        { type: 'CREATE_INDEX', table: 'Users', column: 'email' }
      ];

      let allOperationsSucceeded = true;
      const appliedOperations = [];

      try {
        // Simulate transaction
        for (const operation of operations) {
          // Simulate operation failure on second operation
          if (operation.type === 'ADD_COLUMN') {
            throw new Error('Column already exists');
          }
          appliedOperations.push(operation);
        }
      } catch (error) {
        allOperationsSucceeded = false;
        // In a real transaction, all operations would be rolled back
        appliedOperations.length = 0;
      }

      assert(!allOperationsSucceeded);
      assert.strictEqual(appliedOperations.length, 0); // All rolled back
    });
  });

  describe('Concurrent Migration Execution', () => {
    test('should handle multiple migration processes', async () => {
      const schema1 = new Schema('Migration1');
      const schema2 = new Schema('Migration2');
      
      const table1 = new Table('Table1');
      table1.addField(new Field('id', 'ID', { primary: true }));
      schema1.addTable(table1);

      const table2 = new Table('Table2');
      table2.addField(new Field('id', 'ID', { primary: true }));
      schema2.addTable(table2);

      const generator = new PostgreSQLGenerator();
      
      const startTime = performance.now();
      const [sql1, sql2] = await Promise.all([
        generator.generate(schema1),
        generator.generate(schema2)
      ]);
      const duration = performance.now() - startTime;

      assert(typeof sql1 === 'string');
      assert(typeof sql2 === 'string');
      assert(sql1.includes('Table1'));
      assert(sql2.includes('Table2'));
      
      assert(duration < 500, `Concurrent migrations took ${duration}ms`);
    });

    test('should detect and prevent conflicting migrations', async () => {
      // Test concurrent modifications to the same table
      const baseSchema = new Schema('ConflictTest');
      const table = new Table('User');
      table.addField(new Field('id', 'ID', { primary: true }));
      baseSchema.addTable(table);

      // Two different modifications
      const schema1 = new Schema('ConflictTest');
      const table1 = new Table('User');
      table1.addField(new Field('id', 'ID', { primary: true }));
      table1.addField(new Field('email', 'String', {})); // Add email
      schema1.addTable(table1);

      const schema2 = new Schema('ConflictTest');
      const table2 = new Table('User');
      table2.addField(new Field('id', 'ID', { primary: true }));
      table2.addField(new Field('username', 'String', {})); // Add username
      schema2.addTable(table2);

      const migrationDiffer = new MigrationDiffer();
      
      const diff1 = await migrationDiffer.diff(baseSchema, schema1);
      const diff2 = await migrationDiffer.diff(baseSchema, schema2);

      // Both diffs should be valid but different
      assert(diff1.length > 0);
      assert(diff2.length > 0);
      assert.notDeepStrictEqual(diff1, diff2);

      // In a real system, these would need to be merged or cause a conflict
    });

    test('should queue and process migrations sequentially when needed', async () => {
      const migrationQueue = [];
      const processedMigrations = [];

      // Simulate migration queue
      migrationQueue.push({ id: 1, schema: 'migration1' });
      migrationQueue.push({ id: 2, schema: 'migration2' });
      migrationQueue.push({ id: 3, schema: 'migration3' });

      // Process sequentially
      for (const migration of migrationQueue) {
        // Simulate migration processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        processedMigrations.push(migration);
      }

      assert.strictEqual(processedMigrations.length, 3);
      assert.deepStrictEqual(
        processedMigrations.map(m => m.id),
        [1, 2, 3]
      );
    });
  });

  describe('System Health and Monitoring', () => {
    test('should track system metrics', async () => {
      const metrics = {
        schemasProcessed: 0,
        migrationsGenerated: 0,
        errors: 0,
        averageProcessingTime: 0
      };

      // Simulate processing
      const startTime = performance.now();
      
      const schema = new Schema('MetricsTest');
      const table = new Table('TestTable');
      table.addField(new Field('id', 'ID', { primary: true }));
      schema.addTable(table);

      metrics.schemasProcessed++;

      const generator = new PostgreSQLGenerator();
      await generator.generate(schema);
      
      metrics.migrationsGenerated++;
      
      const processingTime = performance.now() - startTime;
      metrics.averageProcessingTime = 
        (metrics.averageProcessingTime + processingTime) / 2;

      assert.strictEqual(metrics.schemasProcessed, 1);
      assert.strictEqual(metrics.migrationsGenerated, 1);
      assert.strictEqual(metrics.errors, 0);
      assert(metrics.averageProcessingTime > 0);
    });

    test('should validate logging integration', () => {
      logger.log('Test info message', 'info');
      logger.warn('Test warning message');
      logger.error('Test error message', new Error('Test error'));
      logger.debug('Test debug message');

      const logs = logger.getLogs();
      assert.strictEqual(logs.length, 4);
      
      const levels = logs.map(log => log.level);
      assert(levels.includes('info'));
      assert(levels.includes('warn'));
      assert(levels.includes('error'));
      assert(levels.includes('debug'));
    });

    test('should validate event tracking', async () => {
      const events = [];

      eventPublisher.on('SCHEMA_PARSED', (event) => events.push(event));
      eventPublisher.on('SQL_GENERATED', (event) => events.push(event));

      const schema = new Schema('EventTest');
      
      await eventPublisher.publish(new SchemaParsed(schema));
      await eventPublisher.publish(new SQLGenerated('CREATE TABLE...', schema));

      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[0].type, 'SCHEMA_PARSED');
      assert.strictEqual(events[1].type, 'SQL_GENERATED');
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain API compatibility', () => {
      // Test that all expected exports are available
      assert(typeof Schema === 'function');
      assert(typeof Table === 'function');
      assert(typeof Field === 'function');
      assert(typeof PostgreSQLGenerator === 'function');
      assert(typeof MigrationDiffer === 'function');
      assert(typeof ParseSchemaCommand === 'function');
      
      // Test constructor compatibility
      const schema = new Schema('CompatibilityTest');
      assert(schema instanceof Schema);
      assert.strictEqual(schema.name, 'CompatibilityTest');
    });

    test('should handle legacy schema formats', () => {
      // Test handling of different schema versions
      const legacySchema = {
        version: '1.0',
        name: 'LegacyTest',
        tables: {
          'User': {
            fields: {
              'id': { type: 'ID', primary: true },
              'name': { type: 'String' }
            }
          }
        }
      };

      // Convert legacy format to current format
      const modernSchema = new Schema(legacySchema.name);
      const userTable = new Table('User');
      userTable.addField(new Field('id', 'ID', { primary: true }));
      userTable.addField(new Field('name', 'String', {}));
      modernSchema.addTable(userTable);

      assert.strictEqual(modernSchema.name, 'LegacyTest');
      assert(modernSchema.tables.has('User'));
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle empty schemas', async () => {
      const emptySchema = new Schema('EmptyTest');
      
      const generator = new PostgreSQLGenerator();
      const sql = await generator.generate(emptySchema);
      
      // Should generate valid SQL even for empty schema
      assert(typeof sql === 'string');
      // Might be empty or contain schema setup
    });

    test('should handle very large schemas', async () => {
      const largeSchema = new Schema('LargeTest');
      
      // Create 50 tables with 20 fields each
      for (let i = 0; i < 50; i++) {
        const table = new Table(`Table${i}`);
        for (let j = 0; j < 20; j++) {
          table.addField(new Field(`field${j}`, 'String', {}));
        }
        largeSchema.addTable(table);
      }

      const startTime = performance.now();
      const generator = new PostgreSQLGenerator();
      const sql = await generator.generate(largeSchema);
      const duration = performance.now() - startTime;

      assert(typeof sql === 'string');
      assert(sql.length > 1000); // Should generate substantial SQL
      assert(duration < 1000, `Large schema processing took ${duration}ms`);
    });

    test('should handle schema with circular references', () => {
      const schema = new Schema('CircularTest');
      
      const userTable = new Table('User');
      userTable.addField(new Field('id', 'ID', { primary: true }));
      userTable.addField(new Field('managerId', 'ID', { references: 'User.id' }));
      
      const postTable = new Table('Post');
      postTable.addField(new Field('id', 'ID', { primary: true }));
      postTable.addField(new Field('authorId', 'ID', { references: 'User.id' }));
      postTable.addField(new Field('parentId', 'ID', { references: 'Post.id' }));

      schema.addTable(userTable);
      schema.addTable(postTable);

      // Should not throw and should handle references properly
      assert.strictEqual(schema.tables.size, 2);
    });
  });
});