import { Command } from 'commander';
import { initWarpspace } from './warpspace/init.mjs';

function bindWrite(target) {
  return typeof target?.write === 'function'
    ? target.write.bind(target)
    : null;
}

function resolveOutputWriters(ctx = {}) {
  const writeOut = bindWrite(ctx.process?.stdout) ?? bindWrite(ctx.stdout) ?? process.stdout.write.bind(process.stdout);
  const writeErr = bindWrite(ctx.process?.stderr) ?? bindWrite(ctx.stderr) ?? process.stderr.write.bind(process.stderr);
  return { writeOut, writeErr };
}

export async function program(argv, ctx) {
  const { writeOut, writeErr } = resolveOutputWriters(ctx);
  const cli = new Command()
    .name('warpspace')
    .version('0.1.0')
    .description('warpspace - Bootstrap a Continuum consumer workspace')
    .option('--json', 'Output JSON')
    .option('-q, --quiet', 'Suppress non-error text output')
    .configureOutput({
      writeOut,
      writeErr,
      outputError: (message, write) => write(message)
    })
    .exitOverride();

  cli.command('init <projectDir>')
    .description('Initialize a WARPspace from a Continuum stack release manifest')
    .requiredOption('--manifest <path>', 'Path to continuum-stack-release.json')
    .option('--authority-root <path>', 'Override the authored-home repository root')
    .option('--skip-generate', 'Write the WARPspace and materialize families without running generators')
    .option('--force', 'Initialize into a non-empty directory')
    .action(async (projectDir, options) => {
      const globalOpts = cli.opts();
      const mergedOptions = { ...globalOpts, ...options };
      const result = await initWarpspace({
        ctx,
        manifestPath: mergedOptions.manifest,
        projectDir,
        authorityRoot: mergedOptions.authorityRoot ?? null,
        force: Boolean(mergedOptions.force),
        generate: !mergedOptions.skipGenerate
      });

      if (mergedOptions.json) {
        writeOut(JSON.stringify({
          success: true,
          result,
          timestamp: new Date().toISOString()
        }, null, 2) + '\n');
        return;
      }

      if (!mergedOptions.quiet) {
        writeOut(`Initialized WARPspace: ${result.projectDir}\n`);
        writeOut(`Release: ${result.releaseId}\n`);
        writeOut(`Manifest: ${result.manifestPath}\n`);
        writeOut(`Materialized families: ${result.materializedFamilies.map(f => f.id).join(', ')}\n`);
        if (result.generated) {
          writeOut(`Generated commands: ${result.generatedCommands.length}\n`);
        } else {
          writeOut('Generation skipped.\n');
        }
      }
    });

  try {
    await cli.parseAsync(argv, { from: 'node' });
    return 0;
  } catch (error) {
    if (error?.code?.startsWith?.('commander.')) {
      return error.exitCode ?? 1;
    }

    if (!cli.opts().quiet) {
      writeErr(`${error?.stack || error?.message || String(error)}\n`);
    }
    return 1;
  }
}
