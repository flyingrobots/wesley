// wesley-website/src/test/FakeDbSession.js

/**
 * @typedef {Object} QueryResult
 * @property {Array<Object>} rows - The returned rows as an array of objects.
 * @property {Array<string>} fields - The names of the fields/columns.
 */

/**
 * A fake in-memory implementation of DbSession for testing purposes.
 */
export class FakeDbSession {
  /** @type {string[]} */
  #appliedMigrations = [];
  /** @type {Array<Object>} */
  #data = [];
  /** @type {string[]} */
  #tableNames = [];

  /**
   * @param {Object} [initialState]
   * @param {Array<Object>} [initialState.data] - Initial data for the fake database.
   * @param {string[]} [initialState.tableNames] - Initial table names for the fake database.
   */
  constructor(initialState = {}) {
    this.#data = initialState.data || [];
    this.#tableNames = initialState.tableNames || [];
  }

  /**
   * Resets the fake database to its initial empty state.
   * @returns {Promise<void>}
   */
  async reset() {
    this.#appliedMigrations = [];
    this.#data = [];
    this.#tableNames = [];
  }

  /**
   * Records SQL migration statements without executing them.
   * @param {string[]} sqlMigrations - An array of SQL statements.
   * @returns {Promise<void>}
   */
  async applyMigrations(sqlMigrations) {
    this.#appliedMigrations.push(...sqlMigrations);
    // Simulate table creation for testing purposes
    sqlMigrations.forEach(sql => {
      const createTableMatch = sql.match(/CREATE TABLE\s+"?(\w+)"?/i);
      if (createTableMatch && createTableMatch[1]) {
        this.#tableNames.push(createTableMatch[1]);
      }
    });
  }

  /**
   * Simulates executing a SQL query and returns canned data.
   * Supports basic SELECT on mocked tables.
   * @param {string} sql - The SQL query string.
   * @returns {Promise<QueryResult>}
   */
  async query(sql) {
    if (sql.toLowerCase().includes('select 1')) {
      return { rows: [{ value: 1 }], fields: ['value'] };
    }
    const fromMatch = sql.match(/FROM\s+"?(\w+)"?/i);
    if (fromMatch && fromMatch[1]) {
      const tableName = fromMatch[1];
      if (!this.#tableNames.includes(tableName)) {
        throw new Error(`relation "${tableName}" does not exist`);
      }
      // For simplicity, just return all mocked data for the first table
      // In a real fake, you'd parse SQL more thoroughly.
      if (this.#data.length > 0) {
        const fields = Object.keys(this.#data[0]);
        return { rows: this.#data.slice(0, 100), fields };
      }
      return { rows: [], fields: [] };
    }

    // Simulate other operations, or throw if not supported
    if (sql.toLowerCase().startsWith('insert')) {
      // For basic insert, we can acknowledge it
      return { rows: [], fields: [] };
    }
    if (sql.toLowerCase().startsWith('select count(*) from')) {
        return { rows: [{ count: this.#data.length.toString() }], fields: ['count'] };
    }

    throw new Error(`FakeDbSession does not support this query: ${sql}`);
  }

  /**
   * Get all migrations that were applied to this fake session.
   * @returns {string[]}
   */
  getAppliedMigrations() {
    return this.#appliedMigrations;
  }

  /**
   * Get the names of tables simulated to be created.
   * @returns {string[]}
   */
  getTableNames() {
    return this.#tableNames;
  }

  /**
   * Sets initial data for a simulated table.
   * @param {string} tableName - The name of the table to set data for.
   * @param {Array<Object>} data - An array of objects representing rows.
   */
  setTableData(tableName, data) {
    if (!this.#tableNames.includes(tableName)) {
      this.#tableNames.push(tableName);
    }
    this.#data = data;
  }
}
