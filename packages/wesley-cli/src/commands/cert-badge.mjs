import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class CertBadgeCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'cert-badge', 'Print SHIPME.md badge line');
  }
  configureCommander(cmd){ return cmd.option('--in <file>', 'Certificate file', 'SHIPME.md'); }
  async executeCore({ options }){
    const md = await this.ctx.fs.read(options.in);
    const { json } = extractJsonBlock(md);
    const okRealm = json?.realm?.verdict === 'PASS';
    const badge = `[REALM] ${okRealm ? 'PASS' : 'FAIL'} — sha ${json.sha?.slice(0,7) || 'unknown'}`;
    this.ctx.stdout.write(badge + '\n');
    return { badge };
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

export default CertBadgeCommand;

