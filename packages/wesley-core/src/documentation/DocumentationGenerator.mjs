/**
 * DocumentationGenerator - Auto-generate API documentation from JSDoc comments
 * Creates Markdown documentation for all public APIs and TypeScript definitions
 * @license Apache-2.0
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join, dirname, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import { DomainEvent } from '../domain/Events.mjs';

/**
 * Custom events for documentation generation
 */
export class DocumentationGenerationRequested extends DomainEvent {
  constructor(source, options = {}) {
    super('DOCUMENTATION_GENERATION_REQUESTED', { source, options });
  }
}

export class DocumentationGenerated extends DomainEvent {
  constructor(documentation, source) {
    super('DOCUMENTATION_GENERATED', { documentation, source });
  }
}

export class DocumentationError extends DomainEvent {
  constructor(error, source) {
    super('DOCUMENTATION_ERROR', { error: error.message, source });
  }
}

export class TypeDefinitionGenerated extends DomainEvent {
  constructor(typeDefinitions, source) {
    super('TYPE_DEFINITION_GENERATED', { typeDefinitions, source });
  }
}

/**
 * Custom error types for documentation generation
 */
export class DocumentationGenerationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'DocumentationGenerationError';
    this.context = context;
  }
}

export class JSDocParsingError extends Error {
  constructor(message, file, line = null) {
    super(message);
    this.name = 'JSDocParsingError';
    this.file = file;
    this.line = line;
  }
}

export class TypeDefinitionError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'TypeDefinitionError';
    this.context = context;
  }
}

/**
 * DocumentationGenerator - Generates comprehensive API documentation
 * 
 * Features:
 * - Parses JSDoc comments from source files
 * - Generates Markdown documentation for public APIs
 * - Creates TypeScript definition files
 * - Extracts usage examples from test files
 * - Generates dependency graphs and architecture diagrams
 * 
 * @example
 * ```javascript
 * const generator = new DocumentationGenerator({ eventPublisher });
 * const docs = await generator.generate('./src', {
 *   outputFormat: 'markdown',
 *   includePrivate: false,
 *   generateTypes: true
 * });
 * ```
 */
export class DocumentationGenerator {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {EventPublisher} dependencies.eventPublisher - Event publisher for notifications
   * @param {Logger} [dependencies.logger] - Optional logger instance
   */
  constructor({ eventPublisher, logger = console }) {
    this.eventPublisher = eventPublisher;
    this.logger = logger;
    this.parsedFiles = new Map();
    this.typeDefinitions = new Map();
    this.examples = new Map();
    this.dependencies = new Map();
  }

  /**
   * Generate comprehensive documentation for a source directory
   * 
   * @param {string} sourceDir - Path to source directory to document
   * @param {Object} options - Generation options
   * @param {string} [options.outputFormat='markdown'] - Output format (markdown, json, html)
   * @param {boolean} [options.includePrivate=false] - Include private/internal APIs
   * @param {boolean} [options.generateTypes=true] - Generate TypeScript definitions
   * @param {boolean} [options.extractExamples=true] - Extract examples from test files
   * @param {boolean} [options.generateDiagrams=false] - Generate dependency/architecture diagrams
   * @param {string[]} [options.includePatterns] - File patterns to include
   * @param {string[]} [options.excludePatterns] - Patterns to exclude
   * @returns {Promise<Object>} Generated documentation object
   */
  async generate(sourceDir, options = {}) {
    const config = {
      outputFormat: 'markdown',
      includePrivate: false,
      generateTypes: true,
      extractExamples: true,
      generateDiagrams: false,
      includePatterns: ['**/*.mjs'],
      excludePatterns: ['**/test/**', '**/tests/**', '**/node_modules/**'],
      ...options
    };

    try {
      await this.eventPublisher?.publish(new DocumentationGenerationRequested(sourceDir, config));

      this.logger.debug(`Generating documentation for: ${sourceDir}`);
      
      // Clear previous state
      this.parsedFiles.clear();
      this.typeDefinitions.clear();
      this.examples.clear();
      this.dependencies.clear();

      // Step 1: Discover and parse source files
      const sourceFiles = this.discoverFiles(sourceDir, config.includePatterns, config.excludePatterns);
      this.logger.debug(`Found ${sourceFiles.length} source files`);

      // Step 2: Parse JSDoc comments and extract API information
      for (const filePath of sourceFiles) {
        try {
          const parsed = await this.parseFile(filePath, config);
          this.parsedFiles.set(filePath, parsed);
          this.logger.debug(`Parsed ${filePath}: ${parsed.exports.length} exports`);
        } catch (error) {
          this.logger.warn(`Failed to parse ${filePath}: ${error.message}`);
          await this.eventPublisher?.publish(new DocumentationError(error, filePath));
        }
      }

      // Step 3: Extract examples from test files (if enabled)
      if (config.extractExamples) {
        const testFiles = this.discoverFiles(sourceDir, ['**/test/**/*.mjs', '**/tests/**/*.test.mjs'], []);
        await this.extractExamples(testFiles);
      }

      // Step 4: Build dependency graph
      if (config.generateDiagrams) {
        this.buildDependencyGraph(sourceFiles);
      }

      // Step 5: Generate documentation in requested format
      const documentation = await this.formatDocumentation(config);

      // Step 6: Generate TypeScript definitions (if enabled)
      if (config.generateTypes) {
        const typeDefinitions = this.generateTypeDefinitions();
        await this.eventPublisher?.publish(new TypeDefinitionGenerated(typeDefinitions, sourceDir));
        documentation.typeDefinitions = typeDefinitions;
      }

      await this.eventPublisher?.publish(new DocumentationGenerated(documentation, sourceDir));
      return documentation;

    } catch (error) {
      const docError = new DocumentationGenerationError(
        `Documentation generation failed: ${error.message}`,
        { sourceDir, options: config }
      );
      await this.eventPublisher?.publish(new DocumentationError(docError, sourceDir));
      throw docError;
    }
  }

  /**
   * Discover files matching include/exclude patterns
   * 
   * @private
   * @param {string} dir - Directory to search
   * @param {string[]} includePatterns - Patterns to include
   * @param {string[]} excludePatterns - Patterns to exclude
   * @returns {string[]} Array of file paths
   */
  discoverFiles(dir, includePatterns, excludePatterns) {
    const files = [];
    
    const walkDir = (currentDir) => {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = relative(dir, fullPath);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (this.matchesPatterns(relativePath, excludePatterns)) {
            continue;
          }
          walkDir(fullPath);
        } else {
          // Include files matching patterns and not excluded
          if (this.matchesPatterns(relativePath, includePatterns) && 
              !this.matchesPatterns(relativePath, excludePatterns)) {
            files.push(fullPath);
          }
        }
      }
    };

    walkDir(dir);
    return files;
  }

  /**
   * Check if path matches any of the given glob patterns
   * 
   * @private
   * @param {string} path - Path to check
   * @param {string[]} patterns - Glob patterns
   * @returns {boolean} True if path matches any pattern
   */
  matchesPatterns(path, patterns) {
    return patterns.some(pattern => {
      // Simple glob matching - convert to regex
      const regex = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      return new RegExp(`^${regex}$`).test(path);
    });
  }

  /**
   * Parse a single file for JSDoc comments and exports
   * 
   * @private
   * @param {string} filePath - Path to file to parse
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>} Parsed file information
   */
  async parseFile(filePath, config) {
    const content = readFileSync(filePath, 'utf8');
    const stats = statSync(filePath);
    
    const parsed = {
      path: filePath,
      lastModified: stats.mtime,
      exports: [],
      imports: [],
      comments: [],
      classes: [],
      functions: [],
      errors: []
    };

    try {
      // Extract JSDoc comments
      const comments = this.extractJSDocComments(content);
      parsed.comments = comments;

      // Extract exports
      const exports = this.extractExports(content, config.includePrivate);
      parsed.exports = exports;

      // Extract imports for dependency tracking
      const imports = this.extractImports(content);
      parsed.imports = imports;

      // Extract classes
      const classes = this.extractClasses(content, comments);
      parsed.classes = classes;

      // Extract functions
      const functions = this.extractFunctions(content, comments);
      parsed.functions = functions;

    } catch (error) {
      parsed.errors.push(new JSDocParsingError(error.message, filePath));
    }

    return parsed;
  }

  /**
   * Extract JSDoc comments from source code
   * 
   * @private
   * @param {string} content - File content
   * @returns {Array} Array of JSDoc comment objects
   */
  extractJSDocComments(content) {
    const comments = [];
    const jsdocRegex = /\/\*\*([\s\S]*?)\*\//g;
    let match;

    while ((match = jsdocRegex.exec(content)) !== null) {
      const rawComment = match[1];
      const startLine = content.substring(0, match.index).split('\n').length;
      
      const parsed = this.parseJSDocComment(rawComment, startLine);
      if (parsed) {
        comments.push(parsed);
      }
    }

    return comments;
  }

  /**
   * Parse a single JSDoc comment
   * 
   * @private
   * @param {string} comment - Raw JSDoc comment content
   * @param {number} line - Line number where comment starts
   * @returns {Object|null} Parsed comment object or null if invalid
   */
  parseJSDocComment(comment, line) {
    const lines = comment.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean);
    
    if (lines.length === 0) return null;

    const parsed = {
      line,
      description: '',
      tags: {},
      examples: [],
      params: [],
      returns: null,
      throws: [],
      since: null,
      deprecated: false
    };

    let currentTag = null;
    let currentContent = [];

    for (const line of lines) {
      if (line.startsWith('@')) {
        // Save previous tag content
        if (currentTag) {
          this.saveTagContent(parsed, currentTag, currentContent.join(' '));
        }

        // Parse new tag
        const tagMatch = line.match(/^@(\w+)(?:\s+(.*))?$/);
        if (tagMatch) {
          currentTag = tagMatch[1];
          currentContent = tagMatch[2] ? [tagMatch[2]] : [];
        }
      } else {
        if (currentTag) {
          currentContent.push(line);
        } else {
          // Description line
          parsed.description += (parsed.description ? ' ' : '') + line;
        }
      }
    }

    // Save final tag
    if (currentTag) {
      this.saveTagContent(parsed, currentTag, currentContent.join(' '));
    }

    return parsed;
  }

  /**
   * Save parsed tag content to appropriate field
   * 
   * @private
   * @param {Object} parsed - Parsed comment object
   * @param {string} tag - Tag name
   * @param {string} content - Tag content
   */
  saveTagContent(parsed, tag, content) {
    switch (tag) {
      case 'param':
        const paramMatch = content.match(/^{([^}]+)}\s+(\w+)\s*-?\s*(.*)$/);
        if (paramMatch) {
          parsed.params.push({
            type: paramMatch[1],
            name: paramMatch[2],
            description: paramMatch[3] || '',
            optional: paramMatch[2].startsWith('[')
          });
        }
        break;

      case 'returns':
      case 'return':
        const returnMatch = content.match(/^{([^}]+)}\s*(.*)$/);
        if (returnMatch) {
          parsed.returns = {
            type: returnMatch[1],
            description: returnMatch[2] || ''
          };
        }
        break;

      case 'throws':
      case 'throw':
        parsed.throws.push(content);
        break;

      case 'example':
        parsed.examples.push(content);
        break;

      case 'deprecated':
        parsed.deprecated = true;
        parsed.tags.deprecated = content || true;
        break;

      case 'since':
        parsed.since = content;
        break;

      default:
        parsed.tags[tag] = content;
        break;
    }
  }

  /**
   * Extract export statements from source code
   * 
   * @private
   * @param {string} content - File content
   * @param {boolean} includePrivate - Whether to include private exports
   * @returns {Array} Array of export objects
   */
  extractExports(content, includePrivate) {
    const exports = [];
    
    // Export patterns
    const exportPatterns = [
      /export\s+class\s+(\w+)/g,
      /export\s+function\s+(\w+)/g,
      /export\s+const\s+(\w+)/g,
      /export\s+let\s+(\w+)/g,
      /export\s+var\s+(\w+)/g,
      /export\s+{\s*([^}]+)\s*}/g
    ];

    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        const line = content.substring(0, match.index).split('\n').length;
        
        // Skip private exports unless requested
        if (!includePrivate && (name.startsWith('_') || name.includes('Private'))) {
          continue;
        }

        exports.push({
          name,
          line,
          type: this.inferExportType(match[0]),
          public: !name.startsWith('_')
        });
      }
    }

    return exports;
  }

  /**
   * Infer the type of export from the export statement
   * 
   * @private
   * @param {string} statement - Export statement
   * @returns {string} Export type (class, function, const, etc.)
   */
  inferExportType(statement) {
    if (statement.includes('class')) return 'class';
    if (statement.includes('function')) return 'function';
    if (statement.includes('const')) return 'const';
    if (statement.includes('let')) return 'let';
    if (statement.includes('var')) return 'var';
    return 'unknown';
  }

  /**
   * Extract import statements for dependency tracking
   * 
   * @private
   * @param {string} content - File content
   * @returns {Array} Array of import objects
   */
  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const [, namedImports, namespaceImport, defaultImport, module] = match;
      const line = content.substring(0, match.index).split('\n').length;

      imports.push({
        module,
        line,
        type: namedImports ? 'named' : namespaceImport ? 'namespace' : 'default',
        imports: namedImports ? namedImports.split(',').map(s => s.trim()) : 
                 namespaceImport ? [namespaceImport] : 
                 defaultImport ? [defaultImport] : []
      });
    }

    return imports;
  }

  /**
   * Extract class definitions with their JSDoc
   * 
   * @private
   * @param {string} content - File content
   * @param {Array} comments - Parsed JSDoc comments
   * @returns {Array} Array of class objects
   */
  extractClasses(content, comments) {
    const classes = [];
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?\s*{/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const [, name, extends_] = match;
      const line = content.substring(0, match.index).split('\n').length;
      
      // Find associated JSDoc comment
      const associatedComment = comments.find(c => c.line < line && (line - c.line) <= 3);

      classes.push({
        name,
        extends: extends_ || null,
        line,
        comment: associatedComment,
        methods: this.extractClassMethods(content, match.index, name),
        public: !name.startsWith('_')
      });
    }

    return classes;
  }

  /**
   * Extract methods from a class definition
   * 
   * @private
   * @param {string} content - File content
   * @param {number} classStart - Start position of class definition
   * @param {string} className - Name of the class
   * @returns {Array} Array of method objects
   */
  extractClassMethods(content, classStart, className) {
    const methods = [];
    
    // Find class end by matching braces
    let braceCount = 0;
    let classEnd = classStart;
    let inClass = false;

    for (let i = classStart; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inClass = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (inClass && braceCount === 0) {
          classEnd = i;
          break;
        }
      }
    }

    const classContent = content.substring(classStart, classEnd);
    const methodRegex = /(?:(?:async\s+)?(?:static\s+)?(\w+)\s*\([^)]*\)\s*{|(?:get|set)\s+(\w+)\s*\([^)]*\)\s*{)/g;
    let match;

    while ((match = methodRegex.exec(classContent)) !== null) {
      const name = match[1] || match[2];
      if (name && name !== className) { // Exclude constructor
        const line = content.substring(0, classStart + match.index).split('\n').length;
        
        methods.push({
          name,
          line,
          type: match[0].includes('get') ? 'getter' : 
                match[0].includes('set') ? 'setter' : 'method',
          static: match[0].includes('static'),
          async: match[0].includes('async'),
          public: !name.startsWith('_')
        });
      }
    }

    return methods;
  }

  /**
   * Extract function definitions with their JSDoc
   * 
   * @private
   * @param {string} content - File content
   * @param {Array} comments - Parsed JSDoc comments
   * @returns {Array} Array of function objects
   */
  extractFunctions(content, comments) {
    const functions = [];
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1];
      const line = content.substring(0, match.index).split('\n').length;
      
      // Find associated JSDoc comment
      const associatedComment = comments.find(c => c.line < line && (line - c.line) <= 3);

      functions.push({
        name,
        line,
        comment: associatedComment,
        async: match[0].includes('async'),
        exported: match[0].includes('export'),
        public: !name.startsWith('_')
      });
    }

    return functions;
  }

  /**
   * Extract usage examples from test files
   * 
   * @private
   * @param {string[]} testFiles - Array of test file paths
   */
  async extractExamples(testFiles) {
    for (const filePath of testFiles) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const examples = this.parseTestExamples(content, filePath);
        
        for (const example of examples) {
          const key = example.target || 'general';
          if (!this.examples.has(key)) {
            this.examples.set(key, []);
          }
          this.examples.get(key).push(example);
        }
      } catch (error) {
        this.logger.warn(`Failed to extract examples from ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Parse test examples from test file content
   * 
   * @private
   * @param {string} content - Test file content
   * @param {string} filePath - Path to test file
   * @returns {Array} Array of example objects
   */
  parseTestExamples(content, filePath) {
    const examples = [];
    
    // Look for test cases that might contain usage examples
    const testRegex = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s+)?\(\s*\)\s*=>\s*{([\s\S]*?)}\s*\)/g;
    let match;

    while ((match = testRegex.exec(content)) !== null) {
      const [, description, testBody] = match;
      const line = content.substring(0, match.index).split('\n').length;

      // Extract code that looks like usage examples
      const usageLines = testBody
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//') && !line.startsWith('expect'))
        .slice(0, 10); // Limit example length

      if (usageLines.length > 0) {
        examples.push({
          description,
          code: usageLines.join('\n'),
          file: filePath,
          line,
          target: this.inferExampleTarget(testBody)
        });
      }
    }

    return examples;
  }

  /**
   * Infer what API the test example targets
   * 
   * @private
   * @param {string} testBody - Test body content
   * @returns {string|null} Target API name or null
   */
  inferExampleTarget(testBody) {
    // Look for class instantiation or method calls
    const classMatch = testBody.match(/new\s+(\w+)\s*\(/);
    if (classMatch) {
      return classMatch[1];
    }

    const methodMatch = testBody.match(/(\w+)\.\w+\s*\(/);
    if (methodMatch) {
      return methodMatch[1];
    }

    return null;
  }

  /**
   * Build dependency graph from source files
   * 
   * @private
   * @param {string[]} sourceFiles - Array of source file paths
   */
  buildDependencyGraph(sourceFiles) {
    for (const [filePath, parsed] of this.parsedFiles) {
      const deps = new Set();
      
      for (const importInfo of parsed.imports) {
        // Resolve relative imports to absolute paths
        if (importInfo.module.startsWith('.')) {
          const resolvedPath = this.resolveImport(filePath, importInfo.module);
          if (resolvedPath) {
            deps.add(resolvedPath);
          }
        } else {
          // External dependency
          deps.add(importInfo.module);
        }
      }
      
      this.dependencies.set(filePath, Array.from(deps));
    }
  }

  /**
   * Resolve relative import to absolute path
   * 
   * @private
   * @param {string} fromFile - File making the import
   * @param {string} importPath - Relative import path
   * @returns {string|null} Resolved absolute path or null
   */
  resolveImport(fromFile, importPath) {
    try {
      const fromDir = dirname(fromFile);
      let resolved = join(fromDir, importPath);
      
      // Add .mjs extension if missing
      if (!extname(resolved)) {
        resolved += '.mjs';
      }
      
      // Check if file exists
      try {
        statSync(resolved);
        return resolved;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Format documentation in the requested format
   * 
   * @private
   * @param {Object} config - Generation configuration
   * @returns {Object} Formatted documentation
   */
  async formatDocumentation(config) {
    const documentation = {
      format: config.outputFormat,
      generatedAt: new Date().toISOString(),
      files: [],
      summary: {
        totalFiles: this.parsedFiles.size,
        totalClasses: 0,
        totalFunctions: 0,
        totalExports: 0
      }
    };

    for (const [filePath, parsed] of this.parsedFiles) {
      const relativePath = relative(process.cwd(), filePath);
      
      const fileDoc = {
        path: relativePath,
        lastModified: parsed.lastModified,
        exports: parsed.exports.filter(e => config.includePrivate || e.public),
        classes: parsed.classes.filter(c => config.includePrivate || c.public),
        functions: parsed.functions.filter(f => config.includePrivate || f.public),
        examples: this.examples.get(relativePath) || []
      };

      // Add formatted content based on output format
      if (config.outputFormat === 'markdown') {
        fileDoc.markdown = this.generateMarkdownDoc(parsed, relativePath);
      }

      documentation.files.push(fileDoc);
      
      // Update summary
      documentation.summary.totalClasses += fileDoc.classes.length;
      documentation.summary.totalFunctions += fileDoc.functions.length;
      documentation.summary.totalExports += fileDoc.exports.length;
    }

    // Add dependency graph if generated
    if (config.generateDiagrams && this.dependencies.size > 0) {
      documentation.dependencyGraph = Object.fromEntries(this.dependencies);
    }

    return documentation;
  }

  /**
   * Generate Markdown documentation for a file
   * 
   * @private
   * @param {Object} parsed - Parsed file information
   * @param {string} relativePath - Relative path to the file
   * @returns {string} Markdown documentation
   */
  generateMarkdownDoc(parsed, relativePath) {
    const lines = [];
    
    lines.push(`# ${relativePath}`);
    lines.push('');

    // File description from top-level comment
    const fileComment = parsed.comments.find(c => c.line <= 10);
    if (fileComment && fileComment.description) {
      lines.push(fileComment.description);
      lines.push('');
    }

    // Classes section
    if (parsed.classes.length > 0) {
      lines.push('## Classes');
      lines.push('');

      for (const cls of parsed.classes) {
        lines.push(`### ${cls.name}`);
        
        if (cls.extends) {
          lines.push(`*Extends: ${cls.extends}*`);
        }
        
        if (cls.comment) {
          lines.push('');
          lines.push(cls.comment.description);
          
          if (cls.comment.examples.length > 0) {
            lines.push('');
            lines.push('**Example:**');
            lines.push('```javascript');
            lines.push(cls.comment.examples[0]);
            lines.push('```');
          }
        }

        // Methods
        if (cls.methods.length > 0) {
          lines.push('');
          lines.push('**Methods:**');
          for (const method of cls.methods.filter(m => m.public)) {
            lines.push(`- \`${method.name}()\``);
          }
        }
        
        lines.push('');
      }
    }

    // Functions section
    if (parsed.functions.length > 0) {
      lines.push('## Functions');
      lines.push('');

      for (const func of parsed.functions.filter(f => f.public)) {
        lines.push(`### ${func.name}()`);
        
        if (func.comment) {
          lines.push('');
          lines.push(func.comment.description);
          
          if (func.comment.params.length > 0) {
            lines.push('');
            lines.push('**Parameters:**');
            for (const param of func.comment.params) {
              lines.push(`- \`${param.name}\` {${param.type}} - ${param.description}`);
            }
          }
          
          if (func.comment.returns) {
            lines.push('');
            lines.push(`**Returns:** {${func.comment.returns.type}} ${func.comment.returns.description}`);
          }
          
          if (func.comment.examples.length > 0) {
            lines.push('');
            lines.push('**Example:**');
            lines.push('```javascript');
            lines.push(func.comment.examples[0]);
            lines.push('```');
          }
        }
        
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate TypeScript definition files
   * 
   * @private
   * @returns {string} TypeScript definitions
   */
  generateTypeDefinitions() {
    const lines = [];
    
    lines.push('// Generated TypeScript definitions for Wesley Core');
    lines.push('// DO NOT EDIT - This file is auto-generated');
    lines.push('');

    // Generate module declarations for each file
    for (const [filePath, parsed] of this.parsedFiles) {
      const moduleName = relative(process.cwd(), filePath).replace(/\.mjs$/, '');
      
      lines.push(`declare module "${moduleName}" {`);

      // Export classes
      for (const cls of parsed.classes.filter(c => c.public)) {
        lines.push(`  export class ${cls.name} {`);
        
        // Constructor
        lines.push('    constructor(...args: any[]);');
        
        // Methods
        for (const method of cls.methods.filter(m => m.public)) {
          const returnType = method.async ? 'Promise<any>' : 'any';
          lines.push(`    ${method.name}(...args: any[]): ${returnType};`);
        }
        
        lines.push('  }');
        lines.push('');
      }

      // Export functions
      for (const func of parsed.functions.filter(f => f.public && f.exported)) {
        const returnType = func.async ? 'Promise<any>' : 'any';
        lines.push(`  export function ${func.name}(...args: any[]): ${returnType};`);
      }

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }
}