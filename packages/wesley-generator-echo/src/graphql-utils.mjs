import { Kind } from 'graphql';

/**
 * Unwrap a GraphQL type AST node into its base type name and modifiers.
 *
 * Peels off NonNullType and ListType wrappers, returning:
 * - `typeName` — the named type (e.g. `"String"`, `"Hash32"`)
 * - `required` — `true` if the outermost wrapper is NonNullType
 * - `list` — `true` if the type is a ListType
 *
 * ABI schema invariant: list items are always non-null (e.g. `[ChannelData!]!`).
 * Inner nullability is intentionally discarded — `Vec<Option<T>>` / `Array<T | null>`
 * is not a valid ABI wire type. If this changes, capture `listItemRequired` here.
 *
 * @param {import('graphql').TypeNode} typeNode
 * @returns {{ typeName: string, required: boolean, list: boolean }}
 */
export function unwrapType(typeNode) {
  let required = false;
  let list = false;
  let node = typeNode;

  if (node.kind === Kind.NON_NULL_TYPE) {
    required = true;
    node = node.type;
  }

  if (node.kind === Kind.LIST_TYPE) {
    list = true;
    node = node.type;
    if (node.kind === Kind.NON_NULL_TYPE) {
      node = node.type;
    }
  }

  if (node.kind === Kind.LIST_TYPE || node.kind === Kind.NON_NULL_TYPE) {
    throw new Error(`unwrapType: unsupported nested type wrapper (kind=${node.kind})`);
  }

  if (!node.name?.value) {
    throw new Error(`unwrapType: reached terminal node without a name (kind=${node.kind})`);
  }

  return { typeName: node.name.value, required, list };
}
