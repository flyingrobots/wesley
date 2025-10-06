/**
 * Directive Registry Test
 * Ensures all used directives are properly registered
 * Fails hard if unregistered directive is used
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('all directives in schema are registered', () => {
  // Load the canonical directives
  const directivesPath = join(__dirname, '../../../../schemas/directives.graphql');
  const directivesContent = readFileSync(directivesPath, 'utf8');
  
  // Parse registered directives
  const registeredDirectives = new Set();
  const directiveRegex = /directive\s+@(\w+)/g;
  let match;
  while ((match = directiveRegex.exec(directivesContent)) !== null) {
    registeredDirectives.add(match[1]);
  }
  
  // Load example schemas to check
  const exampleSchemaPath = join(__dirname, '../../../../example/ecommerce.graphql');
  const exampleContent = readFileSync(exampleSchemaPath, 'utf8');
  
  // Find all used directives in schema
  const usedDirectives = new Set();
  const usageRegex = /@(\w+)(?:\s*\(|[\s\n])/g;
  while ((match = usageRegex.exec(exampleContent)) !== null) {
    // Skip built-in GraphQL directives
    if (!['deprecated', 'skip', 'include'].includes(match[1])) {
      usedDirectives.add(match[1]);
    }
  }
  
  // Check every used directive is registered
  const unregistered = [];
  for (const directive of usedDirectives) {
    if (!registeredDirectives.has(directive)) {
      unregistered.push(directive);
    }
  }
  
  if (unregistered.length > 0) {
    assert.fail(`Unregistered directives used in schema: ${unregistered.join(', ')}
    
All directives must be registered in schemas/directives.graphql before use.
Add the following to directives.graphql:

${unregistered.map(d => `directive @${d} on FIELD_DEFINITION | OBJECT`).join('\n')}
`);
  }
  
  // Logging removed to avoid node:test runner serialization flakes in CI
});

test('directive processor handles all registered directives', () => {
  // This would import the DirectiveProcessor from core
  // and verify it has handlers for all registered directives
  
  // For now, just check that critical directives are known
  const criticalDirectives = [
    'table',
    'primaryKey', 
    'foreignKey',
    'unique',
    'index',
    'sensitive',
    'pii',
    'critical',
    'uid',
    'weight',
    'rls'
  ];
  
  // In real implementation, would check DirectiveProcessor.knownDirectives
  // For now, just assert they exist in registry
  const directivesPath = join(__dirname, '../../../../schemas/directives.graphql');
  const directivesContent = readFileSync(directivesPath, 'utf8');
  
  for (const directive of criticalDirectives) {
    assert(
      directivesContent.includes(`directive @${directive}`),
      `Critical directive @${directive} not found in registry`
    );
  }
});

test('directive weights are properly defined', async () => {
  // Load wesley.config.mjs to check weights
  const configPath = join(__dirname, '../../../../wesley.config.mjs');
  const config = await import(configPath);

  const weights = config.default?.weights?.defaults || {};

  // Critical directives should have high weights
  assert(weights['@primaryKey'] >= 10, 'primaryKey should have weight >= 10');
  assert(weights['@critical'] >= 10, 'critical should have weight >= 10');
  assert(weights['@sensitive'] >= 8, 'sensitive should have weight >= 8');
  assert(weights['@foreignKey'] >= 8, 'foreignKey should have weight >= 8');
  assert(weights['@pii'] >= 8, 'pii should have weight >= 8');

  // Logging removed to avoid node:test runner serialization flakes in CI
});
