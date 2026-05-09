#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const forbiddenGitIdentityValues = new Set([
  'Wesley Tests',
  'wesley-tests@example.com',
  'Wesley CLI Test',
  'wesley@example.test',
  'Local Test',
  'test@local.dev',
  'CI Test',
  'test@ci.com'
]);

export function gitIdentityFailures({
  name,
  email,
  authorName,
  authorEmail,
  committerName,
  committerEmail
}) {
  const failures = [];
  if (name && forbiddenGitIdentityValues.has(name)) {
    failures.push(`local git user.name is a test identity: ${name}`);
  }
  if (email && forbiddenGitIdentityValues.has(email)) {
    failures.push(`local git user.email is a test identity: ${email}`);
  }
  if (authorName && forbiddenGitIdentityValues.has(authorName)) {
    failures.push(`HEAD author name is a test identity: ${authorName}`);
  }
  if (authorEmail && forbiddenGitIdentityValues.has(authorEmail)) {
    failures.push(`HEAD author email is a test identity: ${authorEmail}`);
  }
  if (committerName && forbiddenGitIdentityValues.has(committerName)) {
    failures.push(`HEAD committer name is a test identity: ${committerName}`);
  }
  if (committerEmail && forbiddenGitIdentityValues.has(committerEmail)) {
    failures.push(`HEAD committer email is a test identity: ${committerEmail}`);
  }
  return failures;
}

function localGitConfig(key, cwd) {
  const result = spawnSync('git', ['config', '--local', '--get', key], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status === 1) return null;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git config --local --get ${key} failed`);
  }
  return result.stdout.trim() || null;
}

function repositoryRoot(cwd) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function headGitIdentity(cwd) {
  const result = spawnSync(
    'git',
    ['log', '-1', '--format=%an%x00%ae%x00%cn%x00%ce', 'HEAD'],
    {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  if (result.status === 128) return {};
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'git log -1 identity lookup failed');
  }

  const [authorName, authorEmail, committerName, committerEmail] = result.stdout
    .replace(/\n$/, '')
    .split('\0');

  return {
    authorName: authorName || null,
    authorEmail: authorEmail || null,
    committerName: committerName || null,
    committerEmail: committerEmail || null
  };
}

export function checkCurrentRepositoryGitIdentity(cwd = process.cwd()) {
  const root = repositoryRoot(cwd);
  if (!root) return [];

  return gitIdentityFailures({
    name: localGitConfig('user.name', root),
    email: localGitConfig('user.email', root),
    ...headGitIdentity(root)
  });
}

function main() {
  let failures;
  try {
    failures = checkCurrentRepositoryGitIdentity();
  } catch (error) {
    console.error(`Git identity guard failed: ${error?.message || error}`);
    process.exit(1);
  }

  if (failures.length === 0) return;

  console.error('Git identity guard failed: test identity configured in this repository.');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  console.error('Remove the repo-local override or set a real verified signing identity.');
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
