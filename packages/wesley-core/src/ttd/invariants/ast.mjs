/**
 * TTD Invariant Expression AST
 *
 * Abstract Syntax Tree types for invariant expressions.
 */

/**
 * Expression node kinds
 */
export const ExprKind = {
  // Literals
  LITERAL: 'LITERAL',
  IDENTIFIER: 'IDENTIFIER',

  // Operations
  BINARY: 'BINARY',
  UNARY: 'UNARY',
  COMPARISON: 'COMPARISON',
  LOGICAL: 'LOGICAL',

  // Access
  PROPERTY_ACCESS: 'PROPERTY_ACCESS',
  METHOD_CALL: 'METHOD_CALL',

  // Quantifiers
  FORALL: 'FORALL'
};

/**
 * Create a literal node
 */
export function literal(value, valueType) {
  return {
    kind: ExprKind.LITERAL,
    value,
    valueType // 'number', 'string', 'boolean'
  };
}

/**
 * Create an identifier node
 */
export function identifier(name) {
  return {
    kind: ExprKind.IDENTIFIER,
    name
  };
}

/**
 * Create a binary operation node
 */
export function binary(operator, left, right) {
  return {
    kind: ExprKind.BINARY,
    operator,
    left,
    right
  };
}

/**
 * Create a unary operation node
 */
export function unary(operator, operand) {
  return {
    kind: ExprKind.UNARY,
    operator,
    operand
  };
}

/**
 * Create a comparison node
 */
export function comparison(operator, left, right) {
  return {
    kind: ExprKind.COMPARISON,
    operator,
    left,
    right
  };
}

/**
 * Create a logical operation node
 */
export function logical(operator, left, right) {
  return {
    kind: ExprKind.LOGICAL,
    operator,
    left,
    right
  };
}

/**
 * Create a property access node
 */
export function propertyAccess(object, property) {
  return {
    kind: ExprKind.PROPERTY_ACCESS,
    object,
    property
  };
}

/**
 * Create a method call node
 */
export function methodCall(receiver, method, args) {
  return {
    kind: ExprKind.METHOD_CALL,
    receiver,
    method,
    args
  };
}

/**
 * Create a forall quantifier node
 */
export function forall(variable, collection, body) {
  return {
    kind: ExprKind.FORALL,
    variable,
    collection,
    body
  };
}
