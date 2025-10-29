/**
 * QIR (Query IR) Nodes — Minimal skeleton for operation→SQL compilation
 * Pure data structures (no Node built-ins). Kept intentionally small for MVP.
 */

export class QueryPlan {
  constructor(root, projection, { orderBy = [], limit = null, offset = null } = {}) {
    this.root = root; // RelationNode
    this.projection = projection; // Projection
    this.orderBy = orderBy; // OrderBy[]
    this.limit = limit; // number|null
    this.offset = offset; // number|null
  }
}

export class TableNode {
  constructor(table, alias) {
    this.kind = 'Table';
    this.table = table;
    this.alias = alias;
  }
}

export class JoinNode {
  constructor(left, right, joinType, onPredicate) {
    this.kind = 'Join';
    this.left = left; // RelationNode
    this.right = right; // RelationNode
    this.joinType = joinType || 'INNER'; // INNER|LEFT
    this.on = onPredicate; // Predicate
    this.alias = (right && right.alias) || undefined;
  }
}

export class LateralNode {
  constructor(plan, alias) {
    this.kind = 'Lateral';
    this.plan = plan; // QueryPlan
    this.alias = alias;
  }
}

export class SubqueryNode {
  constructor(plan, alias) {
    this.kind = 'Subquery';
    this.plan = plan; // QueryPlan
    this.alias = alias;
  }
}

export class Projection {
  constructor(items = []) {
    this.items = items; // ProjectionItem[]
  }
  add(item) { this.items.push(item); return this; }
}

export class ProjectionItem {
  constructor(alias, expr) {
    this.alias = alias; // string
    this.expr = expr; // Expr
  }
}

// Exprs
export class ColumnRef { constructor(table, column) { this.kind = 'ColumnRef'; this.table = table; this.column = column; } }
export class ParamRef { constructor(name, special) { this.kind = 'ParamRef'; this.name = name; this.special = special || null; } }
export class Literal { constructor(value, type) { this.kind = 'Literal'; this.value = value; this.type = type || null; } }
export class FuncCall { constructor(name, args = []) { this.kind = 'FuncCall'; this.name = name; this.args = args; } }
export class ScalarSubquery { constructor(plan) { this.kind = 'ScalarSubquery'; this.plan = plan; } }
export class JsonBuildObject { constructor(fields) { this.kind = 'JsonBuildObject'; this.fields = fields; } }
export class JsonAgg { constructor(value, orderBy = []) { this.kind = 'JsonAgg'; this.value = value; this.orderBy = orderBy; } }

// Predicates
export class Predicate {
  static compare(left, op, right) { return { kind: 'Compare', left, op, right }; }
  static and(left, right) { return { kind: 'And', left, right }; }
  static or(left, right) { return { kind: 'Or', left, right }; }
  static not(inner) { return { kind: 'Not', left: inner }; }
  static exists(subqueryPlan) { return { kind: 'Exists', subquery: subqueryPlan }; }
  static isNull(expr) { return { kind: 'IsNull', left: expr }; }
  static isNotNull(expr) { return { kind: 'IsNotNull', left: expr }; }
}

export class OrderBy { constructor(expr, direction = 'asc', nulls = null) { this.expr = expr; this.direction = direction; this.nulls = nulls; } }

// Simple alias generator for determinism in tests (not used by runtime yet)
export class AliasAllocator {
  constructor(prefix = 't') { this.prefix = prefix; this.count = 0; }
  next() { return `${this.prefix}${this.count++}`; }
}

