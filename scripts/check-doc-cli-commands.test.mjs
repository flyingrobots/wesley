import test from 'node:test';
import assert from 'node:assert/strict';

import {
  commandOrFamilyExists,
  documentedCommandFromParts,
  loadWesleyCommandsFromSource
} from './check-doc-cli-commands.mjs';

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

test('documented command checker loads command names from Rust help source', () => {
  const source = String.raw`
fn print_help() {
    println!(
        "\
Wesley native CLI

Usage:
  wesley <command> [options]

Commands:
  config validate          Validate a Wesley project manifest
  schema lower              Lower GraphQL SDL to Wesley L1 IR JSON
  operation directive-args  Extract operation directive arguments as JSON

Options:
  -h, --help     Show help"
    );
}
`;

  const commands = loadWesleyCommandsFromSource(source);

  assert.deepEqual([...commands], ['config validate', 'schema lower', 'operation directive-args']);
});
