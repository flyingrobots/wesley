import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const HOLMES_SUITE_COMMENT_MARKER = '<!-- HOLMES_SUITE_COMMENT -->';

export function buildHolmesSuiteComment({
  pullRequestNumber,
  headSha = '',
  statuses = {},
  reportStates = {},
  holmesReport = null,
  watsonReport = null,
  moriartyReport = null,
  holmesMarkdown = '',
  watsonMarkdown = '',
  moriartyMarkdown = ''
}) {
  const lines = [
    HOLMES_SUITE_COMMENT_MARKER,
    renderCurrentShaMarker(headSha),
    `# 🔍 The Case of Pull Request #${pullRequestNumber}`,
    '',
    '## Plain-English Readout',
    '',
    ...renderPlainEnglishReadout({
      holmesReport,
      watsonReport,
      moriartyReport,
      statuses,
      reportStates
    }),
    '',
    ...renderNextActions({
      holmesReport,
      watsonReport,
      moriartyReport,
      statuses,
      reportStates
    }),
    '',
    ...renderGlossary(),
    '',
    '---',
    '',
    renderReportSection('🕵️ SHA-lock HOLMES full report', holmesMarkdown, statuses.holmes, 'holmes'),
    '',
    '---',
    '',
    renderReportSection('🩺 Dr. WATSON full report', watsonMarkdown, statuses.watson, 'watson'),
    '',
    '---',
    '',
    renderReportSection('🔮 Professor MORIARTY full report', moriartyMarkdown, statuses.moriarty, 'moriarty'),
    '',
    '---',
    '',
    '_Machine-readable reports:_ holmes-report.json · watson-report.json · moriarty-report.json (see workflow artifacts).',
    '',
    '---',
    '',
    '*Filed at 221B Repository Street*'
  ];

  return lines.join('\n');
}

export function loadHolmesSuiteReports(reportsDir, statuses = {}) {
  const holmesReport = readJsonReport(reportsDir, 'holmes', 'holmes-report.json');
  const watsonReport = readJsonReport(reportsDir, 'watson', 'watson-report.json');
  const moriartyReport = readJsonReport(reportsDir, 'moriarty', 'moriarty-report.json');
  return {
    statuses,
    reportStates: {
      holmes: holmesReport.state,
      watson: watsonReport.state,
      moriarty: moriartyReport.state
    },
    holmesReport: holmesReport.value,
    watsonReport: watsonReport.value,
    moriartyReport: moriartyReport.value,
    holmesMarkdown: readTextReport(reportsDir, 'holmes', 'holmes-report.md', statuses.holmes),
    watsonMarkdown: readTextReport(reportsDir, 'watson', 'watson-report.md', statuses.watson),
    moriartyMarkdown: readTextReport(reportsDir, 'moriarty', 'moriarty-report.md', statuses.moriarty)
  };
}

function renderCurrentShaMarker(headSha) {
  const sha = normalizeOptionalString(headSha);
  return sha ? `<!-- HOLMES_SUITE_SHA:${sha} -->` : '<!-- HOLMES_SUITE_SHA:unknown -->';
}

function renderPlainEnglishReadout({ holmesReport, watsonReport, moriartyReport, statuses, reportStates }) {
  const holmes = summarizeHolmes(holmesReport, statuses.holmes, reportStates.holmes);
  const watson = summarizeWatson(watsonReport, statuses.watson, reportStates.watson);
  const moriarty = summarizeMoriarty(moriartyReport, statuses.moriarty, reportStates.moriarty);

  return [
    `- **Holmes (evidence investigation)**: ${holmes.summary}`,
    `- **Watson (independent verification)**: ${watson.summary}`,
    `- **Moriarty (trend forecast)**: ${moriarty.summary}`
  ];
}

function renderNextActions({ holmesReport, watsonReport, moriartyReport, statuses, reportStates }) {
  const actions = dedupeStrings([
    ...collectHolmesActions(holmesReport, statuses.holmes, reportStates.holmes),
    ...collectWatsonActions(watsonReport, statuses.watson, reportStates.watson),
    ...collectMoriartyActions(moriartyReport, statuses.moriarty, reportStates.moriarty)
  ]).slice(0, 4);

  if (actions.length === 0) {
    return [
      '## Suggested next actions',
      '',
      '1. No urgent Holmes-suite follow-up is flagged right now. Keep the PR green and re-run the suite after meaningful changes.'
    ];
  }

  return [
    '## Suggested next actions',
    '',
    ...actions.map((action, index) => `${index + 1}. ${action}`)
  ];
}

function renderGlossary() {
  return [
    '<details><summary>📚 Glossary (what the Holmes terms mean)</summary>',
    '',
    '- **HOLMES**: Wesley’s main evidence investigation. It decides whether the cited proof is strong enough to justify shipping this commit.',
    '- **WATSON**: An independent verification pass. It checks Holmes’s citations and score math instead of trusting them blindly.',
    '- **MORIARTY**: A readiness forecast over time. It is advisory trend analysis, not the release gate itself.',
    '- **Schema coverage score (SCS)**: How much of the schema has direct supporting evidence across generated artifacts and cited proof.',
    '- **Test confidence index (TCI)**: How much test evidence exists for constraints, policies, relationships, and operations.',
    '- **Migration risk index (MRI)**: How risky the schema change is to roll out. Lower is better.',
    '- **Evidence trust**: Whether the report is backed by exact citations, whole-file citations, or coarse references. Weak trust means the claim may be directionally right but not specific enough to trust blindly.',
    '- **Citation quality**: A count of exact line-span citations versus whole-file or coarse references.',
    '- **ELEMENTARY**: Ready to ship based on the current evidence.',
    '- **REQUIRES INVESTIGATION**: More work or review is needed before shipping.',
    '- **YOU SHALL NOT PASS**: Do not ship this change in its current state.',
    '',
    '</details>'
  ];
}

function renderReportSection(title, markdown, status, reportName) {
  const body = markdown && markdown.trim()
    ? markdown.trim()
    : `_Report unavailable for ${reportName} (job status: ${status || 'unknown'})_`;
  return `<details><summary>${title} (click to expand)</summary>\n\n${body}\n\n</details>`;
}

function summarizeHolmes(report, status, reportState) {
  const unavailableSummary = buildUnavailableSummary('Holmes report', 'holmes-report.json', status, reportState, report);
  if (unavailableSummary) {
    return {
      summary: unavailableSummary
    };
  }

  const verdict = normalizeOptionalString(report?.verdict?.code) || normalizeOptionalString(report?.metadata?.verificationStatus) || 'UNKNOWN';
  const reasons = collectHolmesReasons(report).slice(0, 3);
  const message = verdictToPlainEnglish(verdict);
  if (reasons.length === 0) {
    return { summary: message };
  }
  return { summary: `${message} Main reasons: ${joinPhrases(reasons)}.` };
}

function summarizeWatson(report, status, reportState) {
  const unavailableSummary = buildUnavailableSummary('Watson report', 'watson-report.json', status, reportState, report);
  if (unavailableSummary) {
    return {
      summary: unavailableSummary
    };
  }

  const verdict = normalizeOptionalString(report?.opinion?.verdict);
  if (verdict === 'PASSED') {
    return {
      summary: 'Watson independently verified the evidence and found no material inconsistencies.'
    };
  }

  const concern = firstNonEmpty([
    report?.inconsistencies?.[0],
    report?.citations?.reasons?.[0],
    report?.opinion?.message
  ]);
  if (concern) {
    return {
      summary: `Watson found verification concerns. Most important concern: ${trimSentence(concern)}.`
    };
  }
  return {
    summary: 'Watson found verification concerns and recommends a closer look before trusting the result.'
  };
}

function summarizeMoriarty(report, status, reportState) {
  const unavailableSummary = buildUnavailableSummary('Moriarty forecast', 'moriarty-report.json', status, reportState, report);
  if (unavailableSummary) {
    return {
      summary: unavailableSummary
    };
  }

  if (report.status === 'INSUFFICIENT_DATA') {
    return {
      summary: 'Moriarty does not have enough historical data yet to forecast readiness.'
    };
  }

  if (report.plateauDetected) {
    return {
      summary: 'Moriarty sees progress as stalled right now, so forecast confidence is limited.'
    };
  }

  if (report?.eta?.realisticDate) {
    const confidence = Number.isFinite(report?.confidence)
      ? ` with about ${Math.round(report.confidence)}% confidence`
      : '';
    return {
      summary: `Moriarty estimates readiness around ${report.eta.realisticDate}${confidence}.`
    };
  }

  if (Array.isArray(report?.warnings) && report.warnings.length > 0) {
    return {
      summary: `Moriarty is cautious: ${trimSentence(report.warnings[0])}.`
    };
  }

  return {
    summary: 'Moriarty sees ongoing movement, but the forecast is not yet concrete enough to promise a readiness date.'
  };
}

function collectHolmesActions(report, status, reportState) {
  const unavailableAction = buildUnavailableAction('HOLMES', 'holmes-report.json', status, reportState, report);
  if (unavailableAction) {
    return [unavailableAction];
  }

  const actions = [];
  const evidenceTrust = normalizeOptionalString(report?.metadata?.evidenceTrust);
  const testCoverageGate = findGate(report, 'Test Coverage');
  const migrationRiskGate = findGate(report, 'Migration Risk');
  const sensitiveGate = findGate(report, 'Sensitive Fields');

  if (evidenceTrust && evidenceTrust !== 'strong') {
    actions.push('Tighten citations so the report points to exact lines instead of whole files or coarse references.');
  }
  if ((typeof report?.scores?.tci === 'number' && report.scores.tci < 0.7) || gateNeedsAttention(testCoverageGate)) {
    actions.push('Add or strengthen tests for the schema elements and operations HOLMES flagged as weakly proven.');
  }
  if ((typeof report?.scores?.mri === 'number' && report.scores.mri >= 0.4) || gateNeedsAttention(migrationRiskGate)) {
    actions.push('Review the migration plan for risky changes such as drops, renames, not-null additions, or index strategy.');
  }
  if (gateNeedsAttention(sensitiveGate)) {
    actions.push('Review sensitive-field protections and add the missing security evidence or tests.');
  }
  if (actions.length === 0 && report?.verdict?.code !== 'ELEMENTARY') {
    actions.push('Resolve the remaining HOLMES findings before treating this PR as ready to ship.');
  }
  return actions;
}

function collectWatsonActions(report, status, reportState) {
  if (buildUnavailableSummary('Watson report', 'watson-report.json', status, reportState, report)) return [];
  if (normalizeOptionalString(report?.opinion?.verdict) === 'PASSED') return [];
  return ['Resolve Watson’s verification concerns before trusting the Holmes verdict as final.'];
}

function collectMoriartyActions(report, status, reportState) {
  if (buildUnavailableSummary('Moriarty forecast', 'moriarty-report.json', status, reportState, report)) return [];
  const actions = [];
  if (report.plateauDetected) {
    actions.push('Treat the readiness forecast as stalled until new evidence or real progress moves the trend again.');
  }
  if (Array.isArray(report?.warnings) && report.warnings.some((warning) => /evidence trust/i.test(warning))) {
    actions.push('Improve evidence trust before leaning on the readiness forecast for shipping decisions.');
  }
  return actions;
}

function collectHolmesReasons(report) {
  const reasons = [];
  const evidenceTrust = normalizeOptionalString(report?.metadata?.evidenceTrust);
  const citationQuality = report?.metadata?.citationQuality || {};
  const migrationRiskGate = findGate(report, 'Migration Risk');
  const testCoverageGate = findGate(report, 'Test Coverage');
  const sensitiveGate = findGate(report, 'Sensitive Fields');

  if (evidenceTrust && evidenceTrust !== 'strong') {
    reasons.push(firstNonEmpty([
      normalizeOptionalString(findGate(report, 'Evidence Quality')?.ruling),
      `some claims rely on ${evidenceTrust} evidence trust`,
      (citationQuality.coarse || citationQuality.wholeFile) > 0 ? 'some claims rely on whole-file or coarse citations' : null
    ]));
  }

  if ((typeof report?.scores?.tci === 'number' && report.scores.tci < 0.7) || gateNeedsAttention(testCoverageGate)) {
    reasons.push('test evidence is incomplete');
  }
  if ((typeof report?.scores?.scs === 'number' && report.scores.scs < 0.85)) {
    reasons.push('schema coverage is incomplete');
  }
  if ((typeof report?.scores?.mri === 'number' && report.scores.mri >= 0.4) || gateNeedsAttention(migrationRiskGate)) {
    reasons.push(trimSentence(normalizeOptionalString(migrationRiskGate?.ruling)) || 'migration risk is elevated');
  }
  if (gateNeedsAttention(sensitiveGate)) {
    reasons.push(trimSentence(normalizeOptionalString(sensitiveGate?.ruling)) || 'sensitive fields still need stronger protections');
  }

  return dedupeStrings(reasons.filter(Boolean));
}

function findReportPath(root, filename, reportName) {
  const matches = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name === filename) {
        matches.push(fullPath);
      }
    }
  }
  if (matches.length === 0) return null;
  const preferred = matches.find((candidate) => candidate.toLowerCase().split(path.sep).includes(reportName.toLowerCase()));
  return preferred || matches[0];
}

function readJsonReport(root, reportName, filename) {
  const reportPath = findReportPath(root, filename, reportName);
  if (!reportPath) {
    return { state: 'missing', value: null };
  }
  try {
    return {
      state: 'loaded',
      value: JSON.parse(readFileSync(reportPath, 'utf8'))
    };
  } catch {
    return { state: 'invalid', value: null };
  }
}

function readTextReport(root, reportName, filename, status) {
  if (status !== 'success') return '';
  const reportPath = findReportPath(root, filename, reportName);
  if (!reportPath) return '';
  return readFileSync(reportPath, 'utf8');
}

function verdictToPlainEnglish(verdict) {
  switch (verdict) {
  case 'ELEMENTARY':
    return 'Holmes says this change looks ready to ship.';
  case 'REQUIRES INVESTIGATION':
    return 'Holmes says this change needs investigation before shipping.';
  case 'YOU SHALL NOT PASS':
    return 'Holmes says this change should not ship in its current state.';
  default:
    return 'Holmes could not reach a clear ship recommendation from the available evidence.';
  }
}

function gateNeedsAttention(gate) {
  return Boolean(gate) && String(gate.status || '').trim() !== '✅';
}

function findGate(report, gateName) {
  return Array.isArray(report?.gates)
    ? report.gates.find((gate) => normalizeOptionalString(gate?.gate) === gateName)
    : null;
}

function joinPhrases(items) {
  if (items.length === 1) return trimSentence(items[0]);
  if (items.length === 2) return `${trimSentence(items[0])}; ${trimSentence(items[1])}`;
  return `${items.slice(0, -1).map(trimSentence).join('; ')}; ${trimSentence(items[items.length - 1])}`;
}

function dedupeStrings(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = normalizeOptionalString(item);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function trimSentence(value) {
  const text = normalizeOptionalString(value);
  if (!text) return '';
  return stripTrailingPeriods(collapseWhitespace(text));
}

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstNonEmpty(values) {
  return values.find((value) => normalizeOptionalString(value)) || '';
}

function statusLabel(status) {
  return normalizeOptionalString(status) || 'unknown';
}

function buildUnavailableSummary(displayName, artifactName, status, reportState, report) {
  const effectiveState = resolveReportState(reportState, report, status);
  if (status !== 'success') {
    return `The ${displayName} is unavailable because the workflow status is ${statusLabel(status)}.`;
  }
  if (effectiveState === 'missing') {
    return `The ${displayName} is unavailable because the workflow finished without a readable ${artifactName} artifact.`;
  }
  if (effectiveState === 'invalid') {
    return `The ${displayName} is unavailable because the ${artifactName} artifact could not be parsed as JSON.`;
  }
  return '';
}

function resolveReportState(reportState, report, status) {
  const explicitState = normalizeOptionalString(reportState);
  if (explicitState) return explicitState;
  if (report) return 'loaded';
  if (status === 'success') return 'missing';
  return 'unavailable';
}

function buildUnavailableAction(reportLabel, artifactName, status, reportState, report) {
  const effectiveState = resolveReportState(reportState, report, status);
  if (status !== 'success') {
    return `Fix the ${reportLabel} workflow job first so the PR has a real evidence investigation again.`;
  }
  if (effectiveState === 'missing') {
    return `Regenerate the ${reportLabel} artifacts and make sure ${artifactName} is uploaded before trusting this PR summary.`;
  }
  if (effectiveState === 'invalid') {
    return `Fix the ${reportLabel} report generation so ${artifactName} contains valid JSON before trusting this PR summary.`;
  }
  return '';
}

function collapseWhitespace(text) {
  let result = '';
  let previousWasWhitespace = false;
  for (const char of text) {
    const isWhitespace = char.trim() === '';
    if (isWhitespace) {
      if (!previousWasWhitespace) {
        result += ' ';
      }
    } else {
      result += char;
    }
    previousWasWhitespace = isWhitespace;
  }
  return result.trim();
}

function stripTrailingPeriods(text) {
  let end = text.length;
  while (end > 0 && text[end - 1] === '.') {
    end -= 1;
  }
  return text.slice(0, end);
}
