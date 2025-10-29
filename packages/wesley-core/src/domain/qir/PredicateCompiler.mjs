/**
 * QIR Predicate Compiler — maps a JSON filter DSL to Predicate trees.
 * The caller provides an environment with column resolution and param creation.
 * Pure module (no Node built-ins).
 */

export function compileFilter(input, env) {
  if (!input || typeof input !== 'object') throw new Error('Invalid filter input');

  // Logical operators
  if (Array.isArray(input.AND)) return andList(input.AND.map(x => compileFilter(x, env)));
  if (Array.isArray(input.OR))  return orList(input.OR.map(x => compileFilter(x, env)));
  if (input.NOT)                return { kind: 'Not', left: compileFilter(input.NOT, env) };

  // Scalar comparison: { field: { op: value } }
  const entries = Object.entries(input);
  if (entries.length !== 1) throw new Error('Filter object must contain exactly one field');
  const [field, spec] = entries[0];
  const col = env.resolveColumn(field);
  const lhs = { kind: 'ColumnRef', table: col.table, column: col.column };

  const op = Object.keys(spec || {})[0];
  const rhsVal = spec ? spec[op] : undefined;
  const isNullish = (v) => v === null || v === undefined;

  // Null operators
  if (op === 'isNull')    return { kind: 'Compare', left: lhs, op: 'isNull' };
  if (op === 'isNotNull') return { kind: 'Compare', left: lhs, op: 'isNotNull' };
  if (op === 'eq' && isNullish(rhsVal)) return { kind: 'Compare', left: lhs, op: 'isNull' };
  if (op === 'ne' && isNullish(rhsVal)) return { kind: 'Not', left: { kind: 'Compare', left: lhs, op: 'isNull' } };

  const param = (name, type) => env.param(name, type);
  const type = normalizeScalar(col.type);

  switch (op) {
    case 'in': {
      if (!Array.isArray(rhsVal) || rhsVal.length === 0) {
        // FALSE = TRUE (we will collapse later). Keeps AST simple.
        return { kind: 'Compare', left: { kind: 'Literal', value: false }, op: 'eq', right: { kind: 'Literal', value: true } };
      }
      const arrType = type.endsWith('[]') ? type : `${type}[]`;
      return { kind: 'Compare', left: lhs, op: 'in', right: param(field, arrType) };
    }
    case 'contains': {
      if (type === 'jsonb' || type.endsWith('[]')) return { kind: 'Compare', left: lhs, op: 'contains', right: param(field, type) };
      // Fallback for text contains → ILIKE
      return { kind: 'Compare', left: lhs, op: 'ilike', right: param(field, 'text') };
    }
    case 'ilike':
    case 'like':
      return { kind: 'Compare', left: lhs, op, right: param(field, 'text') };
    case 'eq': case 'ne': case 'lt': case 'lte': case 'gt': case 'gte':
      return { kind: 'Compare', left: lhs, op, right: param(field, type) };
    default:
      throw new Error(`Unsupported operator '${op}' on ${field}`);
  }
}

function andList(list) {
  let acc = null;
  for (const p of list) acc = acc ? { kind: 'And', left: acc, right: p } : p;
  return acc || { kind: 'Compare', left: { kind: 'Literal', value: true }, op: 'eq', right: { kind: 'Literal', value: true } };
}
function orList(list) {
  let acc = null;
  for (const p of list) acc = acc ? { kind: 'Or', left: acc, right: p } : p;
  return acc || { kind: 'Compare', left: { kind: 'Literal', value: false }, op: 'eq', right: { kind: 'Literal', value: true } };
}

function normalizeScalar(type) {
  if (!type) return 'text';
  const t = String(type).toLowerCase();
  // Accept common aliases
  if (t === 'uuid') return 'uuid';
  if (t === 'text' || t === 'varchar') return 'text';
  if (t === 'int' || t === 'integer') return 'integer';
  if (t === 'bigint') return 'bigint';
  if (t === 'boolean' || t === 'bool') return 'boolean';
  if (t === 'timestamptz' || t === 'timestamp') return 'timestamptz';
  if (t.endsWith('[]')) return t;
  if (t === 'json' || t === 'jsonb') return 'jsonb';
  return t;
}

