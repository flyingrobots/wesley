/**
 * TTD Invariant VM
 *
 * Stack-based virtual machine for executing invariant bytecode.
 * Verifies that runtime state satisfies compiled invariant expressions.
 */

import { Opcode, VmSpec } from './golden.mjs';

/**
 * VM execution result
 * @typedef {Object} VmResult
 * @property {boolean} ok - Whether the invariant holds
 * @property {*} value - The final result value
 * @property {string} [error] - Error message if execution failed
 * @property {number} instructionsExecuted - Number of instructions executed
 * @property {number} maxStackDepth - Maximum stack depth reached
 */

/**
 * Runtime context for VM execution
 * @typedef {Object} VmContext
 * @property {Object} [op] - Current operation context
 * @property {Object} [channel] - Channel registry
 * @property {Object} [collections] - Named collections for forall iteration
 * @property {Object} [variables] - Pre-bound variables
 */

/**
 * VM execution error
 */
export class VmError extends Error {
  constructor(message, { pc, opcode, stack } = {}) {
    super(message);
    this.name = 'VmError';
    this.pc = pc;
    this.opcode = opcode;
    this.stackSnapshot = stack?.slice(-5); // Last 5 stack items
  }
}

/**
 * Execute bytecode with the given context
 *
 * @param {Object} bytecode - Compiled bytecode from compileToBytecode()
 * @param {VmContext} context - Runtime context
 * @param {Object} [options] - Execution options
 * @param {number} [options.maxIterations] - Override max iterations
 * @param {number} [options.timeoutMs] - Override timeout
 * @returns {VmResult}
 */
export function execute(bytecode, context = {}, options = {}) {
  const maxIterations = options.maxIterations ?? VmSpec.maxIterations;
  const maxStackDepth = VmSpec.maxStackDepth;

  const { instructions, constants, variables: varNames } = bytecode;

  // Execution state
  const stack = [];
  const variables = new Map();
  const iteratorStack = []; // For nested forall

  // Pre-bind variables from context
  if (context.variables) {
    for (const [name, value] of Object.entries(context.variables)) {
      const idx = varNames.indexOf(name);
      if (idx !== -1) {
        variables.set(idx, value);
      }
    }
  }

  let pc = 0; // Program counter
  let instructionsExecuted = 0;
  let maxStackReached = 0;

  /**
   * Push value onto stack
   */
  function push(value) {
    if (stack.length >= maxStackDepth) {
      throw new VmError('Stack overflow', { pc, stack });
    }
    stack.push(value);
    maxStackReached = Math.max(maxStackReached, stack.length);
  }

  /**
   * Pop value from stack
   */
  function pop() {
    if (stack.length === 0) {
      throw new VmError('Stack underflow', { pc, stack });
    }
    return stack.pop();
  }

  /**
   * Peek at top of stack
   */
  function peek() {
    if (stack.length === 0) {
      throw new VmError('Stack underflow on peek', { pc, stack });
    }
    return stack[stack.length - 1];
  }

  /**
   * Get property from object
   */
  function getProperty(obj, prop) {
    if (obj === null || obj === undefined) {
      throw new VmError(`Cannot read property "${prop}" of ${obj}`, { pc, stack });
    }
    return obj[prop];
  }

  /**
   * Call method on object
   */
  function callMethod(receiver, methodName, args) {
    // Built-in methods for invariant checking
    switch (methodName) {
    case 'mustEmit':
      // Check if operation emits to specified channel/event
      return {
        __mustEmit: true,
        receiver,
        event: args[0]
      };

    case 'produces':
      // Check if operation produces specified output
      return {
        __produces: true,
        receiver,
        output: args[0]
      };

    case 'emitsTo':
      // Check if operation emits to channel
      return {
        __emitsTo: true,
        receiver,
        channel: args[0],
        ...(args[1] !== undefined && { within: args[1] })
      };

    case 'within':
      // Add timing constraint to previous constraint
      if (receiver && receiver.__mustEmit) {
        return { ...receiver, within: args[0] };
      }
      if (receiver && receiver.__produces) {
        return { ...receiver, within: args[0] };
      }
      if (receiver && receiver.__emitsTo) {
        return { ...receiver, within: args[0] };
      }
      throw new VmError('within() can only be called on mustEmit/produces/emitsTo', { pc, stack });

    default:
      // Try calling method on receiver
      if (typeof receiver?.[methodName] === 'function') {
        return receiver[methodName](...args);
      }
      throw new VmError(`Unknown method: ${methodName}`, { pc, stack });
    }
  }

  /**
   * Get collection for iteration
   */
  function getCollection(name) {
    if (context.collections && name in context.collections) {
      const coll = context.collections[name];
      return Array.isArray(coll) ? coll : Object.values(coll);
    }
    throw new VmError(`Unknown collection: ${name}`, { pc, stack });
  }

  // Main execution loop
  try {
    while (pc < instructions.length) {
      if (instructionsExecuted >= maxIterations) {
        throw new VmError(`Max iterations exceeded (${maxIterations})`, { pc, stack });
      }

      const instr = instructions[pc];
      const { opcode, operand } = instr;
      instructionsExecuted++;

      switch (opcode) {
      case Opcode.NOP:
        break;

      case Opcode.PUSH_CONST:
        push(constants[operand]);
        break;

      case Opcode.LOAD_VAR: {
        const value = variables.get(operand);
        if (value === undefined && !variables.has(operand)) {
          throw new VmError(`Undefined variable at index ${operand}`, { pc, stack });
        }
        push(value);
        break;
      }

      case Opcode.STORE_VAR:
        variables.set(operand, pop());
        break;

      case Opcode.POP:
        pop();
        break;

      case Opcode.DUP:
        push(peek());
        break;

        // Comparison
      case Opcode.CMP_EQ: {
        const right = pop();
        const left = pop();
        push(left === right);
        break;
      }

      case Opcode.CMP_NEQ: {
        const right = pop();
        const left = pop();
        push(left !== right);
        break;
      }

      case Opcode.CMP_LT: {
        const right = pop();
        const left = pop();
        push(left < right);
        break;
      }

      case Opcode.CMP_LTE: {
        const right = pop();
        const left = pop();
        push(left <= right);
        break;
      }

      case Opcode.CMP_GT: {
        const right = pop();
        const left = pop();
        push(left > right);
        break;
      }

      case Opcode.CMP_GTE: {
        const right = pop();
        const left = pop();
        push(left >= right);
        break;
      }

      // Logical
      case Opcode.AND: {
        const right = pop();
        const left = pop();
        push(left && right);
        break;
      }

      case Opcode.OR: {
        const right = pop();
        const left = pop();
        push(left || right);
        break;
      }

      case Opcode.NOT:
        push(!pop());
        break;

        // Arithmetic
      case Opcode.ADD: {
        const right = pop();
        const left = pop();
        push(left + right);
        break;
      }

      case Opcode.SUB: {
        const right = pop();
        const left = pop();
        push(left - right);
        break;
      }

      case Opcode.MUL: {
        const right = pop();
        const left = pop();
        push(left * right);
        break;
      }

      case Opcode.DIV: {
        const right = pop();
        const left = pop();
        if (right === 0) {
          throw new VmError('Division by zero', { pc, stack });
        }
        push(left / right);
        break;
      }

      // Control flow
      case Opcode.JUMP:
        pc = operand - 1; // -1 because we increment at end of loop
        break;

      case Opcode.JUMP_IF_TRUE:
        if (peek()) {
          pc = operand - 1;
        }
        break;

      case Opcode.JUMP_IF_FALSE:
        if (!peek()) {
          pc = operand - 1;
        }
        break;

        // Iteration
      case Opcode.ITER_BEGIN: {
        const collectionName = pop();
        const items = getCollection(collectionName);
        iteratorStack.push({
          items,
          index: 0
        });
        break;
      }

      case Opcode.ITER_NEXT: {
        const iter = iteratorStack[iteratorStack.length - 1];
        if (!iter) {
          throw new VmError('ITER_NEXT without ITER_BEGIN', { pc, stack });
        }
        if (iter.index < iter.items.length) {
          push(iter.items[iter.index]);
          iter.index++;
          push(true); // More items available
        } else {
          push(false); // No more items
        }
        break;
      }

      case Opcode.ITER_END:
        iteratorStack.pop();
        break;

        // Property access
      case Opcode.GET_PROP: {
        const propName = constants[operand];
        const obj = pop();
        push(getProperty(obj, propName));
        break;
      }

      // Method calls
      case Opcode.CALL_METHOD: {
        const methodName = constants[operand];
        // Pop args in reverse order (they were pushed left to right)
        // We need to know arg count - for now assume it's encoded
        // Actually, the compiler should emit arg count, but it doesn't
        // For simplicity, scan back to find receiver
        // This is a limitation - we'll assume single-arg methods for now
        // TODO: Encode arg count in instruction
        const args = [];
        // Look at stack - receiver is below args
        // For now, just pop one arg if stack has enough
        if (stack.length >= 2) {
          args.unshift(pop()); // Single arg
        }
        const receiver = pop();
        push(callMethod(receiver, methodName, args));
        break;
      }

      case Opcode.LOAD_OP:
        push(context.op ?? { __op: true });
        break;

      case Opcode.LOAD_CHANNEL:
        push(context.channel ?? { __channel: true });
        break;

        // Result
      case Opcode.RETURN: {
        const result = stack.length > 0 ? pop() : undefined;
        return {
          ok: Boolean(result),
          value: result,
          instructionsExecuted,
          maxStackDepth: maxStackReached
        };
      }

      case Opcode.HALT:
        return {
          ok: true,
          value: undefined,
          instructionsExecuted,
          maxStackDepth: maxStackReached
        };

      default:
        throw new VmError(`Unknown opcode: 0x${opcode.toString(16)}`, { pc, opcode, stack });
      }

      pc++;
    }

    // Fell through without RETURN/HALT
    const result = stack.length > 0 ? pop() : undefined;
    return {
      ok: Boolean(result),
      value: result,
      instructionsExecuted,
      maxStackDepth: maxStackReached
    };

  } catch (error) {
    if (error instanceof VmError) {
      return {
        ok: false,
        value: undefined,
        error: error.message,
        instructionsExecuted,
        maxStackDepth: maxStackReached
      };
    }
    throw error;
  }
}

/**
 * Verify an invariant against runtime state
 *
 * @param {Object} bytecode - Compiled invariant bytecode
 * @param {VmContext} context - Runtime context with state to verify
 * @returns {VmResult}
 */
export function verify(bytecode, context) {
  return execute(bytecode, context);
}

/**
 * Batch verify multiple invariants
 *
 * @param {Array<{name: string, bytecode: Object}>} invariants - Named invariants to verify
 * @param {VmContext} context - Runtime context
 * @returns {Object} Results keyed by invariant name
 */
export function verifyAll(invariants, context) {
  const results = {};

  for (const { name, bytecode } of invariants) {
    results[name] = verify(bytecode, context);
  }

  return results;
}
