/**
 * Cert Sign - Append signature to SHIPME cert JSON block
 */
import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { extractJsonBlock, canonicalize } from './_cert-utils.mjs';
import { WesleyError } from '@wesley/core';

export class CertSignCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'cert-sign', 'Sign SHIPME.md certificate');
  }

  configureCommander(cmd) {
    return cmd
      .option('--in <file>', 'Certificate file', '.wesley/SHIPME.md')
      .option('--key <path>', 'Private key (PEM)')
      .option('--signer <name>', 'Signer label', 'HOLMES');
  }

  async executeCore({ options, logger }) {
    if (!options.key) {
      throw new WesleyError('EARGS', 'Missing --key');
    }
    const md = await this.ctx.fs.read(options.in);
    const { pre, json, post } = extractJsonBlock(md);
    const canonical = canonicalize({ ...json, signatures: [] });
    const { createPrivateKey, createPublicKey, sign, createHash } = await import('node:crypto');
    const pem = await this.ctx.fs.read(options.key);
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new WesleyError('EARGS', `Unsupported key type: ${key.asymmetricKeyType} (expected ed25519)`);
    }
    const sig = sign(null, new TextEncoder().encode(canonical), key).toString('base64');
    // Derive a deterministic keyId from the public key (SPKI DER → SHA-256 hex)
    const pub = createPublicKey(key);
    const pubDer = pub.export({ type: 'spki', format: 'der' });
    const keyId = createHash('sha256').update(pubDer).digest('hex');
    const signature = {
      signer: options.signer || 'HOLMES',
      createdAt: new Date().toISOString(),
      alg: 'ed25519',
      keyId,
      signature: sig
    };
    json.signatures = json.signatures || [];
    json.signatures.push(signature);
    const out = pre + JSON.stringify(json, null, 2) + post;
    await this.ctx.fs.write(options.in, out);
    if (!options.json) logger.info(`✍️  Signed ${options.in} as ${signature.signer}`);
    return { ok: true };
  }
}

export default CertSignCommand;
