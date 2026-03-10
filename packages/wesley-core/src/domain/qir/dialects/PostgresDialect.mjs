/**
 * PostgresDialect — PostgreSQL-specific SQL rendering for QIR.
 *
 * Extracts all PG-specific syntax that was previously hardcoded in
 * lowerToSQL.mjs and emit.mjs into a single dialect implementation.
 * This is the default dialect; behaviour is identical to before the
 * dialect abstraction was introduced.
 */

import { SqlDialect } from './SqlDialect.mjs';

export class PostgresDialect extends SqlDialect {
  get name() {
    return 'postgres';
  }

  jsonBuildObject(fields) {
    const pairs = fields.flatMap(({ key, valueSql }) => [
      `'${escString(String(key))}'`,
      valueSql
    ]);
    return `jsonb_build_object(${pairs.join(', ')})`;
  }

  jsonAgg(innerSql, orderBySql) {
    const order = orderBySql ? ` ${orderBySql}` : '';
    return `COALESCE(jsonb_agg(${innerSql}${order}), '[]'::jsonb)`;
  }

  arrayContains(lhsSql, rhsSql) {
    return `${lhsSql} @> ${rhsSql}`;
  }

  arrayIn(lhsSql, paramSql) {
    return `${lhsSql} = ANY(${paramSql})`;
  }

  ilike(lhsSql, rhsSql) {
    return `${lhsSql} ILIKE ${rhsSql}`;
  }

  paramPlaceholder(index) {
    return `$${index}`;
  }

  quoteIdent(name) {
    const escaped = String(name).replace(/"/g, '""');
    return `"${escaped}"`;
  }

  identifierLimit() {
    return 63;
  }

  wrapToJsonb(alias) {
    return `to_jsonb(${this.quoteIdent(alias)}.*)`;
  }

  createView(qualifiedName, selectSql) {
    return `CREATE OR REPLACE VIEW ${qualifiedName} AS\n${selectSql};`;
  }

  createFunction({ qualifiedName, paramsSql, bodySql, security, searchPathSql }) {
    const sec = String(security || 'invoker').toLowerCase() === 'definer'
      ? 'SECURITY DEFINER'
      : 'SECURITY INVOKER';

    const attrs = ['LANGUAGE sql', 'STABLE', sec];
    if (searchPathSql) attrs.push(`SET search_path = ${searchPathSql}`);

    return [
      `CREATE OR REPLACE FUNCTION ${qualifiedName}(${paramsSql})`,
      'RETURNS SETOF jsonb',
      ...attrs,
      'AS $$',
      bodySql,
      '$$;'
    ].join('\n');
  }
}

function escString(s) {
  return String(s).replace(/'/g, "''");
}
