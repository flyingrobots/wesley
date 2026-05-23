import {
  DEFAULT_WESLEY_MODULE_SPECIFIERS,
  discoverConfiguredWesleyModules,
  findNearestWesleyConfigPath,
  loadWesleyModuleEntries
} from '@wesley/runtime-node';

export { DEFAULT_WESLEY_MODULE_SPECIFIERS, findNearestWesleyConfigPath };

const nullLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  }
};

export async function loadWesleyCliModuleEntries({
  cwd = process.cwd(),
  env = process.env,
  defaultSpecifiers = DEFAULT_WESLEY_MODULE_SPECIFIERS
} = {}) {
  return loadWesleyModuleEntries({ cwd, env, defaultSpecifiers });
}

export async function discoverAndRegisterWesleyCliModules({
  ctx,
  cwd = process.cwd(),
  env = process.env,
  logger = ctx?.logger ?? nullLogger
} = {}) {
  const { modules, entries, capabilityRegistry } = await discoverConfiguredWesleyModules({
    cwd,
    env,
    logger
  });

  if (ctx && typeof ctx === 'object') {
    ctx.moduleCapabilityRegistry = capabilityRegistry;
  }

  for (const module of modules) {
    if (typeof module.registerCliCommands === 'function') {
      await module.registerCliCommands(ctx);
    }
  }

  return { modules, entries, capabilityRegistry };
}
