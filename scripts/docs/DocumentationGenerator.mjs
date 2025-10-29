/**
 * DocumentationGenerator - Auto-generate API documentation from JSDoc comments
 * Creates Markdown documentation for all public APIs and TypeScript definitions
 * NOTE: This script lives outside core packages to preserve core purity.
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join, dirname, relative, extname } from 'path';
import { fileURLToPath } from 'url';
// Import DomainEvent type for structured events (from core)
import { DomainEvent } from '../../packages/wesley-core/src/domain/Events.mjs';

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

export class DocumentationGenerator {
  constructor({ eventPublisher, logger = console } = {}) {
    this.eventPublisher = eventPublisher;
    this.logger = logger;
    this.parsedFiles = new Map();
    this.typeDefinitions = new Map();
    this.examples = new Map();
    this.dependencies = new Map();
  }

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
      this.logger.debug?.(`Generating documentation for: ${sourceDir}`);
      this.parsedFiles.clear();
      this.typeDefinitions.clear();
      this.examples.clear();
      this.dependencies.clear();

      const sourceFiles = this.discoverFiles(sourceDir, config.includePatterns, config.excludePatterns);
      for (const filePath of sourceFiles) {
        try {
          const parsed = await this.parseFile(filePath, config);
          this.parsedFiles.set(filePath, parsed);
        } catch (error) {
          this.logger.warn?.(`Failed to parse ${filePath}: ${error.message}`);
          await this.eventPublisher?.publish(new DocumentationError(error, filePath));
        }
      }

      if (config.extractExamples) {
        const testFiles = this.discoverFiles(sourceDir, ['**/test/**/*.mjs', '**/tests/**/*.test.mjs'], []);
        await this.extractExamples(testFiles);
      }

      if (config.generateDiagrams) {
        this.buildDependencyGraph(sourceFiles);
      }

      const documentation = await this.formatDocumentation(config);
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

  discoverFiles(dir, includePatterns, excludePatterns) {
    const files = [];
    const walkDir = (currentDir) => {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = relative(dir, fullPath);
        if (entry.isDirectory()) {
          if (this.matchesPatterns(relativePath, excludePatterns)) continue;
          walkDir(fullPath);
        } else {
          if (this.matchesPatterns(relativePath, includePatterns) && !this.matchesPatterns(relativePath, excludePatterns)) {
            files.push(fullPath);
          }
        }
      }
    };
    walkDir(dir);
    return files;
  }

  matchesPatterns(path, patterns) {
    return patterns.some(pattern => {
      const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.');
      return new RegExp(`^${regex}$`).test(path);
    });
  }

  async parseFile(filePath, config) {
    const content = readFileSync(filePath, 'utf8');
    // Very lightweight parse: capture exported symbols and JSDoc blocks
    const exports = Array.from(content.matchAll(/export\s+(?:class|function|const|let|var)\s+([A-Za-z0-9_]+)/g)).map(m => m[1]);
    const jsdocBlocks = Array.from(content.matchAll(/\/\*\*[\s\S]*?\*\//g)).map(m => m[0]);
    return { exports, jsdocBlocks };
  }

  async extractExamples(testFiles) {
    for (const f of testFiles) {
      try {
        const content = readFileSync(f, 'utf8');
        if (content.includes('@example')) this.examples.set(f, true);
      } catch { /* ignore */ }
    }
  }

  buildDependencyGraph(sourceFiles) {
    for (const f of sourceFiles) {
      const content = readFileSync(f, 'utf8');
      const imports = Array.from(content.matchAll(/import\s+.*?from\s+['\"](.*?)['\"]/g)).map(m => m[1]);
      this.dependencies.set(f, imports);
    }
  }

  async formatDocumentation(config) {
    const out = [];
    out.push('# API Documentation');
    out.push('');
    for (const [file, parsed] of this.parsedFiles.entries()) {
      out.push(`## ${file}`);
      out.push('');
      if (parsed.exports.length) {
        out.push('Exports:');
        for (const e of parsed.exports) out.push(`- ${e}`);
        out.push('');
      }
    }
    return { format: config.outputFormat, content: out.join('\n') };
  }

  generateTypeDefinitions() {
    return { types: '// d.ts placeholders' };
  }
}

// If executed directly: simple CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(process.argv[1])) {
  const src = process.argv[2] || 'packages/wesley-core/src';
  const out = process.argv[3] || 'docs/api.md';
  const gen = new DocumentationGenerator({ logger: console });
  gen.generate(src).then(doc => {
    writeFileSync(out, doc.content, 'utf8');
    console.log(`Wrote ${out}`);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

