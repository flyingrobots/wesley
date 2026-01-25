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

    // Compile to bytecode
    const bytecode = compileToBytecode(ast);
    const bytecodeJson = JSON.stringify(bytecode, null, 2);
    const bytecodeHash = createHash('sha256').update(bytecodeJson).digest('hex');

    vector.bytecode = bytecode;
    vector.bytecodeHash = bytecodeHash;
    vector.bytecodeLength = bytecode.instructions.length;

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

/**
 * Bytecode compiler
 * Compiles invariant expression AST to stack-based bytecode
 */
export function compileToBytecode(ast) {
  const instructions = [];
  const constants = [];
  const variables = [];
  const collections = [];

  function emit(opcode, operand = null) {
    instructions.push({ opcode, operand });
  }

  function addConstant(value) {
    let idx = constants.indexOf(value);
    if (idx === -1) {
      idx = constants.length;
      constants.push(value);
    }
    return idx;
  }

  function addVariable(name) {
    let idx = variables.indexOf(name);
    if (idx === -1) {
      idx = variables.length;
      variables.push(name);
    }
    return idx;
  }

  function addCollection(name) {
    let idx = collections.indexOf(name);
    if (idx === -1) {
      idx = collections.length;
      collections.push(name);
    }
    return idx;
  }

  function compile(node) {
    switch (node.kind) {
      case ExprKind.LITERAL:
        emit(Opcode.PUSH_CONST, addConstant(node.value));
        break;

      case ExprKind.IDENTIFIER:
        // Check for subject keywords
        if (node.name === 'op') {
          emit(Opcode.LOAD_OP);
        } else if (node.name === 'channel') {
          emit(Opcode.LOAD_CHANNEL);
        } else {
          emit(Opcode.LOAD_VAR, addVariable(node.name));
        }
        break;

      case ExprKind.BINARY:
        compile(node.left);
        compile(node.right);
        switch (node.operator) {
          case '+': emit(Opcode.ADD); break;
          case '-': emit(Opcode.SUB); break;
          case '*': emit(Opcode.MUL); break;
          case '/': emit(Opcode.DIV); break;
        }
        break;

      case ExprKind.COMPARISON:
        compile(node.left);
        compile(node.right);
        switch (node.operator) {
          case '==': emit(Opcode.CMP_EQ); break;
          case '!=': emit(Opcode.CMP_NEQ); break;
          case '<': emit(Opcode.CMP_LT); break;
          case '<=': emit(Opcode.CMP_LTE); break;
          case '>': emit(Opcode.CMP_GT); break;
          case '>=': emit(Opcode.CMP_GTE); break;
        }
        break;

      case ExprKind.LOGICAL:
        compile(node.left);
        if (node.operator === '&&') {
          // Short-circuit AND: if left is false, jump past right
          const jumpIdx = instructions.length;
          emit(Opcode.JUMP_IF_FALSE, 0); // placeholder
          emit(Opcode.POP); // discard left
          compile(node.right);
          instructions[jumpIdx].operand = instructions.length; // patch jump target
          emit(Opcode.AND);
        } else if (node.operator === '||') {
          // Short-circuit OR: if left is true, jump past right
          const jumpIdx = instructions.length;
          emit(Opcode.JUMP_IF_TRUE, 0); // placeholder
          emit(Opcode.POP); // discard left
          compile(node.right);
          instructions[jumpIdx].operand = instructions.length; // patch jump target
          emit(Opcode.OR);
        }
        break;

      case ExprKind.UNARY:
        compile(node.operand);
        switch (node.operator) {
          case '!': emit(Opcode.NOT); break;
          case '-': emit(Opcode.PUSH_CONST, addConstant(-1)); emit(Opcode.MUL); break;
        }
        break;

      case ExprKind.PROPERTY_ACCESS:
        compile(node.object);
        emit(Opcode.GET_PROP, addConstant(node.property));
        break;

      case ExprKind.METHOD_CALL:
        compile(node.receiver);
        // Push arguments
        for (const arg of node.args) {
          compile(arg);
        }
        emit(Opcode.CALL_METHOD, addConstant(node.method));
        break;

      case ExprKind.FORALL:
        // Store collection reference
        addCollection(node.collection);
        addVariable(node.variable);

        // Setup iteration
        emit(Opcode.PUSH_CONST, addConstant(node.collection));
        emit(Opcode.ITER_BEGIN);

        // Loop start
        const loopStart = instructions.length;
        emit(Opcode.ITER_NEXT);

        // If no more items, jump to end
        const jumpToEnd = instructions.length;
        emit(Opcode.JUMP_IF_FALSE, 0); // placeholder

        // Store current item in variable
        emit(Opcode.STORE_VAR, addVariable(node.variable));

        // Compile body
        compile(node.body);

        // If body is false, fail fast
        const failFastJump = instructions.length;
        emit(Opcode.JUMP_IF_FALSE, 0); // placeholder
        emit(Opcode.POP);

        // Jump back to loop start
        emit(Opcode.JUMP, loopStart);

        // End of loop - success case
        const loopEnd = instructions.length;
        emit(Opcode.ITER_END);
        emit(Opcode.PUSH_CONST, addConstant(true)); // forall succeeded

        // Patch jump targets
        instructions[jumpToEnd].operand = loopEnd;
        instructions[failFastJump].operand = loopEnd + 1; // jump to fail case

        // Fail case
        emit(Opcode.ITER_END);
        emit(Opcode.PUSH_CONST, addConstant(false)); // forall failed
        break;

      default:
        throw new Error(`Unknown AST node kind: ${node.kind}`);
    }
  }

  compile(ast);
  emit(Opcode.RETURN);

  return {
    version: 1,
    instructions,
    constants,
    variables,
    collections,
  };
}
