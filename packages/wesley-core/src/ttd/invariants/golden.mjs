/**
 * TTD Invariant Golden Test Vectors
 *
 * Generates golden test vectors for invariant expressions.
 * Bytecode compilation is deferred to v2; for now we only capture AST.
 */

import { createHash } from 'node:crypto';
import { parseExpr } from './parser.mjs';
import { ExprKind } from './ast.mjs';

/**
 * Check if an expression is statically evaluable (no runtime context needed)
 */
function isStatic(ast) {
  switch (ast.kind) {
    case ExprKind.LITERAL:
      return true;

    case ExprKind.IDENTIFIER:
      return false; // Variables need runtime context

    case ExprKind.BINARY:
    case ExprKind.COMPARISON:
    case ExprKind.LOGICAL:
      return isStatic(ast.left) && isStatic(ast.right);

    case ExprKind.UNARY:
      return isStatic(ast.operand);

    case ExprKind.PROPERTY_ACCESS:
    case ExprKind.METHOD_CALL:
    case ExprKind.FORALL:
      return false; // These need runtime context

    default:
      return false;
  }
}

/**
 * Evaluate a static expression
 */
function evaluateStatic(ast) {
  switch (ast.kind) {
    case ExprKind.LITERAL:
      return ast.value;

    case ExprKind.BINARY: {
      const left = evaluateStatic(ast.left);
      const right = evaluateStatic(ast.right);
      switch (ast.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        default: throw new Error(`Unknown binary operator: ${ast.operator}`);
      }
    }

    case ExprKind.COMPARISON: {
      const left = evaluateStatic(ast.left);
      const right = evaluateStatic(ast.right);
      switch (ast.operator) {
        case '==': return left === right;
        case '!=': return left !== right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        default: throw new Error(`Unknown comparison operator: ${ast.operator}`);
      }
    }

    case ExprKind.LOGICAL: {
      const left = evaluateStatic(ast.left);
      const right = evaluateStatic(ast.right);
      switch (ast.operator) {
        case '&&': return left && right;
        case '||': return left || right;
        default: throw new Error(`Unknown logical operator: ${ast.operator}`);
      }
    }

    case ExprKind.UNARY: {
      const operand = evaluateStatic(ast.operand);
      switch (ast.operator) {
        case '!': return !operand;
        case '-': return -operand;
        default: throw new Error(`Unknown unary operator: ${ast.operator}`);
      }
    }

    default:
      throw new Error(`Cannot evaluate non-static expression: ${ast.kind}`);
  }
}

/**
 * Generate golden test vectors for invariant expressions
 *
 * @param {Array} specs - Array of {name, expr} objects
 * @returns {Array} Array of golden vectors
 */
export function generateGoldenVectors(specs) {
  return specs.map(spec => {
    const ast = parseExpr(spec.expr);
    const astJson = JSON.stringify(ast, null, 2);
    const astHash = createHash('sha256').update(astJson).digest('hex');

    const vector = {
      name: spec.name,
      expr: spec.expr,
      ast,
      astHash,
      requiresRuntime: !isStatic(ast),
    };

    // For static expressions, compute expected result
    if (!vector.requiresRuntime) {
      try {
        vector.expectedResult = evaluateStatic(ast);
      } catch {
        // Some static expressions may still fail evaluation
        vector.requiresRuntime = true;
      }
    }

    // Bytecode compilation deferred to v2
    // For now, bytecode fields are stubs
    vector.bytecode = null;
    vector.bytecodeHash = astHash; // Use AST hash as placeholder
    vector.bytecodeLength = 0;

    return vector;
  });
}

// VM spec and bytecode opcodes deferred to v2
export const Opcode = {
  NOP: 0x00,
  PUSH_CONST: 0x01,
  LOAD_VAR: 0x02,
  STORE_VAR: 0x03,
  POP: 0x04,
  DUP: 0x05,

  // Comparison
  CMP_EQ: 0x10,
  CMP_NEQ: 0x11,
  CMP_LT: 0x12,
  CMP_LTE: 0x13,
  CMP_GT: 0x14,
  CMP_GTE: 0x15,

  // Logical
  AND: 0x20,
  OR: 0x21,
  NOT: 0x22,

  // Arithmetic
  ADD: 0x30,
  SUB: 0x31,
  MUL: 0x32,
  DIV: 0x33,

  // Control flow
  JUMP: 0x40,
  JUMP_IF_TRUE: 0x41,
  JUMP_IF_FALSE: 0x42,

  // Iteration
  ITER_BEGIN: 0x50,
  ITER_NEXT: 0x51,
  ITER_END: 0x52,

  // Property access
  GET_PROP: 0x60,

  // Method calls
  CALL_METHOD: 0x70,
  LOAD_OP: 0x71,
  LOAD_CHANNEL: 0x72,

  // Result
  RETURN: 0xF0,
  HALT: 0xFF,
};

export const VmSpec = {
  stackBased: true,
  maxStackDepth: 256,
  maxIterations: 10000,
  timeoutMs: 5000,
  instructionFormat: {
    opcodeBytes: 1,
    operandBytes: 4,
  },
};

// Stub for bytecode compiler (deferred to v2)
export function compileToBytecode(ast) {
  // Deferred to v2
  return {
    version: 1,
    instructions: [],
    constants: [],
    variables: [],
    collections: [],
  };
}
