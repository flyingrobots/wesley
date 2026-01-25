// wesley-website/src/db/pglite.js

import { PGlite } from '@electric-sql/pglite';

/**
 * @typedef {Object} QueryResult
 * @property {Array<Object>} rows - The returned rows as an array of objects.
 * @property {Array<string>} fields - The names of the fields/columns.
 */

/**
 * A session for interacting with an in-browser PGLite database.
 * This class abstracts the PGLite specific implementation.
 */
// Singleton instance to prevent "already read Response" WASM errors during hot-reload/strict-mode
let globalPg = null;

export class DbSession {
  /** @type {PGlite | null} */
  #pg = null;

  constructor() {
    // Lazy init via reset/init
  }

  /**
   * Initializes the session.
   * Uses a singleton PGLite instance to be safe against React double-mounts.
   */
  async init() {
    if (!globalPg) {
      globalPg = new PGlite();
      await globalPg.waitReady;
    }
    this.#pg = globalPg;
  }

  /**
   * Initializes or resets the PGLite database.
   * This effectively clears all schema and data.
   * @returns {Promise<void>}
   */
  async reset() {
    await this.init(); // Ensure we have the instance
    
    // Instead of re-instantiating (which causes WASM race conditions),
    // we drop the public schema and recreate it.
    await this.#pg.query('DROP SCHEMA public CASCADE;');
    await this.#pg.query('CREATE SCHEMA public;');
  }

  /**
   * Closes the database connection.
   * For the browser demo, we actually keep the singleton alive to avoid WASM reloading issues.
   * @returns {Promise<void>}
   */
  async close() {
    // No-op: we keep globalPg alive for the lifetime of the tab to prevent "already read Response" errors.
    this.#pg = null; 
  }

  /**
   * Applies a list of SQL migration statements to the database.
   * @param {string[]} sqlMigrations - An array of SQL statements.
   * @returns {Promise<void>}
   */
  async applyMigrations(sqlMigrations) {
    if (!this.#pg) {
      throw new Error('PGLite database not initialized.');
    }
    for (const sql of sqlMigrations) {
      // PGLite automatically handles transactions for single statements.
      // For multiple statements that need to be atomic, wrap them explicitly.
      await this.#pg.query(sql);
    }
  }

  /**
   * Executes a single SQL query against the database.
   * Limits result size to 100 rows.
   * @param {string} sql - The SQL query string.
   * @param {Array<any>} [params] - Optional query parameters for parameterized queries.
   * @returns {Promise<QueryResult>}
   */
  async query(sql, params) {
    if (!this.#pg) {
      throw new Error('PGLite database not initialized.');
    }
    try {
      const result = params
        ? await this.#pg.query(sql, params)
        : await this.#pg.query(sql);
      // PGLite query result structure is { rows: [], fields: [{ name: 'col' }] }
      const rows = result.rows.slice(0, 100); // Limit results
      const fields = result.fields.map(f => f.name);
      return { rows, fields };
    } catch (error) {
      // Wrap PGLite errors for cleaner UI display
      throw new Error(`Database query failed: ${error.message}`);
    }
  }
}

/**
 * Factory function to create a new DbSession.
 * @returns {Promise<DbSession>}
 */
export async function createDbSession() {
  const session = new DbSession();
  await session.reset(); // Ensure it starts in a clean state
  return session;
}
