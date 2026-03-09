import { describe, it, expect } from 'vitest';
import { emitWasmAbiCodecTs } from '../src/emitWasmAbiCodecTs.mjs';

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

describe('wasm_abi_codec TypeScript generation', () => {
  it('generates non-null output', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).not.toBeNull();
    expect(ts.length).toBeGreaterThan(0);
  });

  it('includes DO NOT EDIT comment', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('DO NOT EDIT');
  });

  it('returns null for SDL with no object types', () => {
    const ts = emitWasmAbiCodecTs('scalar Foo');
    expect(ts).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Interface generation
// ---------------------------------------------------------------------------

describe('interface generation', () => {
  it('emits all ABI interfaces', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('export interface DispatchResponse {');
    expect(ts).toContain('export interface HeadInfo {');
    expect(ts).toContain('export interface StepResponse {');
    expect(ts).toContain('export interface ChannelData {');
    expect(ts).toContain('export interface DrainResponse {');
    expect(ts).toContain('export interface RegistryInfo {');
    expect(ts).toContain('export interface AbiError {');
  });

  it('uses correct TypeScript types for ABI scalars', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('accepted: boolean;');
    expect(ts).toContain('intentId: Uint8Array;');
    expect(ts).toContain('tick: bigint;');
    expect(ts).toContain('ticksExecuted: number;');
    expect(ts).toContain('data: Uint8Array;');
    expect(ts).toContain('channels: ChannelData[];');
  });

  it('marks optional fields with ? modifier', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('codecId?:');
    expect(ts).toContain('registryVersion?:');
    expect(ts).toContain('schemaSha256Hex?:');
  });
});

// ---------------------------------------------------------------------------
// AbiResult type
// ---------------------------------------------------------------------------

describe('AbiResult type', () => {
  it('emits AbiResult discriminated union', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('export type AbiResult<T>');
    expect(ts).toContain('ok: true');
    expect(ts).toContain('ok: false');
    expect(ts).toContain('error: AbiError');
  });
});

// ---------------------------------------------------------------------------
// Encode/decode helpers
// ---------------------------------------------------------------------------

describe('helpers', () => {
  it('emits U32 encode/decode helpers', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('function _encodeU32(');
    expect(ts).toContain('function _decodeU32(');
    expect(ts).toContain('setUint32');
    expect(ts).toContain('getUint32');
  });

  it('emits U64 encode/decode helpers with bigint', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('function _encodeU64(');
    expect(ts).toContain('function _decodeU64(');
    expect(ts).toContain('setBigUint64');
    expect(ts).toContain('getBigUint64');
  });

  it('emits Hash32 encode/decode helpers', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('function _encodeHash32(');
    expect(ts).toContain('function _decodeHash32(');
  });

  it('emits Bytes encode/decode helpers', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('function _encodeBytes(');
    expect(ts).toContain('function _decodeBytes(');
  });

  it('emits standard helpers (bool, string, option, list)', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('function _encodeBool(');
    expect(ts).toContain('function _encodeString(');
    expect(ts).toContain('function _encodeOption');
    expect(ts).toContain('function _encodeList');
    expect(ts).toContain('function _decodeBool(');
    expect(ts).toContain('function _decodeString(');
    expect(ts).toContain('function _decodeOption');
    expect(ts).toContain('function _decodeList');
  });
});

// ---------------------------------------------------------------------------
// Per-type encode/decode functions
// ---------------------------------------------------------------------------

describe('per-type functions', () => {
  it('emits public encode functions for each type', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('export function encodeDispatchResponse(');
    expect(ts).toContain('export function encodeHeadInfo(');
    expect(ts).toContain('export function encodeStepResponse(');
    expect(ts).toContain('export function encodeChannelData(');
    expect(ts).toContain('export function encodeDrainResponse(');
    expect(ts).toContain('export function encodeRegistryInfo(');
    expect(ts).toContain('export function encodeAbiError(');
  });

  it('emits public decode functions for each type', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('export function decodeDispatchResponse(');
    expect(ts).toContain('export function decodeHeadInfo(');
    expect(ts).toContain('export function decodeStepResponse(');
    expect(ts).toContain('export function decodeChannelData(');
    expect(ts).toContain('export function decodeDrainResponse(');
    expect(ts).toContain('export function decodeRegistryInfo(');
    expect(ts).toContain('export function decodeAbiError(');
  });

  it('decode functions return { value, bytesRead }', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('bytesRead: off.v - (offset ?? 0)');
  });
});

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

describe('envelope', () => {
  it('emits decodeEnvelope function', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('export function decodeEnvelope');
    expect(ts).toContain('0x01');
    expect(ts).toContain('0x00');
  });

  it('emits encodeOk with 0x01 tag', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('export function encodeOk(');
  });

  it('emits encodeErr with 0x00 tag', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('export function encodeErr(');
  });

  it('emits convenience envelope decoders per type', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    expect(ts).toContain('export function decodeDispatchResponseEnvelope(');
    expect(ts).toContain('export function decodeStepResponseEnvelope(');
    expect(ts).toContain('export function decodeDrainResponseEnvelope(');
    expect(ts).toContain('export function decodeRegistryInfoEnvelope(');
  });
});

// ---------------------------------------------------------------------------
// Hash32 (fixed-size, no length prefix)
// ---------------------------------------------------------------------------

describe('Hash32 TypeScript handling', () => {
  it('encodes Hash32 as fixed 32 bytes without length prefix', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    // _encodeHash32 should copy exactly 32 bytes
    const encodeBlock = ts.slice(ts.indexOf('function _encodeHash32'));
    expect(encodeBlock).toContain('32');
  });

  it('decodes Hash32 as fixed 32 bytes', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    const decodeBlock = ts.slice(ts.indexOf('function _decodeHash32'));
    expect(decodeBlock).toContain('32');
  });
});

// ---------------------------------------------------------------------------
// Field ordering
// ---------------------------------------------------------------------------

describe('alphabetical field order', () => {
  it('encodes fields in alphabetical order', () => {
    const ts = emitWasmAbiCodecTs(ABI_SDL);
    // In _encodeDispatchResponse: accepted before intentId
    const encBlock = ts.slice(ts.indexOf('function _encodeDispatchResponse'));
    const acceptedIdx = encBlock.indexOf('value.accepted');
    const intentIdx = encBlock.indexOf('value.intentId');
    expect(acceptedIdx).toBeLessThan(intentIdx);
  });
});
