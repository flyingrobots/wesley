/**
 * SqlDialect — Abstract interface for database-specific SQL rendering.
 *
 * QIR's core (Nodes, plans, predicates, parameter collection, translator) is
 * dialect-neutral. Only the final rendering steps — lowerToSQL and emit — need
 * to know about the target database's SQL flavour.
 *
 * SqlDialect captures those flavour differences behind a clean interface so
 * that lowerToSQL and emit can delegate to the dialect instead of hardcoding
 * PostgreSQL syntax.
 *
 * All methods throw by default; concrete dialects must override every method.
 */
export class SqlDialect {
  /**
   * Human-readable dialect name (e.g. 'postgres', 'sqlite').
   * @returns {string}
   */
  get name() {
    throw new Error('SqlDialect.name must be implemented');
  }

  /**
   * Render a JSON object constructor from key/value pairs.
   * @param {Array<{key: string, valueSql: string}>} _fields
   * @returns {string} e.g. `jsonb_build_object('a', t0."a", 'b', t0."b")`
   */
  jsonBuildObject(_fields) {
    throw new Error(`${this.constructor.name}.jsonBuildObject() must be implemented`);
  }

  /**
   * Render a JSON array aggregation with COALESCE empty-array fallback.
   * @param {string} _innerSql - The rendered expression to aggregate
   * @param {string} _orderBySql - Rendered ORDER BY clause (empty string if none)
   * @returns {string} e.g. `COALESCE(jsonb_agg(expr ORDER BY ...), '[]'::jsonb)`
   */
  jsonAgg(_innerSql, _orderBySql) {
    throw new Error(`${this.constructor.name}.jsonAgg() must be implemented`);
  }

  /**
   * Render a JSONB/JSON containment check.
   * @param {string} _lhsSql - Left-hand side (column)
   * @param {string} _rhsSql - Right-hand side (parameter/literal)
   * @returns {string} e.g. `"col" @> $1`
   */
  arrayContains(_lhsSql, _rhsSql) {
    throw new Error(`${this.constructor.name}.arrayContains() must be implemented`);
  }

  /**
   * Render an array membership / IN check.
   * @param {string} _lhsSql - Left-hand side (column)
   * @param {string} _paramSql - Parameter SQL (already rendered with cast)
   * @returns {string} e.g. `"col" = ANY($1::text[])`
   */
  arrayIn(_lhsSql, _paramSql) {
    throw new Error(`${this.constructor.name}.arrayIn() must be implemented`);
  }

  /**
   * Render a case-insensitive LIKE comparison.
   * @param {string} _lhsSql
   * @param {string} _rhsSql
   * @returns {string} e.g. `"col" ILIKE $1`
   */
  ilike(_lhsSql, _rhsSql) {
    throw new Error(`${this.constructor.name}.ilike() must be implemented`);
  }

  /**
   * Render a parameter placeholder for the given 1-based index.
   * @param {number} _index - 1-based parameter index
   * @returns {string} e.g. `$1`, `?`, `:param1`
   */
  paramPlaceholder(_index) {
    throw new Error(`${this.constructor.name}.paramPlaceholder() must be implemented`);
  }

  /**
   * Quote an identifier for this dialect.
   * @param {string} _name
   * @returns {string} e.g. `"name"`, `` `name` ``
   */
  quoteIdent(_name) {
    throw new Error(`${this.constructor.name}.quoteIdent() must be implemented`);
  }

  /**
   * Maximum identifier length in bytes for this dialect.
   * @returns {number}
   */
  identifierLimit() {
    throw new Error(`${this.constructor.name}.identifierLimit() must be implemented`);
  }

  /**
   * Wrap a subquery alias to produce a JSON/JSONB row.
   * @param {string} _alias - The subquery alias
   * @returns {string} e.g. `to_jsonb("q".*)`
   */
  wrapToJsonb(_alias) {
    throw new Error(`${this.constructor.name}.wrapToJsonb() must be implemented`);
  }

  /**
   * Render a CREATE VIEW statement.
   * @param {string} _qualifiedName - Fully qualified view name
   * @param {string} _selectSql - The SELECT statement body
   * @returns {string}
   */
  createView(_qualifiedName, _selectSql) {
    throw new Error(`${this.constructor.name}.createView() must be implemented`);
  }

  /**
   * Render a CREATE FUNCTION statement.
   * @param {Object} _spec
   * @param {string} _spec.qualifiedName - Fully qualified function name
   * @param {string} _spec.paramsSql - Rendered parameter list
   * @param {string} _spec.bodySql - Function body SQL
   * @param {'invoker'|'definer'} _spec.security
   * @param {string} _spec.searchPathSql - Rendered SET search_path (empty string if none)
   * @returns {string}
   */
  createFunction(_spec) {
    throw new Error(`${this.constructor.name}.createFunction() must be implemented`);
  }
}
