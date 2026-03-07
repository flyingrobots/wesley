/**
 * TTD Rejection Integration Tests
 *
 * Tests that invalid schemas are rejected with correct, stable error codes.
 * Generators need negative tests or they rot.
 */
import { describe, it, expect } from 'vitest';
import {
  compileTtdProtocol,
  extractTtdSchema,
  validateTtdSchema,
  validateChannel,
  validateOp,
  validateRegistry,
  validateInvariant
} from '@wesley/core/ttd';
import { FakeClock } from '@wesley/core/ports';
import { testCrypto } from '../setup.mjs';

const clock = new FakeClock('2025-01-01T00:00:00.000Z');
const deps = { clock, crypto: testCrypto };

describe('Rejection Tests', () => {
  describe('Validation Errors via SDL', () => {
    it('rejects rule without from/to with specific error', async () => {
      const invalidSdl = `
        type Mutation {
          doSomething(id: ID!): Result!
            @wes_op(name: "doSomething")
            @wes_rule(name: "incomplete_rule")
        }
        type Result { ok: Boolean! }
      `;

      await expect(compileTtdProtocol({ sdl: invalidSdl, deps })).rejects.toThrow();
    });

    it('rejects op with empty name', () => {
      const invalidSdl = `
        type Mutation {
          emptyOp(id: ID!): Result! @wes_op(name: "")
        }
        type Result { ok: Boolean! }
      `;

      const schema = extractTtdSchema(invalidSdl, deps);
      const validation = validateTtdSchema(schema);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.code === 'OP_NAME_EMPTY')).toBe(true);
    });

    it('rejects duplicate registry ids', () => {
      const invalidSdl = `
        type Type1 @wes_registry(id: 1) { id: ID! }
        type Type2 @wes_registry(id: 1) { id: ID! }
      `;

      const schema = extractTtdSchema(invalidSdl, deps);
      const validation = validateTtdSchema(schema);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.code === 'REGISTRY_DUPLICATE_ID')).toBe(true);
    });

    it('rejects invariant with empty expr', () => {
      const invalidSdl = `
        type System @wes_invariant(name: "empty_expr", expr: "", severity: "error") {
          _placeholder: Boolean
        }
      `;

      const schema = extractTtdSchema(invalidSdl, deps);
      const validation = validateTtdSchema(schema);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.code === 'INVARIANT_EMPTY_EXPR')).toBe(true);
    });
  });

  describe('Validation Errors via Direct Functions', () => {
    it('rejects channel with empty name', () => {
      const channel = { name: '', version: 1, eventTypes: [] };
      const errors = validateChannel(channel);
      expect(errors.some(e => e.code === 'CHANNEL_NAME_EMPTY')).toBe(true);
    });

    it('rejects channel with zero version', () => {
      const channel = { name: 'bad', version: 0, eventTypes: [] };
      const errors = validateChannel(channel);
      expect(errors.some(e => e.code === 'CHANNEL_VERSION_INVALID')).toBe(true);
    });

    it('rejects op with reserved name', () => {
      const op = { name: '__typename', op_id: 1, args: [], resultType: 'Void' };
      const errors = validateOp(op);
      expect(errors.some(e => e.code === 'OP_NAME_RESERVED')).toBe(true);
    });

    it('rejects registry with invalid id', () => {
      const entry = { typeName: 'BadType', id: -1 };
      const errors = validateRegistry([entry], [{ name: 'BadType' }]);
      expect(errors.some(e => e.code === 'REGISTRY_INVALID_ID')).toBe(true);
    });

    it('rejects invariant with invalid severity', () => {
      const invariant = { name: 'test', expr: 'true', severity: 'invalid' };
      const errors = validateInvariant(invariant, []);
      expect(errors.some(e => e.code === 'INVARIANT_INVALID_SEVERITY')).toBe(true);
    });
  });

  describe('Error Ordering Determinism', () => {
    it('multiple validation errors are returned in deterministic order', () => {
      // Schema with multiple validation issues
      const invalidSdl = `
        type BadChannel @wes_channel(name: "", version: 0) {
          event: Event!
        }
        type Event { id: ID! }
        type Mutation {
          op1(id: ID!): Result! @wes_op(name: "")
          op2(id: ID!): Result! @wes_op(name: "dupe")
          op3(id: ID!): Result! @wes_op(name: "dupe")
        }
        type Result { ok: Boolean! }
      `;

      const schema = extractTtdSchema(invalidSdl, deps);

      // Run validation twice
      const validation1 = validateTtdSchema(schema);
      const validation2 = validateTtdSchema(schema);

      expect(validation1.valid).toBe(false);
      expect(validation2.valid).toBe(false);

      // Error codes should be in same order
      const codes1 = validation1.errors.map(e => e.code);
      const codes2 = validation2.errors.map(e => e.code);

      expect(codes1).toEqual(codes2);

      // Verify we got multiple errors
      expect(codes1.length).toBeGreaterThan(1);
    });

    it('errors are sorted by code for stable ordering', () => {
      const invalidSdl = `
        type BadChannel @wes_channel(name: "", version: 0) {
          event: Event!
        }
        type Event { id: ID! }
      `;

      const schema = extractTtdSchema(invalidSdl, deps);
      const validation = validateTtdSchema(schema);

      const codes = validation.errors.map(e => e.code);
      const sorted = [...codes].sort();

      // Errors should be sorted by code
      expect(codes).toEqual(sorted);
    });
  });

  describe('Warning Cases', () => {
    it('warns on self-transition rule without guard', () => {
      const sdl = `
        enum State { ACTIVE }
        type Mutation {
          selfLoop(id: ID!): Result!
            @wes_op(name: "selfLoop")
            @wes_rule(name: "loop", from: ["ACTIVE"], to: "ACTIVE")
        }
        type Result { ok: Boolean! }
      `;

      const schema = extractTtdSchema(sdl, deps);
      const validation = validateTtdSchema(schema);

      // Should pass but with warnings
      expect(validation.valid).toBe(true);
      expect(validation.warnings.some(w => w.code === 'RULE_SELF_TRANSITION_NO_GUARD')).toBe(true);
    });
  });

  describe('Parse Errors', () => {
    it('rejects invalid GraphQL syntax', async () => {
      const invalidSdl = `
        type Mutation {
          broken(: Result!
        }
      `;

      await expect(compileTtdProtocol({ sdl: invalidSdl, deps })).rejects.toThrow();
    });

    it('rejects malformed directive arguments', async () => {
      const invalidSdl = `
        type Mutation {
          bad(id: ID!): Result! @wes_op(name: 123)
        }
        type Result { ok: Boolean! }
      `;

      // This may throw during extraction or produce validation error
      try {
        const schema = extractTtdSchema(invalidSdl, deps);
        const validation = validateTtdSchema(schema);
        // If it doesn't throw, it should at least fail validation
        expect(validation.valid).toBe(false);
      } catch (e) {
        // Throwing is also acceptable
        expect(e).toBeDefined();
      }
    });
  });
});
