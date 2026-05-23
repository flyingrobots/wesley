import test from 'node:test';
import assert from 'node:assert/strict';

import { gitIdentityFailures } from './check-git-identity.mjs';

test('git identity guard accepts unset or collaborator local identities', () => {
  assert.deepEqual(gitIdentityFailures({ name: null, email: null }), []);
  assert.deepEqual(
    gitIdentityFailures({
      name: 'Example Contributor',
      email: 'contributor@company.dev',
      authorName: 'Another Contributor',
      authorEmail: 'another@company.dev',
      committerName: 'Release Operator',
      committerEmail: 'release@company.dev'
    }),
    []
  );
});

test('git identity guard rejects test names and emails independently', () => {
  assert.deepEqual(
    gitIdentityFailures({ name: 'Wesley Tests', email: 'contributor@company.dev' }),
    ['local git user.name is a test identity: Wesley Tests']
  );
  assert.deepEqual(
    gitIdentityFailures({ name: 'Example Contributor', email: 'wesley-tests@example.com' }),
    ['local git user.email is a test identity: wesley-tests@example.com']
  );
});

test('git identity guard rejects known local and CI fixture identities', () => {
  assert.deepEqual(gitIdentityFailures({ name: 'Local Test', email: 'test@local.dev' }), [
    'local git user.name is a test identity: Local Test',
    'local git user.email is a test identity: test@local.dev'
  ]);
  assert.deepEqual(gitIdentityFailures({ name: 'CI Test', email: 'test@ci.com' }), [
    'local git user.name is a test identity: CI Test',
    'local git user.email is a test identity: test@ci.com'
  ]);
});

test('git identity guard rejects fixture identities on HEAD commits', () => {
  assert.deepEqual(
    gitIdentityFailures({
      authorName: 'Wesley Tests',
      authorEmail: 'wesley-tests@example.com',
      committerName: 'CI Test',
      committerEmail: 'test@ci.com'
    }),
    [
      'HEAD author name is a test identity: Wesley Tests',
      'HEAD author email is a test identity: wesley-tests@example.com',
      'HEAD committer name is a test identity: CI Test',
      'HEAD committer email is a test identity: test@ci.com'
    ]
  );
});
