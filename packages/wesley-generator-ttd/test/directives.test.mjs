/**
 * TTD Directive Parser Tests
 * These tests define the specification for parsing TTD directives from GraphQL AST.
 */
import { describe, it, expect } from 'vitest';
import { parse } from 'graphql';
import {
  parseChannelDirective,
  parseOpDirective,
  parseRuleDirective,
  parseInvariantDirective,
  parseEmissionDirective,
  parseFootprintDirective,
  parseCodecDirective,
  parseRegistryDirective,
  parseConstraintDirective,
  parseStateFieldDirective,
  parseRequiresDirective,
  parseProducesDirective,
  parseEmitsToDirective,
  parseMustEmitDirective,
  extractTtdDirectives,
  isTtdDirective
} from '@wesley/core/ttd';

describe('TTD Directive Parsing', () => {
  describe('parseChannelDirective', () => {
    it('parses @wes_channel with all args', () => {
      const sdl = `
        type Events @wes_channel(name: "events", version: 2, ordered: false, persistent: true) {
          event: Event!
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];
      const directive = typeDef.directives.find(d => d.name.value === 'wes_channel');

      const result = parseChannelDirective(directive);

      expect(result.name).toBe('events');
      expect(result.version).toBe(2);
      expect(result.ordered).toBe(false);
      expect(result.persistent).toBe(true);
    });

    it('uses defaults for omitted args', () => {
      const sdl = `
        type Events @wes_channel {
          event: Event!
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];
      const directive = typeDef.directives.find(d => d.name.value === 'wes_channel');

      const result = parseChannelDirective(directive, 'Events');

      expect(result.name).toBe('Events'); // defaults to type name
      expect(result.version).toBe(1);
      expect(result.ordered).toBe(true);
      expect(result.persistent).toBe(false);
    });
  });

  describe('parseOpDirective', () => {
    it('parses @wes_op with all args', () => {
      const sdl = `
        type Mutation {
          doThing(id: ID!): Result! @wes_op(name: "doThing", idempotent: true, readonly: false, timeout: 5000)
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_op');

      const result = parseOpDirective(directive);

      expect(result.name).toBe('doThing');
      expect(result.idempotent).toBe(true);
      expect(result.readonly).toBe(false);
      expect(result.timeout).toBe(5000);
    });

    it('uses defaults for omitted args', () => {
      const sdl = `
        type Mutation {
          doThing(id: ID!): Result! @wes_op
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_op');

      const result = parseOpDirective(directive, 'doThing');

      expect(result.name).toBe('doThing');
      expect(result.idempotent).toBe(false);
      expect(result.readonly).toBe(false);
      expect(result.timeout).toBeUndefined();
    });
  });

  describe('parseRuleDirective', () => {
    it('parses @wes_rule with all args', () => {
      const sdl = `
        type Mutation {
          transition: State! @wes_rule(name: "to_active", from: ["IDLE", "PAUSED"], to: "ACTIVE", guard: "canActivate()")
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_rule');

      const result = parseRuleDirective(directive);

      expect(result.name).toBe('to_active');
      expect(result.from).toEqual(['IDLE', 'PAUSED']);
      expect(result.to).toBe('ACTIVE');
      expect(result.guard).toBe('canActivate()');
    });

    it('parses @wes_rule without guard', () => {
      const sdl = `
        type Mutation {
          start: State! @wes_rule(name: "start", from: ["IDLE"], to: "RUNNING")
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_rule');

      const result = parseRuleDirective(directive);

      expect(result.guard).toBeUndefined();
    });
  });

  describe('parseInvariantDirective', () => {
    it('parses @wes_invariant with all args', () => {
      const sdl = `
        type System @wes_invariant(name: "positive_balance", expr: "account.balance >= 0", severity: "error") {
          _: Boolean
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];
      const directive = typeDef.directives.find(d => d.name.value === 'wes_invariant');

      const result = parseInvariantDirective(directive);

      expect(result.name).toBe('positive_balance');
      expect(result.expr).toBe('account.balance >= 0');
      expect(result.severity).toBe('error');
    });

    it('defaults severity to error', () => {
      const sdl = `
        type System @wes_invariant(name: "test", expr: "true") {
          _: Boolean
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];
      const directive = typeDef.directives.find(d => d.name.value === 'wes_invariant');

      const result = parseInvariantDirective(directive);

      expect(result.severity).toBe('error');
    });
  });

  describe('parseEmissionDirective', () => {
    it('parses @wes_emission with condition', () => {
      const sdl = `
        type Mutation {
          update: Result! @wes_emission(channel: "updates", event: "Updated", condition: "changed == true")
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_emission');

      const result = parseEmissionDirective(directive);

      expect(result.channel).toBe('updates');
      expect(result.event).toBe('Updated');
      expect(result.condition).toBe('changed == true');
    });
  });

  describe('parseFootprintDirective', () => {
    it('parses @wes_footprint with all resource types', () => {
      const sdl = `
        type Mutation {
          transfer: Result! @wes_footprint(reads: ["Account"], writes: ["Account", "Transaction"], creates: ["Transaction"], deletes: [])
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_footprint');

      const result = parseFootprintDirective(directive);

      expect(result.reads).toEqual(['Account']);
      expect(result.writes).toEqual(['Account', 'Transaction']);
      expect(result.creates).toEqual(['Transaction']);
      expect(result.deletes).toEqual([]);
    });
  });

  describe('parseCodecDirective', () => {
    it('parses @wes_codec for cbor', () => {
      const sdl = `
        type Event @wes_codec(format: "cbor", canonical: true) {
          id: ID!
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];
      const directive = typeDef.directives.find(d => d.name.value === 'wes_codec');

      const result = parseCodecDirective(directive);

      expect(result.format).toBe('cbor');
      expect(result.canonical).toBe(true);
    });

    it('defaults canonical to true for cbor', () => {
      const sdl = `
        type Event @wes_codec(format: "cbor") {
          id: ID!
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];
      const directive = typeDef.directives.find(d => d.name.value === 'wes_codec');

      const result = parseCodecDirective(directive);

      expect(result.canonical).toBe(true);
    });
  });

  describe('parseRegistryDirective', () => {
    it('parses @wes_registry with explicit id', () => {
      const sdl = `
        type Event @wes_registry(id: 42, deprecated: false) {
          id: ID!
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];
      const directive = typeDef.directives.find(d => d.name.value === 'wes_registry');

      const result = parseRegistryDirective(directive);

      expect(result.id).toBe(42);
      expect(result.deprecated).toBe(false);
    });

    it('parses deprecated registry entry', () => {
      const sdl = `
        type OldEvent @wes_registry(id: 1, deprecated: true, deprecatedBy: "NewEvent") {
          id: ID!
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];
      const directive = typeDef.directives.find(d => d.name.value === 'wes_registry');

      const result = parseRegistryDirective(directive);

      expect(result.deprecated).toBe(true);
      expect(result.deprecatedBy).toBe('NewEvent');
    });
  });

  describe('parseConstraintDirective', () => {
    it('parses numeric constraints', () => {
      const sdl = `
        type Counter {
          value: Int! @wes_constraint(min: 0, max: 1000000)
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_constraint');

      const result = parseConstraintDirective(directive);

      expect(result.min).toBe(0);
      expect(result.max).toBe(1000000);
    });

    it('parses string constraints', () => {
      const sdl = `
        type User {
          email: String! @wes_constraint(minLength: 5, maxLength: 255, pattern: "^[a-z]+@[a-z]+\\\\.[a-z]+$")
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_constraint');

      const result = parseConstraintDirective(directive);

      expect(result.minLength).toBe(5);
      expect(result.maxLength).toBe(255);
      expect(result.pattern).toBe('^[a-z]+@[a-z]+\\.[a-z]+$');
    });

    it('parses oneOf constraint', () => {
      const sdl = `
        type Config {
          env: String! @wes_constraint(oneOf: ["dev", "staging", "prod"])
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_constraint');

      const result = parseConstraintDirective(directive);

      expect(result.oneOf).toEqual(['dev', 'staging', 'prod']);
    });
  });

  describe('parseStateFieldDirective', () => {
    it('parses key state field', () => {
      const sdl = `
        type Entity {
          id: ID! @wes_stateField(key: true)
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_stateField');

      const result = parseStateFieldDirective(directive);

      expect(result.key).toBe(true);
      expect(result.derived).toBe(false);
    });

    it('parses derived state field', () => {
      const sdl = `
        type Entity {
          fullName: String! @wes_stateField(derived: true, derivation: "firstName + ' ' + lastName")
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_stateField');

      const result = parseStateFieldDirective(directive);

      expect(result.derived).toBe(true);
      expect(result.derivation).toBe("firstName + ' ' + lastName");
    });
  });

  describe('parseRequiresDirective', () => {
    it('parses state requirement', () => {
      const sdl = `
        type Mutation {
          doThing: Result! @wes_requires(state: "entity.status == ACTIVE")
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_requires');

      const result = parseRequiresDirective(directive);

      expect(result.state).toBe('entity.status == ACTIVE');
    });

    it('parses ops and permissions requirements', () => {
      const sdl = `
        type Mutation {
          complete: Result! @wes_requires(ops: ["start", "process"], permissions: ["admin", "operator"])
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_requires');

      const result = parseRequiresDirective(directive);

      expect(result.ops).toEqual(['start', 'process']);
      expect(result.permissions).toEqual(['admin', 'operator']);
    });
  });

  describe('parseProducesDirective', () => {
    it('parses events production', () => {
      const sdl = `
        type Mutation {
          create: Entity! @wes_produces(events: ["EntityCreated", "AuditLog"])
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_produces');

      const result = parseProducesDirective(directive);

      expect(result.events).toEqual(['EntityCreated', 'AuditLog']);
    });

    it('parses state production', () => {
      const sdl = `
        type Mutation {
          activate: Entity! @wes_produces(state: "entity.status = ACTIVE")
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_produces');

      const result = parseProducesDirective(directive);

      expect(result.state).toBe('entity.status = ACTIVE');
    });
  });

  describe('parseEmitsToDirective', () => {
    it('parses channel and timing', () => {
      const sdl = `
        type Mutation {
          update: Result! @wes_emitsTo(channel: "updates", within: 100)
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_emitsTo');

      const result = parseEmitsToDirective(directive);

      expect(result.channel).toBe('updates');
      expect(result.within).toBe(100);
    });
  });

  describe('parseMustEmitDirective', () => {
    it('parses event and timing', () => {
      const sdl = `
        type Mutation {
          create: Entity! @wes_mustEmit(event: "Created", within: 50)
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];
      const directive = field.directives.find(d => d.name.value === 'wes_mustEmit');

      const result = parseMustEmitDirective(directive);

      expect(result.event).toBe('Created');
      expect(result.within).toBe(50);
    });
  });

  describe('extractTtdDirectives', () => {
    it('extracts all TTD directives from a type', () => {
      const sdl = `
        type Event
          @wes_channel(name: "events")
          @wes_codec(format: "cbor")
          @wes_registry(id: 1)
        {
          id: ID!
        }
      `;
      const doc = parse(sdl);
      const typeDef = doc.definitions[0];

      const result = extractTtdDirectives(typeDef.directives);

      expect(result.channel).toBeDefined();
      expect(result.codec).toBeDefined();
      expect(result.registry).toBeDefined();
    });

    it('extracts all TTD directives from a field', () => {
      const sdl = `
        type Mutation {
          doThing: Result!
            @wes_op(name: "doThing")
            @wes_rule(name: "r1", from: ["A"], to: "B")
            @wes_emission(channel: "ch", event: "E")
            @wes_footprint(reads: ["X"])
        }
      `;
      const doc = parse(sdl);
      const field = doc.definitions[0].fields[0];

      const result = extractTtdDirectives(field.directives);

      expect(result.op).toBeDefined();
      expect(result.rules).toHaveLength(1);
      expect(result.emissions).toHaveLength(1);
      expect(result.footprint).toBeDefined();
    });
  });

  describe('isTtdDirective', () => {
    it('identifies TTD directives', () => {
      expect(isTtdDirective('wes_channel')).toBe(true);
      expect(isTtdDirective('wes_op')).toBe(true);
      expect(isTtdDirective('wes_rule')).toBe(true);
      expect(isTtdDirective('wes_invariant')).toBe(true);
      expect(isTtdDirective('wes_emission')).toBe(true);
      expect(isTtdDirective('wes_footprint')).toBe(true);
      expect(isTtdDirective('wes_codec')).toBe(true);
      expect(isTtdDirective('wes_registry')).toBe(true);
      expect(isTtdDirective('wes_constraint')).toBe(true);
      expect(isTtdDirective('wes_stateField')).toBe(true);
      expect(isTtdDirective('wes_requires')).toBe(true);
      expect(isTtdDirective('wes_produces')).toBe(true);
      expect(isTtdDirective('wes_emitsTo')).toBe(true);
      expect(isTtdDirective('wes_mustEmit')).toBe(true);
      expect(isTtdDirective('wes_version')).toBe(true);
      expect(isTtdDirective('wes_tick')).toBe(true);
      expect(isTtdDirective('wes_effect')).toBe(true);
    });

    it('rejects non-TTD directives', () => {
      expect(isTtdDirective('wes_table')).toBe(false);
      expect(isTtdDirective('wes_pk')).toBe(false);
      expect(isTtdDirective('deprecated')).toBe(false);
      expect(isTtdDirective('custom')).toBe(false);
    });
  });
});
