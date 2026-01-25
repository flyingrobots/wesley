/**
 * TTD Schema Extractor Tests
 * These tests define the specification for extracting TTD AST from GraphQL SDL.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTtdSchema } from '@wesley/core/ttd';

const __dirname = dirname(fileURLToPath(import.meta.url));
const basicProtocolSdl = readFileSync(join(__dirname, 'fixtures/basic-protocol.graphql'), 'utf-8');

describe('TTD Schema Extractor', () => {
  describe('extractTtdSchema', () => {
    it('extracts channels from schema', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.channels).toHaveLength(1);
      const channel = schema.channels[0];
      expect(channel.name).toBe('counter');
      expect(channel.version).toBe(1);
      expect(channel.ordered).toBe(true);
      expect(channel.eventTypes).toContain('CounterIncremented');
      expect(channel.eventTypes).toContain('CounterDecremented');
      expect(channel.eventTypes).toContain('CounterReset');
    });

    it('extracts operations from Mutation type', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.ops.length).toBeGreaterThanOrEqual(6);

      const increment = schema.ops.find(o => o.name === 'increment');
      expect(increment).toBeDefined();
      expect(increment.idempotent).toBe(false);
      expect(increment.readonly).toBe(false);
      expect(increment.args).toHaveLength(2);
      expect(increment.resultType).toBe('Counter');

      const reset = schema.ops.find(o => o.name === 'reset');
      expect(reset).toBeDefined();
      expect(reset.idempotent).toBe(true);
    });

    it('extracts operations from Query type', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      const getCounter = schema.ops.find(o => o.name === 'getCounter');
      expect(getCounter).toBeDefined();
      expect(getCounter.readonly).toBe(true);

      const listCounters = schema.ops.find(o => o.name === 'listCounters');
      expect(listCounters).toBeDefined();
      expect(listCounters.readonly).toBe(true);
    });

    it('extracts transition rules', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.rules.length).toBeGreaterThanOrEqual(5);

      const idleToCountingRule = schema.rules.find(r => r.name === 'idle_to_counting');
      expect(idleToCountingRule).toBeDefined();
      expect(idleToCountingRule.from).toEqual(['IDLE']);
      expect(idleToCountingRule.to).toBe('COUNTING');

      const decrementRule = schema.rules.find(r => r.name === 'decrement_rule');
      expect(decrementRule).toBeDefined();
      expect(decrementRule.guard).toBe('value >= amount');

      const resetRule = schema.rules.find(r => r.name === 'reset_to_idle');
      expect(resetRule).toBeDefined();
      expect(resetRule.from).toContain('COUNTING');
      expect(resetRule.from).toContain('PAUSED');
    });

    it('extracts invariants', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.invariants.length).toBeGreaterThanOrEqual(3);

      const nonNegative = schema.invariants.find(i => i.name === 'value_non_negative');
      expect(nonNegative).toBeDefined();
      expect(nonNegative.expr).toBe('forall c in Counter: c.value >= 0');
      expect(nonNegative.severity).toBe('error');

      const bounded = schema.invariants.find(i => i.name === 'value_bounded');
      expect(bounded).toBeDefined();

      const emits = schema.invariants.find(i => i.name === 'increment_emits');
      expect(emits).toBeDefined();
    });

    it('extracts emission contracts', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.emissions.length).toBeGreaterThanOrEqual(3);

      const incrementEmission = schema.emissions.find(e =>
        e.opName === 'increment' && e.event === 'CounterIncremented'
      );
      expect(incrementEmission).toBeDefined();
      expect(incrementEmission.channel).toBe('counter');

      const decrementEmission = schema.emissions.find(e =>
        e.opName === 'decrement' && e.condition === 'amount > 0'
      );
      expect(decrementEmission).toBeDefined();
    });

    it('extracts footprint specs', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.footprints.length).toBeGreaterThanOrEqual(6);

      const incrementFp = schema.footprints.find(f => f.opName === 'increment');
      expect(incrementFp).toBeDefined();
      expect(incrementFp.reads).toContain('Counter');
      expect(incrementFp.writes).toContain('Counter');

      const startFp = schema.footprints.find(f => f.opName === 'start');
      expect(startFp).toBeDefined();
      expect(startFp.writes).toContain('Counter');
    });

    it('extracts registry entries', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.registry.length).toBeGreaterThanOrEqual(3);

      const incrementedEntry = schema.registry.find(r => r.typeName === 'CounterIncremented');
      expect(incrementedEntry).toBeDefined();
      expect(incrementedEntry.id).toBe(1);

      const decrementedEntry = schema.registry.find(r => r.typeName === 'CounterDecremented');
      expect(decrementedEntry).toBeDefined();
      expect(decrementedEntry.id).toBe(2);
    });

    it('extracts codec specs', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.codecs.length).toBeGreaterThanOrEqual(3);

      const incrementedCodec = schema.codecs.find(c => c.typeName === 'CounterIncremented');
      expect(incrementedCodec).toBeDefined();
      expect(incrementedCodec.format).toBe('cbor');
      expect(incrementedCodec.canonical).toBe(true);
    });

    it('extracts type definitions with state fields', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      const counterType = schema.types.find(t => t.name === 'Counter');
      expect(counterType).toBeDefined();
      expect(counterType.version).toEqual({ major: 1, minor: 0, patch: 0 });

      const idField = counterType.fields.find(f => f.name === 'id');
      expect(idField).toBeDefined();
      expect(idField.stateField).toBeDefined();
      expect(idField.stateField.key).toBe(true);

      const valueField = counterType.fields.find(f => f.name === 'value');
      expect(valueField).toBeDefined();
      expect(valueField.constraint).toBeDefined();
      expect(valueField.constraint.min).toBe(0);
      expect(valueField.constraint.max).toBe(1000000);

      const lastModifiedField = counterType.fields.find(f => f.name === 'lastModified');
      expect(lastModifiedField).toBeDefined();
      expect(lastModifiedField.stateField.derived).toBe(true);
      expect(lastModifiedField.stateField.derivation).toBe('now()');
    });

    it('extracts enum definitions', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      const counterState = schema.enums.find(e => e.name === 'CounterState');
      expect(counterState).toBeDefined();
      expect(counterState.values).toEqual(['IDLE', 'COUNTING', 'PAUSED', 'COMPLETED']);
    });

    it('links ops to their rules', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      const increment = schema.ops.find(o => o.name === 'increment');
      expect(increment.rules).toBeDefined();
      expect(increment.rules).toHaveLength(1);
      expect(increment.rules[0].name).toBe('stay_counting');
    });

    it('computes op_id for each operation', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      for (const op of schema.ops) {
        expect(typeof op.op_id).toBe('number');
        expect(op.op_id).toBeGreaterThan(0);
      }

      // op_ids should be unique
      const opIds = schema.ops.map(o => o.op_id);
      const uniqueIds = new Set(opIds);
      expect(uniqueIds.size).toBe(opIds.length);
    });

    it('includes schema metadata', () => {
      const schema = extractTtdSchema(basicProtocolSdl);

      expect(schema.metadata).toBeDefined();
      expect(schema.metadata.extractedAt).toBeDefined();
      expect(schema.metadata.ttdVersion).toBe('1.0.0');
    });
  });

  describe('error handling', () => {
    it('throws on invalid SDL', () => {
      expect(() => extractTtdSchema('not valid graphql {')).toThrow();
    });

    it('throws on missing required directive args', () => {
      const sdl = `
        type Mutation {
          bad: Result! @wes_rule(name: "test")
        }
      `;
      expect(() => extractTtdSchema(sdl)).toThrow(/from.*required/i);
    });

    it('returns empty schema for SDL without TTD directives', () => {
      const sdl = `
        type Query {
          hello: String!
        }
      `;
      const schema = extractTtdSchema(sdl);

      expect(schema.channels).toHaveLength(0);
      expect(schema.ops).toHaveLength(0);
      expect(schema.rules).toHaveLength(0);
      expect(schema.invariants).toHaveLength(0);
    });
  });
});
