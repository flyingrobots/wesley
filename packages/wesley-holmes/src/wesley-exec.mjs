import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function resolveWesleyExecutable(repoRoot) {
  const candidates = [
    path.resolve(repoRoot, 'packages/wesley-host-node/bin/wesley.mjs'),
    path.resolve(fileURLToPath(new URL('../../wesley-host-node/bin/wesley.mjs', import.meta.url)))
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { entry: candidate, env: { ...process.env } };
    }
  }
  return null;
}

export function runNodeCommand(args, cwd, env = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: node ${args.join(' ')}`);
  }
  return result;
}
