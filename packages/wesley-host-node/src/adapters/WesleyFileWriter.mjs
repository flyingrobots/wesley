/**
 * Wesley File Writer - Node.js adapter for writing generation results
 * Thin platform layer that writes bundle to disk
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export class WesleyFileWriter {
  constructor(options = {}) {
    this.dirs = {
      output: options.outputDir || 'out',
      wesley: options.wesleyDir || '.wesley',
      migrations: options.migrationsDir || 'db/migrations',
      tests: options.testsDir || 'tests'
    };
  }

  /**
   * Write complete generation bundle to disk
   */
  async writeBundle(bundle) {
    this.ensureDirectories();
    
    // Handle the actual structure returned by InProcessCompiler
    const artifacts = bundle.artifacts || {};
    // Write artifacts
    if (artifacts.sql) {
      writeFileSync(
        join(this.dirs.output, 'schema.sql'),
        artifacts.sql
      );
    }
    
    if (artifacts.typescript) {
      writeFileSync(
        join(this.dirs.output, 'types.ts'),
        artifacts.typescript
      );
    }
    
    if (artifacts.tests) {
      writeFileSync(
        join(this.dirs.tests, 'generated.sql'),
        artifacts.tests
      );
    }
    
    if (artifacts.migration?.sql) {
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      writeFileSync(
        join(this.dirs.migrations, `${timestamp}_auto.sql`),
        artifacts.migration.sql
      );
    }
    
    // Write Wesley bundle files - handle correct bundle structure
    writeFileSync(
      join(this.dirs.wesley, 'evidence-map.json'),
      JSON.stringify(bundle.evidence || [], null, 2)
    );
    
    writeFileSync(
      join(this.dirs.wesley, 'scores.json'),
      JSON.stringify(bundle.scores || {}, null, 2)
    );
    
    writeFileSync(
      join(this.dirs.wesley, 'bundle.json'),
      JSON.stringify(bundle, null, 2)
    );
    
    // Update snapshot for next diff - use artifacts for the snapshot
    writeFileSync(
      join(this.dirs.wesley, 'snapshot.json'),
      JSON.stringify({ artifacts: bundle.artifacts, meta: bundle.meta }, null, 2)
    );
    
    // Update history
    this.updateHistory(bundle.scores);
    
    return {
      files: {
        sql: join(this.dirs.output, 'schema.sql'),
        typescript: join(this.dirs.output, 'types.ts'),
        tests: join(this.dirs.tests, 'generated.sql'),
        bundle: join(this.dirs.wesley, 'bundle.json')
      }
    };
  }

  /**
   * Update history for predictions
   */
  updateHistory(scores) {
    const historyPath = join(this.dirs.wesley, 'history.json');
    let history = { points: [] };
    
    if (existsSync(historyPath)) {
      try {
        history = JSON.parse(readFileSync(historyPath, 'utf8'));
      } catch {
        // Start fresh if corrupt
      }
    }
    
    history.points.push({
      timestamp: new Date().toISOString(),
      sha: scores.commit || this.getCurrentSHA(),
      scs: scores.scores.scs,
      mri: scores.scores.mri,
      tci: scores.scores.tci,
      day: Math.floor(Date.now() / (1000 * 60 * 60 * 24))
    });
    
    // Keep last 60 points
    if (history.points.length > 60) {
      history.points = history.points.slice(-60);
    }
    
    writeFileSync(historyPath, JSON.stringify(history, null, 2));
  }

  /**
   * Get current git SHA (platform-specific)
   */
  getCurrentSHA() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'uncommitted';
    }
  }

  /**
   * Ensure all directories exist
   */
  ensureDirectories() {
    for (const dir of Object.values(this.dirs)) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }
}