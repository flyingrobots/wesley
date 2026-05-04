// packages/wesley-host-browser/src/index.test.mjs
import { describe, it, expect } from 'vitest';
import { compileSchemaInBrowser } from './index.mjs';

describe('compileSchemaInBrowser', () => {
  it('should compile a basic GraphQL schema and return output files', async () => {
    const inputFiles = [
      {
        file: 'schema.graphql',
        body: `type User {
  id: ID!
  name: String
}`
      }
    ];

    const result = await compileSchemaInBrowser(inputFiles);

    expect(result.ok).toBe(true);
    expect(result.outputFiles).toBeInstanceOf(Array);
    expect(result.outputFiles.length).toBeGreaterThan(0);

    const schemaFile = result.outputFiles.find(f => f.file === 'schema.json');
    expect(schemaFile).toBeDefined();
    expect(schemaFile.body).toContain('"name": "User"'); // Check for table name in the bundle schema
    expect(result.tables).toBe(1);
  });

  it('should handle invalid GraphQL schema by ignoring it (lenient parser)', async () => {
    const inputFiles = [
      {
        file: 'invalid.graphql',
        body: `BROKEN_SYNTAX User {
  id: ID!
}`
      }
    ];

    const result = await compileSchemaInBrowser(inputFiles);

    // The current BrowserParserPort is regex-based and skips non-matching parts.
    // So it won't throw, but it won't find any tables.
    expect(result.ok).toBe(true);
    expect(result.tables).toBe(0);
  });

  it('should return schema JSON for an empty schema', async () => {
    const inputFiles = [
      {
        file: 'empty.graphql',
        body: ''
      }
    ];

    const result = await compileSchemaInBrowser(inputFiles);

    expect(result.ok).toBe(true);
    expect(result.outputFiles).toBeInstanceOf(Array);
    const schemaFile = result.outputFiles.find(f => f.file === 'schema.json');
    expect(schemaFile).toBeDefined();
    expect(schemaFile.body).toContain('"tables": []');
    expect(result.tables).toBe(0);
  });

  it('should handle multiple input files', async () => {
    const inputFiles = [
      {
        file: 'user.graphql',
        body: 'type User { id: ID! name: String }'
      },
      {
        file: 'product.graphql',
        body: 'type Product { id: ID! name: String price: Float }'
      }
    ];

    const result = await compileSchemaInBrowser(inputFiles);

    expect(result.ok).toBe(true);
    expect(result.outputFiles.length).toBeGreaterThan(0);
    const schemaFile = result.outputFiles.find(f => f.file === 'schema.json');
    expect(schemaFile.body).toContain('"name": "User"');
    expect(schemaFile.body).toContain('"name": "Product"');
    expect(result.tables).toBe(2);
  });
});
