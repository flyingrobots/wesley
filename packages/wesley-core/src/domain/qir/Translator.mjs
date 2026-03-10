/**
 * QIR Translator — Compiles GraphQL operation documents into QIR query plans.
 *
 * Input: a GraphQL operation string (query/mutation) + a TranslateEnv (schema context)
 * Output: a QueryPlan ready for lowerToSQL() and emit.mjs
 *
 * Pure module (no Node built-ins). Uses graphql-js for parsing.
 */

import { parse as parseGQL } from 'graphql';
import {
  QueryPlan, TableNode, JoinNode, LateralNode,
  Projection, ProjectionItem,
  ColumnRef, ParamRef, FuncCall, Literal,
  JsonBuildObject, JsonAgg,
  Predicate, OrderBy
} from './Nodes.mjs';

/**
 * Translate a GraphQL operation string into a QIR QueryPlan.
 *
 * @param {string} gql — GraphQL operation document (query or mutation)
 * @param {import('./TranslateEnv.mjs').TranslateEnv} env — schema introspection layer
 * @param {object} options
 * @param {string} options.rootTypeName — the Wesley IR type name for the root table (e.g., 'Product')
 * @param {string} [options.target='postgres'] — 'supabase' | 'postgres' (affects auth variable compilation)
 * @param {object} [options.variables={}] — variable values for literal substitution (limit, offset)
 * @returns {QueryPlan}
 */
export function translateOperation(gql, env, options = {}) {
  const { rootTypeName, target = 'postgres', variables = {} } = options;

  // 1. Parse GraphQL
  let doc;
  try {
    doc = parseGQL(gql);
  } catch (err) {
    throw new Error(`GraphQL syntax error: ${err.message}`);
  }

  // 2. Find the first operation definition
  const opDef = doc.definitions.find(d => d.kind === 'OperationDefinition');
  if (!opDef) throw new Error('No operation definition found in GraphQL document');

  // 3. Resolve root table
  const tableName = env.resolveTable(rootTypeName);
  const rootAlias = env.nextAlias();
  const root = new TableNode(tableName, rootAlias);

  // 4. Extract the root field (first field in the selection set)
  const rootField = opDef.selectionSet.selections[0];
  if (!rootField || rootField.kind !== 'Field') {
    throw new Error('Expected a field selection in the operation');
  }

  // 5. Extract variable definitions for param type resolution
  const varDefs = new Map();
  for (const v of opDef.variableDefinitions || []) {
    const varName = v.variable.name.value;
    const varType = extractGqlType(v.type);
    varDefs.set(varName, varType);
  }

  // 6. Build projection from selection set
  const ctx = {
    env,
    rootTypeName,
    rootAlias,
    target,
    variables,
    varDefs,
    params: new Map()
  };

  const proj = new Projection();
  let rel = root;

  const innerSelections = rootField.selectionSet ? rootField.selectionSet.selections : [];
  for (const sel of innerSelections) {
    if (sel.kind !== 'Field') continue;
    const fieldName = sel.name.value;
    const fieldAlias = sel.alias ? sel.alias.value : fieldName;

    // Check if this is a relation field
    const relation = env.resolveRelation(rootTypeName, fieldName);

    if (relation && relation.kind === 'many-to-one') {
      // belongsTo: LEFT JOIN + JsonBuildObject
      const joinResult = buildBelongsToJoin(ctx, rel, relation, sel, fieldAlias);
      rel = joinResult.rel;
      proj.add(joinResult.projItem);
    } else if (relation && relation.kind === 'one-to-many') {
      // hasMany: LATERAL + JsonAgg
      const lateralResult = buildHasManyLateral(ctx, rootAlias, relation, sel, fieldAlias);
      rel = new JoinNode(rel, lateralResult.lateral, 'LEFT', null);
      proj.add(lateralResult.projItem);
    } else {
      // Scalar field
      env.resolveColumn(rootTypeName, fieldName); // validates existence
      proj.add(new ProjectionItem(fieldAlias, new ColumnRef(rootAlias, fieldName)));
    }
  }

  // 7. Build WHERE predicate from arguments
  let predicate = null;
  const args = extractArguments(rootField.arguments || []);

  if (args.where) {
    predicate = translateWhere(ctx, rootTypeName, rootAlias, args.where);
  }

  if (predicate) {
    rel = { kind: 'Filter', input: rel, predicate };
  }

  // 8. ORDER BY
  const orderBy = [];
  if (args.orderBy) {
    for (const item of args.orderBy) {
      for (const [col, dir] of Object.entries(item)) {
        env.resolveColumn(rootTypeName, col); // validate
        orderBy.push(new OrderBy(
          new ColumnRef(rootAlias, col),
          String(dir).toLowerCase() === 'desc' ? 'desc' : 'asc'
        ));
      }
    }
  }

  // 9. LIMIT / OFFSET
  const limit = resolveIntArg(args.limit, variables) || null;
  const offset = resolveIntArg(args.offset, variables) || null;

  return new QueryPlan(rel, proj, { orderBy, limit, offset });
}

// --- Internal helpers ---

/**
 * Build a LEFT JOIN for a belongsTo (many:1) relation with nested fields as JsonBuildObject.
 */
function buildBelongsToJoin(ctx, currentRel, relation, selection, fieldAlias) {
  const { env } = ctx;
  const joinAlias = env.nextAlias('j');
  const joinTable = env.resolveTable(relation.targetTable);
  const right = new TableNode(joinTable, joinAlias);

  // ON predicate: parent.fk_field = joined.pk_field
  const on = Predicate.compare(
    new ColumnRef(ctx.rootAlias, relation.fkField),
    'eq',
    new ColumnRef(joinAlias, relation.targetPkField)
  );

  const rel = new JoinNode(currentRel, right, 'LEFT', on);

  // Build JsonBuildObject from nested selections
  const fields = [];
  const innerSels = selection.selectionSet ? selection.selectionSet.selections : [];
  for (const sel of innerSels) {
    if (sel.kind !== 'Field') continue;
    const name = sel.name.value;
    const alias = sel.alias ? sel.alias.value : name;
    env.resolveColumn(relation.targetTable, name); // validate
    fields.push({ key: alias, value: new ColumnRef(joinAlias, name) });
  }

  const projItem = new ProjectionItem(fieldAlias, new JsonBuildObject(fields));
  return { rel, projItem };
}

/**
 * Build a LATERAL subquery for a hasMany (1:N) relation with JsonAgg(JsonBuildObject(...)).
 */
function buildHasManyLateral(ctx, parentAlias, relation, selection, fieldAlias) {
  const { env } = ctx;
  const childAlias = env.nextAlias();
  const lateralAlias = env.nextAlias('l');
  const childTable = env.resolveTable(relation.targetTable);

  const childRoot = new TableNode(childTable, childAlias);

  // Build JsonBuildObject fields from nested selections
  const fields = [];
  const innerSels = selection.selectionSet ? selection.selectionSet.selections : [];
  for (const sel of innerSels) {
    if (sel.kind !== 'Field') continue;
    const name = sel.name.value;
    const alias = sel.alias ? sel.alias.value : name;
    env.resolveColumn(relation.targetTable, name); // validate
    fields.push({ key: alias, value: new ColumnRef(childAlias, name) });
  }

  // Projection: jsonb_agg(jsonb_build_object(...))
  const jsonExpr = new JsonAgg(new JsonBuildObject(fields));
  const subProj = new Projection();
  subProj.add(new ProjectionItem(fieldAlias, jsonExpr));

  // WHERE: child.fk_field = parent.pk_field
  const matchPred = Predicate.compare(
    new ColumnRef(childAlias, relation.fkField),
    'eq',
    new ColumnRef(parentAlias, relation.targetPkField)
  );
  const subRel = { kind: 'Filter', input: childRoot, predicate: matchPred };
  const subPlan = new QueryPlan(subRel, subProj, {});

  const lateral = new LateralNode(subPlan, lateralAlias);
  const projItem = new ProjectionItem(fieldAlias, new ColumnRef(lateralAlias, fieldAlias));

  return { lateral, projItem };
}

/**
 * Translate a `where` argument object into a QIR Predicate tree.
 */
function translateWhere(ctx, typeName, tableAlias, where) {
  // Logical combinators
  if (where.AND) {
    const preds = where.AND.map(w => translateWhere(ctx, typeName, tableAlias, w));
    return preds.reduce((acc, p) => acc ? Predicate.and(acc, p) : p, null);
  }
  if (where.OR) {
    const preds = where.OR.map(w => translateWhere(ctx, typeName, tableAlias, w));
    return preds.reduce((acc, p) => acc ? Predicate.or(acc, p) : p, null);
  }
  if (where.NOT) {
    return Predicate.not(translateWhere(ctx, typeName, tableAlias, where.NOT));
  }

  // Field-level filters
  const entries = Object.entries(where);
  if (entries.length === 0) return null;

  const preds = [];
  for (const [field, spec] of entries) {
    // Check for relation filter (some/none/every)
    const relation = ctx.env.resolveRelation(typeName, field);
    if (relation && typeof spec === 'object') {
      if (spec.some) {
        preds.push(buildExistsFilter(ctx, tableAlias, relation, spec.some));
      } else if (spec.none) {
        preds.push(Predicate.not(buildExistsFilter(ctx, tableAlias, relation, spec.none)));
      } else if (spec.every) {
        // every = NOT EXISTS (child WHERE NOT predicate)
        preds.push(Predicate.not(buildExistsFilter(ctx, tableAlias, relation, spec.every, true)));
      }
      continue;
    }

    // Scalar filter
    const col = ctx.env.resolveColumn(typeName, field);
    const lhs = new ColumnRef(tableAlias, col.column);

    for (const [op, rawValue] of Object.entries(spec)) {
      if (op === 'isNull') {
        preds.push(Predicate.isNull(lhs));
      } else if (op === 'isNotNull') {
        preds.push(Predicate.isNotNull(lhs));
      } else {
        const rhs = resolveFilterValue(ctx, field, op, rawValue, col.pgType);
        preds.push(Predicate.compare(lhs, op, rhs));
      }
    }
  }

  return preds.reduce((acc, p) => acc ? Predicate.and(acc, p) : p, null);
}

/**
 * Build an EXISTS subquery for relation filters (some/none).
 */
function buildExistsFilter(ctx, parentAlias, relation, filterSpec, negateInner = false) {
  const { env } = ctx;
  const childAlias = env.nextAlias();
  const childTable = env.resolveTable(relation.targetTable);
  const childRoot = new TableNode(childTable, childAlias);

  // Join condition: child.fk = parent.pk
  let parentPk;
  if (relation.kind === 'one-to-many') {
    parentPk = relation.targetPkField;
  } else {
    parentPk = relation.fkField;
  }

  const joinPred = Predicate.compare(
    new ColumnRef(childAlias, relation.fkField),
    'eq',
    new ColumnRef(parentAlias, parentPk)
  );

  // Inner filter on child fields
  let innerPred = translateWhere(ctx, relation.targetTable, childAlias, filterSpec);
  if (negateInner && innerPred) {
    innerPred = Predicate.not(innerPred);
  }

  const combinedPred = innerPred ? Predicate.and(joinPred, innerPred) : joinPred;

  const subRel = { kind: 'Filter', input: childRoot, predicate: combinedPred };
  const subProj = new Projection([new ProjectionItem('_1', new Literal(1))]);
  const subPlan = new QueryPlan(subRel, subProj, {});

  return Predicate.exists(subPlan);
}

/**
 * Resolve a filter value to a ParamRef, FuncCall, or Literal.
 */
function resolveFilterValue(ctx, fieldName, op, rawValue, pgType) {
  // Variable reference: { $ref: 'varName' } or string starting with '$'
  if (typeof rawValue === 'object' && rawValue !== null && rawValue.$ref) {
    return makeParamOrAuth(ctx, rawValue.$ref, pgType);
  }
  if (typeof rawValue === 'string' && rawValue.startsWith('$')) {
    return makeParamOrAuth(ctx, rawValue.slice(1), pgType);
  }
  // Literal value
  return new Literal(rawValue, pgType);
}

/**
 * Create a ParamRef or an auth FuncCall depending on the variable name and target.
 */
function makeParamOrAuth(ctx, varName, pgType) {
  // Auth variables
  if (varName === 'auth_uid') {
    if (ctx.target === 'supabase') {
      return new FuncCall('auth.uid', []);
    }
    return new FuncCall('current_setting', [new Literal('app.user_id', 'text'), new Literal(true)]);
  }

  const p = new ParamRef(varName);
  if (pgType) p.typeHint = pgType;
  return p;
}

/**
 * Extract a GraphQL type name from a type AST node.
 */
function extractGqlType(typeNode) {
  if (typeNode.kind === 'NonNullType') return extractGqlType(typeNode.type);
  if (typeNode.kind === 'ListType') return `[${extractGqlType(typeNode.type)}]`;
  return typeNode.name.value;
}

/**
 * Extract arguments from a GraphQL field's argument AST into a plain object.
 * Handles variable references, object values, list values, and literals.
 */
function extractArguments(args) {
  const result = {};
  for (const arg of args) {
    result[arg.name.value] = extractValue(arg.value);
  }
  return result;
}

function extractValue(valueNode) {
  switch (valueNode.kind) {
  case 'Variable':
    return '$' + valueNode.name.value;
  case 'IntValue':
    return parseInt(valueNode.value, 10);
  case 'FloatValue':
    return parseFloat(valueNode.value);
  case 'StringValue':
    return valueNode.value;
  case 'BooleanValue':
    return valueNode.value;
  case 'NullValue':
    return null;
  case 'EnumValue':
    return valueNode.value;
  case 'ListValue':
    return valueNode.values.map(extractValue);
  case 'ObjectValue': {
    const obj = {};
    for (const field of valueNode.fields) {
      obj[field.name.value] = extractValue(field.value);
    }
    return obj;
  }
  default:
    return null;
  }
}

/**
 * Resolve an integer argument that may be a variable reference or a literal.
 */
function resolveIntArg(value, variables) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.startsWith('$')) {
    const varName = value.slice(1);
    const v = variables[varName];
    return typeof v === 'number' ? v : null;
  }
  return null;
}
