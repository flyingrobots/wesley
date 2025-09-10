/**
 * Cert Verify - Validate SHIPME signatures and realm verdict
 */
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

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
    const canonical = canonicalize({ ...json, signatures: [] });
    const pubs = options.pub || [];
    let validCount = 0;
    for (const sig of json.signatures || []) {
      for (const p of pubs) {
        const ok = await verifySig(p, canonical, sig.signature);
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

function extractJsonBlock(md) {
  const begin = md.indexOf('<!-- WESLEY_CERT:BEGIN -->');
  const fence = md.indexOf('```json', begin);
  const fenceEnd = md.indexOf('```', fence + 1);
  const end = md.indexOf('<!-- WESLEY_CERT:END -->', fenceEnd);
  if (begin === -1 || fence === -1 || fenceEnd === -1 || end === -1) throw new Error('Invalid SHIPME.md format');
  const jsonStr = md.slice(fence + 7, fenceEnd).trim();
  const json = JSON.parse(jsonStr);
  return { json };
}

function canonicalize(obj) {
  const sort = (x) => Array.isArray(x) ? x.map(sort) : (x && typeof x==='object') ? Object.keys(x).sort().reduce((a,k)=>{a[k]=sort(x[k]);return a;},{}) : x;
  return JSON.stringify(sort(obj));
}

async function verifySig(pubPath, data, b64sig) {
  const { readFile } = await import('node:fs/promises');
  const { createPublicKey, verify } = await import('node:crypto');
  try {
    const pem = await readFile(pubPath);
    const key = createPublicKey(pem);
    const ok = verify(null, Buffer.from(data), key, Buffer.from(b64sig, 'base64'));
    return !!ok;
  } catch {
    return false;
  }
}

export default CertVerifyCommand;
