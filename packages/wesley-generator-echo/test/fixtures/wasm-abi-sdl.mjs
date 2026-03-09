/**
 * Shared WASM ABI SDL fixture for codec tests.
 * Canonical source: schemas/echo-wasm-abi.graphql
 */
export const ABI_SDL = /* GraphQL */ `
  scalar Hash32
  scalar Bytes
  scalar U32
  scalar U64

  type DispatchResponse {
    accepted: Boolean!
    intentId: Hash32!
  }

  type HeadInfo {
    commitId: Hash32!
    stateRoot: Hash32!
    tick: U64!
  }

  type StepResponse {
    head: HeadInfo!
    ticksExecuted: U32!
  }

  type ChannelData {
    channelId: Hash32!
    data: Bytes!
  }

  type DrainResponse {
    channels: [ChannelData!]!
  }

  type RegistryInfo {
    abiVersion: U32!
    codecId: String
    registryVersion: String
    schemaSha256Hex: String
  }

  type AbiError {
    code: U32!
    message: String!
  }
`;
