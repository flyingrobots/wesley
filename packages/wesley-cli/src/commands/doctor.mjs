/**
 * Doctor Command - Diagnose Wesley installation health
 *
 * Checks:
 *  1. Node.js version >= 18.17
 *  2. wesley.config.mjs present and parseable
 *  3. Declared generator packages resolve
 *  4. Resolved plugins export valid GeneratorPlugin with supported apiVersion
 *  5. SHA-256 hashing available
 *  6. Experimental flags listed with current values
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import {
  checkNodeVersion,
  checkConfig,
  checkPlugins,
  checkHash,
  checkExperimental,
  formatText,
  formatJson,
} from './doctor-checks.mjs';

export class DoctorCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'doctor', 'Diagnose Wesley installation health');
    this.requiresSchema = false;
  }

  configureCommander(cmd) {
    return cmd.option('--format <format>', 'Output format: text or json', 'text');
  }

  /**
   * Override execute to control output and exit code directly.
   * Doctor handles its own output formatting — we skip the base class
   * error/JSON wrappers.
   */
  async execute(options = {}) {
    const results = [];

    results.push(checkNodeVersion(process.version));
    results.push(await checkConfig(this.ctx));
    results.push(...await checkPlugins(this.ctx));
    results.push(checkHash(this.ctx));
    results.push(checkExperimental(this.ctx));

    const format = options.format || 'text';
    const output = format === 'json' ? formatJson(results) : formatText(results);
    this.ctx.stdout.write(output + '\n');

    const hasFail = results.some((r) => r.status === 'fail');
    if (hasFail) {
      const { ExitError } = await import('../framework/errors.mjs');
      throw new ExitError(1);
    }

    return { results };
  }

  // Not used — execute is overridden — but required by the base class contract
  async executeCore() {
    throw new Error('DoctorCommand.execute is overridden; executeCore should not be called');
  }
}

export default DoctorCommand;
