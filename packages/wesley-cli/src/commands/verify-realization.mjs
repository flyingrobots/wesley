import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError } from '@wesley/core';
import {
  inspectRealizationManifest,
  resolveRealizationManifestPath,
  verifyRealizationManifestsInRepo
} from './realization-integrity.mjs';
import { joinPath } from './path-utils.mjs';

export class VerifyRealizationCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'verify-realization',
      'Verify realization manifest sourceHash and artifact signatures'
    );
  }

  configureCommander(cmd) {
    return cmd
      .option('--tracked', 'Verify all tracked or staged realization manifests visible to git')
      .option('-o, --out-dir <dir>', 'Root output directory containing realization/, warp-ttd/, and echo/')
      .option('--manifest <path>', 'Explicit realization manifest path')
      .option('--schema <path>', 'Override authored GraphQL schema path')
      .option('--ttd-dir <dir>', 'Override warp-ttd leg directory')
      .option('--echo-dir <dir>', 'Override echo leg directory')
      .option('--repo-root <dir>', 'Repository root used for --tracked discovery', '.');
  }

  async executeCore({ options, logger }) {
    if (options.tracked) {
      const result = await verifyRealizationManifestsInRepo({
        fs: this.ctx.fs,
        crypto: this.ctx.crypto,
        repoRoot: options.repoRoot
      });

      if (result.status === 'fail') {
        throw new WesleyError(
          'REALIZATION_VERIFICATION_FAILED',
          `Realization verification failed ${result.summary.failed} check(s) across ${result.manifestCount} manifest(s).`
        );
      }

      if (!options.quiet && !options.json) {
        logger?.info?.(`Verified ${result.manifestCount} realization manifest(s).`);
      }
      return result;
    }

    const manifestPath = resolveRealizationManifestPath({
      outDir: options.outDir,
      manifest: options.manifest
    });
    if (manifestPath == null) {
      throw new WesleyError(
        'REALIZATION_VERIFY_TARGET_REQUIRED',
        'Provide --tracked, --out-dir, or --manifest when verifying realization integrity.'
      );
    }

    const outDir = options.outDir == null
      ? null
      : options.outDir;
    const report = await inspectRealizationManifest({
      fs: this.ctx.fs,
      crypto: this.ctx.crypto,
      manifestPath,
      schemaPath: options.schema,
      realizationRoot: outDir == null ? null : joinPath(outDir, 'realization'),
      ttdDir: options.ttdDir ?? (outDir == null ? null : joinPath(outDir, 'warp-ttd')),
      echoDir: options.echoDir ?? (outDir == null ? null : joinPath(outDir, 'echo'))
    });

    if (report == null) {
      throw new WesleyError(
        'REALIZATION_MANIFEST_NOT_FOUND',
        `Realization manifest not found at ${manifestPath}.`
      );
    }

    if (report.status === 'fail') {
      throw new WesleyError(
        'REALIZATION_VERIFICATION_FAILED',
        `Realization verification failed ${report.summary.failed} check(s).`
      );
    }

    if (!options.quiet && !options.json) {
      logger?.info?.(`Realization verification passed (${report.summary.passed}/${report.summary.totalChecks} checks).`);
      logger?.info?.(`Manifest: ${report.manifestPath}`);
    }
    return report;
  }
}
