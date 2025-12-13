// wesley-website/src/db/pglite.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { DbSession, createDbSession } from './pglite';

describe('DbSession', () => {
  let dbSession;

  beforeEach(async () => {
    dbSession = await createDbSession();
  });

  it('should initialize and execute a basic query', async () => {
    const result = await dbSession.query('SELECT 1 as value;');
    expect(result.rows).toEqual([{ value: 1 }]);
    expect(result.fields).toEqual(['value']);
  });

  it('should apply migrations', async () => {
    const migrations = [
      'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);',
      "INSERT INTO users (name) VALUES ('Alice');",
    ];
    await dbSession.applyMigrations(migrations);

    const result = await dbSession.query('SELECT * FROM users;');
    expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
    expect(result.fields).toEqual(['id', 'name']);
  });

  it('should reset the database', async () => {
    await dbSession.applyMigrations(['CREATE TABLE products (id INT);']);
    const beforeReset = await dbSession.query('SELECT COUNT(*) FROM products;');
    expect(Number(beforeReset.rows[0]['count'])).toBe(0); // PGLite returns count as number

    await dbSession.reset();

    // After reset, the table should not exist
    await expect(dbSession.query('SELECT * FROM products;'))
      .rejects.toThrow('Database query failed: relation "products" does not exist');
  });

  it('should limit query results to 100 rows', async () => {
    const createTable = 'CREATE TABLE large_table (id SERIAL PRIMARY KEY);';
    const insertStatements = Array.from({ length: 150 }, (_, i) => `INSERT INTO large_table VALUES (${i + 1});`);
    await dbSession.applyMigrations([createTable, ...insertStatements]);

    const result = await dbSession.query('SELECT * FROM large_table;');
    expect(result.rows.length).toBe(100);
    expect(result.rows[0].id).toBe(1);
    expect(result.rows[99].id).toBe(100);
  });

  it('should throw wrapped errors for invalid SQL', async () => {
    await expect(dbSession.query('SELECT * FROM non_existent_table;'))
      .rejects.toThrow('Database query failed: relation "non_existent_table" does not exist');
  });
});
