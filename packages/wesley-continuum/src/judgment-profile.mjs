const CONTINUUM_JUDGMENT_PROFILE = deepFreeze({
  profilePackage: '@wesley/continuum',
  enginePackage: '@wesley/holmes',
  roles: {
    holmes: {
      role: 'current-state judgment',
      asks: 'What is true right now at the Continuum contract boundary?',
      consumes: [
        'authored schema identity',
        'generated leg evidence',
        'realization shell status',
        'publication-boundary checks',
        'substrate facts from git-warp and neighboring adapters'
      ],
      emits: [
        'status',
        'signals',
        'risk class',
        'confidence adjustment',
        'gate result'
      ],
      doesNotOwn: [
        'substrate fact extraction',
        'runtime semantics',
        'storage semantics',
        'debugger policy'
      ]
    },
    watson: {
      role: 'independent verification',
      asks: 'Do Holmes citations and proof surfaces actually support the claim?',
      consumes: [
        'Holmes report outputs',
        'evidence citations',
        'manifest signatures',
        'family witness fixtures'
      ],
      emits: [
        'citation verification status',
        'verification commentary',
        'exact-versus-coarse citation quality'
      ],
      doesNotOwn: [
        'policy setting',
        'forecasting',
        'runtime semantics',
        'counterfactual planning'
      ]
    },
    moriarty: {
      role: 'forecast and counterfactual analysis',
      asks: 'What will be true soon, and what is in the way?',
      consumes: [
        'Holmes and Watson history',
        'drift-watch outputs',
        'counterfactual substrate facts',
        'transmutation and project trend lines'
      ],
      emits: [
        'ETA',
        'bottleneck identification',
        'regression risk',
        'counterfactual forecast'
      ],
      doesNotOwn: [
        'present-tense gate authority',
        'citation verification',
        'substrate fact extraction',
        'runtime semantics'
      ]
    }
  }
});

export { CONTINUUM_JUDGMENT_PROFILE };

export function getContinuumJudgmentProfile() {
  return cloneJson(CONTINUUM_JUDGMENT_PROFILE);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}
