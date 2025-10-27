import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class QirValidateCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'qir', 'QIR utilities');
  }

  configureCommander(cmd) {
    return cmd
      .command('validate')
      .description('Validate a QIR JSON file against schemas/qir.schema.json')
      .argument('<file>', 'Path to QIR JSON file')
      .option('--json', 'Emit JSON output')
      .action(async (file, options) => {
        return this.execute({ ...options, file });
      });
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

    const schemaPath = await this.ctx.fs.join(process.cwd(), 'schemas', 'qir.schema.json');
    const [schemaJson, planJson] = await Promise.all([
      fs.read(schemaPath),
      fs.read(input)
    ]);
    const schema = JSON.parse(schemaJson);
    const plan = JSON.parse(planJson);

    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const ok = validate(plan);
    if (!ok) {
      const err = new Error('QIR validation failed');
      err.code = 'VALIDATION_FAILED';
      err.meta = { errors: validate.errors };
      logger.error({ errors: validate.errors }, err.message);
      throw err;
    }

    if (!options.json) {
      logger.info({ file: input }, 'QIR validation OK');
    }
    return { valid: true, file: input };
  }
}

export default QirValidateCommand;

