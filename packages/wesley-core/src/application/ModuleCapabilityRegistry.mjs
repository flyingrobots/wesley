export const WESLEY_MODULE_CAPABILITY_COLLECTIONS = Object.freeze({
  wesley: Object.freeze([
    'directives',
    'targets',
    'generators',
    'bundleProfiles',
    'realizationVerifiers'
  ]),
  holmes: Object.freeze([
    'scopes',
    'checks',
    'evidenceCollectors'
  ]),
  watson: Object.freeze([
    'verifiers',
    'auditProfiles'
  ]),
  moriarty: Object.freeze([
    'policyProfiles',
    'judgmentProfiles',
    'predictors'
  ]),
  blade: Object.freeze([
    'scenarios',
    'fixtures',
    'envSetups',
    'tests',
    'gates',
    'certificationProfiles'
  ]),
  cli: Object.freeze([
    'commands'
  ])
});

export const WESLEY_MODULE_CAPABILITY_AREAS = Object.freeze(
  Object.keys(WESLEY_MODULE_CAPABILITY_COLLECTIONS)
);

function fail(message, code = 'WMOD005') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function describeValue(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function emptyCapabilities() {
  return Object.fromEntries(
    WESLEY_MODULE_CAPABILITY_AREAS.map((area) => [
      area,
      Object.fromEntries(
        WESLEY_MODULE_CAPABILITY_COLLECTIONS[area].map((collection) => [
          collection,
          []
        ])
      )
    ])
  );
}

function getModuleLabel(module) {
  return typeof module?.name === 'string' && module.name.trim()
    ? module.name.trim()
    : '<unknown>';
}

function readCapabilities(module) {
  try {
    return module.capabilities;
  } catch (cause) {
    fail(`Module "${getModuleLabel(module)}" capabilities getter threw: ${cause.message}`);
  }
}

export function normalizeModuleCapabilities(module) {
  const moduleName = getModuleLabel(module);
  const rawCapabilities = readCapabilities(module);
  const normalized = emptyCapabilities();

  if (rawCapabilities === undefined) {
    return normalized;
  }

  if (!isPlainObject(rawCapabilities)) {
    fail(
      `Module "${moduleName}" capabilities must be a plain object if provided ` +
      `(got ${describeValue(rawCapabilities)})`
    );
  }

  for (const area of Object.keys(rawCapabilities)) {
    if (!WESLEY_MODULE_CAPABILITY_AREAS.includes(area)) {
      fail(
        `Module "${moduleName}" capabilities contains unknown area "${area}". ` +
        `Supported areas: ${WESLEY_MODULE_CAPABILITY_AREAS.join(', ')}`
      );
    }

    const areaValue = rawCapabilities[area];
    if (areaValue === undefined) {
      continue;
    }
    if (!isPlainObject(areaValue)) {
      fail(
        `Module "${moduleName}" capabilities.${area} must be a plain object ` +
        `(got ${describeValue(areaValue)})`
      );
    }

    const allowedCollections = WESLEY_MODULE_CAPABILITY_COLLECTIONS[area];
    for (const collection of Object.keys(areaValue)) {
      if (!allowedCollections.includes(collection)) {
        fail(
          `Module "${moduleName}" capabilities.${area} contains unknown collection ` +
          `"${collection}". Supported ${area} collections: ${allowedCollections.join(', ')}`
        );
      }

      const collectionValue = areaValue[collection];
      if (collectionValue === undefined) {
        continue;
      }
      if (!Array.isArray(collectionValue)) {
        fail(
          `Module "${moduleName}" capabilities.${area}.${collection} must be an array ` +
          `(got ${describeValue(collectionValue)})`
        );
      }

      normalized[area][collection] = collectionValue.map((value) => ({
        moduleName,
        value
      }));
    }
  }

  return normalized;
}

export function createModuleCapabilityRegistry(modules = []) {
  if (!Array.isArray(modules)) {
    throw new TypeError('createModuleCapabilityRegistry: "modules" must be an array');
  }

  const capabilities = emptyCapabilities();
  const moduleSummaries = [];

  for (const module of modules) {
    const moduleName = getModuleLabel(module);
    moduleSummaries.push({
      name: moduleName,
      apiVersion: module.apiVersion
    });

    const normalized = normalizeModuleCapabilities(module);
    for (const area of WESLEY_MODULE_CAPABILITY_AREAS) {
      for (const collection of WESLEY_MODULE_CAPABILITY_COLLECTIONS[area]) {
        capabilities[area][collection].push(...normalized[area][collection]);
      }
    }
  }

  return {
    modules: moduleSummaries,
    capabilities
  };
}

export function listModuleCapabilities(registry, area, collection) {
  return registry?.capabilities?.[area]?.[collection] ?? [];
}
