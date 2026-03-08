export function emitOps(ir) {
  const lines = [];
  lines.push('// AUTO-GENERATED. DO NOT EDIT.');
  lines.push(`export const CONTRACT_VERSION = "${ir.contract_version || '1.1.0'}";`);
  lines.push(`export const SCHEMA_SHA256 = "${ir.schema_sha256 || ''}";`);
  lines.push(`export const REGISTRY_VERSION = ${ir.registry_version ?? 1};`);
  lines.push(`export const CODEC_ID = "${ir.codec_id || 'cbor-canon-v1'}";`);
  lines.push('export const OPS = [');
  for (const op of ir.ops ?? []) {
    lines.push(`  { kind: "${op.kind}", name: "${op.name}", op_id: ${op.op_id}, result_type: "${op.result_type}", args: ${JSON.stringify(op.args ?? [])} },`);
  }
  lines.push('];');
  lines.push(`export const findOpId = (kind, name) => { const op = OPS.find(o => o.kind === kind && o.name === name); if (!op) throw new Error(\`Unknown op: ${'${'}kind${'}'}:${'${'}name${'}'}\`); return op.op_id; };`);
  return lines.join('\n');
}
