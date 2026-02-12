import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class QirValidateCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'qir', 'QIR utilities');
  }

  configureCommander(cmd) {
    const root = cmd
      .command('validate')
      .description('Validate a QIR JSON file against schemas/qir.schema.json')
      .argument('<file>', 'Path to QIR JSON file')
      .option('--json', 'Emit JSON output')
      .action(async (file, options) => {
        return this.execute({ ...options, file });
      });
    // Envelope validation
    cmd
      .command('envelope-validate')
      .description('Validate an IR envelope JSON against schemas (Schema IR + QIR plans)')
      .argument('<file>', 'Path to IR envelope JSON file')
      .option('--json', 'Emit JSON output')
      .action(async (file, options) => {
        return this.execute({ ...options, file, envelope: true });
      });

    // Ops manifest validation
    cmd
      .command('manifest-validate')
      .description('Validate an ops manifest JSON against schemas/ops-manifest.schema.json')
      .argument('<file>', 'Path to ops manifest JSON')
      .option('--json', 'Emit JSON output')
      .action(async (file, options) => {
        return this.execute({ ...options, file, manifest: true });
      });

    // Ops registry validation
    cmd
      .command('registry-validate')
      .description('Validate an ops registry JSON against schemas/ops-registry.schema.json')
      .argument('<file>', 'Path to ops registry JSON')
      .option('--json', 'Emit JSON output')
      .action(async (file, options) => {
        return this.execute({ ...options, file, registry: true });
      });
    return root;
  }

  async executeCore(context) {
    const { fs, logger } = this.ctx;
    const { options } = context;
    const input = options.file;
    if (!input) {
      const e = new Error('Expected a path to a QIR JSON file');
      e.code = 'ENOENT';
      throw e;
    }

    // Lazy import Ajv at runtime in CLI to avoid adding core deps
    const [{ default: Ajv }, { default: addFormats }] = await Promise.all([
      import('ajv'),
      import('ajv-formats')
    ]);

    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    if (options.envelope) {
      const root = process.env.WESLEY_REPO_ROOT || process.cwd();
      const [schemaIR, schemaQIR, schemaEnv, envJson] = await Promise.all([
        fs.read(await this.ctx.fs.join(root, 'schemas', 'ir.schema.json')),
        fs.read(await this.ctx.fs.join(root, 'schemas', 'qir.schema.json')),
        fs.read(await this.ctx.fs.join(root, 'schemas', 'ir-envelope.schema.json')).catch(() => '{}'),
        fs.read(input)
      ]);
      const ir = JSON.parse(schemaIR);
      const qir = JSON.parse(schemaQIR);
      const envSchema = JSON.parse(schemaEnv);
      const env = JSON.parse(envJson);
      ajv.addSchema(ir);
      ajv.addSchema(qir);
      const validate = ajv.compile(envSchema);
      const ok = validate(env);
      if (!ok) {
        const err = new Error('IR envelope validation failed');
        err.code = 'VALIDATION_FAILED';
        err.meta = { errors: validate.errors };
        logger.error({ errors: validate.errors }, err.message);
        throw err;
      }
      if (!options.json) logger.info({ file: input }, 'IR envelope validation OK');
      return { valid: true, file: input, kind: 'envelope' };
    } else if (options.manifest) {
      const root = process.env.WESLEY_REPO_ROOT || process.cwd();
      const [schemaJson, manJson] = await Promise.all([
        fs.read(await this.ctx.fs.join(root, 'schemas', 'ops-manifest.schema.json')),
        fs.read(input)
      ]);
      const schema = JSON.parse(schemaJson);
      const manifest = JSON.parse(manJson);
      const validate = ajv.compile(schema);
      const ok = validate(manifest);
      if (!ok) {
        const err = new Error('Ops manifest validation failed');
        err.code = 'VALIDATION_FAILED';
        err.meta = { errors: validate.errors };
        logger.error({ errors: validate.errors }, err.message);
        throw err;
      }
      if (!options.json) logger.info({ file: input }, 'Ops manifest validation OK');
      return { valid: true, file: input, kind: 'ops-manifest' };
    } else if (options.registry) {
      const root = process.env.WESLEY_REPO_ROOT || process.cwd();
      const [schemaJson, regJson] = await Promise.all([
        fs.read(await this.ctx.fs.join(root, 'schemas', 'ops-registry.schema.json')),
        fs.read(input)
      ]);
      const schema = JSON.parse(schemaJson);
      const registry = JSON.parse(regJson);
      const validate = ajv.compile(schema);
      const ok = validate(registry);
      if (!ok) {
        const err = new Error('Ops registry validation failed');
        err.code = 'VALIDATION_FAILED';
        err.meta = { errors: validate.errors };
        logger.error({ errors: validate.errors }, err.message);
        throw err;
      }
      if (!options.json) logger.info({ file: input }, 'Ops registry validation OK');
      return { valid: true, file: input, kind: 'ops-registry' };
    } else {
      const root = process.env.WESLEY_REPO_ROOT || process.cwd();
      const schemaPath = await this.ctx.fs.join(root, 'schemas', 'qir.schema.json');
      const [schemaJson, planJson] = await Promise.all([
        fs.read(schemaPath),
        fs.read(input)
      ]);
      const schema = JSON.parse(schemaJson);
      const plan = JSON.parse(planJson);
      const validate = ajv.compile(schema);
      const ok = validate(plan);
      if (!ok) {
        const err = new Error('QIR validation failed');
        err.code = 'VALIDATION_FAILED';
        err.meta = { errors: validate.errors };
        logger.error({ errors: validate.errors }, err.message);
        throw err;
      }
      if (!options.json) logger.info({ file: input }, 'QIR validation OK');
      return { valid: true, file: input, kind: 'qir' };
    }
  }
}

export default QirValidateCommand;
