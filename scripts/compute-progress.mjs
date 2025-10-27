#!/usr/bin/env node
/**
 * Compute per-package stage and progress, update meta/progress.json and README Package Matrix.
 * - Uses GitHub Actions API when GITHUB_TOKEN + GITHUB_REPOSITORY are present.
 * - Falls back to defaults when offline.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = process.env.GITHUB_REPOSITORY || '';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function readJSON(p) { return JSON.parse(readFileSync(resolve(p), 'utf8')); }
function has(hay, needle) { return hay.toLowerCase().includes(needle.toLowerCase()); }

const cfg = readJSON('meta/progress.config.json');

async function fetchWorkflowPassRate(workflowFile, branch = 'main', take = 10) {
  try {
    if (!token || !repo || !workflowFile) return null;
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
  return order[Math.min(order.length - 1, i + 1)] || 'MVP';
}

function inferBaseStage(status) {
  if (status === 'Too soon') return 'Prototype';
  return 'MVP';
}

function computeStageAndProgress(pkg, passRate, docs) {
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
    const score = 0.7 * pr + 0.3 * d;
    if (pr >= 0.95 && d) { stage = 'Alpha'; progress = 0; }
    else progress = Math.round(score * 100);
  }

  // Alpha gates → Beta
  // - passRate >= 0.98
  // - docs.hasApi && docs.hasCaveats
  if (stage === 'Alpha') {
    const pr = passRate ?? 0;
    const d = (docs.hasApi && docs.hasCaveats) ? 1 : 0;
    const score = 0.7 * Math.min(1, pr / 0.98) + 0.3 * d;
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
    const score = 0.5 + d; // encourage early progress between 50–100 when usage appears
    progress = Math.round(score * 50); // 0–100 toward MVP
  }

  return { stage, progress, next: nextStage(stage) };
}

async function main() {
  const rows = [];
  const results = [];

  for (const p of cfg.packages) {
    const docs = detectDocsSections(p.readme);
    const passRate = await fetchWorkflowPassRate(p.ci);
    const { stage, progress, next } = computeStageAndProgress(p, passRate, docs);
    results.push({ name: p.name, status: p.status, stage, progress, next, passRate, docs });
  }

  // Write meta/progress.json
  const out = { generatedAt: new Date().toISOString(), repo, results };
  writeFileSync(resolve('meta/progress.json'), JSON.stringify(out, null, 2), 'utf8');

  // Build table markdown
  rows.push('| Package | Status | Stage | Progress | CI | Notes |');
  rows.push('| --- | --- | --- | --- | --- | --- |');
  for (const p of cfg.packages) {
    const r = results.find(x => x.name === p.name) || { stage: inferBaseStage(p.status), progress: 0, next: 'Alpha' };
    const badge = p.ci ? `![${p.ci}](https://github.com/${repo || 'flyingrobots/wesley'}/actions/workflows/${p.ci}/badge.svg?branch=main)` : '—';
    const prog = r.stage === 'v1.0.0' ? '100% — v1.0.0' : `${r.progress}% → ${r.next}`;
    rows.push(`| \`${p.name}\` | ${p.status} | ${r.stage} | ${prog} | ${badge} | ${p.notes} |`);
  }

  // Update README between markers
  const readmePath = resolve('README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const startMarker = '<!-- BEGIN:PACKAGE_MATRIX -->';
  const endMarker = '<!-- END:PACKAGE_MATRIX -->';
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    console.error('Package matrix markers not found in README.md');
    process.exit(2);
  }
  const before = readme.slice(0, start + startMarker.length);
  const after = readme.slice(end);
  const body = '\n' + rows.join('\n') + '\n';
  const nextReadme = before + body + after;
  writeFileSync(readmePath, nextReadme, 'utf8');

  console.log('Updated meta/progress.json and README Package Matrix.');
}

main().catch((e) => { console.error(e?.stack || e); process.exit(1); });

