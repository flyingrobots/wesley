import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateEcho } from '../src/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Reference encoders (JS mirrors of the Rust raw-LE codec)
// ---------------------------------------------------------------------------

function encodeString(s) {
  const bytes = new TextEncoder().encode(s);
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, bytes.length, true);
  return [...new Uint8Array(buf), ...bytes];
}

function encodeOptionalString(v) {
  if (v == null) return [0x00];
  return [0x01, ...encodeString(v)];
}

// ClaimRecord fields in alphabetical order:
// claim_key, commitment, issuer, policy_hash, private_ref?, proof_hash?, scheme_id, statement_hash
function encodeClaimRecord(v) {
  return [
    ...encodeString(v.claim_key),
    ...encodeString(v.commitment),
    ...encodeString(v.issuer),
    ...encodeString(v.policy_hash),
    ...encodeOptionalString(v.private_ref),
    ...encodeOptionalString(v.proof_hash),
    ...encodeString(v.scheme_id),
    ...encodeString(v.statement_hash)
  ];
}

// PrivateAtomRefV1 fields in alphabetical order:
// commit, opaque_ref?, policy_hash, statement_hash, zk_evidence?
function encodePrivateAtomRefV1(v) {
  return [
    ...encodeString(v.commit),
    ...encodeOptionalString(v.opaque_ref),
    ...encodeString(v.policy_hash),
    ...encodeString(v.statement_hash),
    ...encodeOptionalString(v.zk_evidence)
  ];
}

// OpaqueRefV1 fields in alphabetical order:
// alg_id, commit, locator, policy_hash, vault_id
function encodeOpaqueRefV1(v) {
  return [
    ...encodeString(v.alg_id),
    ...encodeString(v.commit),
    ...encodeString(v.locator),
    ...encodeString(v.policy_hash),
    ...encodeString(v.vault_id)
  ];
}

// ---------------------------------------------------------------------------
// Reference decoders (JS mirrors of the Rust raw-LE codec)
// ---------------------------------------------------------------------------

function decodeStringAt(bytes, offset) {
  const len = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
  offset += 4;
  const strBytes = bytes.slice(offset, offset + len);
  offset += len;
  return { value: new TextDecoder().decode(new Uint8Array(strBytes)), offset };
}

function decodeOptionalStringAt(bytes, offset) {
  const tag = bytes[offset];
  offset += 1;
  if (tag === 0x00) return { value: null, offset };
  const result = decodeStringAt(bytes, offset);
  return { value: result.value, offset: result.offset };
}

function decodeClaimRecord(bytes) {
  let offset = 0;
  const claim_key = decodeStringAt(bytes, offset); offset = claim_key.offset;
  const commitment = decodeStringAt(bytes, offset); offset = commitment.offset;
  const issuer = decodeStringAt(bytes, offset); offset = issuer.offset;
  const policy_hash = decodeStringAt(bytes, offset); offset = policy_hash.offset;
  const private_ref = decodeOptionalStringAt(bytes, offset); offset = private_ref.offset;
  const proof_hash = decodeOptionalStringAt(bytes, offset); offset = proof_hash.offset;
  const scheme_id = decodeStringAt(bytes, offset); offset = scheme_id.offset;
  const statement_hash = decodeStringAt(bytes, offset);
  return {
    claim_key: claim_key.value,
    commitment: commitment.value,
    issuer: issuer.value,
    policy_hash: policy_hash.value,
    private_ref: private_ref.value,
    proof_hash: proof_hash.value,
    scheme_id: scheme_id.value,
    statement_hash: statement_hash.value
  };
}

function decodePrivateAtomRefV1(bytes) {
  let offset = 0;
  const commit = decodeStringAt(bytes, offset); offset = commit.offset;
  const opaque_ref = decodeOptionalStringAt(bytes, offset); offset = opaque_ref.offset;
  const policy_hash = decodeStringAt(bytes, offset); offset = policy_hash.offset;
  const statement_hash = decodeStringAt(bytes, offset); offset = statement_hash.offset;
  const zk_evidence = decodeOptionalStringAt(bytes, offset);
  return {
    commit: commit.value,
    opaque_ref: opaque_ref.value,
    policy_hash: policy_hash.value,
    statement_hash: statement_hash.value,
    zk_evidence: zk_evidence.value
  };
}

function decodeOpaqueRefV1(bytes) {
  let offset = 0;
  const alg_id = decodeStringAt(bytes, offset); offset = alg_id.offset;
  const commit = decodeStringAt(bytes, offset); offset = commit.offset;
  const locator = decodeStringAt(bytes, offset); offset = locator.offset;
  const policy_hash = decodeStringAt(bytes, offset); offset = policy_hash.offset;
  const vault_id = decodeStringAt(bytes, offset);
  return {
    alg_id: alg_id.value,
    commit: commit.value,
    locator: locator.value,
    policy_hash: policy_hash.value,
    vault_id: vault_id.value
  };
}

function bytesToHex(arr) {
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Encoder dispatch
// ---------------------------------------------------------------------------

function encodeByType(type, value) {
  switch (type) {
  case 'ClaimRecord':
    return encodeClaimRecord(value);
  case 'PrivateAtomRefV1':
    return encodePrivateAtomRefV1(value);
  case 'OpaqueRefV1':
    return encodeOpaqueRefV1(value);
  default:
    throw new Error(`Unknown type: ${type}`);
  }
}

function decodeByType(type, bytes) {
  switch (type) {
  case 'ClaimRecord':
    return decodeClaimRecord(bytes);
  case 'PrivateAtomRefV1':
    return decodePrivateAtomRefV1(bytes);
  case 'OpaqueRefV1':
    return decodeOpaqueRefV1(bytes);
  default:
    throw new Error(`Unknown type: ${type}`);
  }
}

// ---------------------------------------------------------------------------
// Load vectors
// ---------------------------------------------------------------------------

const vectorFile = JSON.parse(
  readFileSync(join(__dirname, 'golden-vectors', 'privacy-types.json'), 'utf-8')
);

// ---------------------------------------------------------------------------
// Golden vector verification
// ---------------------------------------------------------------------------

describe('privacy type golden vectors', () => {
  for (const vec of vectorFile.vectors) {
    it(`${vec.type}: ${vec.label}`, () => {
      const encoded = encodeByType(vec.type, vec.value);
      const hex = bytesToHex(encoded);
      expect(hex).toBe(vec.raw_le_hex);
    });
  }
});

// ---------------------------------------------------------------------------
// Round-trip encoding: encode -> decode -> compare to original
// ---------------------------------------------------------------------------

describe('privacy type round-trip', () => {
  for (const vec of vectorFile.vectors) {
    it(`${vec.type} round-trip: ${vec.label}`, () => {
      const encoded = encodeByType(vec.type, vec.value);
      const decoded = decodeByType(vec.type, encoded);
      expect(decoded).toEqual(vec.value);
    });
  }

  it('ClaimRecord round-trip from hex: decode then re-encode matches', () => {
    const vec = vectorFile.vectors.find((v) => v.type === 'ClaimRecord' && v.label.includes('optional fields present'));
    const bytes = hexToBytes(vec.raw_le_hex);
    const decoded = decodeClaimRecord(bytes);
    const reEncoded = encodeClaimRecord(decoded);
    expect(bytesToHex(reEncoded)).toBe(vec.raw_le_hex);
  });

  it('PrivateAtomRefV1 round-trip from hex: decode then re-encode matches', () => {
    const vec = vectorFile.vectors.find((v) => v.type === 'PrivateAtomRefV1' && v.label.includes('optionals present'));
    const bytes = hexToBytes(vec.raw_le_hex);
    const decoded = decodePrivateAtomRefV1(bytes);
    const reEncoded = encodePrivateAtomRefV1(decoded);
    expect(bytesToHex(reEncoded)).toBe(vec.raw_le_hex);
  });

  it('OpaqueRefV1 round-trip from hex: decode then re-encode matches', () => {
    const vec = vectorFile.vectors.find((v) => v.type === 'OpaqueRefV1');
    const bytes = hexToBytes(vec.raw_le_hex);
    const decoded = decodeOpaqueRefV1(bytes);
    const reEncoded = encodeOpaqueRefV1(decoded);
    expect(bytesToHex(reEncoded)).toBe(vec.raw_le_hex);
  });
});

// ---------------------------------------------------------------------------
// Rust codegen verification for privacy types
// ---------------------------------------------------------------------------

describe('privacy type Rust codegen', () => {
  let rs;

  // Use the schema from the vector file which includes all three privacy types
  const sdl = vectorFile.schema;

  it('generates encode/decode for ClaimRecord', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('impl ClaimRecord {');
    expect(rs).toContain('pub fn encode_raw_le(&self) -> Vec<u8>');
    expect(rs).toContain('pub fn decode_raw_le(bytes: &[u8]) -> Result<Self, DecodeError>');
  });

  it('generates encode/decode for PrivateAtomRefV1', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('impl PrivateAtomRefV1 {');
    expect(rs).toContain('pub fn encode_raw_le(&self) -> Vec<u8>');
  });

  it('generates encode/decode for OpaqueRefV1', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('impl OpaqueRefV1 {');
    expect(rs).toContain('pub fn encode_raw_le(&self) -> Vec<u8>');
  });

  it('ClaimRecord fields are in alphabetical order', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    // Extract the ClaimRecord impl block
    const implStart = rs.indexOf('impl ClaimRecord {');
    const implBlock = rs.slice(implStart, rs.indexOf('\n}\n', implStart) + 3);

    // Verify alphabetical field order: claim_key < commitment < issuer < policy_hash < private_ref < proof_hash < scheme_id < statement_hash
    const claimKeyIdx = implBlock.indexOf('self.claim_key');
    const commitmentIdx = implBlock.indexOf('self.commitment');
    const issuerIdx = implBlock.indexOf('self.issuer');
    const policyHashIdx = implBlock.indexOf('self.policy_hash');
    const privateRefIdx = implBlock.indexOf('self.private_ref');
    const proofHashIdx = implBlock.indexOf('self.proof_hash');
    const schemeIdIdx = implBlock.indexOf('self.scheme_id');
    const statementHashIdx = implBlock.indexOf('self.statement_hash');

    expect(claimKeyIdx).toBeLessThan(commitmentIdx);
    expect(commitmentIdx).toBeLessThan(issuerIdx);
    expect(issuerIdx).toBeLessThan(policyHashIdx);
    expect(policyHashIdx).toBeLessThan(privateRefIdx);
    expect(privateRefIdx).toBeLessThan(proofHashIdx);
    expect(proofHashIdx).toBeLessThan(schemeIdIdx);
    expect(schemeIdIdx).toBeLessThan(statementHashIdx);
  });

  it('PrivateAtomRefV1 fields are in alphabetical order', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    const implStart = rs.indexOf('impl PrivateAtomRefV1 {');
    const implBlock = rs.slice(implStart, rs.indexOf('\n}\n', implStart) + 3);

    // commit < opaque_ref < policy_hash < statement_hash < zk_evidence
    const commitIdx = implBlock.indexOf('self.commit');
    const opaqueRefIdx = implBlock.indexOf('self.opaque_ref');
    const policyIdx = implBlock.indexOf('self.policy_hash');
    const stmtIdx = implBlock.indexOf('self.statement_hash');
    const zkIdx = implBlock.indexOf('self.zk_evidence');

    expect(commitIdx).toBeLessThan(opaqueRefIdx);
    expect(opaqueRefIdx).toBeLessThan(policyIdx);
    expect(policyIdx).toBeLessThan(stmtIdx);
    expect(stmtIdx).toBeLessThan(zkIdx);
  });

  it('OpaqueRefV1 fields are in alphabetical order', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    const implStart = rs.indexOf('impl OpaqueRefV1 {');
    const implBlock = rs.slice(implStart, rs.indexOf('\n}\n', implStart) + 3);

    // alg_id < commit < locator < policy_hash < vault_id
    const algIdx = implBlock.indexOf('self.alg_id');
    const commitIdx = implBlock.indexOf('self.commit');
    const locatorIdx = implBlock.indexOf('self.locator');
    const policyIdx = implBlock.indexOf('self.policy_hash');
    const vaultIdx = implBlock.indexOf('self.vault_id');

    expect(algIdx).toBeLessThan(commitIdx);
    expect(commitIdx).toBeLessThan(locatorIdx);
    expect(locatorIdx).toBeLessThan(policyIdx);
    expect(policyIdx).toBeLessThan(vaultIdx);
  });

  it('handles optional fields in ClaimRecord with encode_option', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    // private_ref and proof_hash are optional
    expect(rs).toContain('encode_option(&self.private_ref');
    expect(rs).toContain('encode_option(&self.proof_hash');
    // Required fields should NOT use encode_option
    expect(rs).toContain('encode_string(&self.claim_key)');
    expect(rs).toContain('encode_string(&self.commitment)');
  });

  it('handles optional fields in PrivateAtomRefV1 with encode_option', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    // opaque_ref and zk_evidence are optional
    expect(rs).toContain('encode_option(&self.opaque_ref');
    expect(rs).toContain('encode_option(&self.zk_evidence');
    // Required fields should use encode_string directly
    expect(rs).toContain('encode_string(&self.commit)');
    expect(rs).toContain('encode_string(&self.policy_hash)');
  });

  it('OpaqueRefV1 has no optional fields (all required)', async () => {
    const result = await generateEcho({ sdl });
    rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    const implStart = rs.indexOf('impl OpaqueRefV1 {');
    const implBlock = rs.slice(implStart, rs.indexOf('\n}\n', implStart) + 3);

    // All fields are required String!, so no encode_option calls in this impl
    expect(implBlock).not.toContain('encode_option');
    // All use encode_string directly
    expect(implBlock).toContain('encode_string(&self.alg_id)');
    expect(implBlock).toContain('encode_string(&self.commit)');
    expect(implBlock).toContain('encode_string(&self.locator)');
    expect(implBlock).toContain('encode_string(&self.policy_hash)');
    expect(implBlock).toContain('encode_string(&self.vault_id)');
  });
});
