/**
 * TTD AST Types Tests
 * These tests define the specification for TTD AST types.
 */
import { describe, it, expect } from 'vitest';
import {
  createChannel,
  createOp,
  createRule,
  createInvariant,
  createEmission,
  createFootprint,
  createRegistryEntry,
  createCodecSpec,
  TtdAstKind
} from '@wesley/core/ttd';
import { testCrypto } from './setup.mjs';

/** Crypto deps for createOp */
const deps = { crypto: testCrypto };

describe('TTD AST Types', () => {
  describe('Channel', () => {
    it('creates a channel with required fields', () => {
      const channel = createChannel({
        name: 'counter',
        version: 1,
        eventTypes: ['CounterIncremented', 'CounterDecremented']
      });

      expect(channel.kind).toBe(TtdAstKind.CHANNEL);
      expect(channel.name).toBe('counter');
      expect(channel.version).toBe(1);
      expect(channel.eventTypes).toEqual(['CounterIncremented', 'CounterDecremented']);
      expect(channel.ordered).toBe(true); // default
      expect(channel.persistent).toBe(false); // default
    });

    it('creates a channel with optional fields', () => {
      const channel = createChannel({
        name: 'audit',
        version: 2,
        eventTypes: ['AuditEvent'],
        ordered: false,
        persistent: true
      });

      expect(channel.ordered).toBe(false);
      expect(channel.persistent).toBe(true);
    });
  });

  describe('Op', () => {
    it('creates an operation with required fields', () => {
      const op = createOp({
        name: 'increment',
        args: [
          { name: 'counterId', type: 'ID', required: true },
          { name: 'amount', type: 'Int', required: true }
        ],
        resultType: 'Counter'
      }, deps);

      expect(op.kind).toBe(TtdAstKind.OP);
      expect(op.name).toBe('increment');
      expect(op.args).toHaveLength(2);
      expect(op.resultType).toBe('Counter');
      expect(op.idempotent).toBe(false); // default
      expect(op.readonly).toBe(false); // default
    });

    it('creates an operation with op_id computed from name', () => {
      const op = createOp({
        name: 'increment',
        args: [],
        resultType: 'Counter',
        namespace: 'Mutation'
      }, deps);

      // op_id should be a 32-bit hash of namespace:name
      expect(typeof op.op_id).toBe('number');
      expect(op.op_id).toBeGreaterThan(0);
    });

    it('creates a readonly query operation', () => {
      const op = createOp({
        name: 'getCounter',
        args: [{ name: 'id', type: 'ID', required: true }],
        resultType: 'Counter',
        readonly: true
      }, deps);

      expect(op.readonly).toBe(true);
    });
  });

  describe('Rule', () => {
    it('creates a transition rule', () => {
      const rule = createRule({
        name: 'idle_to_counting',
        from: ['IDLE'],
        to: 'COUNTING'
      });

      expect(rule.kind).toBe(TtdAstKind.RULE);
      expect(rule.name).toBe('idle_to_counting');
      expect(rule.from).toEqual(['IDLE']);
      expect(rule.to).toBe('COUNTING');
      expect(rule.guard).toBeUndefined();
    });

    it('creates a rule with guard expression', () => {
      const rule = createRule({
        name: 'decrement_rule',
        from: ['COUNTING'],
        to: 'COUNTING',
        guard: 'value >= amount'
      });

      expect(rule.guard).toBe('value >= amount');
    });

    it('creates a rule with multiple source states', () => {
      const rule = createRule({
        name: 'reset_to_idle',
        from: ['COUNTING', 'PAUSED'],
        to: 'IDLE'
      });

      expect(rule.from).toEqual(['COUNTING', 'PAUSED']);
    });
  });

  describe('Invariant', () => {
    it('creates an invariant with expression', () => {
      const inv = createInvariant({
        name: 'value_non_negative',
        expr: 'forall c in Counter: c.value >= 0'
      });

      expect(inv.kind).toBe(TtdAstKind.INVARIANT);
      expect(inv.name).toBe('value_non_negative');
      expect(inv.expr).toBe('forall c in Counter: c.value >= 0');
      expect(inv.severity).toBe('error'); // default
    });

    it('creates a warning-level invariant', () => {
      const inv = createInvariant({
        name: 'soft_limit',
        expr: 'counter.value < 500000',
        severity: 'warning'
      });

      expect(inv.severity).toBe('warning');
    });
  });

  describe('Emission', () => {
    it('creates an emission contract', () => {
      const emission = createEmission({
        channel: 'counter',
        event: 'CounterIncremented',
        opName: 'increment'
      });

      expect(emission.kind).toBe(TtdAstKind.EMISSION);
      expect(emission.channel).toBe('counter');
      expect(emission.event).toBe('CounterIncremented');
      expect(emission.opName).toBe('increment');
    });

    it('creates an emission with condition', () => {
      const emission = createEmission({
        channel: 'counter',
        event: 'CounterDecremented',
        opName: 'decrement',
        condition: 'amount > 0'
      });

      expect(emission.condition).toBe('amount > 0');
    });

    it('creates an emission with timing constraint', () => {
      const emission = createEmission({
        channel: 'counter',
        event: 'CounterIncremented',
        opName: 'increment',
        withinMs: 100
      });

      expect(emission.withinMs).toBe(100);
    });
  });

  describe('Footprint', () => {
    it('creates a footprint spec', () => {
      const fp = createFootprint({
        opName: 'increment',
        reads: ['Counter'],
        writes: ['Counter']
      });

      expect(fp.kind).toBe(TtdAstKind.FOOTPRINT);
      expect(fp.opName).toBe('increment');
      expect(fp.reads).toEqual(['Counter']);
      expect(fp.writes).toEqual(['Counter']);
      expect(fp.creates).toEqual([]);
      expect(fp.deletes).toEqual([]);
    });

    it('creates a footprint with creates and deletes', () => {
      const fp = createFootprint({
        opName: 'createCounter',
        reads: [],
        writes: [],
        creates: ['Counter'],
        deletes: []
      });

      expect(fp.creates).toEqual(['Counter']);
    });
  });

  describe('RegistryEntry', () => {
    it('creates a registry entry with explicit id', () => {
      const entry = createRegistryEntry({
        typeName: 'CounterIncremented',
        id: 1
      });

      expect(entry.kind).toBe(TtdAstKind.REGISTRY_ENTRY);
      expect(entry.typeName).toBe('CounterIncremented');
      expect(entry.id).toBe(1);
      expect(entry.deprecated).toBe(false);
    });

    it('creates a deprecated registry entry', () => {
      const entry = createRegistryEntry({
        typeName: 'OldEvent',
        id: 100,
        deprecated: true,
        deprecatedBy: 'NewEvent'
      });

      expect(entry.deprecated).toBe(true);
      expect(entry.deprecatedBy).toBe('NewEvent');
    });
  });

  describe('CodecSpec', () => {
    it('creates a CBOR codec spec', () => {
      const codec = createCodecSpec({
        typeName: 'CounterIncremented',
        format: 'cbor',
        canonical: true
      });

      expect(codec.kind).toBe(TtdAstKind.CODEC);
      expect(codec.typeName).toBe('CounterIncremented');
      expect(codec.format).toBe('cbor');
      expect(codec.canonical).toBe(true);
    });

    it('creates a JSON codec spec', () => {
      const codec = createCodecSpec({
        typeName: 'DebugInfo',
        format: 'json'
      });

      expect(codec.format).toBe('json');
      expect(codec.canonical).toBe(false); // default for non-cbor
    });
  });
});

describe('TtdAstKind enum', () => {
  it('has all expected AST kinds', () => {
    expect(TtdAstKind.CHANNEL).toBe('CHANNEL');
    expect(TtdAstKind.OP).toBe('OP');
    expect(TtdAstKind.RULE).toBe('RULE');
    expect(TtdAstKind.INVARIANT).toBe('INVARIANT');
    expect(TtdAstKind.EMISSION).toBe('EMISSION');
    expect(TtdAstKind.FOOTPRINT).toBe('FOOTPRINT');
    expect(TtdAstKind.REGISTRY_ENTRY).toBe('REGISTRY_ENTRY');
    expect(TtdAstKind.CODEC).toBe('CODEC');
    expect(TtdAstKind.STATE_FIELD).toBe('STATE_FIELD');
    expect(TtdAstKind.CONSTRAINT).toBe('CONSTRAINT');
  });
});
