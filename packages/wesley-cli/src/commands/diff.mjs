/**
 * Diff Command - Compare two GraphQL schema versions (E1.7)
 *
 * Usage: wesley diff <old-schema> <new-schema>
 *
 * Computes a structural delta between two SDL files and reports
 * breaking vs non-breaking changes.  Supports text, json and
 * summary output formats plus CI gate flags.
 */

import { readFileSync } from 'node:fs';
import { computeDelta } from '@wesley/core';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { ExitError } from '../framework/errors.mjs';

// ─── helpers ────────────────────────────────────────────────────────

/**
 * Flatten a SchemaDelta into a uniform list of { breaking, description } entries.
 * @param {import('@wesley/core').SchemaDelta} delta
 * @returns {{ breaking: boolean, description: string }[]}
 */
function flattenChanges(delta) {
  const out = [];

  for (const t of delta.removed_types)  out.push({ breaking: true,  description: `Removed type: ${t.name}` });
  for (const o of delta.removed_ops)    out.push({ breaking: true,  description: `Removed operation: ${o.name}` });

  for (const m of delta.modified_types) {
    for (const fc of m.fieldChanges) {
      out.push({ breaking: fc.breaking, description: fc.description });
    }
    for (const dc of m.directiveChanges) {
      out.push({ breaking: dc.breaking, description: dc.description });
    }
  }

  for (const m of delta.modified_ops) {
    for (const ac of m.argChanges) {
      out.push({ breaking: ac.breaking, description: ac.description });
    }
    if (m.returnTypeChange) {
      out.push({ breaking: true, description: `Operation "${m.name}": ${m.returnTypeChange}` });
    }
  }

  for (const t of delta.added_types) out.push({ breaking: false, description: `Added type: ${t.name}` });
  for (const o of delta.added_ops)   out.push({ breaking: false, description: `Added operation: ${o.name}` });

  return out;
}

/**
 * Format a flat change list as human-readable lines.
 * @param {{ breaking: boolean, description: string }[]} changes
 * @returns {string}
 */
function formatText(changes) {
  if (changes.length === 0) return 'No changes detected.';
  return changes.map((c) => {
    const tag = c.breaking ? 'BREAKING' : 'safe    ';
    return `${tag}  ${c.description}`;
  }).join('\n');
}

/**
 * Single-line CI-friendly summary.
 * @param {{ breaking: boolean }[]} changes
 * @returns {string}
 */
function formatSummary(changes) {
  if (changes.length === 0) return 'No changes detected.';
  const breaking = changes.filter((c) => c.breaking).length;
  const safe = changes.length - breaking;
  const parts = [];
  if (breaking > 0) parts.push(`${breaking} breaking`);
  if (safe > 0)     parts.push(`${safe} safe`);
  return parts.join(', ');
}

// ─── command ────────────────────────────────────────────────────────

export class DiffCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'diff', 'Compare two schema versions and report changes');
    this.requiresSchema = false;
  }

  configureCommander(cmd) {
    return cmd
      .argument('<old-schema>', 'Path to the old/base schema file')
      .argument('<new-schema>', 'Path to the new/target schema file')
      .option('--format <format>', 'Output format: text, json, or summary', 'text')
      .option('--breaking-only', 'Show only breaking changes')
      .option('--exit-code', 'Exit with code 1 if breaking changes exist');
  }

  /**
   * Override execute to handle positional arguments from Commander,
   * which arrive before the options object in the action callback.
   *
   * The base class registerAll wires: action((options, command) => ...)
   * but Commander actually calls: action(arg1, arg2, ..., options, command)
   * so `options` here is really the first positional argument.  We
   * re-register the action ourselves in configureCommander — instead,
   * we override execute to accept any shape and normalize.
   */
  async execute(options = {}, command) {
    // When Commander invokes us via registerAll, `options` is actually
    // the first positional arg (a string) because registerAll does not
    // account for .argument() declarations.  We pull the real values
    // from the Command object instead.
    const cmd = command || options;
    const realOpts = typeof cmd?.opts === 'function' ? cmd.opts() : options;
    const args = typeof cmd?.args !== 'undefined' ? cmd.args : [];

    const oldPath = typeof options === 'string' ? options : args[0];
    const newPath = args[1];

    // Merge parent (global) options that registerAll merges
    const mergedOpts = { ...realOpts };

    try {
      return await this._run(oldPath, newPath, mergedOpts);
    } catch (error) {
      if (error.name === 'ExitError') throw error;

      throw new ExitError(error.exitCode ?? 1, error);
    }
  }

  /** Core logic, separated for testability. */
  async _run(oldPath, newPath, options) {
    // Validate arguments
    if (!oldPath || !newPath) {
      const err = new Error('Two schema file paths are required: wesley diff <old-schema> <new-schema>');
      err.code = 'EUSAGE';
      this.ctx.stderr.write(err.message + '\n');

      throw new ExitError(1, err);
    }

    // Read files
    let oldSDL, newSDL;
    try {
      oldSDL = readFileSync(oldPath, 'utf-8');
    } catch (e) {
      const err = new Error(`Cannot read old schema: ${oldPath}`);
      err.code = 'ENOENT';
      this.ctx.stderr.write(err.message + '\n');

      throw new ExitError(2, err);
    }
    try {
      newSDL = readFileSync(newPath, 'utf-8');
    } catch (e) {
      const err = new Error(`Cannot read new schema: ${newPath}`);
      err.code = 'ENOENT';
      this.ctx.stderr.write(err.message + '\n');

      throw new ExitError(2, err);
    }

    // Compute delta
    const delta = computeDelta(oldSDL, newSDL);

    // Flatten for text/summary formatters
    let changes = flattenChanges(delta);

    // Filter
    if (options.breakingOnly) {
      changes = changes.filter((c) => c.breaking);
    }

    // Format & output
    const format = options.format || 'text';
    let output;

    if (format === 'json') {
      output = JSON.stringify(delta, null, 2);
    } else if (format === 'summary') {
      output = formatSummary(changes);
    } else {
      output = formatText(changes);
    }

    this.ctx.stdout.write(output + '\n');

    // Exit code
    const hasBreaking = changes.some((c) => c.breaking) ||
      delta.removed_types.length > 0 ||
      delta.removed_ops.length > 0 ||
      delta.modified_types.some((m) => m.breaking) ||
      delta.modified_ops.some((m) => m.breaking);

    if (options.exitCode && hasBreaking) {

      throw new ExitError(1);
    }

    return { delta, changes };
  }

  // Not used — execute is overridden
  async executeCore() {
    throw new Error('DiffCommand.execute is overridden; executeCore should not be called');
  }
}

// Also export helpers for testing
export { flattenChanges, formatText, formatSummary };

export default DiffCommand;
