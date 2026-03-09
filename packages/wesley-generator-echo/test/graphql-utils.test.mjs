import { describe, it, expect } from 'vitest';
import { Kind } from 'graphql';
import { unwrapType } from '../src/graphql-utils.mjs';

describe('unwrapType', () => {
  it('unwraps a plain named type as optional', () => {
    const node = { kind: Kind.NAMED_TYPE, name: { value: 'String' } };
    expect(unwrapType(node)).toEqual({ typeName: 'String', required: false, list: false });
  });

  it('unwraps NonNullType wrapping a named type', () => {
    const node = {
      kind: Kind.NON_NULL_TYPE,
      type: { kind: Kind.NAMED_TYPE, name: { value: 'Int' } },
    };
    expect(unwrapType(node)).toEqual({ typeName: 'Int', required: true, list: false });
  });

  it('unwraps a required list of required items: [Foo!]!', () => {
    const node = {
      kind: Kind.NON_NULL_TYPE,
      type: {
        kind: Kind.LIST_TYPE,
        type: {
          kind: Kind.NON_NULL_TYPE,
          type: { kind: Kind.NAMED_TYPE, name: { value: 'Foo' } },
        },
      },
    };
    expect(unwrapType(node)).toEqual({ typeName: 'Foo', required: true, list: true });
  });

  it('unwraps an optional list: [Bar]', () => {
    const node = {
      kind: Kind.LIST_TYPE,
      type: { kind: Kind.NAMED_TYPE, name: { value: 'Bar' } },
    };
    expect(unwrapType(node)).toEqual({ typeName: 'Bar', required: false, list: true });
  });

  it('unwraps a required list of optional items: [Baz]!', () => {
    const node = {
      kind: Kind.NON_NULL_TYPE,
      type: {
        kind: Kind.LIST_TYPE,
        type: { kind: Kind.NAMED_TYPE, name: { value: 'Baz' } },
      },
    };
    expect(unwrapType(node)).toEqual({ typeName: 'Baz', required: true, list: true });
  });

  it('falls back to "Unknown" for a node with no name', () => {
    const node = { kind: 'SomeWeirdKind' };
    expect(unwrapType(node)).toEqual({ typeName: 'Unknown', required: false, list: false });
  });

  it('falls back through node.type.name when node.name is absent', () => {
    const node = {
      kind: Kind.NAMED_TYPE,
      type: { name: { value: 'Fallback' } },
    };
    expect(unwrapType(node)).toEqual({ typeName: 'Fallback', required: false, list: false });
  });
});
