/**
 * Cert Sign - Append signature to SHIPME cert JSON block
 */
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

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
      const e = new Error('Missing --key'); e.code = 'EARGS'; throw e;
    }
    const md = await this.ctx.fs.read(options.in);
    const { pre, json, post } = extractJsonBlock(md);
    const canonical = canonicalize(json);
    const { createPrivateKey, sign } = await import('node:crypto');
    const pem = await this.ctx.fs.readFile(options.key);
    const key = createPrivateKey(pem);
    const sig = sign(null, Buffer.from(canonical), key).toString('base64');
    const signature = {
      signer: options.signer || 'HOLMES',
      createdAt: new Date().toISOString(),
      alg: 'ed25519',
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

function extractJsonBlock(md) {
  const begin = md.indexOf('<!-- WESLEY_CERT:BEGIN -->');
  const fence = md.indexOf('```json', begin);
  const fenceEnd = md.indexOf('```', fence + 1);
  const end = md.indexOf('<!-- WESLEY_CERT:END -->', fenceEnd);
  if (begin === -1 || fence === -1 || fenceEnd === -1 || end === -1) throw new Error('Invalid SHIPME.md format');
  const pre = md.slice(0, fence + 7) + '\n';
  const jsonStr = md.slice(fence + 7, fenceEnd).trim();
  const post = '\n```\n' + md.slice(end);
  const json = JSON.parse(jsonStr);
  return { pre, json, post };
}

function canonicalize(obj) {
  const sort = (x) => {
    if (Array.isArray(x)) return x.map(sort);
    if (x && typeof x === 'object') {
      return Object.keys(x).sort().reduce((acc,k)=>{ acc[k]=sort(x[k]); return acc; },{});
    }
    return x;
  };
  return JSON.stringify(sort(obj));
}

// (Signing logic moved into executeCore to use injected filesystem)

export default CertSignCommand;
