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
export class DbSession {
  /** @type {PGlite | null} */
  #pg = null;

  constructor() {
    this.#pg = new PGlite();
  }

  /**
   * Initializes or resets the PGLite database.
   * This effectively clears all schema and data.
   * @returns {Promise<void>}
   */
  async reset() {
    if (this.#pg) {
      await this.#pg.close(); // Close existing connection to clear state
    }
    this.#pg = new PGlite(); // Create a new instance for a clean slate
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
   * @returns {Promise<QueryResult>}
   */
  async query(sql) {
    if (!this.#pg) {
      throw new Error('PGLite database not initialized.');
    }
    try {
      const result = await this.#pg.query(sql);
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
