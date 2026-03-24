export function createMoriartyConfig({ env = process.env } = {}) {
  return {
    alpha: 0.4,
    minSlope: 0.01,
    useGitActivity: (env.MORIARTY_USE_GIT || '1') !== '0',
    gitWindowHours: Number(env.MORIARTY_GIT_WINDOW_HOURS || '24'),
    activityPlateauThreshold: Number(env.MORIARTY_ACTIVITY_THRESHOLD || '0.35'),
    activityCommitThreshold: Number(env.MORIARTY_ACTIVITY_COMMITS_PER_DAY || '6'),
    activityRelevantCommitThreshold: Number(env.MORIARTY_ACTIVITY_RELEVANT_PER_DAY || '4'),
    activityLinesPerDayTarget: Number(env.MORIARTY_ACTIVITY_LINES_PER_DAY || '400'),
    activityFilesPerDayTarget: Number(env.MORIARTY_ACTIVITY_FILES_PER_DAY || '10'),
    confidenceBurstinessMax: Number(env.MORIARTY_CONFIDENCE_BURSTINESS_MAX_PCT || '15'),
    baseRef: env.MORIARTY_BASE_REF || env.GITHUB_BASE_REF || 'main',
    readinessThresholds: {
      scs: Number(env.MORIARTY_READY_SCS || '0.8'),
      tci: Number(env.MORIARTY_READY_TCI || '0.7'),
      mri: Number(env.MORIARTY_READY_MRI || '0.4'),
      ci: Number(env.MORIARTY_READY_CI_STABILITY || '0.9'),
      evidenceTrust: env.MORIARTY_READY_EVIDENCE_TRUST || 'moderate'
    }
  };
}
