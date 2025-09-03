import { readFileSync } from 'node:fs';

export function readStdinUtf8() {
  return readFileSync(0, 'utf8');
}

export function formatError(err, options = {}) {
  const code = err?.code || 'ERROR';
  const msg = err?.message || String(err);
  const showStack =
    options.debug ||
    options.verbose ||
    process.env.DEBUG === '1' ||
    process.env.WESLEY_DEBUG === '1' ||
    (Array.isArray(process.argv) && process.argv.includes('--debug'));
  let out = `\n💥 ${code}: ${msg}`;
  if (showStack && err?.stack) out += `\n${err.stack}`;
  return out;
}

export function exitCodeFor(err) {
  switch (err?.code) {
    case 'PARSE_FAILED': return 3;
    case 'GENERATION_FAILED': return 4;
    case 'DIFF_FAILED': return 5;
    case 'PIPELINE_EXEC_FAILED': return 6;
    case 'EEMPTYSCHEMA': return 2;
    case 'ENOENT': return 2;
    default: return 1;
  }
}

export function resolveLevel(opts = {}) {
  if (opts.quiet) return 'silent';
  if (opts.logLevel) return opts.logLevel;
  if (opts.verbose) return 'debug';
  return process.env.WESLEY_LOG_LEVEL || 'info';
}

