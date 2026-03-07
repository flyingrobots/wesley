/**
 * TTD Invariant Expression Language Tests
 * These tests define the specification for the law compiler (lexer, parser, bytecode).
 */
import { describe, it, expect } from 'vitest';
import {
  tokenize,
  TokenType,
  parseExpr,
  ExprKind,
  compileToBytecode,
  Opcode,
  VmSpec,
  generateGoldenVectors,
  execute,
  verify,
  verifyAll,
  _VmError,
  compileObligation,
  compileObligations,
  generateVerificationManifest,
  serializeObligations,
  deserializeObligations,
  ObligationSeverity,
  ObligationKind,
  Verifier,
  createVerifier,
  generateTsVerifier,
  generateReport
} from '@wesley/core/ttd/invariants';
import { testCrypto } from './setup.mjs';

/** Crypto deps for golden vectors */
const deps = { crypto: testCrypto };

describe('Invariant Expression Lexer', () => {
  describe('tokenize', () => {
    it('tokenizes identifiers', () => {
      const tokens = tokenize('counter');

      expect(tokens).toHaveLength(2); // identifier + EOF
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('counter');
    });

    it('tokenizes keywords', () => {
      const tokens = tokenize('forall in true false');

      expect(tokens[0].type).toBe(TokenType.FORALL);
      expect(tokens[1].type).toBe(TokenType.IN);
      expect(tokens[2].type).toBe(TokenType.TRUE);
      expect(tokens[3].type).toBe(TokenType.FALSE);
    });

    it('tokenizes operators', () => {
      const tokens = tokenize('>= <= == != && || > < + - * /');

      expect(tokens[0].type).toBe(TokenType.GTE);
      expect(tokens[1].type).toBe(TokenType.LTE);
      expect(tokens[2].type).toBe(TokenType.EQ);
      expect(tokens[3].type).toBe(TokenType.NEQ);
      expect(tokens[4].type).toBe(TokenType.AND);
      expect(tokens[5].type).toBe(TokenType.OR);
      expect(tokens[6].type).toBe(TokenType.GT);
      expect(tokens[7].type).toBe(TokenType.LT);
      expect(tokens[8].type).toBe(TokenType.PLUS);
      expect(tokens[9].type).toBe(TokenType.MINUS);
      expect(tokens[10].type).toBe(TokenType.STAR);
      expect(tokens[11].type).toBe(TokenType.SLASH);
    });

    it('tokenizes numbers', () => {
      const tokens = tokenize('42 3.14 -100');

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('42');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('3.14');
      expect(tokens[2].type).toBe(TokenType.MINUS);
      expect(tokens[3].type).toBe(TokenType.NUMBER);
    });

    it('tokenizes strings', () => {
      const tokens = tokenize('"hello" "world"');

      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('hello');
      expect(tokens[1].type).toBe(TokenType.STRING);
      expect(tokens[1].value).toBe('world');
    });

    it('tokenizes punctuation', () => {
      const tokens = tokenize('( ) [ ] . , : ;');

      expect(tokens[0].type).toBe(TokenType.LPAREN);
      expect(tokens[1].type).toBe(TokenType.RPAREN);
      expect(tokens[2].type).toBe(TokenType.LBRACKET);
      expect(tokens[3].type).toBe(TokenType.RBRACKET);
      expect(tokens[4].type).toBe(TokenType.DOT);
      expect(tokens[5].type).toBe(TokenType.COMMA);
      expect(tokens[6].type).toBe(TokenType.COLON);
      expect(tokens[7].type).toBe(TokenType.SEMICOLON);
    });

    it('tokenizes method call keywords', () => {
      const tokens = tokenize('mustEmit produces emitsTo within');

      expect(tokens[0].type).toBe(TokenType.MUST_EMIT);
      expect(tokens[1].type).toBe(TokenType.PRODUCES);
      expect(tokens[2].type).toBe(TokenType.EMITS_TO);
      expect(tokens[3].type).toBe(TokenType.WITHIN);
    });

    it('tokenizes subject keywords', () => {
      const tokens = tokenize('tick op channel rule');

      expect(tokens[0].type).toBe(TokenType.TICK);
      expect(tokens[1].type).toBe(TokenType.OP);
      expect(tokens[2].type).toBe(TokenType.CHANNEL);
      expect(tokens[3].type).toBe(TokenType.RULE);
    });

    it('handles complex expressions', () => {
      const tokens = tokenize('forall c in Counter: c.value >= 0');

      expect(tokens.map(t => t.type)).toEqual([
        TokenType.FORALL,
        TokenType.IDENTIFIER,
        TokenType.IN,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.IDENTIFIER,
        TokenType.DOT,
        TokenType.IDENTIFIER,
        TokenType.GTE,
        TokenType.NUMBER,
        TokenType.EOF
      ]);
    });

    it('tracks line and column numbers', () => {
      const tokens = tokenize('a\nb');

      expect(tokens[0].line).toBe(1);
      expect(tokens[0].column).toBe(1);
      expect(tokens[1].line).toBe(2);
      expect(tokens[1].column).toBe(1);
    });

    it('throws on invalid characters', () => {
      expect(() => tokenize('x @ y')).toThrow(/unexpected character/i);
    });
  });
});

describe('Invariant Expression Parser', () => {
  describe('parseExpr', () => {
    it('parses simple comparison', () => {
      const ast = parseExpr('x >= 0');

      expect(ast.kind).toBe(ExprKind.COMPARISON);
      expect(ast.operator).toBe('>=');
      expect(ast.left.kind).toBe(ExprKind.IDENTIFIER);
      expect(ast.left.name).toBe('x');
      expect(ast.right.kind).toBe(ExprKind.LITERAL);
      expect(ast.right.value).toBe(0);
    });

    it('parses property access', () => {
      const ast = parseExpr('counter.value');

      expect(ast.kind).toBe(ExprKind.PROPERTY_ACCESS);
      expect(ast.object.name).toBe('counter');
      expect(ast.property).toBe('value');
    });

    it('parses chained property access', () => {
      const ast = parseExpr('entity.state.name');

      expect(ast.kind).toBe(ExprKind.PROPERTY_ACCESS);
      expect(ast.property).toBe('name');
      expect(ast.object.kind).toBe(ExprKind.PROPERTY_ACCESS);
      expect(ast.object.property).toBe('state');
    });

    it('parses forall quantifier', () => {
      const ast = parseExpr('forall c in Counter: c.value >= 0');

      expect(ast.kind).toBe(ExprKind.FORALL);
      expect(ast.variable).toBe('c');
      expect(ast.collection).toBe('Counter');
      expect(ast.body.kind).toBe(ExprKind.COMPARISON);
    });

    it('parses logical AND', () => {
      const ast = parseExpr('x > 0 && y < 10');

      expect(ast.kind).toBe(ExprKind.LOGICAL);
      expect(ast.operator).toBe('&&');
    });

    it('parses logical OR', () => {
      const ast = parseExpr('x == 0 || x == 1');

      expect(ast.kind).toBe(ExprKind.LOGICAL);
      expect(ast.operator).toBe('||');
    });

    it('parses method calls', () => {
      const ast = parseExpr('op.increment.mustEmit(CounterIncremented)');

      expect(ast.kind).toBe(ExprKind.METHOD_CALL);
      expect(ast.method).toBe('mustEmit');
      expect(ast.args).toHaveLength(1);
      expect(ast.args[0].name).toBe('CounterIncremented');
    });

    it('parses method calls with within', () => {
      const ast = parseExpr('op.increment.mustEmit(CounterIncremented).within(100)');

      expect(ast.kind).toBe(ExprKind.METHOD_CALL);
      expect(ast.method).toBe('within');
      expect(ast.args[0].value).toBe(100);
      expect(ast.receiver.kind).toBe(ExprKind.METHOD_CALL);
      expect(ast.receiver.method).toBe('mustEmit');
    });

    it('parses arithmetic expressions', () => {
      const ast = parseExpr('x + y * 2');

      expect(ast.kind).toBe(ExprKind.BINARY);
      expect(ast.operator).toBe('+');
      // * has higher precedence than +
      expect(ast.right.kind).toBe(ExprKind.BINARY);
      expect(ast.right.operator).toBe('*');
    });

    it('parses negation', () => {
      const ast = parseExpr('!valid');

      expect(ast.kind).toBe(ExprKind.UNARY);
      expect(ast.operator).toBe('!');
    });

    it('parses parenthesized expressions', () => {
      const ast = parseExpr('(x + y) * 2');

      expect(ast.kind).toBe(ExprKind.BINARY);
      expect(ast.operator).toBe('*');
      expect(ast.left.kind).toBe(ExprKind.BINARY);
      expect(ast.left.operator).toBe('+');
    });

    it('parses boolean literals', () => {
      const ast = parseExpr('true && false');

      expect(ast.left.kind).toBe(ExprKind.LITERAL);
      expect(ast.left.value).toBe(true);
      expect(ast.right.kind).toBe(ExprKind.LITERAL);
      expect(ast.right.value).toBe(false);
    });

    it('parses string literals', () => {
      const ast = parseExpr('state == "ACTIVE"');

      expect(ast.right.kind).toBe(ExprKind.LITERAL);
      expect(ast.right.value).toBe('ACTIVE');
    });

    it('throws on syntax errors', () => {
      expect(() => parseExpr('x >')).toThrow(/unexpected/i);
      expect(() => parseExpr('forall x')).toThrow(/expected.*in/i);
    });
  });
});

describe('Invariant Bytecode Compiler', () => {
  describe('compileToBytecode', () => {
    it('compiles simple comparison to bytecode', () => {
      const ast = parseExpr('x >= 0');
      const bytecode = compileToBytecode(ast);

      expect(bytecode.instructions).toBeDefined();
      expect(bytecode.instructions.length).toBeGreaterThan(0);
    });

    it('generates correct opcodes for comparison', () => {
      const ast = parseExpr('x >= 0');
      const bytecode = compileToBytecode(ast);

      const opcodes = bytecode.instructions.map(i => i.opcode);
      expect(opcodes).toContain(Opcode.LOAD_VAR);
      expect(opcodes).toContain(Opcode.PUSH_CONST);
      expect(opcodes).toContain(Opcode.CMP_GTE);
    });

    it('generates forall loop structure', () => {
      const ast = parseExpr('forall c in Counter: c.value >= 0');
      const bytecode = compileToBytecode(ast);

      const opcodes = bytecode.instructions.map(i => i.opcode);
      expect(opcodes).toContain(Opcode.ITER_BEGIN);
      expect(opcodes).toContain(Opcode.ITER_NEXT);
      expect(opcodes).toContain(Opcode.ITER_END);
      expect(opcodes).toContain(Opcode.JUMP_IF_FALSE);
    });

    it('generates method call instructions', () => {
      const ast = parseExpr('op.increment.mustEmit(CounterIncremented)');
      const bytecode = compileToBytecode(ast);

      const opcodes = bytecode.instructions.map(i => i.opcode);
      expect(opcodes).toContain(Opcode.LOAD_OP);
      expect(opcodes).toContain(Opcode.CALL_METHOD);
    });

    it('generates logical operators with short-circuit', () => {
      const ast = parseExpr('x > 0 && y < 10');
      const bytecode = compileToBytecode(ast);

      const opcodes = bytecode.instructions.map(i => i.opcode);
      // Short-circuit AND uses DUP and conditional jumps instead of AND opcode
      expect(opcodes).toContain(Opcode.DUP);
      expect(opcodes).toContain(Opcode.JUMP_IF_FALSE);
    });

    it('includes constant pool', () => {
      const ast = parseExpr('x == "hello"');
      const bytecode = compileToBytecode(ast);

      expect(bytecode.constants).toBeDefined();
      expect(bytecode.constants).toContain('hello');
    });

    it('generates jump addresses for control flow', () => {
      const ast = parseExpr('x > 0 || y < 10');
      const bytecode = compileToBytecode(ast);

      // Should have short-circuit evaluation
      const jumpInstructions = bytecode.instructions.filter(
        i => i.opcode === Opcode.JUMP || i.opcode === Opcode.JUMP_IF_TRUE
      );
      expect(jumpInstructions.length).toBeGreaterThan(0);

      // Jump targets should be valid
      for (const jump of jumpInstructions) {
        expect(jump.operand).toBeGreaterThanOrEqual(0);
        expect(jump.operand).toBeLessThan(bytecode.instructions.length);
      }
    });

    it('handles nested expressions', () => {
      const ast = parseExpr('(x + y) * (z - w)');
      const bytecode = compileToBytecode(ast);

      const opcodes = bytecode.instructions.map(i => i.opcode);
      expect(opcodes).toContain(Opcode.ADD);
      expect(opcodes).toContain(Opcode.SUB);
      expect(opcodes).toContain(Opcode.MUL);
    });
  });

  describe('bytecode structure', () => {
    it('has version field', () => {
      const ast = parseExpr('true');
      const bytecode = compileToBytecode(ast);

      expect(bytecode.version).toBe(1);
    });

    it('includes variable table', () => {
      const ast = parseExpr('forall c in Counter: c.value >= 0');
      const bytecode = compileToBytecode(ast);

      expect(bytecode.variables).toBeDefined();
      expect(bytecode.variables).toContain('c');
    });

    it('includes collection references', () => {
      const ast = parseExpr('forall c in Counter: c.value >= 0');
      const bytecode = compileToBytecode(ast);

      expect(bytecode.collections).toBeDefined();
      expect(bytecode.collections).toContain('Counter');
    });
  });
});

describe('VM Spec', () => {
  describe('Opcode enum', () => {
    it('has all expected opcodes', () => {
      expect(Opcode.NOP).toBe(0x00);
      expect(Opcode.PUSH_CONST).toBeDefined();
      expect(Opcode.LOAD_VAR).toBeDefined();
      expect(Opcode.STORE_VAR).toBeDefined();
      expect(Opcode.POP).toBeDefined();
      expect(Opcode.DUP).toBeDefined();

      // Comparison
      expect(Opcode.CMP_EQ).toBeDefined();
      expect(Opcode.CMP_NEQ).toBeDefined();
      expect(Opcode.CMP_LT).toBeDefined();
      expect(Opcode.CMP_LTE).toBeDefined();
      expect(Opcode.CMP_GT).toBeDefined();
      expect(Opcode.CMP_GTE).toBeDefined();

      // Logical
      expect(Opcode.AND).toBeDefined();
      expect(Opcode.OR).toBeDefined();
      expect(Opcode.NOT).toBeDefined();

      // Arithmetic
      expect(Opcode.ADD).toBeDefined();
      expect(Opcode.SUB).toBeDefined();
      expect(Opcode.MUL).toBeDefined();
      expect(Opcode.DIV).toBeDefined();

      // Control flow
      expect(Opcode.JUMP).toBeDefined();
      expect(Opcode.JUMP_IF_TRUE).toBeDefined();
      expect(Opcode.JUMP_IF_FALSE).toBeDefined();

      // Iteration
      expect(Opcode.ITER_BEGIN).toBeDefined();
      expect(Opcode.ITER_NEXT).toBeDefined();
      expect(Opcode.ITER_END).toBeDefined();

      // Property access
      expect(Opcode.GET_PROP).toBeDefined();

      // Method calls
      expect(Opcode.CALL_METHOD).toBeDefined();
      expect(Opcode.LOAD_OP).toBeDefined();
      expect(Opcode.LOAD_CHANNEL).toBeDefined();

      // Result
      expect(Opcode.RETURN).toBeDefined();
      expect(Opcode.HALT).toBeDefined();
    });
  });

  describe('VmSpec', () => {
    it('defines stack-based VM', () => {
      expect(VmSpec.stackBased).toBe(true);
    });

    it('defines max stack depth', () => {
      expect(VmSpec.maxStackDepth).toBeGreaterThan(0);
    });

    it('defines max iterations', () => {
      expect(VmSpec.maxIterations).toBeGreaterThan(0);
    });

    it('defines timeout', () => {
      expect(VmSpec.timeoutMs).toBeGreaterThan(0);
    });

    it('specifies instruction format', () => {
      expect(VmSpec.instructionFormat).toBeDefined();
      expect(VmSpec.instructionFormat.opcodeBytes).toBe(1);
      expect(VmSpec.instructionFormat.operandBytes).toBe(4);
    });
  });
});

describe('Golden Test Vectors', () => {
  describe('generateGoldenVectors', () => {
    it('generates test vectors for simple expressions', () => {
      const vectors = generateGoldenVectors([
        { name: 'simple_true', expr: 'true' },
        { name: 'simple_false', expr: 'false' },
        { name: 'comparison', expr: '5 > 3' }
      ], deps);

      expect(vectors).toHaveLength(3);

      for (const vector of vectors) {
        expect(vector.name).toBeDefined();
        expect(vector.expr).toBeDefined();
        expect(vector.bytecode).toBeDefined();
        expect(vector.bytecodeHash).toBeDefined();
        expect(vector.bytecodeHash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('generates deterministic hashes', () => {
      const vectors1 = generateGoldenVectors([{ name: 'test', expr: 'x >= 0' }], deps);
      const vectors2 = generateGoldenVectors([{ name: 'test', expr: 'x >= 0' }], deps);

      expect(vectors1[0].bytecodeHash).toBe(vectors2[0].bytecodeHash);
    });

    it('includes expected result for static expressions', () => {
      const vectors = generateGoldenVectors([
        { name: 'always_true', expr: 'true' },
        { name: 'always_false', expr: 'false' },
        { name: 'static_compare', expr: '10 > 5' }
      ], deps);

      expect(vectors[0].expectedResult).toBe(true);
      expect(vectors[1].expectedResult).toBe(false);
      expect(vectors[2].expectedResult).toBe(true);
    });

    it('marks dynamic expressions as needing runtime evaluation', () => {
      const vectors = generateGoldenVectors([
        { name: 'forall', expr: 'forall c in Counter: c.value >= 0' }
      ], deps);

      expect(vectors[0].requiresRuntime).toBe(true);
      expect(vectors[0].expectedResult).toBeUndefined();
    });

    it('includes bytecode length', () => {
      const vectors = generateGoldenVectors([{ name: 'test', expr: 'x > 0' }], deps);

      expect(vectors[0].bytecodeLength).toBeGreaterThan(0);
    });
  });
});

describe('Expression language edge cases', () => {
  it('handles deeply nested expressions', () => {
    const expr = '((((x + 1) * 2) - 3) / 4) >= 0';
    const ast = parseExpr(expr);
    const bytecode = compileToBytecode(ast);

    expect(bytecode.instructions.length).toBeGreaterThan(0);
  });

  it('handles multiple forall quantifiers', () => {
    // This is not directly supported in the grammar but tests robustness
    const expr = 'forall a in A: forall b in B: a.x == b.y';

    // Should either parse correctly or throw a clear error
    expect(() => parseExpr(expr)).not.toThrow();
  });

  it('handles empty method args', () => {
    const expr = 'op.increment.produces()';
    const ast = parseExpr(expr);

    expect(ast.kind).toBe(ExprKind.METHOD_CALL);
    expect(ast.args).toHaveLength(0);
  });

  it('handles multiple method args', () => {
    const expr = 'channel.counter.emitsTo("topic", 100)';
    const ast = parseExpr(expr);

    expect(ast.args).toHaveLength(2);
  });
});

describe('VM Execution', () => {
  describe('execute', () => {
    it('executes simple boolean literal', () => {
      const ast = parseExpr('true');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.ok).toBe(true);
      expect(result.value).toBe(true);
    });

    it('executes false literal', () => {
      const ast = parseExpr('false');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.ok).toBe(false);
      expect(result.value).toBe(false);
    });

    it('executes numeric comparison', () => {
      const ast = parseExpr('5 > 3');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.ok).toBe(true);
      expect(result.value).toBe(true);
    });

    it('executes arithmetic expressions', () => {
      const ast = parseExpr('(2 + 3) * 4 == 20');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.ok).toBe(true);
      expect(result.value).toBe(true);
    });

    it('executes logical AND', () => {
      const ast = parseExpr('true && true');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.ok).toBe(true);
    });

    it('executes logical OR', () => {
      const ast = parseExpr('false || true');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.ok).toBe(true);
    });

    it('executes negation', () => {
      const ast = parseExpr('!false');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.ok).toBe(true);
      expect(result.value).toBe(true);
    });

    it('executes with bound variables', () => {
      const ast = parseExpr('x >= 0');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode, {
        variables: { x: 10 }
      });

      expect(result.ok).toBe(true);
    });

    it('fails when variable is negative', () => {
      const ast = parseExpr('x >= 0');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode, {
        variables: { x: -5 }
      });

      expect(result.ok).toBe(false);
    });

    it('executes forall quantifier - all pass', () => {
      const ast = parseExpr('forall c in Counter: c.value >= 0');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode, {
        collections: {
          Counter: [
            { value: 0 },
            { value: 10 },
            { value: 100 }
          ]
        }
      });

      expect(result.ok).toBe(true);
    });

    it('executes forall quantifier - one fails', () => {
      const ast = parseExpr('forall c in Counter: c.value >= 0');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode, {
        collections: {
          Counter: [
            { value: 10 },
            { value: -1 }, // This should fail
            { value: 100 }
          ]
        }
      });

      expect(result.ok).toBe(false);
    });

    it('executes forall on empty collection', () => {
      const ast = parseExpr('forall c in Counter: c.value >= 0');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode, {
        collections: {
          Counter: []
        }
      });

      // forall on empty set is vacuously true
      expect(result.ok).toBe(true);
    });

    it('tracks instructions executed', () => {
      const ast = parseExpr('1 + 2 + 3');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.instructionsExecuted).toBeGreaterThan(0);
    });

    it('tracks max stack depth', () => {
      const ast = parseExpr('1 + 2 + 3 + 4');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.maxStackDepth).toBeGreaterThan(0);
    });

    it('handles division by zero gracefully', () => {
      const ast = parseExpr('10 / 0');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode);

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/division by zero/i);
    });

    it('loads op context', () => {
      const ast = parseExpr('op.name == "increment"');
      const bytecode = compileToBytecode(ast);
      const result = execute(bytecode, {
        op: { name: 'increment' }
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('verify', () => {
    it('verifies simple invariant', () => {
      const ast = parseExpr('x > 0');
      const bytecode = compileToBytecode(ast);
      const result = verify(bytecode, { variables: { x: 5 } });

      expect(result.ok).toBe(true);
    });
  });

  describe('verifyAll', () => {
    it('verifies multiple invariants', () => {
      const invariants = [
        { name: 'positive', bytecode: compileToBytecode(parseExpr('x > 0')) },
        { name: 'small', bytecode: compileToBytecode(parseExpr('x < 100')) }
      ];

      const results = verifyAll(invariants, { variables: { x: 50 } });

      expect(results.positive.ok).toBe(true);
      expect(results.small.ok).toBe(true);
    });

    it('reports individual failures', () => {
      const invariants = [
        { name: 'positive', bytecode: compileToBytecode(parseExpr('x > 0')) },
        { name: 'small', bytecode: compileToBytecode(parseExpr('x < 10')) }
      ];

      const results = verifyAll(invariants, { variables: { x: 50 } });

      expect(results.positive.ok).toBe(true);
      expect(results.small.ok).toBe(false);
    });
  });
});

describe('Obligation Spec Compiler', () => {
  describe('compileObligation', () => {
    it('compiles a simple invariant', () => {
      const invariant = {
        name: 'counter_non_negative',
        expr: 'forall c in Counter: c.value >= 0',
        severity: 'ERROR'
      };

      const spec = compileObligation(invariant, { crypto: testCrypto });

      expect(spec.id).toMatch(/^obligation:/);
      expect(spec.name).toBe('counter_non_negative');
      expect(spec.expr).toBe('forall c in Counter: c.value >= 0');
      expect(spec.ast).toBeDefined();
      expect(spec.bytecode).toBeDefined();
      expect(spec.bytecode.instructions.length).toBeGreaterThan(0);
      expect(spec.severity).toBe('ERROR');
      expect(spec.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('extracts dependencies from expression', () => {
      const invariant = {
        name: 'tick_emits',
        expr: 'tick.mustEmit("state")'
      };

      const spec = compileObligation(invariant, { crypto: testCrypto });

      expect(spec.dependencies).toContain('tick');
    });

    it('extracts collection dependencies from forall', () => {
      const invariant = {
        name: 'all_counters',
        expr: 'forall c in Counter: c.value >= 0'
      };

      const spec = compileObligation(invariant, { crypto: testCrypto });

      expect(spec.dependencies).toContain('collection:Counter');
    });

    it('infers TICK kind from tick reference', () => {
      const invariant = {
        name: 'tick_check',
        expr: 'tick.count > 0'
      };

      const spec = compileObligation(invariant, { crypto: testCrypto });

      expect(spec.kind).toBe(ObligationKind.TICK);
    });

    it('infers EVENTUAL kind from within clause', () => {
      const invariant = {
        name: 'eventual_check',
        expr: 'op.produce().within(100)'
      };

      const spec = compileObligation(invariant, { crypto: testCrypto });

      expect(spec.kind).toBe(ObligationKind.EVENTUAL);
      expect(spec.withinTicks).toBe(100);
    });

    it('throws on invalid expression', () => {
      const invariant = {
        name: 'bad',
        expr: 'this is not valid !!!'
      };

      expect(() => compileObligation(invariant, { crypto: testCrypto }))
        .toThrow(/Failed to parse invariant/);
    });

    it('generates deterministic hashes', () => {
      const invariant = {
        name: 'test',
        expr: 'x > 0'
      };

      const spec1 = compileObligation(invariant, { crypto: testCrypto });
      const spec2 = compileObligation(invariant, { crypto: testCrypto });

      expect(spec1.hash).toBe(spec2.hash);
      expect(spec1.id).toBe(spec2.id);
    });
  });

  describe('compileObligations', () => {
    it('compiles all invariants from schema', () => {
      const schema = {
        invariants: [
          { name: 'inv1', expr: 'true', severity: 'INFO' },
          { name: 'inv2', expr: 'x > 0', severity: 'ERROR' },
          { name: 'inv3', expr: 'forall c in C: c.ok', severity: 'FATAL' }
        ]
      };

      const specs = compileObligations(schema, { crypto: testCrypto });

      expect(specs).toHaveLength(3);
      expect(specs[0].name).toBe('inv1');
      expect(specs[1].name).toBe('inv2');
      expect(specs[2].name).toBe('inv3');
    });

    it('handles empty invariants array', () => {
      const schema = { invariants: [] };

      const specs = compileObligations(schema, { crypto: testCrypto });

      expect(specs).toHaveLength(0);
    });

    it('handles missing invariants array', () => {
      const schema = {};

      const specs = compileObligations(schema, { crypto: testCrypto });

      expect(specs).toHaveLength(0);
    });
  });

  describe('generateVerificationManifest', () => {
    it('generates manifest from specs', () => {
      const schema = {
        invariants: [
          { name: 'tick_inv', expr: 'tick.ok', severity: 'ERROR', kind: 'TICK' },
          { name: 'eventual_inv', expr: 'op.done().within(10)', severity: 'WARN' },
          { name: 'safety_inv', expr: 'x >= 0', severity: 'FATAL', kind: 'SAFETY' }
        ]
      };

      const specs = compileObligations(schema, { crypto: testCrypto });
      const manifest = generateVerificationManifest(specs, { crypto: testCrypto });

      expect(manifest.version).toBe(1);
      expect(manifest.totalObligations).toBe(3);
      expect(manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.obligations).toHaveLength(3);
    });

    it('groups by kind', () => {
      const schema = {
        invariants: [
          { name: 'tick1', expr: 'tick.a', kind: 'TICK' },
          { name: 'tick2', expr: 'tick.b', kind: 'TICK' },
          { name: 'safety1', expr: 'x > 0', kind: 'SAFETY' }
        ]
      };

      const specs = compileObligations(schema, { crypto: testCrypto });
      const manifest = generateVerificationManifest(specs, { crypto: testCrypto });

      expect(manifest.byKind.TICK).toHaveLength(2);
      expect(manifest.byKind.SAFETY).toHaveLength(1);
    });

    it('groups by severity', () => {
      const schema = {
        invariants: [
          { name: 'info', expr: 'true', severity: 'INFO' },
          { name: 'warn', expr: 'true', severity: 'WARN' },
          { name: 'error', expr: 'true', severity: 'ERROR' },
          { name: 'fatal', expr: 'true', severity: 'FATAL' }
        ]
      };

      const specs = compileObligations(schema, { crypto: testCrypto });
      const manifest = generateVerificationManifest(specs, { crypto: testCrypto });

      expect(manifest.bySeverity.INFO).toHaveLength(1);
      expect(manifest.bySeverity.WARN).toHaveLength(1);
      expect(manifest.bySeverity.ERROR).toHaveLength(1);
      expect(manifest.bySeverity.FATAL).toHaveLength(1);
    });
  });

  describe('serialization', () => {
    it('round-trips through serialize/deserialize', () => {
      const schema = {
        invariants: [
          { name: 'test', expr: 'x > 0', severity: 'ERROR' }
        ]
      };

      const specs = compileObligations(schema, { crypto: testCrypto });
      const json = serializeObligations(specs);
      const restored = deserializeObligations(json);

      expect(restored).toHaveLength(1);
      expect(restored[0].name).toBe('test');
      expect(restored[0].expr).toBe('x > 0');
      expect(restored[0].bytecode).toBeDefined();
      expect(restored[0].ast).toBeDefined();
    });

    it('produces valid JSON', () => {
      const schema = {
        invariants: [
          { name: 'a', expr: 'true' },
          { name: 'b', expr: 'false' }
        ]
      };

      const specs = compileObligations(schema, { crypto: testCrypto });
      const json = serializeObligations(specs);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('ObligationSeverity', () => {
    it('has expected values', () => {
      expect(ObligationSeverity.INFO).toBe('INFO');
      expect(ObligationSeverity.WARN).toBe('WARN');
      expect(ObligationSeverity.ERROR).toBe('ERROR');
      expect(ObligationSeverity.FATAL).toBe('FATAL');
    });
  });

  describe('ObligationKind', () => {
    it('has expected values', () => {
      expect(ObligationKind.TICK).toBe('TICK');
      expect(ObligationKind.EVENTUAL).toBe('EVENTUAL');
      expect(ObligationKind.SAFETY).toBe('SAFETY');
      expect(ObligationKind.ALWAYS).toBe('ALWAYS');
    });
  });
});

describe('Verifier', () => {
  const schema = {
    invariants: [
      { name: 'counter_positive', expr: 'forall c in Counter: c.value >= 0', severity: 'ERROR', kind: 'ALWAYS' },
      { name: 'tick_check', expr: 'tick.count > 0', severity: 'WARN', kind: 'TICK' },
      { name: 'safety_check', expr: 'x >= 0', severity: 'FATAL', kind: 'SAFETY' }
    ]
  };

  describe('createVerifier', () => {
    it('creates verifier from schema', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });

      expect(verifier).toBeInstanceOf(Verifier);
      expect(verifier.specs).toHaveLength(3);
      expect(verifier.manifest).toBeDefined();
    });
  });

  describe('Verifier.verifyAll', () => {
    it('verifies all obligations', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });

      const result = verifier.verifyAll({
        collections: { Counter: [{ value: 10 }, { value: 20 }] },
        variables: { x: 5, tick: { count: 1 } }
      });

      expect(result.totalChecked).toBe(3);
      expect(result.timestamp).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('reports failures', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });

      const result = verifier.verifyAll({
        collections: { Counter: [{ value: -5 }] }, // This fails counter_positive
        variables: { x: -1, tick: { count: 0 } }  // x < 0 fails safety, count <= 0 fails tick
      });

      expect(result.passed).toBe(false);
      expect(result.totalFailed).toBeGreaterThan(0);
      expect(result.failures.length).toBeGreaterThan(0);
    });

    it('returns passed=true when all pass', () => {
      const simpleSchema = {
        invariants: [
          { name: 'always_true', expr: 'true' }
        ]
      };
      const verifier = createVerifier(simpleSchema, { crypto: testCrypto });

      const result = verifier.verifyAll({});

      expect(result.passed).toBe(true);
      expect(result.totalPassed).toBe(1);
      expect(result.totalFailed).toBe(0);
    });
  });

  describe('Verifier.verifyOne', () => {
    it('verifies a single obligation by ID', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });
      const spec = verifier.specs[0];

      const result = verifier.verifyOne(spec.id, {
        collections: { Counter: [{ value: 100 }] }
      });

      expect(result.id).toBe(spec.id);
      expect(result.name).toBe(spec.name);
      expect(result.passed).toBe(true);
    });

    it('throws on unknown obligation', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });

      expect(() => verifier.verifyOne('unknown:id', {}))
        .toThrow(/Unknown obligation/);
    });
  });

  describe('Verifier.verifyByKind', () => {
    it('verifies only TICK obligations', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });

      const result = verifier.verifyTick({
        variables: { tick: { count: 5 } }
      });

      expect(result.totalChecked).toBe(1);
    });

    it('verifies only SAFETY obligations', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });

      const result = verifier.verifySafety({
        variables: { x: 10 }
      });

      expect(result.totalChecked).toBe(1);
      expect(result.passed).toBe(true);
    });
  });

  describe('Verifier.manifest', () => {
    it('returns verification manifest', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });

      expect(verifier.manifest.version).toBe(1);
      expect(verifier.manifest.totalObligations).toBe(3);
    });
  });

  describe('Verifier.getObligation', () => {
    it('returns obligation by ID', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });
      const spec = verifier.specs[0];

      const retrieved = verifier.getObligation(spec.id);

      expect(retrieved).toBe(spec);
    });

    it('returns undefined for unknown ID', () => {
      const verifier = createVerifier(schema, { crypto: testCrypto });

      expect(verifier.getObligation('unknown')).toBeUndefined();
    });
  });
});

describe('generateTsVerifier', () => {
  it('generates valid TypeScript code', () => {
    const schema = {
      invariants: [
        { name: 'test', expr: 'x > 0', severity: 'ERROR' }
      ]
    };
    const specs = compileObligations(schema, { crypto: testCrypto });

    const code = generateTsVerifier(specs);

    expect(code).toContain('import { Verifier }');
    expect(code).toContain('const specs =');
    expect(code).toContain('export const verifier');
    expect(code).toContain('export function verifyAll');
    expect(code).toContain('export function verifyTick');
    expect(code).toContain('export function verifySafety');
  });

  it('includes obligation specs in output', () => {
    const schema = {
      invariants: [
        { name: 'my_invariant', expr: 'true', severity: 'WARN' }
      ]
    };
    const specs = compileObligations(schema, { crypto: testCrypto });

    const code = generateTsVerifier(specs);

    expect(code).toContain('my_invariant');
    expect(code).toContain('WARN');
  });
});

describe('generateReport', () => {
  it('generates report for passed verification', () => {
    const result = {
      passed: true,
      totalChecked: 5,
      totalPassed: 5,
      totalFailed: 0,
      failures: [],
      timestamp: '2026-01-25T00:00:00Z',
      durationMs: 10
    };

    const report = generateReport(result);

    expect(report).toContain('VERIFICATION REPORT');
    expect(report).toContain('Total Checked: 5');
    expect(report).toContain('Passed:        5');
    expect(report).toContain('Failed:        0');
    expect(report).toContain('✓ ALL PASSED');
  });

  it('generates report for failed verification', () => {
    const result = {
      passed: false,
      totalChecked: 3,
      totalPassed: 2,
      totalFailed: 1,
      failures: [
        {
          id: 'obligation:abc',
          name: 'counter_check',
          expr: 'x >= 0',
          severity: 'ERROR',
          error: 'Verification failed'
        }
      ],
      timestamp: '2026-01-25T00:00:00Z',
      durationMs: 5
    };

    const report = generateReport(result);

    expect(report).toContain('✗ FAILURES DETECTED');
    expect(report).toContain('FAILURES');
    expect(report).toContain('[ERROR] counter_check');
    expect(report).toContain('x >= 0');
  });

  it('includes value in verbose mode', () => {
    const result = {
      passed: false,
      totalChecked: 1,
      totalPassed: 0,
      totalFailed: 1,
      failures: [
        {
          id: 'obligation:abc',
          name: 'test',
          expr: 'x > 0',
          severity: 'ERROR',
          value: -5
        }
      ],
      timestamp: '2026-01-25T00:00:00Z',
      durationMs: 1
    };

    const report = generateReport(result, { verbose: true });

    expect(report).toContain('Value: -5');
  });
});
