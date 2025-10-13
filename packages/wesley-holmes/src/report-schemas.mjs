/**
 * HOLMES Suite report schemas (structural definitions)
 * Runtime validator is implemented in validateReport.
 */

export const holmesReportSchema = {
  type: 'object',
  required: ['metadata', 'scores', 'evidence', 'gates', 'verdict'],
  properties: {
    metadata: {
      type: 'object',
      required: ['generatedAt', 'sha'],
      properties: {
        generatedAt: { type: 'string' },
        sha: { type: 'string' },
        verificationStatus: { type: 'string' }
      }
    },
    scores: {
      type: 'object',
      required: ['scs', 'tci', 'mri'],
      properties: {
        scs: { type: 'number' },
        tci: { type: 'number' },
        mri: { type: 'number' }
      }
    },
    evidence: { type: 'array' },
    gates: { type: 'array' },
    verdict: { type: 'object' }
  }
};

export const watsonReportSchema = {
  type: 'object',
  required: ['metadata', 'citations', 'math', 'opinion'],
  properties: {
    metadata: {
      type: 'object',
      required: ['examinedAt', 'sha']
    },
    citations: {
      type: 'object',
      required: ['total', 'verified', 'failed', 'unverified', 'rate']
    },
    math: {
      type: 'object',
      required: ['claimedScs', 'recalculatedScs', 'difference', 'acceptable']
    },
    opinion: {
      type: 'object',
      required: ['verdict', 'message']
    }
  }
};

export const moriartyReportSchema = {
  type: 'object',
  required: ['metadata', 'status'],
  properties: {
    metadata: {
      type: 'object',
      required: ['analysisAt']
    },
    status: { type: 'string' }
  }
};

export function validateReport(schema, data) {
  // Minimal stub to be implemented with actual validation logic.
  return { valid: true, errors: [] };
}
