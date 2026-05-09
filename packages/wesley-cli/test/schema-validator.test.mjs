import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { compileSchema } from '../src/framework/schemaValidator.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

function createSchemaCtx() {
  return {
    env: {
      WESLEY_REPO_ROOT: repoRoot
    },
    fs: {
      async join(...parts) {
        return path.join(...parts);
      },
      async read(filePath) {
        return readFile(filePath, 'utf8');
      }
    }
  };
}

function makeRuntimeEvent(type, sequence) {
  return {
    eventId: `transmutation:null-generator:run-123:${sequence}`,
    type,
    streamId: 'transmutation:null-generator:run-123',
    sequence,
    schemaVersion: '1.0.0',
    timestamp: '2026-03-19T10:30:00.000Z',
    causationId: null,
    correlationId: 'run-123',
    idempotencyKey: `null-generator:${type}:${sequence}`,
    runId: 'run-123',
    transmutation: 'null-generator',
    payload: {}
  };
}

test('compileSchema resolves nested local refs for shipme + realm + runtime-event schemas', async () => {
  const { validate } = await compileSchema(createSchemaCtx(), 'shipme.schema.json');
  const document = {
    version: '1.0.0',
    transmutation: 'null-generator',
    runId: 'run-123',
    sha: '0123456789abcdef0123456789abcdef01234567',
    timestamp: '2026-03-19T10:30:00.000Z',
    environment: 'test',
    scores: null,
    evidence: {
      totalCitations: 3,
      exact: 1,
      wholeFile: 1,
      coarse: 1,
      strongestCitation: 'exact',
      trust: 'weak',
      reasons: ['1 coarse citation remains unpinned to exact line spans.']
    },
    holmes: {
      generatedAt: '2026-03-19T10:30:00.000Z',
      shipVerdict: 'ELEMENTARY',
      baseReadiness: 'ELEMENTARY',
      evidenceTrust: 'strong',
      verificationCount: 3,
      gateFailures: 0,
      gateWarnings: 0,
      blockingGates: [],
      warningGates: [],
      message: 'Ship immediately! The evidence is conclusive.'
    },
    realm: {
      transmutation: 'null-generator',
      runId: 'run-123',
      provider: 'postgres',
      verdict: 'PASS',
      duration_ms: 12,
      steps: 1,
      timestamp: '2026-03-19T10:30:00.000Z',
      events: [makeRuntimeEvent('RunCompleted', 1)]
    },
    artifacts: {},
    signatures: [],
    events: [makeRuntimeEvent('CertificateIssued', 1)]
  };

  assert.equal(validate(document), true);
});
