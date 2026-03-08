// Remove Node.js coupling - delegate to host adapter
export function readStdinUtf8() {
  // This will be injected by the command context
  throw new Error('readStdinUtf8 must be provided by host adapter');
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

import { exitCodeFor as coreExitCodeFor } from '@wesley/core/domain/ExitCodes';

export function exitCodeFor(err) {
  return coreExitCodeFor(err?.code);
}

export function resolveLevel(opts = {}) {
  if (opts.quiet) return 'silent';
  if (opts.logLevel) return opts.logLevel;
  if (opts.verbose) return 'debug';
  return process.env.WESLEY_LOG_LEVEL || 'info';
}

