import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_SUBSTRINGS = {
  password: 10,
  email: 8,
  id: 7,
  user: 6,
  created: 5,
  theme: 2
};

export const DEFAULT_WEIGHT_CONFIG = {
  default: 5,
  substrings: { ...DEFAULT_SUBSTRINGS },
  directives: {},
  overrides: {}
};

const DEFAULT_SOURCE = 'defaults';

export function normalizeWeightConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('weights config must be an object');
  }

  const config = cloneDefaultConfig();

  // Legacy flat map support ("password": 12, "default": 5, ...)
  const simpleKeys = Object.keys(raw);
  const looksLikeFlatMap = simpleKeys.every((key) => typeof raw[key] === 'number');

  if (looksLikeFlatMap) {
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'default') {
        config.default = coerceNumber(value, config.default, `'default' weight`);
      } else {
        config.substrings[key.toLowerCase()] = coerceNumber(value, config.substrings[key.toLowerCase()] ?? config.default, `substring weight for "${key}"`);
      }
    }
    return config;
  }

  if ('default' in raw) {
    config.default = coerceNumber(raw.default, config.default, `'default' weight`);
  }

  if (raw.substrings && typeof raw.substrings === 'object' && !Array.isArray(raw.substrings)) {
    for (const [key, value] of Object.entries(raw.substrings)) {
      config.substrings[key.toLowerCase()] = coerceNumber(value, config.substrings[key.toLowerCase()] ?? config.default, `substring weight for "${key}"`);
    }
  }

  if (raw.directives && typeof raw.directives === 'object' && !Array.isArray(raw.directives)) {
    for (const [key, value] of Object.entries(raw.directives)) {
      const normalized = normalizeDirectiveKey(key);
      config.directives[normalized] = coerceNumber(value, config.directives[normalized] ?? config.default, `directive weight for "${key}"`);
    }
  }

  if (raw.overrides && typeof raw.overrides === 'object' && !Array.isArray(raw.overrides)) {
    for (const [key, value] of Object.entries(raw.overrides)) {
      config.overrides[key] = coerceNumber(value, config.overrides[key] ?? config.default, `override weight for "${key}"`);
    }
  }

  return config;
}

export function loadWeightConfig({ cwd = process.cwd(), env = process.env } = {}) {
  const fileFromEnv = env.WESLEY_HOLMES_WEIGHT_FILE;
  const jsonEnv = env.WESLEY_HOLMES_WEIGHTS;
  const defaultPath = resolve(cwd, '.wesley/weights.json');

  // Highest precedence: explicit JSON string via env
  if (jsonEnv) {
    try {
      const parsed = JSON.parse(jsonEnv);
      return { config: normalizeWeightConfig(parsed), source: 'env:WESLEY_HOLMES_WEIGHTS' };
    } catch (err) {
      console.warn('[Holmes] Failed to parse WESLEY_HOLMES_WEIGHTS JSON:', err?.message);
    }
  }

  // Next: explicit file override via env
  if (fileFromEnv) {
    const resolved = resolve(cwd, fileFromEnv);
    if (existsSync(resolved)) {
      try {
        const parsed = JSON.parse(readFileSync(resolved, 'utf8'));
        return { config: normalizeWeightConfig(parsed), source: `file:${resolved}` };
      } catch (err) {
        console.warn('[Holmes] Failed to load weight file', resolved, err?.message);
      }
    } else {
      console.warn('[Holmes] WESLEY_HOLMES_WEIGHT_FILE not found:', resolved);
    }
  }

  // Finally: repository default .wesley/weights.json
  if (existsSync(defaultPath)) {
    try {
      const parsed = JSON.parse(readFileSync(defaultPath, 'utf8'));
      return { config: normalizeWeightConfig(parsed), source: `file:${defaultPath}` };
    } catch (err) {
      console.warn('[Holmes] Failed to load .wesley/weights.json:', err?.message);
    }
  }

  return { config: cloneDefaultConfig(), source: DEFAULT_SOURCE };
}

export function readWeightConfig(path, { required = false } = {}) {
  const resolved = resolve(process.cwd(), path);
  if (!existsSync(resolved)) {
    if (required) {
      throw new Error(`weights file not found: ${resolved}`);
    }
    return { config: cloneDefaultConfig(), source: DEFAULT_SOURCE };
  }

  const parsed = JSON.parse(readFileSync(resolved, 'utf8'));
  return { config: normalizeWeightConfig(parsed), source: `file:${resolved}` };
}

function normalizeDirectiveKey(key) {
  const name = key.startsWith('@') ? key.slice(1) : key;
  return name.toLowerCase();
}

function coerceNumber(value, fallback, label) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${label} must be a finite number`);
  }
  return num;
}

function cloneDefaultConfig() {
  return {
    default: DEFAULT_WEIGHT_CONFIG.default,
    substrings: { ...DEFAULT_WEIGHT_CONFIG.substrings },
    directives: { ...DEFAULT_WEIGHT_CONFIG.directives },
    overrides: { ...DEFAULT_WEIGHT_CONFIG.overrides }
  };
}
