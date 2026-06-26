import test from 'node:test';
import assert from 'node:assert/strict';

import { commandOrFamilyExists, documentedCommandFromParts } from './check-doc-cli-commands.mjs';

test('documented command parsing preserves unknown nested subcommands for family validation', () => {
  const commands = new Set(['config validate', 'config inspect', 'schema lower']);

  const documented = documentedCommandFromParts(['config', 'bogus'], commands);

  assert.equal(documented, 'config bogus');
  assert.equal(commandOrFamilyExists(documented, commands), false);
});

test('documented command parsing still accepts command-family headings', () => {
  const commands = new Set(['config validate', 'config inspect', 'schema lower']);

  const documented = documentedCommandFromParts(['config'], commands);

  assert.equal(documented, 'config');
  assert.equal(commandOrFamilyExists(documented, commands), true);
});
