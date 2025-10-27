/**
 * HOLMES Suite report schemas and lightweight runtime validator.
 *
 * The validator intentionally supports only the constructs we use here
 * (object, array, string, number, boolean, required keys, and item schemas)
 * to avoid pulling in a full JSON Schema dependency.
 */

const stringField = { type: 'string' };
const numberField = { type: 'number' };
const booleanField = { type: 'boolean' };

function scsComponentSchema() {
  return {
    type: 'object',
    required: ['score', 'earnedWeight', 'totalWeight'],
    properties: {
      score: { anyOf: [numberField, { type: 'null' }] },
      earnedWeight: numberField,
      totalWeight: numberField
    },
    additionalProperties: false
  };
}

function tciComponentSchema() {
  return {
    type: 'object',
    required: ['score', 'covered', 'total'],
    properties: {
      score: { anyOf: [numberField, { type: 'null' }] },
      covered: numberField,
      total: numberField
    },
    additionalProperties: false
  };
}

function mriComponentSchema() {
  return {
    type: 'object',
    required: ['score', 'points', 'count'],
    properties: {
      score: numberField,
      points: numberField,
      count: numberField
    },
    additionalProperties: false
  };
}

export const holmesReportSchema = {
  type: 'object',
  required: ['metadata', 'scores', 'breakdown', 'evidence', 'gates', 'verdict'],
  properties: {
    metadata: {
      type: 'object',
      required: ['generatedAt', 'sha', 'verificationStatus', 'verificationCount', 'bundleVersion'],
      properties: {
        generatedAt: stringField,
        sha: stringField,
        verificationStatus: stringField,
        verificationCount: numberField,
        weightedCompletion: numberField,
        tci: numberField,
        mri: numberField,
        bundleVersion: stringField
      }
    },
    scores: {
      type: 'object',
      required: ['scs', 'tci', 'mri'],
      properties: {
        scs: numberField,
        tci: numberField,
        mri: numberField
      }
    },
    breakdown: {
      type: 'object',
      required: ['scs', 'tci', 'mri'],
      properties: {
        scs: {
          type: 'object',
          required: ['sql', 'types', 'validation', 'tests'],
          properties: {
            sql: scsComponentSchema(),
            types: scsComponentSchema(),
            validation: scsComponentSchema(),
            tests: scsComponentSchema()
          }
        },
        tci: {
          type: 'object',
          required: ['unit_constraints', 'unit_rls', 'integration_relations', 'e2e_ops'],
          properties: {
            unit_constraints: tciComponentSchema(),
            unit_rls: tciComponentSchema(),
            integration_relations: tciComponentSchema(),
            e2e_ops: {
              type: 'object',
              required: ['score', 'covered', 'total'],
              properties: {
                score: { anyOf: [numberField, { type: 'null' }] },
                covered: numberField,
                total: numberField,
                note: { type: 'string' }
              },
              additionalProperties: false
            },
            legacy_components: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        mri: {
          type: 'object',
          required: ['drops', 'renames_without_uid', 'add_not_null_without_default', 'non_concurrent_indexes', 'totalPoints'],
          properties: {
            drops: mriComponentSchema(),
            renames_without_uid: mriComponentSchema(),
            add_not_null_without_default: mriComponentSchema(),
            non_concurrent_indexes: mriComponentSchema(),
            totalPoints: numberField
          }
        }
      }
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        required: ['element', 'weight', 'status', 'evidence', 'deduction'],
        properties: {
          element: stringField,
          weight: numberField,
          status: stringField,
          evidence: stringField,
          deduction: stringField
        }
      }
    },
    gates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['gate', 'status', 'evidence', 'ruling'],
        properties: {
          gate: stringField,
          status: stringField,
          evidence: stringField,
          ruling: stringField
        }
      }
    },
    verdict: {
      type: 'object',
      required: ['code', 'message', 'markdown'],
      properties: {
        code: stringField,
        message: stringField,
        markdown: stringField
      }
    }
  }
};

export const watsonReportSchema = {
  type: 'object',
  required: ['metadata', 'citations', 'math', 'opinion', 'inconsistencies'],
  properties: {
    metadata: {
      type: 'object',
      required: ['examinedAt', 'sha'],
      properties: {
        examinedAt: stringField,
        sha: stringField
      }
    },
    citations: {
      type: 'object',
      required: ['total', 'verified', 'failed', 'unverified', 'rate'],
      properties: {
        total: numberField,
        verified: numberField,
        failed: numberField,
        unverified: numberField,
        rate: numberField
      }
    },
    math: {
      type: 'object',
      required: ['claimedScs', 'recalculatedScs', 'difference', 'acceptable'],
      properties: {
        claimedScs: numberField,
        recalculatedScs: numberField,
        difference: numberField,
        acceptable: booleanField
      }
    },
    inconsistencies: {
      type: 'array',
      items: stringField
    },
    opinion: {
      type: 'object',
      required: ['verdict', 'message', 'markdown'],
      properties: {
        verdict: stringField,
        message: stringField,
        markdown: stringField
      }
    }
  }
};

export const moriartyReportSchema = {
  type: 'object',
  required: ['metadata', 'status', 'history'],
  properties: {
    metadata: {
      type: 'object',
      required: ['analysisAt'],
      properties: {
        analysisAt: stringField
      }
    },
    status: stringField,
    history: {
      type: 'array',
      items: {
        type: 'object',
        required: ['timestamp', 'scs', 'tci', 'mri'],
        properties: {
          timestamp: stringField,
          scs: numberField,
          tci: numberField,
          mri: numberField
        }
      }
    },
    latest: {
      type: 'object'
    },
    velocity: {
      type: 'object'
    },
    plateauDetected: booleanField,
    regressionDetected: booleanField,
    eta: {
      type: 'object'
    },
    confidence: numberField,
    patterns: {
      type: 'array'
    }
  }
};

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateNode(schema, value, path, errors) {
  if (!schema) return;
  const location = path || 'root';

  switch (schema.type) {
    case 'object': {
      if (!isObject(value)) {
        errors.push(`${location} expected object`);
        return;
      }
      const required = schema.required || [];
      for (const key of required) {
        if (!(key in value)) {
          errors.push(`${location}.${key} missing`);
        }
      }
      const props = schema.properties || {};
      for (const [key, childSchema] of Object.entries(props)) {
        if (key in value) {
          validateNode(childSchema, value[key], `${location}.${key}`, errors);
        }
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        errors.push(`${location} expected array`);
        return;
      }
      if (schema.items) {
        value.forEach((item, index) => {
          validateNode(schema.items, item, `${location}[${index}]`, errors);
        });
      }
      return;
    }
    case 'string': {
      if (typeof value !== 'string') {
        errors.push(`${location} expected string`);
      }
      return;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push(`${location} expected number`);
      }
      return;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        errors.push(`${location} expected boolean`);
      }
      return;
    }
    default:
      return;
  }
}

export function validateReport(schema, data) {
  const errors = [];
  validateNode(schema, data, 'report', errors);
  return { valid: errors.length === 0, errors };
}
