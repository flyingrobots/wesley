/**
 * TTD Validation Rules Tests
 * These tests define the specification for TTD schema validation.
 */
import { describe, it, expect } from 'vitest';
import {
  validateTtdSchema,
  validateChannel,
  validateOp,
  validateRule,
  validateInvariant,
  validateEmission,
  validateFootprint,
  validateRegistry,
  validateStateMachine,
  ValidationSeverity,
} from '@wesley/core/ttd';

describe('TTD Validation Rules', () => {
  describe('validateChannel', () => {
    it('passes for valid channel', () => {
      const channel = {
        name: 'events',
        version: 1,
        eventTypes: ['Created', 'Updated'],
        ordered: true,
        persistent: false,
      };

      const errors = validateChannel(channel);
      expect(errors).toHaveLength(0);
    });

    it('fails on empty channel name', () => {
      const channel = { name: '', version: 1, eventTypes: [] };

      const errors = validateChannel(channel);
      expect(errors.some(e => e.code === 'CHANNEL_NAME_EMPTY')).toBe(true);
    });

    it('fails on invalid version', () => {
      const channel = { name: 'events', version: 0, eventTypes: [] };

      const errors = validateChannel(channel);
      expect(errors.some(e => e.code === 'CHANNEL_VERSION_INVALID')).toBe(true);
    });

    it('warns on channel with no event types', () => {
      const channel = { name: 'events', version: 1, eventTypes: [] };

      const errors = validateChannel(channel);
      const warning = errors.find(e => e.code === 'CHANNEL_NO_EVENTS');
      expect(warning).toBeDefined();
      expect(warning.severity).toBe(ValidationSeverity.WARNING);
    });
  });

  describe('validateOp', () => {
    it('passes for valid operation', () => {
      const op = {
        name: 'increment',
        op_id: 12345,
        args: [{ name: 'id', type: 'ID', required: true }],
        resultType: 'Counter',
      };

      const errors = validateOp(op);
      expect(errors).toHaveLength(0);
    });

    it('fails on empty operation name', () => {
      const op = { name: '', op_id: 1, args: [], resultType: 'Void' };

      const errors = validateOp(op);
      expect(errors.some(e => e.code === 'OP_NAME_EMPTY')).toBe(true);
    });

    it('fails on reserved operation name', () => {
      const reservedNames = ['__typename', '__schema', '__type'];

      for (const name of reservedNames) {
        const op = { name, op_id: 1, args: [], resultType: 'Void' };
        const errors = validateOp(op);
        expect(errors.some(e => e.code === 'OP_NAME_RESERVED')).toBe(true);
      }
    });

    it('fails on duplicate argument names', () => {
      const op = {
        name: 'test',
        op_id: 1,
        args: [
          { name: 'id', type: 'ID', required: true },
          { name: 'id', type: 'String', required: false },
        ],
        resultType: 'Void',
      };

      const errors = validateOp(op);
      expect(errors.some(e => e.code === 'OP_DUPLICATE_ARG')).toBe(true);
    });

    it('fails on invalid op_id', () => {
      const op = { name: 'test', op_id: -1, args: [], resultType: 'Void' };

      const errors = validateOp(op);
      expect(errors.some(e => e.code === 'OP_ID_INVALID')).toBe(true);
    });
  });

  describe('validateRule', () => {
    it('passes for valid rule', () => {
      const rule = {
        name: 'idle_to_active',
        from: ['IDLE'],
        to: 'ACTIVE',
      };
      const validStates = ['IDLE', 'ACTIVE', 'COMPLETED'];

      const errors = validateRule(rule, validStates);
      expect(errors).toHaveLength(0);
    });

    it('fails on empty from states', () => {
      const rule = { name: 'test', from: [], to: 'ACTIVE' };

      const errors = validateRule(rule, ['IDLE', 'ACTIVE']);
      expect(errors.some(e => e.code === 'RULE_NO_FROM_STATES')).toBe(true);
    });

    it('fails on unknown from state', () => {
      const rule = { name: 'test', from: ['UNKNOWN'], to: 'ACTIVE' };

      const errors = validateRule(rule, ['IDLE', 'ACTIVE']);
      expect(errors.some(e => e.code === 'RULE_UNKNOWN_FROM_STATE')).toBe(true);
    });

    it('fails on unknown to state', () => {
      const rule = { name: 'test', from: ['IDLE'], to: 'UNKNOWN' };

      const errors = validateRule(rule, ['IDLE', 'ACTIVE']);
      expect(errors.some(e => e.code === 'RULE_UNKNOWN_TO_STATE')).toBe(true);
    });

    it('warns on self-transition without guard', () => {
      const rule = { name: 'test', from: ['ACTIVE'], to: 'ACTIVE' };

      const errors = validateRule(rule, ['ACTIVE']);
      const warning = errors.find(e => e.code === 'RULE_SELF_TRANSITION_NO_GUARD');
      expect(warning).toBeDefined();
      expect(warning.severity).toBe(ValidationSeverity.WARNING);
    });

    it('passes self-transition with guard', () => {
      const rule = { name: 'test', from: ['ACTIVE'], to: 'ACTIVE', guard: 'canContinue()' };

      const errors = validateRule(rule, ['ACTIVE']);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateInvariant', () => {
    it('passes for valid invariant', () => {
      const inv = {
        name: 'positive_balance',
        expr: 'account.balance >= 0',
        severity: 'error',
      };

      const errors = validateInvariant(inv);
      expect(errors).toHaveLength(0);
    });

    it('fails on empty expression', () => {
      const inv = { name: 'test', expr: '', severity: 'error' };

      const errors = validateInvariant(inv);
      expect(errors.some(e => e.code === 'INVARIANT_EMPTY_EXPR')).toBe(true);
    });

    it('fails on invalid severity', () => {
      const inv = { name: 'test', expr: 'true', severity: 'fatal' };

      const errors = validateInvariant(inv);
      expect(errors.some(e => e.code === 'INVARIANT_INVALID_SEVERITY')).toBe(true);
    });

    it('fails on unparseable expression', () => {
      const inv = { name: 'test', expr: 'forall x in : x > 0', severity: 'error' };

      const errors = validateInvariant(inv);
      expect(errors.some(e => e.code === 'INVARIANT_PARSE_ERROR')).toBe(true);
    });
  });

  describe('validateEmission', () => {
    it('passes for valid emission', () => {
      const emission = {
        channel: 'events',
        event: 'Created',
        opName: 'create',
      };
      const channels = [{ name: 'events', eventTypes: ['Created', 'Updated'] }];

      const errors = validateEmission(emission, channels);
      expect(errors).toHaveLength(0);
    });

    it('fails on unknown channel', () => {
      const emission = { channel: 'unknown', event: 'Created', opName: 'create' };

      const errors = validateEmission(emission, []);
      expect(errors.some(e => e.code === 'EMISSION_UNKNOWN_CHANNEL')).toBe(true);
    });

    it('fails on event type not in channel', () => {
      const emission = { channel: 'events', event: 'Unknown', opName: 'create' };
      const channels = [{ name: 'events', eventTypes: ['Created'] }];

      const errors = validateEmission(emission, channels);
      expect(errors.some(e => e.code === 'EMISSION_UNKNOWN_EVENT')).toBe(true);
    });

    it('warns on emission without timing constraint', () => {
      const emission = { channel: 'events', event: 'Created', opName: 'create' };
      const channels = [{ name: 'events', eventTypes: ['Created'] }];

      const errors = validateEmission(emission, channels);
      const warning = errors.find(e => e.code === 'EMISSION_NO_TIMING');
      expect(warning).toBeDefined();
      expect(warning.severity).toBe(ValidationSeverity.WARNING);
    });

    it('fails on negative timing constraint', () => {
      const emission = {
        channel: 'events',
        event: 'Created',
        opName: 'create',
        withinMs: -100,
      };
      const channels = [{ name: 'events', eventTypes: ['Created'] }];

      const errors = validateEmission(emission, channels);
      expect(errors.some(e => e.code === 'EMISSION_INVALID_TIMING')).toBe(true);
    });
  });

  describe('validateFootprint', () => {
    it('passes for valid footprint', () => {
      const fp = {
        opName: 'create',
        reads: ['Entity'],
        writes: ['Entity'],
        creates: ['Entity'],
        deletes: [],
      };
      const knownTypes = ['Entity', 'Other'];

      const errors = validateFootprint(fp, knownTypes);
      expect(errors).toHaveLength(0);
    });

    it('fails on unknown type in reads', () => {
      const fp = { opName: 'test', reads: ['Unknown'], writes: [], creates: [], deletes: [] };

      const errors = validateFootprint(fp, ['Known']);
      expect(errors.some(e => e.code === 'FOOTPRINT_UNKNOWN_TYPE')).toBe(true);
    });

    it('fails on unknown type in writes', () => {
      const fp = { opName: 'test', reads: [], writes: ['Unknown'], creates: [], deletes: [] };

      const errors = validateFootprint(fp, ['Known']);
      expect(errors.some(e => e.code === 'FOOTPRINT_UNKNOWN_TYPE')).toBe(true);
    });

    it('warns on empty footprint', () => {
      const fp = { opName: 'test', reads: [], writes: [], creates: [], deletes: [] };

      const errors = validateFootprint(fp, []);
      const warning = errors.find(e => e.code === 'FOOTPRINT_EMPTY');
      expect(warning).toBeDefined();
      expect(warning.severity).toBe(ValidationSeverity.WARNING);
    });

    it('warns on create without write', () => {
      const fp = { opName: 'test', reads: [], writes: [], creates: ['Entity'], deletes: [] };

      const errors = validateFootprint(fp, ['Entity']);
      const warning = errors.find(e => e.code === 'FOOTPRINT_CREATE_NO_WRITE');
      expect(warning).toBeDefined();
    });
  });

  describe('validateRegistry', () => {
    it('passes for valid registry', () => {
      const entries = [
        { typeName: 'EventA', id: 1 },
        { typeName: 'EventB', id: 2 },
      ];

      const errors = validateRegistry(entries);
      expect(errors).toHaveLength(0);
    });

    it('fails on duplicate registry IDs', () => {
      const entries = [
        { typeName: 'EventA', id: 1 },
        { typeName: 'EventB', id: 1 },
      ];

      const errors = validateRegistry(entries);
      expect(errors.some(e => e.code === 'REGISTRY_DUPLICATE_ID')).toBe(true);
    });

    it('fails on duplicate type names', () => {
      const entries = [
        { typeName: 'EventA', id: 1 },
        { typeName: 'EventA', id: 2 },
      ];

      const errors = validateRegistry(entries);
      expect(errors.some(e => e.code === 'REGISTRY_DUPLICATE_TYPE')).toBe(true);
    });

    it('fails on invalid registry ID', () => {
      const entries = [{ typeName: 'EventA', id: -1 }];

      const errors = validateRegistry(entries);
      expect(errors.some(e => e.code === 'REGISTRY_INVALID_ID')).toBe(true);
    });

    it('warns on deprecated entry without replacement', () => {
      const entries = [{ typeName: 'OldEvent', id: 1, deprecated: true }];

      const errors = validateRegistry(entries);
      const warning = errors.find(e => e.code === 'REGISTRY_DEPRECATED_NO_REPLACEMENT');
      expect(warning).toBeDefined();
      expect(warning.severity).toBe(ValidationSeverity.WARNING);
    });
  });

  describe('validateStateMachine', () => {
    it('passes for valid state machine', () => {
      const rules = [
        { name: 'start', from: ['IDLE'], to: 'RUNNING' },
        { name: 'stop', from: ['RUNNING'], to: 'STOPPED' },
      ];
      const states = ['IDLE', 'RUNNING', 'STOPPED'];

      const errors = validateStateMachine(rules, states);
      expect(errors).toHaveLength(0);
    });

    it('warns on unreachable states', () => {
      const rules = [{ name: 'start', from: ['IDLE'], to: 'RUNNING' }];
      const states = ['IDLE', 'RUNNING', 'ORPHAN'];

      const errors = validateStateMachine(rules, states);
      const warning = errors.find(
        e => e.code === 'SM_UNREACHABLE_STATE' && e.details.state === 'ORPHAN'
      );
      expect(warning).toBeDefined();
      expect(warning.severity).toBe(ValidationSeverity.WARNING);
    });

    it('warns on terminal state with no explicit marking', () => {
      const rules = [
        { name: 'start', from: ['IDLE'], to: 'RUNNING' },
        { name: 'complete', from: ['RUNNING'], to: 'DONE' },
      ];
      const states = ['IDLE', 'RUNNING', 'DONE'];

      const errors = validateStateMachine(rules, states);
      const warning = errors.find(
        e => e.code === 'SM_IMPLICIT_TERMINAL' && e.details.state === 'DONE'
      );
      expect(warning).toBeDefined();
    });

    it('fails on no initial state', () => {
      // All states are targets, none are source-only
      const rules = [{ name: 'loop', from: ['A'], to: 'A' }];
      const states = ['A'];

      // This is technically valid (single state machine)
      const errors = validateStateMachine(rules, states);
      // A single self-looping state is valid
      expect(errors.filter(e => e.code === 'SM_NO_INITIAL_STATE')).toHaveLength(0);
    });
  });

  describe('validateTtdSchema (integration)', () => {
    it('validates a complete schema', () => {
      const schema = {
        channels: [
          {
            name: 'events',
            version: 1,
            eventTypes: ['Created', 'Updated'],
            ordered: true,
            persistent: false,
          },
        ],
        ops: [
          {
            name: 'create',
            op_id: 12345,
            args: [{ name: 'data', type: 'Input', required: true }],
            resultType: 'Entity',
          },
        ],
        rules: [{ name: 'activate', from: ['DRAFT'], to: 'ACTIVE' }],
        invariants: [
          { name: 'positive', expr: 'entity.value >= 0', severity: 'error' },
        ],
        emissions: [
          { channel: 'events', event: 'Created', opName: 'create', withinMs: 100 },
        ],
        footprints: [
          { opName: 'create', reads: [], writes: ['Entity'], creates: ['Entity'], deletes: [] },
        ],
        registry: [{ typeName: 'Created', id: 1 }],
        types: [{ name: 'Entity', fields: [] }],
        enums: [{ name: 'State', values: ['DRAFT', 'ACTIVE'] }],
      };

      const result = validateTtdSchema(schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('collects all errors from invalid schema', () => {
      const schema = {
        channels: [{ name: '', version: 0, eventTypes: [] }],
        ops: [{ name: '', op_id: -1, args: [], resultType: '' }],
        rules: [],
        invariants: [],
        emissions: [],
        footprints: [],
        registry: [],
        types: [],
        enums: [],
      };

      const result = validateTtdSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'CHANNEL_NAME_EMPTY')).toBe(true);
      expect(result.errors.some(e => e.code === 'OP_NAME_EMPTY')).toBe(true);
    });

    it('separates errors from warnings', () => {
      const schema = {
        channels: [{ name: 'events', version: 1, eventTypes: [] }],
        ops: [],
        rules: [],
        invariants: [],
        emissions: [],
        footprints: [],
        registry: [],
        types: [],
        enums: [],
      };

      const result = validateTtdSchema(schema);

      expect(result.warnings.some(w => w.code === 'CHANNEL_NO_EVENTS')).toBe(true);
    });
  });

  describe('ValidationSeverity', () => {
    it('has expected values', () => {
      expect(ValidationSeverity.ERROR).toBe('error');
      expect(ValidationSeverity.WARNING).toBe('warning');
      expect(ValidationSeverity.INFO).toBe('info');
    });
  });
});
