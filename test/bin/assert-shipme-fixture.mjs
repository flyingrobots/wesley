// Asserts the contract of the fixture that scripts/prepare-shipme-cert-fixture.mjs
// writes, by parsing it. Usage: node assert-shipme-fixture.mjs <cache-dir> <expected-commit>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const [cacheDir, expectedCommit] = process.argv.slice(2);
const read = (name) => JSON.parse(readFileSync(join(cacheDir, name), 'utf8'));

const realm = read('realm.json');
const scores = read('scores.json');
const bundle = read('bundle.json');
const schemaEvidence = bundle.evidence.evidence.schema;

// [field, actual, expected]. The witness below is the length of this list, so
// it cannot claim more than was asserted.
const checks = [
  ['realm.verdict', realm.verdict, 'PASS'],
  ['scores.version', scores.version, '2.0.0'],
  ['scores.commit', scores.commit, expectedCommit],
  ['bundle.sha', bundle.sha, expectedCommit],
  // `typeof null` is "object" too, so say what kind of object.
  ['scores.metadata', scores.metadata === null ? 'null' : typeof scores.metadata, 'object'],
  ['scores.readiness.ready', scores.readiness.ready, true],
  ['bundle.scores.readiness.ready', bundle.scores.readiness.ready, true],
  ['schema sql evidence lines', schemaEvidence.sql[0].lines, '1-2'],
  ['schema tests evidence lines', schemaEvidence.tests[0].lines, '1-1']
];
for (const [field, actual, expected] of checks) assert.equal(actual, expected, field);

console.log(`checked ${checks.length} fields for commit ${expectedCommit}`);
