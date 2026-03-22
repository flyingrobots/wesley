export function assertCounterfactualSurfacePort(port) {
  if (!port || typeof port !== 'object') {
    throw new TypeError('Counterfactual surface port is required');
  }

  for (const method of [
    'exists',
    'mkdir',
    'readText',
    'readFile',
    'writeText',
    'listFilesRecursive',
    'hashContent',
    'resolvePath',
    'joinPath',
    'relativePath',
    'dirname',
    'isAbsolute',
    'parseSDL',
    'emitDDL',
    'emitRLS',
    'emitPgTap'
  ]) {
    if (typeof port[method] !== 'function') {
      throw new TypeError(`Counterfactual surface port missing ${method}()`);
    }
  }

  return port;
}
