/**
 * Cert Verify - Validate SHIPME signatures and realm verdict
 */
import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { extractJsonBlock, canonicalize } from './_cert-utils.mjs';
import { createAjv, loadSchemaFile } from '../framework/schemaValidator.mjs';
import { WesleyError } from '@wesley/core';

export class CertVerifyCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'cert-verify', 'Verify SHIPME.md certificate');
  }

  configureCommander(cmd) {
    return cmd
      .option('--in <file>', 'Certificate file', '.wesley/SHIPME.md')
      .option('--pub <path...>', 'Public key(s) for verification')
      .option('--json', 'Emit JSON results');
  }

  async executeCore({ options }) {
    const md = await this.ctx.fs.read(options.in);
    const { json } = extractJsonBlock(md);
    // Validate SHIPME certificate schema first (drift guard)
    const ajv = await createAjv();
    const [realmSchema, shipmeSchema] = await Promise.all([
      loadSchemaFile(this.ctx, 'realm.schema.json'),
      loadSchemaFile(this.ctx, 'shipme.schema.json')
    ]);
    ajv.addSchema(JSON.parse(realmSchema));
    const validate = ajv.compile(JSON.parse(shipmeSchema));
    const schemaOk = validate(json);
    if (!schemaOk) {
      throw new WesleyError('VALIDATION_FAILED', 'Certificate JSON failed schema validation', { errors: validate.errors });
    }
    const canonical = canonicalize({ ...json, signatures: [] });
    const pubs = options.pub || [];
    let validCount = 0;
    for (const sig of json.signatures || []) {
      for (const p of pubs) {
        const ok = await verifySig(this.ctx.fs, p, canonical, sig.signature);
        if (ok) { validCount++; break; }
      }
    }
    const okRealm = json?.realm?.verdict === 'PASS';
    const ok = validCount > 0 && okRealm;
    const badge = `[REALM] ${okRealm ? 'PASS' : 'FAIL'} — sha ${json.sha?.slice(0,7) || 'unknown'}`;
    const result = { ok, validSignatures: validCount, badge };
    if (options.json) this.ctx.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else this.ctx.stdout.write(badge + '\n');
    if (!ok) {
      throw new WesleyError('CERT_INVALID', 'Certificate verification failed');
    }
    return options.json ? undefined : result;
  }
}

async function verifySig(fs, pubPath, data, b64sig) {
  const { createPublicKey, verify } = await import('node:crypto');
  try {
    const pem = await fs.read(pubPath);
    const key = createPublicKey(pem);
    const ok = verify(null, Buffer.from(data), key, Buffer.from(b64sig, 'base64'));
    return !!ok;
  } catch (err) {
    // Crypto verification mismatch returns false; infrastructure errors propagate
    if (err?.code === 'ERR_CRYPTO_SIGN_MISMATCH' || err?.message?.includes?.('Signature')) return false;
    throw err;
  }
}

