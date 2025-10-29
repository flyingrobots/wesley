/**
 * Init Command - Scaffold a minimal Wesley project
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class InitCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'init', 'Initialize a minimal Wesley project');
    this.requiresSchema = false;
  }

  configureCommander(cmd) {
    return cmd
      .option('--schema <path>', 'Schema filepath to create', 'schema.graphql')
      .option('--force', 'Overwrite existing files if present')
      .option('--gitignore', 'Add .gitignore entries for out/ and .wesley/', true);
  }

  async executeCore({ options, logger }) {
    const fs = this.ctx.fs;
    const schemaPath = options.schema || 'schema.graphql';

    const exists = await fs.exists(schemaPath).catch(() => false);
    if (exists && !options.force) {
      const e = new Error(`Schema already exists: ${schemaPath}. Use --force to overwrite.`);
      e.code = 'EEXIST';
      throw e;
    }

    // Minimal canonical schema (v1 baseline)
    const schema = `# Wesley minimal schema (v1 baseline)\n\n` +
      `type User @wes_table {\n` +
      `  id: ID! @wes_pk\n` +
      `  email: String! @wes_unique\n` +
      `}\n`;

    await fs.write(schemaPath, schema);

    // Optional .gitignore entries
    if (options.gitignore) {
      try {
        const giPath = '.gitignore';
        let content = '';
        if (await fs.exists(giPath)) content = await fs.read(giPath);
        const needed = ['out/', '.wesley/'];
        let changed = false;
        for (const entry of needed) {
          if (!content.split('\n').some((l) => l.trim() === entry)) {
            content += (content.endsWith('\n') || content === '' ? '' : '\n') + entry + '\n';
            changed = true;
          }
        }
        if (changed) await fs.write(giPath, content);
      } catch {}
    }

    if (logger) logger.info(`✨ Initialized Wesley project. Schema: ${schemaPath}`);
    return { ok: true, schemaPath };
  }
}

export default InitCommand;

