import { describe, it, expect } from 'vitest';
import { emitWasmAbiCodec } from '../src/emitWasmAbiCodec.mjs';
import { generateEcho } from '../src/index.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ABI_SDL = /* GraphQL */ `
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

// ---------------------------------------------------------------------------
// Basic generation
// ---------------------------------------------------------------------------

describe('wasm_abi_codec Rust generation', () => {
  it('generates non-null output', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).not.toBeNull();
    expect(rs.length).toBeGreaterThan(0);
  });

  it('includes safety header', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('#![forbid(unsafe_code)]');
    expect(rs).toContain('DO NOT EDIT');
  });

  it('returns null for SDL with no object types', () => {
    const rs = emitWasmAbiCodec('scalar Foo');
    expect(rs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AbiDecodeError
// ---------------------------------------------------------------------------

describe('AbiDecodeError', () => {
  it('emits AbiDecodeError enum', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('pub enum AbiDecodeError {');
    expect(rs).toContain('UnexpectedEof');
    expect(rs).toContain('InvalidOptionTag');
    expect(rs).toContain('Utf8Error');
    expect(rs).toContain('ErrorResponse { code: u32, message: String }');
  });

  it('implements Display for AbiDecodeError', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('impl std::fmt::Display for AbiDecodeError');
  });
});

// ---------------------------------------------------------------------------
// Struct generation
// ---------------------------------------------------------------------------

describe('struct generation', () => {
  it('emits all ABI structs with derive attributes', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('pub struct DispatchResponse {');
    expect(rs).toContain('pub struct HeadInfo {');
    expect(rs).toContain('pub struct StepResponse {');
    expect(rs).toContain('pub struct ChannelData {');
    expect(rs).toContain('pub struct DrainResponse {');
    expect(rs).toContain('pub struct RegistryInfo {');
    expect(rs).toContain('pub struct AbiError {');
  });

  it('uses correct Rust types for ABI scalars', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('pub accepted: bool,');
    expect(rs).toContain('pub intent_id: [u8; 32],');
    expect(rs).toContain('pub tick: u64,');
    expect(rs).toContain('pub ticks_executed: u32,');
    expect(rs).toContain('pub data: Vec<u8>,');
    expect(rs).toContain('pub channels: Vec<ChannelData>,');
    expect(rs).toContain('pub codec_id: Option<String>,');
  });

  it('includes #[derive(Debug, Clone, PartialEq)]', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('#[derive(Debug, Clone, PartialEq)]');
  });
});

// ---------------------------------------------------------------------------
// Hash32 encoding (fixed 32 bytes, no length prefix)
// ---------------------------------------------------------------------------

describe('Hash32 encoding', () => {
  it('encodes Hash32 as raw 32 bytes without length prefix', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    // extend_from_slice for fixed-size — no encode_bytes call
    expect(rs).toContain('buf.extend_from_slice(&self.intent_id);');
  });

  it('decodes Hash32 as fixed 32 bytes', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('fn decode_hash32(');
    expect(rs).toContain('[0u8; 32]');
    expect(rs).toContain('*offset + 32 > bytes.len()');
  });
});

// ---------------------------------------------------------------------------
// U32 / U64 encoding
// ---------------------------------------------------------------------------

describe('U32 and U64 encoding', () => {
  it('emits encode_u32_le and encode_u64_le helpers', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('fn encode_u32_le(v: u32) -> [u8; 4]');
    expect(rs).toContain('fn encode_u64_le(v: u64) -> [u8; 8]');
  });

  it('emits decode_u32_le and decode_u64_le helpers', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('fn decode_u32_le(bytes: &[u8], offset: &mut usize) -> Result<u32, AbiDecodeError>');
    expect(rs).toContain('fn decode_u64_le(bytes: &[u8], offset: &mut usize) -> Result<u64, AbiDecodeError>');
  });

  it('uses to_le_bytes for encoding', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('v.to_le_bytes()');
  });
});

// ---------------------------------------------------------------------------
// Bytes encoding (variable-length with length prefix)
// ---------------------------------------------------------------------------

describe('Bytes encoding', () => {
  it('emits encode_bytes and decode_bytes helpers', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('fn encode_bytes(v: &[u8]) -> Vec<u8>');
    expect(rs).toContain('fn decode_bytes(');
  });

  it('uses u32 LE length prefix for Bytes', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    const encodeBytesIdx = rs.indexOf('fn encode_bytes');
    const block = rs.slice(encodeBytesIdx, rs.indexOf('}', encodeBytesIdx + 50) + 1);
    expect(block).toContain('(v.len() as u32).to_le_bytes()');
  });
});

// ---------------------------------------------------------------------------
// Envelope functions
// ---------------------------------------------------------------------------

describe('envelope functions', () => {
  it('emits encode_ok with 0x01 tag', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('pub fn encode_ok(payload: &[u8]) -> Vec<u8>');
    expect(rs).toContain('buf.push(0x01);');
  });

  it('emits encode_err with 0x00 tag', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('pub fn encode_err(code: u32, message: &str) -> Vec<u8>');
    expect(rs).toContain('buf.push(0x00);');
  });

  it('emits decode_envelope', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('pub fn decode_envelope(');
    expect(rs).toContain('0x01 => Ok(&bytes[1..]),');
    expect(rs).toContain('0x00 => {');
  });
});

// ---------------------------------------------------------------------------
// Optional field handling
// ---------------------------------------------------------------------------

describe('optional fields', () => {
  it('handles optional fields with encode_option', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('encode_option(&self.codec_id');
    expect(rs).toContain('encode_option(&self.registry_version');
    expect(rs).toContain('encode_option(&self.schema_sha256_hex');
  });

  it('handles optional decode with decode_option', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('decode_option(bytes, &mut offset, decode_string)');
  });
});

// ---------------------------------------------------------------------------
// Nested struct encoding
// ---------------------------------------------------------------------------

describe('nested struct encoding', () => {
  it('calls encode_raw_le on nested structs', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('self.head.encode_raw_le()');
  });

  it('emits decode_raw_le_at for nested struct decoding', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('HeadInfo::decode_raw_le_at(bytes, &mut offset)');
  });
});

// ---------------------------------------------------------------------------
// List encoding
// ---------------------------------------------------------------------------

describe('list encoding', () => {
  it('encodes Vec fields with encode_list', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('encode_list(&self.channels');
  });

  it('decodes Vec fields with decode_list', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    expect(rs).toContain('decode_list(bytes, &mut offset,');
  });
});

// ---------------------------------------------------------------------------
// Field alphabetical ordering
// ---------------------------------------------------------------------------

describe('alphabetical field order', () => {
  it('encodes fields in alphabetical order', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    // In DispatchResponse: accepted (a) before intentId (i)
    const dispatchBlock = rs.slice(rs.indexOf('impl DispatchResponse'));
    const acceptedIdx = dispatchBlock.indexOf('self.accepted');
    const intentIdx = dispatchBlock.indexOf('self.intent_id');
    expect(acceptedIdx).toBeLessThan(intentIdx);
  });

  it('sorts struct fields alphabetically', () => {
    const rs = emitWasmAbiCodec(ABI_SDL);
    // In HeadInfo struct: commitId before stateRoot before tick
    const headBlock = rs.slice(rs.indexOf('pub struct HeadInfo'));
    const commitIdx = headBlock.indexOf('commit_id');
    const stateIdx = headBlock.indexOf('state_root');
    const tickIdx = headBlock.indexOf('tick');
    expect(commitIdx).toBeLessThan(stateIdx);
    expect(stateIdx).toBeLessThan(tickIdx);
  });
});

// ---------------------------------------------------------------------------
// Integration: generateEcho produces ABI codec files
// ---------------------------------------------------------------------------

describe('integration with generateEcho', () => {
  it('generates wasm_abi_codec.generated.rs alongside other artifacts', async () => {
    const result = await generateEcho({ sdl: 'type Query { hello: String! }' });
    const file = result.files.find((f) => f.path === 'wasm_abi_codec.generated.rs');
    expect(file).toBeDefined();
    expect(file.content.length).toBeGreaterThan(0);
    expect(file.content).toContain('pub struct DispatchResponse');
  });

  it('generates wasm_abi_codec.generated.ts alongside other artifacts', async () => {
    const result = await generateEcho({ sdl: 'type Query { hello: String! }' });
    const file = result.files.find((f) => f.path === 'wasm_abi_codec.generated.ts');
    expect(file).toBeDefined();
    expect(file.content.length).toBeGreaterThan(0);
  });
});
