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

assert.equal(realm.verdict, 'PASS', 'realm.verdict');
assert.equal(scores.version, '2.0.0', 'scores.version');
assert.equal(scores.commit, expectedCommit, 'scores.commit');
assert.equal(bundle.sha, expectedCommit, 'bundle.sha');
assert.equal(typeof scores.metadata, 'object', 'scores.metadata');
assert.equal(scores.readiness.ready, true, 'scores.readiness.ready');
assert.equal(bundle.scores.readiness.ready, true, 'bundle.scores.readiness.ready');

const schemaEvidence = bundle.evidence.evidence.schema;
assert.equal(schemaEvidence.sql[0].lines, '1-2', 'schema sql evidence lines');
assert.equal(schemaEvidence.tests[0].lines, '1-1', 'schema tests evidence lines');

console.log(`checked 9 fields for commit ${expectedCommit}`);
