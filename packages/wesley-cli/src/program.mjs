/**
 * Wesley CLI Program
 * Uses Commander with constructor-based registration.
 * Commands auto-register when instantiated via directory discovery.
 */

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { WesleyCommand } from './framework/WesleyCommand.mjs';
import { discoverAndRegisterWesleyCliModules } from './framework/module-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(__dirname, 'commands');

const LEGACY_COMMAND_REPLACEMENTS = new Map([
  ['diff', 'wesley schema diff --old <old.graphql> --new <new.graphql>'],
  ['doctor', 'wesley doctor'],
  ['generate', 'wesley emit rust|typescript --schema <path> --out <path>'],
  ['typescript', 'wesley emit typescript --schema <path> --out <path>'],
  ['ts', 'wesley emit typescript --schema <path> --out <path>']
]);

/**
 * Auto-discover and instantiate all WesleyCommand subclasses from the
 * commands/ directory. Files prefixed with `_` are private helpers;
 * `index.mjs` is a re-export barrel — both are skipped.
 */
async function discoverCommands(ctx) {
  const files = readdirSync(commandsDir).filter(
    (f) => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'index.mjs'
  );

  for (const file of files) {
    const mod = await import(join(commandsDir, file));
    for (const exported of Object.values(mod)) {
      if (typeof exported === 'function' && exported.prototype instanceof WesleyCommand) {
        new exported(ctx);
      }
    }
  }
}

function bindWrite(target) {
  return typeof target?.write === 'function' ? target.write.bind(target) : null;
}

function resolveOutputWriters(ctx = {}) {
  const writeOut =
    bindWrite(ctx.process?.stdout) ??
    bindWrite(ctx.stdout) ??
    process.stdout.write.bind(process.stdout);
  const writeErr =
    bindWrite(ctx.process?.stderr) ??
    bindWrite(ctx.stderr) ??
    process.stderr.write.bind(process.stderr);
  return { writeOut, writeErr };
}

function shouldSuppressLegacyWarning(argv, env = {}) {
  if (env.WESLEY_LEGACY_WARNINGS === '0') return true;
  return argv.some((arg) =>
    ['--help', '-h', '--json', '--quiet', '-q', '--version', '-V'].includes(arg)
  );
}

function firstCommandToken(argv) {
  for (const arg of argv.slice(2)) {
    if (arg === '--') continue;
    if (arg.startsWith('-')) continue;
    return arg;
  }
  return null;
}

function emitLegacyCommandWarning(argv, ctx, writeErr) {
  if (shouldSuppressLegacyWarning(argv, ctx?.env ?? process.env)) return;
  const command = firstCommandToken(argv);
  const replacement = LEGACY_COMMAND_REPLACEMENTS.get(command);
  if (!replacement) return;
  writeErr(
    `Warning: legacy Node command \`${command}\` is compatibility-only. Prefer native \`${replacement}\` where it covers the needed output.\n`
  );
}

export async function program(argv, ctx) {
  return WesleyCommand.withRegistry(WesleyCommand.createRegistry(), async (commandRegistry) => {
    // Auto-discover and register all commands
    await discoverCommands(ctx);
    await discoverAndRegisterWesleyCliModules({
      ctx,
      cwd: ctx?.cwd ?? process.cwd(),
      env: ctx?.env ?? process.env
    });
    const { writeOut, writeErr } = resolveOutputWriters(ctx);

    // Create main program
    const program = new Command()
      .name('wesley')
      .version('0.1.0')
      .description('Wesley - GraphQL → Everything\n"Make it so, schema."')
      .option('-v, --verbose', 'Verbose output')
      .option('--debug', 'Debug mode with stack traces')
      .option('-q, --quiet', 'Suppress all output')
      .option('--json', 'Output JSON')
      .configureOutput({
        writeOut,
        writeErr,
        outputError: (message, write) => write(message)
      })
      .exitOverride();

    // Register all commands from this invocation's registry
    WesleyCommand.registerAll(program, commandRegistry);
    emitLegacyCommandWarning(argv, ctx, writeErr);

    // Parse and execute
    try {
      await program.parseAsync(argv, { from: 'node' });
      return 0;
    } catch (error) {
      // Allow commands to throw ExitError to control exit code
      if (error && error.name === 'ExitError') {
        return error.exitCode ?? 1;
      }
      if (error?.code?.startsWith?.('commander.')) {
        return error.exitCode ?? 1;
      }
      // Commander-level errors or unexpected issues
      if (!program.opts().quiet) {
        writeErr(`${error?.stack || error?.message || String(error)}\n`);
      }
      return 1;
    }
  });
}
