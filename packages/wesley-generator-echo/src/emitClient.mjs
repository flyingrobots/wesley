export function emitClient(ir) {
  const lines = [];
  lines.push('// AUTO-GENERATED. DO NOT EDIT.');
  lines.push(`export interface RegistryInfo { schema_sha256: string; codec_id: string; registry_version: number; }`);
  lines.push(`export interface EchoWasm {
  encode_command(op_id: number, payload: Uint8Array): Uint8Array;
  encode_query_vars(query_id: number, payload: Uint8Array): Uint8Array;
  execute_query(query_id: number, vars_bytes: Uint8Array): Uint8Array;
  get_registry_info(): Uint8Array;
}`);
  lines.push(`export class WesleyClient {
  constructor(private wasm: EchoWasm, private registry: RegistryInfo) {}
  verifyRegistry(info: RegistryInfo) {
    if (info.schema_sha256 !== this.registry.schema_sha256) throw new Error('Schema hash mismatch');
    if (info.codec_id !== this.registry.codec_id) throw new Error('Codec mismatch');
    if (info.registry_version !== this.registry.registry_version) throw new Error('Registry version mismatch');
  }
}`);
  return lines.join('\\n');
}
