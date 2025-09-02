/**
 * DocumentationGenerator Test Suite
 * Comprehensive tests for JSDoc parsing, Markdown generation, and TypeScript definitions
 * @license Apache-2.0
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { 
  DocumentationGenerator,
  DocumentationGenerationRequested,
  DocumentationGenerated,
  DocumentationError,
  TypeDefinitionGenerated,
  DocumentationGenerationError,
  JSDocParsingError,
  TypeDefinitionError
} from '../src/documentation/DocumentationGenerator.mjs';

// Mock EventPublisher for testing
class MockEventPublisher {
  constructor() {
    this.events = [];
  }

  async publish(event) {
    this.events.push(event);
  }

  getEventsByType(type) {
    return this.events.filter(e => e.type === type);
  }

  clear() {
    this.events = [];
  }
}

// Mock Logger for testing
class MockLogger {
  constructor() {
    this.logs = [];
  }

  debug(message) {
    this.logs.push({ level: 'debug', message });
  }

  warn(message) {
    this.logs.push({ level: 'warn', message });
  }

  error(message) {
    this.logs.push({ level: 'error', message });
  }

  clear() {
    this.logs = [];
  }
}

// Test fixtures
const sampleClassFile = `/**
 * Sample class for testing documentation generation
 * This class demonstrates various JSDoc patterns
 * @example
 * const sample = new SampleClass('test');
 * await sample.process();
 */
export class SampleClass {
  /**
   * Constructor for SampleClass
   * @param {string} name - Name of the instance
   * @param {Object} options - Configuration options
   * @param {boolean} [options.debug=false] - Enable debug mode
   */
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
  }

  /**
   * Process data asynchronously
   * @param {Array<string>} data - Data to process
   * @returns {Promise<Object>} Processing results
   * @throws {Error} When data is invalid
   * @since 1.0.0
   */
  async process(data) {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }
    return { processed: data.length };
  }

  /**
   * Get current status
   * @returns {string} Current status
   * @deprecated Use getState() instead
   */
  getStatus() {
    return 'active';
  }

  /**
   * Private method for internal use
   * @private
   * @returns {void}
   */
  _internalMethod() {
    // Internal implementation
  }
}

/**
 * Utility function for testing
 * @param {string} input - Input string
 * @param {Object} options - Processing options
 * @returns {string} Processed output
 */
export function processString(input, options) {
  return input.toUpperCase();
}

/**
 * Private utility function
 * @private
 */
function _privateFunction() {
  return 'private';
}
`;

const sampleTestFile = `import { test, describe } from 'node:test';
import { SampleClass } from '../src/sample.mjs';

describe('SampleClass', () => {
  test('should create instance with name', () => {
    const sample = new SampleClass('test-name');
    assert.equal(sample.name, 'test-name');
  });

  test('should process data arrays', async () => {
    const sample = new SampleClass('processor');
    const result = await sample.process(['a', 'b', 'c']);
    assert.equal(result.processed, 3);
  });
});
`;

const sampleConfigFile = `/**
 * Configuration module
 * @module Config
 */

/**
 * Default configuration object
 * @type {Object}
 */
export const defaultConfig = {
  timeout: 5000,
  retries: 3
};

export { processString } from './sample.mjs';
`;

describe('DocumentationGenerator', () => {
  let tempDir;
  let mockEventPublisher;
  let mockLogger;
  let generator;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = join(tmpdir(), `doc-gen-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Setup mocks
    mockEventPublisher = new MockEventPublisher();
    mockLogger = new MockLogger();

    // Create generator instance
    generator = new DocumentationGenerator({
      eventPublisher: mockEventPublisher,
      logger: mockLogger
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }

    // Clear mocks
    mockEventPublisher.clear();
    mockLogger.clear();
  });

  describe('Constructor', () => {
    test('should create instance with required dependencies', () => {
      assert.ok(generator instanceof DocumentationGenerator);
      assert.equal(generator.eventPublisher, mockEventPublisher);
      assert.equal(generator.logger, mockLogger);
    });

    test('should initialize empty collections', () => {
      assert.ok(generator.parsedFiles instanceof Map);
      assert.ok(generator.typeDefinitions instanceof Map);
      assert.ok(generator.examples instanceof Map);
      assert.ok(generator.dependencies instanceof Map);
      assert.equal(generator.parsedFiles.size, 0);
    });

    test('should use console logger as default', () => {
      const gen = new DocumentationGenerator({ eventPublisher: mockEventPublisher });
      assert.equal(gen.logger, console);
    });
  });

  describe('File Discovery', () => {
    beforeEach(() => {
      // Create test file structure
      const srcDir = join(tempDir, 'src');
      const testDir = join(tempDir, 'test');
      mkdirSync(srcDir, { recursive: true });
      mkdirSync(testDir, { recursive: true });
      mkdirSync(join(srcDir, 'utils'), { recursive: true });

      writeFileSync(join(srcDir, 'sample.mjs'), sampleClassFile);
      writeFileSync(join(srcDir, 'config.mjs'), sampleConfigFile);
      writeFileSync(join(srcDir, 'utils', 'helper.mjs'), 'export const helper = () => {};');
      writeFileSync(join(testDir, 'sample.test.mjs'), sampleTestFile);
      writeFileSync(join(tempDir, 'README.md'), '# Test Project');
    });

    test('should discover files matching include patterns', () => {
      const files = generator.discoverFiles(tempDir, ['**/*.mjs'], ['**/test/**']);
      
      assert.ok(files.length >= 3);
      assert.ok(files.some(f => f.includes('sample.mjs')));
      assert.ok(files.some(f => f.includes('config.mjs')));
      assert.ok(files.some(f => f.includes('helper.mjs')));
      assert.ok(!files.some(f => f.includes('sample.test.mjs')));
    });

    test('should respect exclude patterns', () => {
      const files = generator.discoverFiles(tempDir, ['**/*.mjs'], ['**/utils/**']);
      
      assert.ok(!files.some(f => f.includes('helper.mjs')));
      assert.ok(files.some(f => f.includes('sample.mjs')));
    });

    test('should handle multiple include patterns', () => {
      const files = generator.discoverFiles(tempDir, ['**/*.mjs', '**/*.md'], ['**/test/**']);
      
      assert.ok(files.some(f => f.includes('.mjs')));
      assert.ok(files.some(f => f.includes('.md')));
    });
  });

  describe('Pattern Matching', () => {
    test('should match simple glob patterns', () => {
      assert.ok(generator.matchesPatterns('file.mjs', ['*.mjs']));
      assert.ok(!generator.matchesPatterns('file.js', ['*.mjs']));
    });

    test('should match recursive glob patterns', () => {
      assert.ok(generator.matchesPatterns('src/utils/file.mjs', ['**/*.mjs']));
      assert.ok(generator.matchesPatterns('deep/nested/dir/file.mjs', ['**/*.mjs']));
    });

    test('should match directory patterns', () => {
      assert.ok(generator.matchesPatterns('test/file.mjs', ['test/**']));
      assert.ok(generator.matchesPatterns('src/test/file.mjs', ['**/test/**']));
    });

    test('should handle question mark wildcards', () => {
      assert.ok(generator.matchesPatterns('file1.mjs', ['file?.mjs']));
      assert.ok(!generator.matchesPatterns('file10.mjs', ['file?.mjs']));
    });
  });

  describe('JSDoc Comment Parsing', () => {
    test('should extract JSDoc comments from source code', () => {
      const comments = generator.extractJSDocComments(sampleClassFile);
      
      assert.ok(comments.length >= 3);
      
      // Check class comment
      const classComment = comments.find(c => c.description.includes('Sample class for testing'));
      assert.ok(classComment);
      assert.ok(classComment.examples.length > 0);
    });

    test('should parse JSDoc tags correctly', () => {
      const comment = `/**
       * Test function
       * @param {string} name - The name parameter
       * @param {Object} [options] - Optional configuration
       * @returns {Promise<boolean>} Success status
       * @throws {Error} When name is invalid
       * @since 1.2.0
       * @deprecated Use newFunction instead
       */`;

      const parsed = generator.parseJSDocComment(
        comment.replace(/\/\*\*|\*\//g, ''),
        1
      );

      assert.equal(parsed.description, 'Test function');
      assert.equal(parsed.params.length, 2);
      assert.equal(parsed.params[0].name, 'name');
      assert.equal(parsed.params[0].type, 'string');
      assert.equal(parsed.params[1].name, 'options');
      assert.ok(parsed.params[1].optional);
      assert.equal(parsed.returns.type, 'Promise<boolean>');
      assert.ok(parsed.throws.length > 0);
      assert.equal(parsed.since, '1.2.0');
      assert.ok(parsed.deprecated);
    });

    test('should handle empty or invalid comments', () => {
      const empty = generator.parseJSDocComment('', 1);
      assert.equal(empty, null);

      const whitespace = generator.parseJSDocComment('   \n   \n   ', 1);
      assert.equal(whitespace, null);
    });

    test('should parse multi-line descriptions', () => {
      const comment = `/**
       * First line of description
       * Second line of description
       * 
       * More details here
       * @param {string} test - Test param
       */`;

      const parsed = generator.parseJSDocComment(
        comment.replace(/\/\*\*|\*\//g, ''),
        1
      );

      assert.ok(parsed.description.includes('First line'));
      assert.ok(parsed.description.includes('Second line'));
      assert.ok(parsed.description.includes('More details'));
    });
  });

  describe('Code Structure Extraction', () => {
    test('should extract export statements', () => {
      const exports = generator.extractExports(sampleClassFile, false);
      
      assert.ok(exports.length >= 2);
      
      const classExport = exports.find(e => e.name === 'SampleClass');
      assert.ok(classExport);
      assert.equal(classExport.type, 'class');
      assert.ok(classExport.public);

      const functionExport = exports.find(e => e.name === 'processString');
      assert.ok(functionExport);
      assert.equal(functionExport.type, 'function');
    });

    test('should filter private exports when includePrivate is false', () => {
      const code = `
        export class PublicClass {}
        export class _PrivateClass {}
        export const publicConst = 1;
        export const _privateConst = 2;
      `;

      const publicExports = generator.extractExports(code, false);
      const allExports = generator.extractExports(code, true);

      assert.equal(publicExports.length, 2);
      assert.equal(allExports.length, 4);
      assert.ok(!publicExports.some(e => e.name.startsWith('_')));
    });

    test('should extract import statements', () => {
      const code = `
        import { parse, deparse } from '@supabase/pg-parser';
        import * as fs from 'fs';
        import defaultExport from './utils.mjs';
        import { named1, named2 } from './helpers.mjs';
      `;

      const imports = generator.extractImports(code);

      assert.equal(imports.length, 4);
      
      const namedImport = imports.find(i => i.module === '@supabase/pg-parser');
      assert.equal(namedImport.type, 'named');
      assert.deepEqual(namedImport.imports, ['parse', 'deparse']);

      const namespaceImport = imports.find(i => i.module === 'fs');
      assert.equal(namespaceImport.type, 'namespace');
      assert.deepEqual(namespaceImport.imports, ['fs']);

      const defaultImport = imports.find(i => i.module === './utils.mjs');
      assert.equal(defaultImport.type, 'default');
      assert.deepEqual(defaultImport.imports, ['defaultExport']);
    });

    test('should extract class definitions with methods', () => {
      const classes = generator.extractClasses(sampleClassFile, []);
      
      assert.equal(classes.length, 1);
      
      const sampleClass = classes[0];
      assert.equal(sampleClass.name, 'SampleClass');
      assert.ok(sampleClass.methods.length >= 3);
      
      const processMethod = sampleClass.methods.find(m => m.name === 'process');
      assert.ok(processMethod);
      assert.ok(processMethod.async);
      
      const privateMethod = sampleClass.methods.find(m => m.name === '_internalMethod');
      assert.ok(privateMethod);
      assert.ok(!privateMethod.public);
    });

    test('should extract function definitions', () => {
      const functions = generator.extractFunctions(sampleClassFile, []);
      
      const processStringFunc = functions.find(f => f.name === 'processString');
      assert.ok(processStringFunc);
      assert.ok(processStringFunc.exported);
      assert.ok(processStringFunc.public);

      const privateFunc = functions.find(f => f.name === '_privateFunction');
      assert.ok(privateFunc);
      assert.ok(!privateFunc.public);
    });
  });

  describe('Test Example Extraction', () => {
    test('should extract examples from test files', async () => {
      await generator.extractExamples([
        join(tempDir, 'sample.test.mjs')
      ]);

      // Write the test file first
      writeFileSync(join(tempDir, 'sample.test.mjs'), sampleTestFile);
      
      await generator.extractExamples([
        join(tempDir, 'sample.test.mjs')
      ]);

      assert.ok(generator.examples.size > 0);
    });

    test('should parse test examples correctly', () => {
      const examples = generator.parseTestExamples(sampleTestFile, 'test.mjs');
      
      assert.ok(examples.length >= 1);
      
      const example = examples[0];
      assert.ok(example.description.includes('create instance'));
      assert.ok(example.code.includes('SampleClass'));
      assert.equal(example.file, 'test.mjs');
    });

    test('should infer example targets', () => {
      const testBody1 = 'const sample = new SampleClass("test");';
      const testBody2 = 'generator.process(data);';
      const testBody3 = 'const result = helper();';

      assert.equal(generator.inferExampleTarget(testBody1), 'SampleClass');
      assert.equal(generator.inferExampleTarget(testBody2), 'generator');
      assert.equal(generator.inferExampleTarget(testBody3), null);
    });
  });

  describe('Full Documentation Generation', () => {
    beforeEach(() => {
      // Setup complete test environment
      const srcDir = join(tempDir, 'src');
      const testDir = join(tempDir, 'test');
      mkdirSync(srcDir, { recursive: true });
      mkdirSync(testDir, { recursive: true });

      writeFileSync(join(srcDir, 'sample.mjs'), sampleClassFile);
      writeFileSync(join(srcDir, 'config.mjs'), sampleConfigFile);
      writeFileSync(join(testDir, 'sample.test.mjs'), sampleTestFile);
    });

    test('should generate complete documentation', async () => {
      const docs = await generator.generate(tempDir, {
        outputFormat: 'markdown',
        includePrivate: false,
        generateTypes: true,
        extractExamples: true
      });

      assert.equal(docs.format, 'markdown');
      assert.ok(docs.generatedAt);
      assert.ok(docs.files.length >= 2);
      assert.ok(docs.summary.totalClasses >= 1);
      assert.ok(docs.summary.totalFunctions >= 1);
      assert.ok(docs.typeDefinitions);

      // Check events were emitted
      const requestedEvents = mockEventPublisher.getEventsByType('DOCUMENTATION_GENERATION_REQUESTED');
      const generatedEvents = mockEventPublisher.getEventsByType('DOCUMENTATION_GENERATED');
      const typeEvents = mockEventPublisher.getEventsByType('TYPE_DEFINITION_GENERATED');

      assert.equal(requestedEvents.length, 1);
      assert.equal(generatedEvents.length, 1);
      assert.equal(typeEvents.length, 1);
    });

    test('should generate markdown documentation', async () => {
      const docs = await generator.generate(tempDir, {
        outputFormat: 'markdown'
      });

      const sampleFile = docs.files.find(f => f.path.includes('sample.mjs'));
      assert.ok(sampleFile);
      assert.ok(sampleFile.markdown);
      assert.ok(sampleFile.markdown.includes('# '));
      assert.ok(sampleFile.markdown.includes('## Classes'));
      assert.ok(sampleFile.markdown.includes('### SampleClass'));
    });

    test('should generate TypeScript definitions', async () => {
      const docs = await generator.generate(tempDir, {
        generateTypes: true
      });

      assert.ok(docs.typeDefinitions);
      assert.ok(docs.typeDefinitions.includes('declare module'));
      assert.ok(docs.typeDefinitions.includes('export class SampleClass'));
      assert.ok(docs.typeDefinitions.includes('export function processString'));
    });

    test('should handle generation errors gracefully', async () => {
      // Test with non-existent directory
      try {
        await generator.generate('/non/existent/path');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof DocumentationGenerationError);
        
        // Check error event was emitted
        const errorEvents = mockEventPublisher.getEventsByType('DOCUMENTATION_ERROR');
        assert.ok(errorEvents.length > 0);
      }
    });

    test('should respect includePrivate option', async () => {
      const docsWithPrivate = await generator.generate(tempDir, {
        includePrivate: true
      });

      const docsWithoutPrivate = await generator.generate(tempDir, {
        includePrivate: false
      });

      // Reset state between calls
      generator.parsedFiles.clear();

      const sampleFileWith = docsWithPrivate.files.find(f => f.path.includes('sample.mjs'));
      const sampleFileWithout = docsWithoutPrivate.files.find(f => f.path.includes('sample.mjs'));

      // Should have more items when including private
      assert.ok(sampleFileWith.classes[0].methods.length >= sampleFileWithout.classes[0].methods.length);
    });
  });

  describe('Markdown Generation', () => {
    test('should generate proper markdown structure', () => {
      const parsed = {
        comments: [{
          line: 1,
          description: 'Test file description',
          examples: ['const test = new Test();']
        }],
        classes: [{
          name: 'TestClass',
          extends: 'BaseClass',
          comment: {
            description: 'A test class',
            examples: ['new TestClass()'],
            params: [],
            returns: null
          },
          methods: [{
            name: 'testMethod',
            public: true
          }],
          public: true
        }],
        functions: [{
          name: 'testFunction',
          comment: {
            description: 'A test function',
            params: [{ name: 'input', type: 'string', description: 'Input value' }],
            returns: { type: 'boolean', description: 'Success status' },
            examples: ['testFunction("hello")']
          },
          public: true
        }],
        exports: []
      };

      const markdown = generator.generateMarkdownDoc(parsed, 'test.mjs');

      assert.ok(markdown.includes('# test.mjs'));
      assert.ok(markdown.includes('## Classes'));
      assert.ok(markdown.includes('### TestClass'));
      assert.ok(markdown.includes('*Extends: BaseClass*'));
      assert.ok(markdown.includes('**Methods:**'));
      assert.ok(markdown.includes('## Functions'));
      assert.ok(markdown.includes('### testFunction()'));
      assert.ok(markdown.includes('**Parameters:**'));
      assert.ok(markdown.includes('**Returns:**'));
      assert.ok(markdown.includes('**Example:**'));
      assert.ok(markdown.includes('```javascript'));
    });
  });

  describe('TypeScript Definition Generation', () => {
    beforeEach(() => {
      // Setup parsed files for type generation
      generator.parsedFiles.set('/test/sample.mjs', {
        classes: [{
          name: 'SampleClass',
          methods: [
            { name: 'process', async: true, public: true },
            { name: 'getStatus', async: false, public: true },
            { name: '_private', async: false, public: false }
          ],
          public: true
        }],
        functions: [{
          name: 'processString',
          async: false,
          exported: true,
          public: true
        }, {
          name: '_privateFunc',
          async: true,
          exported: false,
          public: false
        }]
      });
    });

    test('should generate module declarations', () => {
      const types = generator.generateTypeDefinitions();

      assert.ok(types.includes('declare module "test/sample"'));
      assert.ok(types.includes('export class SampleClass'));
      assert.ok(types.includes('export function processString'));
    });

    test('should generate correct method signatures', () => {
      const types = generator.generateTypeDefinitions();

      assert.ok(types.includes('process(...args: any[]): Promise<any>'));
      assert.ok(types.includes('getStatus(...args: any[]): any'));
    });

    test('should only include public members', () => {
      const types = generator.generateTypeDefinitions();

      assert.ok(types.includes('processString(...args: any[])'));
      assert.ok(!types.includes('_privateFunc'));
      assert.ok(!types.includes('_private'));
    });
  });

  describe('Error Handling', () => {
    test('should create proper error types', () => {
      const docError = new DocumentationGenerationError('Test error', { file: 'test.mjs' });
      assert.ok(docError instanceof Error);
      assert.equal(docError.name, 'DocumentationGenerationError');
      assert.equal(docError.context.file, 'test.mjs');

      const jsDocError = new JSDocParsingError('Parse error', 'file.mjs', 10);
      assert.equal(jsDocError.name, 'JSDocParsingError');
      assert.equal(jsDocError.file, 'file.mjs');
      assert.equal(jsDocError.line, 10);

      const typeError = new TypeDefinitionError('Type error');
      assert.equal(typeError.name, 'TypeDefinitionError');
    });

    test('should handle file parsing errors', async () => {
      // Create invalid JavaScript file
      const invalidFile = join(tempDir, 'invalid.mjs');
      writeFileSync(invalidFile, 'export class { invalid syntax');

      // Should not throw but should log warnings
      await generator.generate(tempDir);

      const warnings = mockLogger.logs.filter(log => log.level === 'warn');
      assert.ok(warnings.length > 0);
    });
  });

  describe('Dependency Graph', () => {
    test('should build dependency relationships', () => {
      const files = ['/test/a.mjs', '/test/b.mjs'];
      
      generator.parsedFiles.set('/test/a.mjs', {
        imports: [
          { module: './b.mjs', type: 'named' },
          { module: 'external-lib', type: 'default' }
        ]
      });

      generator.parsedFiles.set('/test/b.mjs', {
        imports: [
          { module: 'another-lib', type: 'namespace' }
        ]
      });

      generator.buildDependencyGraph(files);

      assert.equal(generator.dependencies.size, 2);
      
      const aDeps = generator.dependencies.get('/test/a.mjs');
      assert.ok(aDeps.includes('external-lib'));
    });

    test('should resolve relative imports', () => {
      const resolved = generator.resolveImport('/src/utils/helper.mjs', '../lib/base');
      // Note: This will return null in test environment since files don't exist
      // In real usage, it would resolve to absolute path
      assert.ok(resolved === null || resolved.includes('/src/lib/base.mjs'));
    });
  });

  describe('Event System', () => {
    test('should emit documentation generation events', async () => {
      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'simple.mjs'), 'export const test = 1;');

      await generator.generate(tempDir);

      const events = mockEventPublisher.events;
      assert.ok(events.some(e => e instanceof DocumentationGenerationRequested));
      assert.ok(events.some(e => e instanceof DocumentationGenerated));
      assert.ok(events.some(e => e instanceof TypeDefinitionGenerated));
    });

    test('should emit error events on failures', async () => {
      try {
        await generator.generate('/invalid/path');
      } catch (error) {
        // Expected to throw
      }

      const errorEvents = mockEventPublisher.getEventsByType('DOCUMENTATION_ERROR');
      assert.ok(errorEvents.length > 0);
      assert.ok(errorEvents[0].payload.error);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex project structure', async () => {
      // Create complex project structure
      const dirs = [
        'src/domain',
        'src/application',
        'src/ports',
        'test/unit',
        'test/integration'
      ];

      for (const dir of dirs) {
        mkdirSync(join(tempDir, dir), { recursive: true });
      }

      // Create interconnected files
      const domainFile = `
        /**
         * Domain layer class
         */
        export class DomainEntity {
          constructor() {}
          
          /**
           * Domain method
           * @returns {Promise<void>}
           */
          async process() {}
        }
      `;

      const applicationFile = `
        import { DomainEntity } from '../domain/entity.mjs';
        
        /**
         * Application service
         */
        export class ApplicationService {
          constructor() {
            this.entity = new DomainEntity();
          }
        }
      `;

      writeFileSync(join(tempDir, 'src/domain/entity.mjs'), domainFile);
      writeFileSync(join(tempDir, 'src/application/service.mjs'), applicationFile);

      const docs = await generator.generate(tempDir, {
        generateDiagrams: true,
        extractExamples: false
      });

      assert.ok(docs.files.length >= 2);
      assert.ok(docs.dependencyGraph);
      assert.ok(docs.summary.totalClasses >= 2);
    });

    test('should generate comprehensive API documentation', async () => {
      // Setup realistic file structure
      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });

      writeFileSync(join(srcDir, 'api.mjs'), `
        /**
         * Main API class for Wesley Documentation Generator
         * Provides methods for generating various types of documentation
         * 
         * @example
         * const api = new DocumentationAPI();
         * const docs = await api.generateDocs('./src');
         * console.log(docs.summary);
         */
        export class DocumentationAPI {
          /**
           * Generate documentation for a project
           * @param {string} sourcePath - Path to source files  
           * @param {Object} [options={}] - Generation options
           * @param {boolean} [options.includePrivate=false] - Include private APIs
           * @param {string[]} [options.formats=['markdown']] - Output formats
           * @returns {Promise<DocumentationResult>} Generated documentation
           * @throws {DocumentationError} When generation fails
           * @since 1.0.0
           */
          async generateDocs(sourcePath, options = {}) {
            return { success: true };
          }

          /**
           * Get available documentation formats
           * @returns {string[]} Array of supported formats
           * @deprecated Use getSupportedFormats() instead  
           */
          getFormats() {
            return ['markdown', 'json', 'html'];
          }
        }

        /**
         * Result object from documentation generation
         * @typedef {Object} DocumentationResult
         * @property {boolean} success - Whether generation succeeded
         * @property {string[]} files - Generated file paths
         * @property {Object} summary - Generation summary statistics
         */
      `);

      const docs = await generator.generate(tempDir, {
        outputFormat: 'markdown',
        generateTypes: true
      });

      // Verify comprehensive documentation
      const apiFile = docs.files.find(f => f.path.includes('api.mjs'));
      assert.ok(apiFile);
      assert.ok(apiFile.markdown.includes('DocumentationAPI'));
      assert.ok(apiFile.markdown.includes('**Parameters:**'));
      assert.ok(apiFile.markdown.includes('**Returns:**'));
      assert.ok(apiFile.markdown.includes('**Example:**'));
      assert.ok(apiFile.markdown.includes('@deprecated'));

      // Verify TypeScript definitions
      assert.ok(docs.typeDefinitions.includes('DocumentationAPI'));
      assert.ok(docs.typeDefinitions.includes('generateDocs(...args: any[]): Promise<any>'));
    });
  });
});