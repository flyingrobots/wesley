/**
 * TTD Protocol Compiler - Core Module
 *
 * This module provides the foundation for Type-Driven Development (TTD) protocol
 * compilation, including AST types, directive parsing, schema extraction,
 * hashing, manifest generation, and validation.
 */

// Re-export AST types and constructors
export * from './ast.mjs';

// Re-export directive parsing
export * from './directives.mjs';

// Re-export schema extraction
export * from './extractor.mjs';

// Re-export canonical hashing
export * from './hasher.mjs';

// Re-export manifest generation
export * from './manifest.mjs';

// Re-export validation
export * from './validation.mjs';

// Re-export codegen
export * from './codegen/index.mjs';
