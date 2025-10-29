/**
 * Cert Create - Assemble SHIPME.md certificate from evidence/realm
 */
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class CertCreateCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'cert-create', 'Create SHIPME.md certificate');
  }

  configureCommander(cmd) {
    return cmd
      .option('--env <name>', 'Target environment', 'production')
      .option('--out <file>', 'Output file', '.wesley/SHIPME.md')
      .option('--json', 'Emit JSON to stdout (no file)');
  }

  async executeCore({ options, logger }) {
    const env = options.env || 'production';
    const now = new Date().toISOString();
    const sha = await gitSha(this.ctx) || 'uncommitted';

    const scores = await readJsonSafe(this.ctx, '.wesley/scores.json');
    const realm = await readJsonSafe(this.ctx, '.wesley/realm.json');

    const artifacts = await hashArtifacts(this.ctx, this.ctx?.config?.paths?.output || 'out');

    const cert = {
      version: '1.0.0',
      sha,
      environment: env,
      timestamp: now,
      scores: scores?.scores || null,
      realm: realm || null,
      artifacts,
      signatures: []
    };

    if (options.json) {
      this.ctx.stdout.write(JSON.stringify(cert, null, 2) + '\n');
      return { ok: true, sha };
    }

    const content = renderSHIPME(cert);
    await this.ctx.fs.write(options.out, content);
    if (!options.quiet) logger.info(`✍️  Wrote ${options.out}`);
    return { ok: true, file: options.out };
  }
}

function renderSHIPME(cert) {
  const human = [
    '# SHIPME Certificate',
    '',
    `- Commit: ${cert.sha}`,
    `- Environment: ${cert.environment}`,
    `- Timestamp: ${cert.timestamp}`,
    cert.realm ? `- REALM: ${cert.realm.verdict} (${cert.realm.duration_ms}ms)` : '- REALM: n/a',
    cert.scores ? `- Scores: SCS=${fmt(cert.scores.scs)} MRI=${fmt(cert.scores.mri)} TCI=${fmt(cert.scores.tci)}` : '- Scores: n/a',
    '',
    '<!-- WESLEY_CERT:BEGIN -->',
    '```json',
    JSON.stringify(cert, null, 2),
    '```',
    '<!-- WESLEY_CERT:END -->',
    ''
  ].join('\n');
  return human;
}

function fmt(v){ if (v==null) return 'n/a'; return typeof v==='number' ? Number(v).toFixed(2) : String(v); }

async function gitSha(ctx) {
  try {
    const execSync = this.ctx.shell.execSync;
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return ctx.env?.GITHUB_SHA || null;
  }
}

async function readJsonSafe(ctx, path) {
  try { const s = await ctx.fs.read(path); return JSON.parse(s); } catch { return null; }
}

async function hashArtifacts(ctx, outDir) {
  const crypto = await import('node:crypto');
  const fs = ctx.fs;
  const res = {};
  for (const f of ['schema.sql']) {
    try {
      const p = `${outDir}/${f}`;
      const buf = await fs.read(p);
      const h = crypto.createHash('sha256').update(buf).digest('hex');
      res[f] = { sha256: h };
    } catch {}
  }
  return res;
}

export default CertCreateCommand;
