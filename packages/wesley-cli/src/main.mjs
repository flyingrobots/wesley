/**
 * Legacy CLI main entry.
 *
 * This surface remains exported for compatibility, but it now delegates to the
 * same discovered-command program used by the real host entrypoint so command
 * availability cannot drift between the two paths.
 */

import { program as runProgram } from './program.mjs';

export async function main(argv, adapters) {
  return runProgram(argv, adapters);
}
