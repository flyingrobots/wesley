/**
 * Shared Ajv schema-validation helper.
 *
 * Centralises the boilerplate that was previously copy-pasted across
 * cert-verify, generate, plan, qir-validate, and rehearse commands:
 *   1. Lazy import of ajv + ajv-formats
 *   2. Deterministic Ajv configuration
 *   3. Dual-path schema file resolution (WESLEY_REPO_ROOT → import.meta.url)
 */

let _ajvFactory = null;

/**
 * Lazily import Ajv and ajv-formats, returning a ready-to-use instance.
 * All callers share the same import; each gets a fresh Ajv instance so
 * compiled validators don't leak between commands.
 */
export async function createAjv() {
  if (!_ajvFactory) {
    _ajvFactory = Promise.all([
      import('ajv'),
      import('ajv-formats')
    ]);
  }
  const [{ default: Ajv }, { default: addFormats }] = await _ajvFactory;
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv;
}

/**
 * Resolve a schema filename from the repo's `schemas/` directory.
 *
 * Resolution order:
 *   1. `$WESLEY_REPO_ROOT/schemas/<name>`
 *   2. `import.meta.url`-relative fallback (4 levels up from this file)
 *
 * @param {object} ctx  Wesley command context (`ctx.fs`, `ctx.env`)
 * @param {string} name Schema filename, e.g. `'qir.schema.json'`
 * @returns {Promise<string>} Raw file contents (string or Buffer)
 */
export async function loadSchemaFile(ctx, name) {
  const root = (ctx.env || {}).WESLEY_REPO_ROOT || ctx.cwd?.() || process.cwd();
  try {
    const path = await ctx.fs.join(root, 'schemas', name);
    return await ctx.fs.read(path);
  } catch {
    // Fallback: resolve relative to this module
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve: pres } = await import('node:path');
    const modDir = dirname(fileURLToPath(import.meta.url));
    const fallbackRoot = pres(modDir, '../../../..');
    // packages/wesley-cli/src/framework/ → src/ → wesley-cli/ → packages/ → repo root
    return ctx.fs.read(pres(fallbackRoot, 'schemas', name));
  }
}

/**
 * Load a JSON schema file and compile it into an Ajv validator.
 *
 * @param {object} ctx  Wesley command context
 * @param {string} name Schema filename
 * @param {object} [ajv] Optional pre-created Ajv instance (reuse for multi-schema)
 * @returns {Promise<{ajv: object, validate: Function}>}
 */
export async function compileSchema(ctx, name, ajv) {
  if (!ajv) ajv = await createAjv();
  const raw = await loadSchemaFile(ctx, name);
  const schema = JSON.parse(raw);
  const validate = ajv.compile(schema);
  return { ajv, validate };
}

/**
 * Validate data against a named schema. Throws with code VALIDATION_FAILED
 * on schema violations.
 *
 * @param {object} ctx   Wesley command context
 * @param {string} name  Schema filename
 * @param {*}      data  Data to validate
 * @param {string} label Human-readable label for error messages
 * @param {object} [ajv] Optional pre-created Ajv instance
 * @returns {Promise<void>}
 */
export async function assertValid(ctx, name, data, label, ajv) {
  const result = await compileSchema(ctx, name, ajv);
  const ok = result.validate(data);
  if (!ok) {
    const e = new Error(`${label} failed schema validation`);
    e.code = 'VALIDATION_FAILED';
    e.meta = { errors: result.validate.errors };
    throw e;
  }
}
