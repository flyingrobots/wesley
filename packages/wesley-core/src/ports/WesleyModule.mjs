export const SUPPORTED_WESLEY_MODULE_API_VERSIONS = Object.freeze(['1']);

export class WesleyModule {
  get apiVersion() {
    throw new Error('WesleyModule.apiVersion must be implemented');
  }

  get name() {
    throw new Error('WesleyModule.name must be implemented');
  }

  init(_config) {
    // Optional hook for per-project/module configuration.
  }

  async registerCliCommands(_ctx) {
    // Optional hook for module-owned CLI command surfaces.
  }
}

function fail(msg, code) {
  const err = new Error(msg);
  err.code = code;
  throw err;
}

function safeGet(obj, prop) {
  try {
    return { ok: true, value: obj[prop] };
  } catch (error) {
    return { ok: false, error };
  }
}

export function validateWesleyModule(module) {
  if (module == null || typeof module !== 'object') {
    fail('Module must be a non-null object', 'WMOD001');
  }

  const versionResult = safeGet(module, 'apiVersion');
  const nameResult = safeGet(module, 'name');

  if (!versionResult.ok) {
    fail(`Module apiVersion getter threw: ${versionResult.error.message}`, 'WMOD001');
  }
  if (!nameResult.ok) {
    fail(`Module name getter threw: ${nameResult.error.message}`, 'WMOD001');
  }

  const version = versionResult.value;
  const moduleName = typeof nameResult.value === 'string' && nameResult.value.trim()
    ? nameResult.value.trim()
    : undefined;
  const label = moduleName ? ` "${moduleName}"` : '';

  if (version === undefined || version === null) {
    fail(`Module${label} is missing required "apiVersion" property`, 'WMOD001');
  }
  if (typeof version !== 'string') {
    fail(
      `Module${label} apiVersion must be a string (got ${typeof version}: ${version}).`,
      'WMOD001'
    );
  }
  if (!SUPPORTED_WESLEY_MODULE_API_VERSIONS.includes(version)) {
    fail(
      `Module${label} requires apiVersion "${version}", but only [` +
      `${SUPPORTED_WESLEY_MODULE_API_VERSIONS.map((item) => `"${item}"`).join(', ')}] are supported`,
      'WMOD001'
    );
  }

  if (typeof nameResult.value !== 'string' || nameResult.value.trim().length === 0) {
    fail(
      `Module "name" must be a non-empty string (got ${
        typeof nameResult.value === 'string' ? 'whitespace-only string' : typeof nameResult.value
      })`,
      'WMOD001'
    );
  }

  if (module.init !== undefined && typeof module.init !== 'function') {
    fail(`Module${label} "init" must be a function if provided (got ${typeof module.init})`, 'WMOD001');
  }

  if (
    module.registerCliCommands !== undefined &&
    typeof module.registerCliCommands !== 'function'
  ) {
    fail(
      `Module${label} "registerCliCommands" must be a function if provided (got ${
        typeof module.registerCliCommands
      })`,
      'WMOD001'
    );
  }
}
