import process from 'node:process';

export function buildGitDiscoveryEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_')) delete env[key];
  }
  return env;
}

export async function withSanitizedGitEnv(run, targetEnv = process.env) {
  const saved = [];
  for (const key of Object.keys(targetEnv)) {
    if (!key.startsWith('GIT_')) continue;
    saved.push([key, targetEnv[key]]);
    delete targetEnv[key];
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of saved) {
      targetEnv[key] = value;
    }
  }
}
