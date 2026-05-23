import { describe, it, expect, beforeEach } from 'vitest';
import { FakeDbSession } from './FakeDbSession';

describe('FakeDbSession', () => {
  let session;

  beforeEach(() => {
    session = new FakeDbSession();
  });

  it('information_schema.tables returns created table names', async () => {
    await session.applyMigrations(['CREATE TABLE users (id INT)']);

    const result = await session.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    expect(result.rows).toEqual([{ table_name: 'users' }]);
    expect(result.fields).toEqual(['table_name']);
  });

  it('information_schema.tables returns multiple tables sorted', async () => {
    await session.applyMigrations([
      'CREATE TABLE products (id INT)',
      'CREATE TABLE orders (id INT)'
    ]);

    const result = await session.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    expect(result.rows).toEqual([{ table_name: 'orders' }, { table_name: 'products' }]);
  });

  it('information_schema.tables returns empty after reset', async () => {
    await session.applyMigrations(['CREATE TABLE users (id INT)']);
    await session.reset();

    const result = await session.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    expect(result.rows).toEqual([]);
  });

  it('information_schema.columns returns column metadata placeholder', async () => {
    await session.applyMigrations(['CREATE TABLE users (id INT)']);

    const result = await session.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
    `);

    // FakeDbSession doesn't parse column definitions, so returns empty
    expect(result.fields).toContain('column_name');
  });
});
