import { createHash } from 'node:crypto';

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function pseudoSha(ref) {
  return digest({ ref }).slice(0, 40);
}

const fixtureCounterfactualProvider = {
  name: 'fixture-counterfactual',
  providerPackageVersion: 'fixture-provider-1.0.0',
  async analyze({ lane }) {
    const signals = lane.braidRefs.length > 0 ? ['braid_present'] : [];
    return {
      surfaceVersion: 'fixture-counterfactual-v1',
      laneFingerprint: digest({ provider: 'fixture-counterfactual', lane }),
      composition: lane.composition,
      requested: {
        baseRef: lane.baseRef,
        headRef: lane.headRef,
        braidRefs: lane.braidRefs
      },
      resolved: {
        baseRef: lane.baseRef,
        baseSha: pseudoSha(lane.baseRef),
        headRef: lane.headRef,
        headSha: pseudoSha(lane.headRef),
        braidRefs: lane.braidRefs.map((ref) => ({ ref, sha: pseudoSha(ref) })),
        liveWorkspace: lane.headRef === 'HEAD'
      },
      facts: {
        comparison: null,
        transferPlan: null,
        normalizedScope: lane.scope || null
      },
      judgment: {
        status: 'clean',
        signals,
        riskClass: 'none',
        confidenceAdjustment: 0,
        gate: 'pass',
        wouldFail: false,
        reasons: ['Fixture counterfactual provider reported a clean lane.']
      }
    };
  }
};

export default {
  apiVersion: '1',
  name: 'holmes-counterfactual-fixture-module',
  capabilities: {
    holmes: {
      counterfactualProviders: [fixtureCounterfactualProvider]
    }
  }
};
