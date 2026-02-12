// wesley-website/src/test/FakeDbSession.js

/**
 * @typedef {Object} QueryResult
 * @property {Array<Object>} rows - The returned rows as an array of objects.
 * @property {Array<string>} fields - The names of the fields/columns.
 */

/**
 * A fake in-memory implementation of DbSession for testing purposes.
 * Uses a Map to store per-table data to avoid data leakage between tables.
 */
export class FakeDbSession {
  /** @type {string[]} */
  #appliedMigrations = [];
  /** @type {Map<string, Array<Object>>} */
  #tableData = new Map();
  /** @type {string[]} */
  #tableNames = [];

  /**
   * @param {Object} [initialState]
   * @param {Object<string, Array<Object>>} [initialState.tableData] - Initial data keyed by table name.
   * @param {string[]} [initialState.tableNames] - Initial table names for the fake database.
   */
  constructor(initialState = {}) {
    if (initialState.tableData) {
      for (const [name, data] of Object.entries(initialState.tableData)) {
        this.#tableData.set(name, data);
        if (!this.#tableNames.includes(name)) {
          this.#tableNames.push(name);
        }
      }
    }
    if (initialState.tableNames) {
      for (const name of initialState.tableNames) {
        if (!this.#tableNames.includes(name)) {
          this.#tableNames.push(name);
        }
      }
    }
  }

  /**
   * Resets the fake database to its initial empty state.
   * @returns {Promise<void>}
   */
  async reset() {
    this.#appliedMigrations = [];
    this.#tableData.clear();
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
        const tableName = createTableMatch[1];
        if (!this.#tableNames.includes(tableName)) {
          this.#tableNames.push(tableName);
        }
        if (!this.#tableData.has(tableName)) {
          this.#tableData.set(tableName, []);
        }
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
    // Handle information_schema.tables queries (used by fetchTables)
    if (sql.includes('information_schema.tables')) {
      const rows = [...this.#tableNames].sort().map(n => ({ table_name: n }));
      return { rows, fields: ['table_name'] };
    }
    // Handle information_schema.columns queries (used by table schema inspection)
    if (sql.includes('information_schema.columns')) {
      return { rows: [], fields: ['column_name', 'data_type', 'is_nullable', 'column_default'] };
    }
    const fromMatch = sql.match(/FROM\s+"?(\w+)"?/i);
    if (fromMatch && fromMatch[1]) {
      const tableName = fromMatch[1];
      if (!this.#tableNames.includes(tableName)) {
        throw new Error(`relation "${tableName}" does not exist`);
      }
      const data = this.#tableData.get(tableName) || [];
      if (data.length > 0) {
        const fields = Object.keys(data[0]);
        // Parse LIMIT clause if present, otherwise return all data
        const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1], 10) : data.length;
        return { rows: data.slice(0, limit), fields };
      }
      return { rows: [], fields: [] };
    }

    // Simulate other operations, or throw if not supported
    if (sql.toLowerCase().startsWith('insert')) {
      // For basic insert, we can acknowledge it
      return { rows: [], fields: [] };
    }

    // Handle count queries for specific tables
    const countMatch = sql.match(/select count\(\*\) from\s+"?(\w+)"?/i);
    if (countMatch && countMatch[1]) {
      const tableName = countMatch[1];
      const data = this.#tableData.get(tableName) || [];
      return { rows: [{ count: data.length.toString() }], fields: ['count'] };
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
    this.#tableData.set(tableName, data);
  }
}
