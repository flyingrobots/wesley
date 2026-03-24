export function analyzeMoriartyGitActivity({ git, clock, config }) {
  const prActivity = computeMoriartyGitPrActivity({ git, config });
  const prIndex = normalizeMoriartyGitActivity(prActivity, config);
  const windowActivity = computeMoriartyGitWindowActivity({ git, clock, config });
  const windowIndex = normalizeMoriartyGitActivity(windowActivity, config);
  const activityIndex = (Number.isFinite(prIndex) ? prIndex * 0.6 : 0) + (Number.isFinite(windowIndex) ? windowIndex * 0.4 : 0);
  const gitActivity = {
    window: windowActivity || undefined,
    pr: prActivity || undefined,
    indexBreakdown: { pr: prIndex, window: windowIndex }
  };

  const sizes = [];
  if (gitActivity.pr?.commitRelevantSizes?.length) sizes.push(...gitActivity.pr.commitRelevantSizes);
  if (gitActivity.window?.commitRelevantSizes?.length) sizes.push(...gitActivity.window.commitRelevantSizes);

  return {
    gitActivity,
    activityIndex,
    burstinessIndex: computeMoriartyBurstinessIndex(sizes)
  };
}

export function computeMoriartyGitWindowActivity({ git, clock, config }) {
  if (!git.isInsideWorkTree()) {
    return null;
  }
  const windowHours = Math.max(1, Math.floor(config.gitWindowHours));
  const sinceIso = new Date(clock.nowMs() - windowHours * 3600 * 1000).toISOString();
  const raw = git.log({ since: sinceIso, format: '--%ct', numstat: true, noMerges: true });
  if (raw === null) {
    return null;
  }
  if (!raw.trim()) {
    return { windowHours, commits: 0, relevantCommits: 0, commitsPerDay: 0, linesChanged: 0, relevantLinesChanged: 0 };
  }

  const parsed = parseMoriartyGitNumstat(raw);
  return {
    windowHours,
    commits: parsed.commits,
    relevantCommits: parsed.relevantCommits,
    commitsPerDay: parsed.commits * (24 / windowHours),
    linesChanged: parsed.linesChanged,
    relevantLinesChanged: parsed.relevantLinesChanged,
    uniqueRelevantFiles: parsed.uniqueRelevantFiles,
    commitRelevantSizes: parsed.commitRelevantSizes
  };
}

export function computeMoriartyGitPrActivity({ git, config }) {
  const baseRef = config.baseRef;
  if (!git.isInsideWorkTree()) {
    return null;
  }
  try {
    git.fetch(baseRef);
    const remoteBase = baseRef.startsWith('origin/') ? baseRef : `origin/${baseRef}`;
    const mergeBase = git.mergeBase('HEAD', remoteBase);
    if (!mergeBase) return null;

    const raw = git.log({ range: `${mergeBase}..HEAD`, format: '--%ct', numstat: true, noMerges: true });
    if (raw === null) {
      return null;
    }
    if (!raw.trim()) {
      return { commits: 0, relevantCommits: 0, days: 0, commitsPerDay: 0, linesChanged: 0, relevantLinesChanged: 0 };
    }

    const parsed = parseMoriartyGitNumstat(raw);
    const spanSecs = parsed.firstTs && parsed.lastTs ? Math.max(1, Math.abs(parsed.lastTs - parsed.firstTs)) : 0;
    const days = spanSecs / 86400 || 0;
    return {
      commits: parsed.commits,
      relevantCommits: parsed.relevantCommits,
      days,
      commitsPerDay: days > 0 ? parsed.commits / days : parsed.commits,
      linesChanged: parsed.linesChanged,
      relevantLinesChanged: parsed.relevantLinesChanged,
      uniqueRelevantFiles: parsed.uniqueRelevantFiles,
      commitRelevantSizes: parsed.commitRelevantSizes
    };
  } catch {
    return null;
  }
}

export function normalizeMoriartyGitActivity(activity, config) {
  if (!activity) return 0;
  const commitsPerDay = Number.isFinite(activity.commitsPerDay) ? activity.commitsPerDay : 0;
  const relPerDay = Number.isFinite(activity.windowHours)
    ? (activity.relevantCommits * (24 / activity.windowHours))
    : (Number.isFinite(activity.days) && activity.days > 0 ? activity.relevantCommits / activity.days : 0);
  const locPerDay = Number.isFinite(activity.windowHours)
    ? (activity.relevantLinesChanged * (24 / activity.windowHours))
    : (Number.isFinite(activity.days) && activity.days > 0 ? activity.relevantLinesChanged / activity.days : activity.relevantLinesChanged);
  const filesPerDay = Number.isFinite(activity.windowHours)
    ? (Number.isFinite(activity.uniqueRelevantFiles) ? (activity.uniqueRelevantFiles * (24 / activity.windowHours)) : 0)
    : (Number.isFinite(activity.days) && activity.days > 0 && Number.isFinite(activity.uniqueRelevantFiles) ? activity.uniqueRelevantFiles / activity.days : 0);
  const commitScore = Math.min(1, commitsPerDay / config.activityCommitThreshold);
  const relevantScore = Math.min(1, relPerDay / config.activityRelevantCommitThreshold);
  const volumeScore = Math.min(1, locPerDay / Math.max(1, config.activityLinesPerDayTarget));
  const breadthScore = Math.min(1, filesPerDay / Math.max(1, config.activityFilesPerDayTarget));
  return (
    (commitScore * 0.25) +
    (relevantScore * 0.35) +
    (volumeScore * 0.25) +
    (breadthScore * 0.15)
  );
}

export function computeMoriartyBurstinessIndex(samples) {
  if (!Array.isArray(samples) || samples.length < 2) return 0;
  const nums = samples.map((n) => (Number.isFinite(n) ? n : 0)).filter((n) => n > 0);
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (mean <= 0) return 0;
  const variance = nums.reduce((a, n) => a + Math.pow(n - mean, 2), 0) / (nums.length - 1);
  const sd = Math.sqrt(variance);
  const cv = sd / mean;
  return Math.min(1, cv / 2);
}

function parseMoriartyGitNumstat(raw) {
  const lines = raw.split(/\r?\n/);
  let commits = 0;
  let relevantCommits = 0;
  let linesChanged = 0;
  let relevantLinesChanged = 0;
  let inCommit = false;
  let commitRelevant = false;
  let commitRelevantSize = 0;
  let firstTs = null;
  let lastTs = null;
  const commitRelevantSizes = [];
  const uniqueRelevantFilesSet = new Set();

  for (const line of lines) {
    if (line.startsWith('--')) {
      const ts = Number(line.slice(2).trim());
      if (Number.isFinite(ts)) {
        if (firstTs === null) firstTs = ts;
        lastTs = ts;
      }
      if (inCommit && commitRelevant) {
        relevantCommits++;
        commitRelevantSizes.push(commitRelevantSize);
      }
      inCommit = true;
      commitRelevant = false;
      commitRelevantSize = 0;
      commits++;
      continue;
    }

    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) {
      continue;
    }
    const add = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
    const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
    const file = parts.slice(2).join(' ');
    const delta = add + del;
    linesChanged += delta;
    if (!isRelevantMoriartyFile(file)) {
      continue;
    }
    relevantLinesChanged += delta;
    commitRelevant = true;
    commitRelevantSize += delta;
    uniqueRelevantFilesSet.add(file);
  }

  if (inCommit && commitRelevant) {
    relevantCommits++;
    commitRelevantSizes.push(commitRelevantSize);
  }

  return {
    commits,
    relevantCommits,
    linesChanged,
    relevantLinesChanged,
    uniqueRelevantFiles: uniqueRelevantFilesSet.size,
    commitRelevantSizes,
    firstTs,
    lastTs
  };
}

function isRelevantMoriartyFile(file) {
  const normalized = String(file || '').toLowerCase();
  return normalized.endsWith('.graphql') ||
    normalized.includes('/ddl/') ||
    normalized.endsWith('.sql') ||
    normalized.includes('pgtap') ||
    normalized.includes('/schema') ||
    normalized.includes('.wesley-cache/bundle.json') ||
    normalized.includes('.wesley-cache/history.json') ||
    normalized.includes('.wesley/bundle.json') ||
    normalized.includes('.wesley/history.json');
}
