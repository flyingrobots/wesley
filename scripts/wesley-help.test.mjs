import test from 'node:test';
import assert from 'node:assert/strict';

import { parseHelp } from './wesley-help.mjs';

// Oracle: specified. The layout is what clap prints for `wesley --help`.
const HELP = [
  'Wesley compiles GraphQL schemas.',
  '',
  'Usage: wesley [OPTIONS] <COMMAND>',
  '',
  'Commands:',
  '  schema hash        Print the registry hash',
  '  schema diff        Compare two schemas',
  '  doctor             Report health',
  '  not a row because it has three words',
  '',
  'Options:',
  '  -h, --help     Print help',
  '  -V, --version  Print version',
  '',
  'Trailing prose that mentions --not-an-option and a  fake row.'
].join('\n');

test('commands and options are read from their own sections only', () => {
  const { commands, options } = parseHelp(HELP);
  assert.deepEqual([...commands], ['schema hash', 'schema diff', 'doctor']);
  assert.deepEqual([...options], ['-h', '--help', '-V', '--version']);
});

test('help with no Commands section yields no commands', () => {
  const { commands } = parseHelp('Usage: wesley\n\nOptions:\n  -h, --help  Print help\n');
  assert.equal(commands.size, 0);
});
