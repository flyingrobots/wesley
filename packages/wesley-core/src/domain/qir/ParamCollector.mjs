/**
 * QIR Parameter Collector — deterministic ordering of ParamRef occurrences.
 * Pure module (no Node built-ins). Traverses a QueryPlan in a stable manner
 * to record parameter names once and preserve visit order.
 */

// Using the structural shapes defined in qir/Nodes.mjs

export function collectParams(plan) {
  const seen = new Map(); // key -> 1-based index
  const ordered = []; // { name, typeHint, special }

  const visitPlan = (p) => {
    if (!p) return;
    // Visit predicate on root if represented via Filter node
    // Projection
    if (p.projection && Array.isArray(p.projection.items)) {
      for (const it of p.projection.items) visitExpr(it.expr);
    }
    // ORDER BY
    if (p.orderBy) {
      for (const ob of p.orderBy) visitExpr(ob.expr);
    }
    // Root relation
    visitRelation(p.root);
  };

  const visitRelation = (r) => {
    if (!r) return;
    switch (r.kind) {
      case 'Join':
        visitRelation(r.left);
        visitRelation(r.right);
        if (r.on) visitPredicate(r.on);
        break;
      case 'Lateral':
      case 'Subquery':
        visitPlan(r.plan);
        break;
      case 'Filter':
        visitRelation(r.input);
        if (r.predicate) visitPredicate(r.predicate);
        break;
      case 'DistinctOn':
        visitRelation(r.input);
        if (Array.isArray(r.keys)) for (const k of r.keys) visitExpr(k);
        break;
      default:
        // Table: nothing else to traverse
        break;
    }
  };

  const visitPredicate = (p) => {
    if (!p) return;
    switch (p.kind) {
      case 'Exists':
        if (p.subquery) visitPlan(p.subquery);
        break;
      case 'Not':
        visitPredicate(p.left);
        break;
      case 'And':
      case 'Or':
        visitPredicate(p.left);
        visitPredicate(p.right);
        break;
      case 'Compare':
        // Special null operators carry only left expr
        if (p.op === 'isNull' || p.op === 'isNotNull') {
          visitExpr(p.left);
        } else {
          visitExpr(p.left);
          visitExpr(p.right);
        }
        break;
      default:
        // Unknown predicate shape — ignore
        break;
    }
  };

  const visitExpr = (e) => {
    if (!e) return;
    switch (e.kind) {
      case 'ParamRef':
        recordParam(e);
        break;
      case 'JsonBuildObject':
        for (const f of e.fields || []) visitExpr(f.value);
        break;
      case 'JsonAgg':
        visitExpr(e.value);
        if (e.orderBy) for (const ob of e.orderBy) visitExpr(ob.expr);
        break;
      case 'FuncCall':
        for (const a of e.args || []) visitExpr(a);
        break;
      case 'ScalarSubquery':
        if (e.plan) visitPlan(e.plan);
        break;
      case 'Cast':
        visitExpr(e.expr);
        break;
      case 'CaseWhen':
        for (const b of e.branches || []) {
          visitPredicate(b.when);
          visitExpr(b.then);
        }
        if (e.else) visitExpr(e.else);
        break;
      default:
        // ColumnRef | Literal or unknown — nothing to do
        break;
    }
  };

  const recordParam = (p) => {
    const key = `${p.special || ''}:${p.name}:${p.typeHint || ''}`;
    if (!seen.has(key)) {
      seen.set(key, ordered.length + 1);
      ordered.push({ name: p.name, typeHint: p.typeHint, special: p.special || null });
    }
  };

  visitPlan(plan);
  return { ordered, indexByName: seen };
}

