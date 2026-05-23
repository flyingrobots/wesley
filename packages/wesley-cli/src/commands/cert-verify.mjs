/**
 * Cert Verify - Validate SHIPME signatures and realm verdict
 */
import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import {
  extractJsonBlock,
  canonicalize,
  buildCertBadge,
  evaluateCertificatePolicy
} from './_cert-utils.mjs';
import { createAjv, compileSchema } from '../framework/schemaValidator.mjs';
import { GENERATED_SHIPME_PATH, WesleyError } from '@wesley/core';

export class CertVerifyCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'cert-verify', 'Verify SHIPME.md certificate');
  }

  configureCommander(cmd) {
    return cmd
      .option('--in <file>', 'Certificate file', GENERATED_SHIPME_PATH)
      .option('--pub <path...>', 'Public key(s) for verification')
      .option('--json', 'Emit JSON results');
  }

  async executeCore({ options }) {
    const md = await this.ctx.fs.read(options.in);
    const { json } = extractJsonBlock(md);
    // Validate SHIPME certificate schema first (drift guard)
    const ajv = await createAjv();
    const { validate } = await compileSchema(this.ctx, 'shipme.schema.json', ajv);
    const schemaOk = validate(json);
    if (!schemaOk) {
      throw new WesleyError('VALIDATION_FAILED', 'Certificate JSON failed schema validation', {
        errors: validate.errors
      });
    }
    const canonical = canonicalize({ ...json, signatures: [] });
    const pubs = options.pub || [];
    let validCount = 0;
    for (const sig of json.signatures || []) {
      for (const p of pubs) {
        const ok = await verifySig(this.ctx.fs, p, canonical, sig.signature);
        if (ok) {
          validCount++;
          break;
        }
      }
    }
    const policy = evaluateCertificatePolicy(json);
    const ok = validCount > 0 && policy.eligibleToShip;
    const badge = buildCertBadge(json);
    const result = {
      ok,
      validSignatures: validCount,
      badge,
      realmVerdict: json?.realm?.verdict || null,
      counterfactualGate: json?.counterfactual?.gate || null,
      holmesVerdict: policy.holmesVerdict,
      holmesPassed: policy.okHolmes,
      eligibleToShip: policy.eligibleToShip,
      reasons: policy.reasons,
      holmes: json?.holmes || null,
      evidence: json?.evidence || null
    };
    if (options.json) this.ctx.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else this.ctx.stdout.write(badge + '\n');
    if (!ok) {
      throw new WesleyError('CERT_INVALID', 'Certificate verification failed');
    }
    // In JSON mode we already wrote to stdout above; return null to
    // prevent WesleyCommand.execute() from emitting a duplicate wrapper.
    return options.json ? null : result;
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
    if (err?.code === 'ERR_CRYPTO_SIGN_MISMATCH' || err?.message?.includes?.('Signature'))
      return false;
    throw err;
  }
}
