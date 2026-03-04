/**
 * Cert Verify - Validate SHIPME signatures and realm verdict
 */
import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { extractJsonBlock, canonicalize } from './_cert-utils.mjs';
import { createAjv, loadSchemaFile } from '../framework/schemaValidator.mjs';

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
      loadSchemaFile(this.ctx, 'shipme.schema.json'),
    ]);
    ajv.addSchema(JSON.parse(realmSchema));
    const validate = ajv.compile(JSON.parse(shipmeSchema));
    const schemaOk = validate(json);
    if (!schemaOk) {
      const e = new Error('Certificate JSON failed schema validation');
      e.code = 'VALIDATION_FAILED';
      e.meta = validate.errors;
      throw e;
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
      const e = new Error('Certificate verification failed'); e.code = 'CERT_INVALID'; throw e;
    }
    return result;
  }
}

async function verifySig(fs, pubPath, data, b64sig) {
  const { createPublicKey, verify } = await import('node:crypto');
  try {
    const pem = await fs.read(pubPath);
    const key = createPublicKey(pem);
    const ok = verify(null, Buffer.from(data), key, Buffer.from(b64sig, 'base64'));
    return !!ok;
  } catch {
    return false;
  }
}

export default CertVerifyCommand;
