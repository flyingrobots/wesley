/**
 * TTD Canonical Hasher Tests
 * These tests define the specification for deterministic schema hashing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashSchema,
  hashType,
  hashOp,
  hashChannel,
  canonicalizeObject,
  hashString
} from '@wesley/core/ttd';
import { testCrypto } from './setup.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const basicProtocolSdl = readFileSync(join(__dirname, 'fixtures/basic-protocol/basic-protocol.graphql'), 'utf-8');

/** Crypto deps for hash functions */
const deps = { crypto: testCrypto };

describe('TTD Canonical Hasher', () => {
  describe('hashString', () => {
    it('produces consistent SHA-256 hashes', () => {
      const hash1 = hashString('hello', deps);
      const hash2 = hashString('hello', deps);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = hashString('hello', deps);
      const hash2 = hashString('world', deps);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('canonicalizeObject', () => {
    it('sorts object keys alphabetically', () => {
      const obj = { z: 1, a: 2, m: 3 };
      const canonical = canonicalizeObject(obj);

      expect(JSON.stringify(canonical)).toBe('{"a":2,"m":3,"z":1}');
    });

    it('recursively sorts nested objects', () => {
      const obj = { b: { z: 1, a: 2 }, a: { y: 3, x: 4 } };
      const canonical = canonicalizeObject(obj);

      expect(JSON.stringify(canonical)).toBe('{"a":{"x":4,"y":3},"b":{"a":2,"z":1}}');
    });

    it('handles arrays by canonicalizing each element', () => {
      const obj = { items: [{ b: 1, a: 2 }, { d: 3, c: 4 }] };
      const canonical = canonicalizeObject(obj);

      expect(JSON.stringify(canonical)).toBe('{"items":[{"a":2,"b":1},{"c":4,"d":3}]}');
    });

    it('handles null and primitive values', () => {
      const obj = { a: null, b: 42, c: 'string', d: true };
      const canonical = canonicalizeObject(obj);

      expect(JSON.stringify(canonical)).toBe('{"a":null,"b":42,"c":"string","d":true}');
    });

    it('strips undefined values', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      const canonical = canonicalizeObject(obj);

      expect(JSON.stringify(canonical)).toBe('{"a":1,"c":3}');
    });
  });

  describe('hashType', () => {
    it('produces consistent hashes for type definitions', () => {
      const typeDef = {
        name: 'Counter',
        fields: [
          { name: 'id', type: 'ID', required: true },
          { name: 'value', type: 'Int', required: true }
        ]
      };

      const hash1 = hashType(typeDef, deps);
      const hash2 = hashType(typeDef, deps);

      expect(hash1).toBe(hash2);
    });

    it('produces same hash regardless of field order in input', () => {
      const typeDef1 = {
        name: 'Counter',
        fields: [
          { name: 'id', type: 'ID', required: true },
          { name: 'value', type: 'Int', required: true }
        ]
      };

      const typeDef2 = {
        fields: [
          { name: 'value', type: 'Int', required: true },
          { name: 'id', type: 'ID', required: true }
        ],
        name: 'Counter'
      };

      const hash1 = hashType(typeDef1, deps);
      const hash2 = hashType(typeDef2, deps);

      expect(hash1).toBe(hash2);
    });

    it('produces different hash when type changes', () => {
      const typeDef1 = {
        name: 'Counter',
        fields: [{ name: 'value', type: 'Int', required: true }]
      };

      const typeDef2 = {
        name: 'Counter',
        fields: [{ name: 'value', type: 'Int', required: false }]
      };

      const hash1 = hashType(typeDef1, deps);
      const hash2 = hashType(typeDef2, deps);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashOp', () => {
    it('produces consistent hashes for operations', () => {
      const op = {
        name: 'increment',
        args: [
          { name: 'counterId', type: 'ID', required: true },
          { name: 'amount', type: 'Int', required: true }
        ],
        resultType: 'Counter'
      };

      const hash1 = hashOp(op, deps);
      const hash2 = hashOp(op, deps);

      expect(hash1).toBe(hash2);
    });

    it('produces different hash when signature changes', () => {
      const op1 = {
        name: 'increment',
        args: [{ name: 'amount', type: 'Int', required: true }],
        resultType: 'Counter'
      };

      const op2 = {
        name: 'increment',
        args: [{ name: 'amount', type: 'Int', required: false }],
        resultType: 'Counter'
      };

      expect(hashOp(op1, deps)).not.toBe(hashOp(op2, deps));
    });
  });

  describe('hashChannel', () => {
    it('produces consistent hashes for channels', () => {
      const channel = {
        name: 'counter',
        version: 1,
        eventTypes: ['CounterIncremented', 'CounterDecremented'],
        ordered: true,
        persistent: false
      };

      const hash1 = hashChannel(channel, deps);
      const hash2 = hashChannel(channel, deps);

      expect(hash1).toBe(hash2);
    });

    it('includes event types in hash', () => {
      const channel1 = {
        name: 'counter',
        version: 1,
        eventTypes: ['EventA']
      };

      const channel2 = {
        name: 'counter',
        version: 1,
        eventTypes: ['EventB']
      };

      expect(hashChannel(channel1, deps)).not.toBe(hashChannel(channel2, deps));
    });
  });

  describe('hashSchema', () => {
    it('produces consistent hashes for the same SDL', () => {
      const hash1 = hashSchema(basicProtocolSdl, deps);
      const hash2 = hashSchema(basicProtocolSdl, deps);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different SDL', () => {
      const sdl1 = `
        type Mutation {
          doA: Result! @wes_op(name: "doA")
        }
      `;
      const sdl2 = `
        type Mutation {
          doB: Result! @wes_op(name: "doB")
        }
      `;

      expect(hashSchema(sdl1, deps)).not.toBe(hashSchema(sdl2, deps));
    });

    it('ignores whitespace differences', () => {
      const sdl1 = 'type Query { hello: String! }';
      const sdl2 = `
        type Query {
          hello: String!
        }
      `;

      expect(hashSchema(sdl1, deps)).toBe(hashSchema(sdl2, deps));
    });

    it('ignores comment differences', () => {
      const sdl1 = 'type Query { hello: String! }';
      const sdl2 = `
        # This is a comment
        type Query {
          # Another comment
          hello: String!
        }
      `;

      expect(hashSchema(sdl1, deps)).toBe(hashSchema(sdl2, deps));
    });

    it('is sensitive to type name changes', () => {
      const sdl1 = 'type Counter { value: Int! }';
      const sdl2 = 'type CounterV2 { value: Int! }';

      expect(hashSchema(sdl1, deps)).not.toBe(hashSchema(sdl2, deps));
    });

    it('is sensitive to directive argument changes', () => {
      const sdl1 = `
        type Mutation {
          op: R! @wes_op(idempotent: true)
        }
      `;
      const sdl2 = `
        type Mutation {
          op: R! @wes_op(idempotent: false)
        }
      `;

      expect(hashSchema(sdl1, deps)).not.toBe(hashSchema(sdl2, deps));
    });
  });

  describe('determinism', () => {
    it('produces identical results across multiple runs', () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(hashSchema(basicProtocolSdl, deps));
      }

      const first = results[0];
      expect(results.every(r => r === first)).toBe(true);
    });

    it('hash is not affected by object property insertion order', () => {
      const obj1 = {};
      obj1.a = 1;
      obj1.b = 2;

      const obj2 = {};
      obj2.b = 2;
      obj2.a = 1;

      expect(JSON.stringify(canonicalizeObject(obj1))).toBe(
        JSON.stringify(canonicalizeObject(obj2))
      );
    });
  });
});
