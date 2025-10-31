#!/usr/bin/env node
/**
 * Compute per-package stage and progress, update meta/progress.json and README Package Matrix.
 * - Uses GitHub Actions API when GITHUB_TOKEN + GITHUB_REPOSITORY are present.
 * - Falls back to defaults when offline.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const repo = process.env.GITHUB_REPOSITORY || '';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function readJSON(p) { return JSON.parse(readFileSync(resolve(p), 'utf8')); }
function has(hay, needle) { return hay.toLowerCase().includes(needle.toLowerCase()); }

const cfg = readJSON('meta/progress.config.json');

async function fetchWorkflowPassRate(workflowFile, branch = 'main', take = 10) {
  try {
    if (!token || !repo || !workflowFile || typeof fetch !== 'function') return null;
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(branch)}&per_page=${take}`;
    const res = await fetch(url, { headers: { 'authorization': `Bearer ${token}`, 'accept': 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
    if (!runs.length) return null;
    const ok = runs.filter(r => r.conclusion === 'success').length;
    return ok / runs.length;
  } catch { return null; }
}

async function fetchMilestoneRatioFor(pkgName, milestoneTitle) {
  try {
    if (!token || !repo) return null;
    const qBase = `repo:${repo} label:"pkg:${pkgName}" milestone:"${milestoneTitle}"`;
    const openUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(qBase + ' is:issue is:open')}`;
    const closedUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(qBase + ' is:issue is:closed')}`;
    const headers = { 'authorization': `Bearer ${token}`, 'accept': 'application/vnd.github+json' };
    const [openRes, closedRes] = await Promise.all([fetch(openUrl, { headers }), fetch(closedUrl, { headers })]);
    if (!openRes.ok || !closedRes.ok) return null;
    const open = await openRes.json();
    const closed = await closedRes.json();
    const total = (open.total_count || 0) + (closed.total_count || 0);
    if (total === 0) return null; // no milestone usage yet
    return { total, closed: (closed.total_count || 0), ratio: (closed.total_count || 0) / total };
  } catch { return null; }
}

function detectDocsSections(readmePath) {
  try {
    const c = readFileSync(resolve(readmePath), 'utf8');
    return {
      hasStatus: has(c, 'Status:'),
      hasUsage: has(c, 'Quick Start') || has(c, 'Usage') || has(c, 'Examples'),
      hasApi: has(c, 'API') || has(c, 'Exports'),
      hasCaveats: has(c, 'Limitations') || has(c, 'Caveats') || has(c, 'Notes')
    };
  } catch { return { hasStatus: false, hasUsage: false, hasApi: false, hasCaveats: false }; }
}

function nextStage(stage) {
  const order = ['Prototype', 'MVP', 'Alpha', 'Beta', 'v1.0.0'];
  const i = order.indexOf(stage);
  if (i < 0) throw new Error(`Unknown stage: ${stage}`);
  return order[Math.min(order.length - 1, i + 1)] || 'MVP';
}

function inferBaseStage(status) {
  if (status === 'Too soon') return 'Prototype';
  return 'MVP';
}

function computeStageAndProgress(pkg, passRate, docs, milestones) {
  const base = inferBaseStage(pkg.status);
  let stage = base;
  let progress = 0; // % to next stage
  const nstage = nextStage(stage);

  // MVP gates → Alpha
  // - passRate >= 0.9
  // - docs.hasUsage
  if (stage === 'MVP') {
    const pr = passRate ?? 0; // 0..1 or 0 when unknown
    const d = docs.hasUsage ? 1 : 0;
    const alphaRatio = milestones?.alpha?.ratio ?? 0;
    const score = 0.5 * pr + 0.2 * d + 0.3 * alphaRatio;
    if (pr >= 0.95 && d) { stage = 'Alpha'; progress = 0; }
    else progress = Math.round(score * 100);
  }

  // Alpha gates → Beta
  // - passRate >= 0.98
  // - docs.hasApi && docs.hasCaveats
  if (stage === 'Alpha') {
    const pr = passRate ?? 0;
    const d = (docs.hasApi && docs.hasCaveats) ? 1 : 0;
    const betaRatio = milestones?.beta?.ratio ?? 0;
    const score = 0.5 * Math.min(1, pr / 0.98) + 0.2 * d + 0.3 * betaRatio;
    if (pr >= 0.98 && d) { stage = 'Beta'; progress = 0; }
    else progress = Math.round(score * 100);
  }

  // Beta gates → v1.0.0 (placeholder: require very high pass rate + docs breadth)
  if (stage === 'Beta') {
    const pr = passRate ?? 0;
    const d = (docs.hasApi && docs.hasCaveats && docs.hasUsage) ? 1 : 0.5;
    const score = 0.8 * Math.min(1, pr / 0.995) + 0.2 * d;
    if (pr >= 0.995 && d >= 1) { stage = 'v1.0.0'; progress = 100; }
    else progress = Math.round(score * 100);
  }

  // Prototype → MVP (for "Too soon")
  if (base === 'Prototype' && stage === 'Prototype') {
    const d = docs.hasUsage ? 0.5 : 0;
    // As documented: Prototype progress shows either 50% (no usage docs) or 100% (usage present)
    const score = 0.5 + d; // 0.5 or 1.0
    progress = Math.round(score * 100); // 50 or 100
  }

  return { stage, progress, next: nextStage(stage) };
}

async function main() {
  const rows = [];
  const results = [];

  for (const p of cfg.packages) {
    const docs = detectDocsSections(p.readme);
    const passRate = await fetchWorkflowPassRate(p.ci);
    const milestones = {
      alpha: await fetchMilestoneRatioFor(p.name, 'Alpha'),
      beta: await fetchMilestoneRatioFor(p.name, 'Beta')
    };
    const { stage, progress, next } = computeStageAndProgress(p, passRate, docs, milestones);
    // try to read coverage summary when available (local from progress workflow)
    let coverage = null;
    try {
      const sum = JSON.parse(readFileSync(resolve('packages/wesley-core/coverage/coverage-summary.json'), 'utf8'));
      coverage = sum.total?.lines?.pct ?? null;
    } catch {}
    results.push({ name: p.name, status: p.status, stage, progress, next, passRate, docs, milestones, coverage });
  }

  // Write meta/progress.json
  // Compute overall stage
  const order = ['Prototype', 'MVP', 'Alpha', 'Beta', 'v1.0.0'];
  const idx = (s) => Math.max(0, order.indexOf(s));
  const reqFor = (stage) => {
    if (stage === 'Alpha') return cfg.project.requiredForAlpha || [];
    if (stage === 'Beta') return cfg.project.requiredForBeta || (cfg.packages.filter(p => p.status === 'Active').map(p => p.name));
    if (stage === 'v1.0.0') return cfg.project.requiredForV1 || (cfg.packages.filter(p => p.status === 'Active').map(p => p.name));
    return [];
  };
  const have = (stage, names) => names.every(n => idx((results.find(r => r.name === n) || {}).stage || 'Prototype') >= idx(stage));
  let overallStage = 'MVP';
  if (have('Alpha', reqFor('Alpha'))) overallStage = 'Alpha';
  if (have('Beta', reqFor('Beta'))) overallStage = 'Beta';
  if (have('v1.0.0', reqFor('v1.0.0'))) overallStage = 'v1.0.0';
  const overallNext = nextStage(overallStage);
  // Compute progress to next stage via weighted average
  const include = reqFor(overallNext);
  const weights = cfg.project.weights || {};
  let wsum = 0; let acc = 0;
  for (const name of include) {
    let w = weights[name];
    if (w === undefined) {
      console.warn(`Warning: No weight for ${name} in meta/progress.config.json; using default 0.01`);
      w = 0.01;
    }
    const wNum = Number(w);
    const r = results.find(x => x.name === name);
    const reached = r && idx(r.stage) >= idx(overallNext);
    const frac = reached ? 1 : (r ? (r.progress / 100) : 0);
    acc += wNum * frac; wsum += wNum;
  }
  const overallProgress = include.length && wsum > 0 ? Math.round((acc / wsum) * 100) : 0;

  // When repo is unknown (local runs), continue and render em-dash for CI badges.
  if (!repo) {
    console.warn('GITHUB_REPOSITORY not set; CI badge URLs will be disabled (—).');
  }
  const out = { generatedAt: new Date().toISOString(), overall: { stage: overallStage, next: overallNext, progress: overallProgress }, results };
  writeFileSync(resolve('meta/progress.json'), JSON.stringify(out, null, 2), 'utf8');

  // Write shields endpoint for overall badge
  const colorByStage = (s) => ({
    'Prototype': 'lightgrey',
    'MVP': 'blue',
    'Alpha': 'orange',
    'Beta': 'yellowgreen',
    'v1.0.0': 'brightgreen'
  })[s] || 'blue';
  const msg = overallStage === 'v1.0.0'
    ? 'v1.0.0'
    : `${overallStage} • ${overallProgress}%→${overallNext}`;
  const badge = {
    schemaVersion: 1,
    label: 'project',
    message: msg,
    color: colorByStage(overallStage)
  };
  const badgePath = resolve('meta/badges/overall.json');
  mkdirSync(dirname(badgePath), { recursive: true });
  writeFileSync(badgePath, JSON.stringify(badge), 'utf8');

  // Build table markdown
  rows.push('| Package | Status | Stage | Progress | CI | Notes |');
  rows.push('| --- | --- | --- | --- | --- | --- |');
  for (const p of cfg.packages) {
    const r = results.find(x => x.name === p.name) || { stage: inferBaseStage(p.status), progress: 0, next: 'Alpha' };
    const badge = (repo && p.ci)
      ? `![${p.ci}](https://github.com/${repo}/actions/workflows/${p.ci}/badge.svg?branch=main)`
      : '—';
    const prog = r.stage === 'v1.0.0' ? '100% — v1.0.0' : `${r.progress}% → ${r.next}`;
    rows.push(`| \`${p.name}\` | ${p.status} | ${r.stage} | ${prog} | ${badge} | ${p.notes} |`);
  }

  // Update README Overall and Package Matrix between markers
  const readmePath = resolve('README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const pkgStart = '<!-- BEGIN:PACKAGE_MATRIX -->';
  const pkgEnd = '<!-- END:PACKAGE_MATRIX -->';
  const ovStart = '<!-- BEGIN:OVERALL_STATUS -->';
  const ovEnd = '<!-- END:OVERALL_STATUS -->';

  const s1 = readme.indexOf(pkgStart), e1 = readme.indexOf(pkgEnd);
  const s2 = readme.indexOf(ovStart), e2 = readme.indexOf(ovEnd);
  if (s1 === -1 || e1 === -1 || e1 < s1 || s2 === -1 || e2 === -1 || e2 < s2) {
    console.error('Markers not found in README.md');
    process.exit(2);
  }
  const matrixBefore = readme.slice(0, s1 + pkgStart.length);
  const matrixAfter = readme.slice(e1);
  const matrixBody = '\n' + rows.join('\n') + '\n';

  const overallBefore = (matrixBefore + matrixBody + matrixAfter).slice(0, s2 + ovStart.length);
  const overallAfterPre = (matrixBefore + matrixBody + matrixAfter).slice(e2);
  const overallBody = `\nStage: ${overallStage}  \\\nProgress: ${overallProgress}% → ${overallNext}\n`;
  const nextReadme = overallBefore + overallBody + overallAfterPre;
  writeFileSync(readmePath, nextReadme, 'utf8');

  console.log('Updated meta/progress.json and README Package Matrix.');
}

main().catch((e) => { console.error(e?.stack || e); process.exit(1); });
