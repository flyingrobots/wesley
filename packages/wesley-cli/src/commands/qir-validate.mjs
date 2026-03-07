import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { createAjv, loadSchemaFile, assertValid } from '../framework/schemaValidator.mjs';

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
      .action(async (file, options, command) => {
        let root = command; while (root.parent) root = root.parent; const globalOpts = root.opts();
        return this.execute({ ...globalOpts, ...options, file });
      });
    // Envelope validation
    cmd
      .command('envelope-validate')
      .description('Validate an IR envelope JSON against schemas (Schema IR + QIR plans)')
      .argument('<file>', 'Path to IR envelope JSON file')
      .option('--json', 'Emit JSON output')
      .action(async (file, options, command) => {
        let root = command; while (root.parent) root = root.parent; const globalOpts = root.opts();
        return this.execute({ ...globalOpts, ...options, file, envelope: true });
      });

    // Ops manifest validation
    cmd
      .command('manifest-validate')
      .description('Validate an ops manifest JSON against schemas/ops-manifest.schema.json')
      .argument('<file>', 'Path to ops manifest JSON')
      .option('--json', 'Emit JSON output')
      .action(async (file, options, command) => {
        let root = command; while (root.parent) root = root.parent; const globalOpts = root.opts();
        return this.execute({ ...globalOpts, ...options, file, manifest: true });
      });

    // Ops registry validation
    cmd
      .command('registry-validate')
      .description('Validate an ops registry JSON against schemas/ops-registry.schema.json')
      .argument('<file>', 'Path to ops registry JSON')
      .option('--json', 'Emit JSON output')
      .action(async (file, options, command) => {
        let root = command; while (root.parent) root = root.parent; const globalOpts = root.opts();
        return this.execute({ ...globalOpts, ...options, file, registry: true });
      });
    cmd.action(() => { cmd.help(); });
    return root;
  }

  async executeCore(context) {
    const { fs, logger } = this.ctx;
    const { options } = context;
    const input = options.file;
    if (!input) {
      const e = new Error('Expected a path to a QIR JSON file');
      e.code = 'ERR_MISSING_ARGUMENT';
      throw e;
    }

    // Dispatch to the appropriate validation path
    const kind = options.envelope ? 'envelope'
      : options.manifest ? 'ops-manifest'
        : options.registry ? 'ops-registry'
          : 'qir';

    const data = JSON.parse(await fs.read(input));
    await this._validate(kind, data, input);
    if (!options.json) logger.info({ file: input }, `${kind} validation OK`);
    return { valid: true, file: input, kind };
  }

  async _validate(kind, data, _file) {
    const ajv = await createAjv();
    switch (kind) {
    case 'envelope': {
      const [ir, qir, envSchema] = await Promise.all([
        loadSchemaFile(this.ctx, 'ir.schema.json'),
        loadSchemaFile(this.ctx, 'qir.schema.json'),
        loadSchemaFile(this.ctx, 'ir-envelope.schema.json')
      ]);
      ajv.addSchema(JSON.parse(ir));
      ajv.addSchema(JSON.parse(qir));
      const validate = ajv.compile(JSON.parse(envSchema));
      if (!validate(data)) {
        const e = new Error('IR envelope validation failed');
        e.code = 'VALIDATION_FAILED';
        e.meta = { errors: validate.errors };
        throw e;
      }
      break;
    }
    case 'ops-manifest':
      await assertValid(this.ctx, 'ops-manifest.schema.json', data, 'Ops manifest', ajv);
      break;
    case 'ops-registry':
      await assertValid(this.ctx, 'ops-registry.schema.json', data, 'Ops registry', ajv);
      break;
    default:
      await assertValid(this.ctx, 'qir.schema.json', data, 'QIR', ajv);
    }
  }
}

export default QirValidateCommand;
