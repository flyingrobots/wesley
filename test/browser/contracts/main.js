import { runAll } from '../../contracts/host-contracts.mjs';

// CSS class names used by the browser summary UI
const CSS_CLASSES = Object.freeze({
  report: 'report',
  title: 'report__title',
  meta: 'report__meta',
  stat: 'report__stat',
  statLabel: 'report__stat-label',
  cases: 'report__cases',
  testCase: 'report__test-case',
  testOk: 'report__test-case--ok',
  testFail: 'report__test-case--failed',
  statusIconOk: 'report__status-icon report__status-icon--ok',
  statusIconFail: 'report__status-icon report__status-icon--fail',
  badgeOk: 'report__badge report__badge--ok',
  badgeFail: 'report__badge report__badge--failed',
  code: 'report__code',
  pre: 'report__pre',
  details: 'report__details',
  summary: 'report__summary'
});

// Robust HTML escaping (based on OWASP XSS Prevention Cheat Sheet)
// Escapes & < > " ' and / — safe to use when building strings that will be inserted as text
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  return String(str).replace(/[&<>"'\/]/g, (ch) => map[ch]);
}

// verifyIr now returns structured diagnostics with rich context
async function verifyIr() {
  const { createBrowserRuntime } = await import('../../../packages/wesley-host-browser/src/createBrowserRuntime.mjs');
  const rt = await createBrowserRuntime();
  const sdl = `type Org @wes_table { id: ID! @wes_pk }\n`+
              `type User @wes_table { id: ID! @wes_pk, org_id: ID! @wes_fk(ref: "Org.id") }`;
  const ir = await rt.parsers.graphql.parse(sdl);
  const expectedTableCount = 2;
  const errors = [];
  const details = {
    expectedTableCount,
    actualTableCount: Array.isArray(ir.tables) ? ir.tables.length : 0,
    missingTables: [],
    missingColumns: {},
    sdlSnippet: sdl.slice(0, 200)
  };
  if (!Array.isArray(ir.tables)) errors.push('tables array missing');
  if (Array.isArray(ir.tables) && ir.tables.length !== expectedTableCount) {
    errors.push(`tables: expected ${expectedTableCount}, got ${ir.tables.length}`);
  }
  if (Array.isArray(ir.tables)) {
    const expectedTables = ['Org', 'User'];
    for (const name of expectedTables) {
      const t = ir.tables.find((x) => x.name === name);
      if (!t) details.missingTables.push(name);
    }
    const u = ir.tables.find(t => t.name === 'User');
    if (!u) {
      errors.push('missing table: User');
    } else {
      const missing = [];
      if (!Array.isArray(u.columns) || !u.columns.some(c => c.name === 'id')) missing.push('id');
      if (missing.length) {
        details.missingColumns['User'] = missing;
        errors.push(`User missing columns: ${missing.join(', ')}`);
      }
    }
  }
  details.summary = errors.join('; ');
  return { ok: errors.length === 0, errors, details };
}

function createStatusIcon(ok) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14'); svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('role', 'img');
  svg.setAttribute('class', ok ? CSS_CLASSES.statusIconOk : CSS_CLASSES.statusIconFail);
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = ok ? 'pass' : 'fail'; svg.appendChild(title);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', ok ? 'M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z' : 'M18.3 5.71L12 12.01 5.7 5.71 4.29 7.12 10.59 13.4 4.29 19.7l1.41 1.41 6.3-6.3 6.29 6.3 1.41-1.41-6.29-6.3 6.29-6.28z');
  svg.appendChild(path);
  return svg;
}

function createReportHeader(res) {
  const frag = document.createDocumentFragment();
  const h1 = document.createElement('h1'); h1.className = CSS_CLASSES.title; h1.appendChild(document.createTextNode('Host Contracts (Browser)'));
  const meta = document.createElement('p'); meta.className = CSS_CLASSES.meta;
  const stat = (label, value) => {
    const wrap = document.createElement('span'); wrap.className = CSS_CLASSES.stat;
    const l = document.createElement('span'); l.className = CSS_CLASSES.statLabel; l.appendChild(document.createTextNode(label));
    const v = document.createTextNode(` ${value}`);
    wrap.appendChild(l); wrap.appendChild(v);
    return wrap;
  };
  meta.appendChild(stat('Passed:', res.passed));
  meta.appendChild(stat('Failed:', res.failed));
  meta.appendChild(stat('Total:', res.passed + res.failed));
  frag.appendChild(h1); frag.appendChild(meta);
  return frag;
}

function createFailureDetailsElement(d) {
  const details = document.createElement('details'); details.className = CSS_CLASSES.details; details.open = true;
  const summary = document.createElement('summary'); summary.className = CSS_CLASSES.summary; const label = document.createElement('span'); label.appendChild(document.createTextNode('IR diagnostics')); summary.appendChild(label); details.appendChild(summary);
  const wrap = document.createElement('div');
  if (typeof d.expectedTableCount === 'number' || typeof d.actualTableCount === 'number') {
    const row = document.createElement('div'); row.appendChild(document.createTextNode(`tables: expected=${d.expectedTableCount} actual=${d.actualTableCount}`)); wrap.appendChild(row);
  }
  const mt = Array.isArray(d.missingTables) && d.missingTables.length ? d.missingTables.join(', ') : '—';
  const rowMt = document.createElement('div'); rowMt.appendChild(document.createTextNode(`missing tables: ${mt}`)); wrap.appendChild(rowMt);
  const rowMc = document.createElement('div'); rowMc.appendChild(document.createTextNode('missing columns: ')); const mcCode = document.createElement('code'); mcCode.className = CSS_CLASSES.code; mcCode.textContent = d.missingColumns && typeof d.missingColumns === 'object' ? JSON.stringify(d.missingColumns) : '—'; rowMc.appendChild(mcCode); wrap.appendChild(rowMc);
  if (d.summary) { const row = document.createElement('div'); row.appendChild(document.createTextNode(`summary: ${String(d.summary)}`)); wrap.appendChild(row); }
  if (d.sdlSnippet) { const pre = document.createElement('pre'); pre.className = CSS_CLASSES.pre; pre.textContent = String(d.sdlSnippet); wrap.appendChild(pre); }
  details.appendChild(wrap);
  return details;
}

function createTestCaseElement(c) {
  const li = document.createElement('li');
  li.className = `${CSS_CLASSES.testCase} ${c.ok ? CSS_CLASSES.testOk : CSS_CLASSES.testFail}`;
  li.appendChild(createStatusIcon(c.ok));
  const badge = document.createElement('span'); badge.className = c.ok ? CSS_CLASSES.badgeOk : CSS_CLASSES.badgeFail; badge.appendChild(document.createTextNode(c.ok ? 'PASS' : 'FAIL')); li.appendChild(badge);
  const code = document.createElement('code'); code.className = CSS_CLASSES.code; code.textContent = String(c.name || ''); li.appendChild(code);
  if (!c.ok) {
    const d = c.details || {};
    if (c.name === 'browser-ir-shape' && d) {
      li.appendChild(createFailureDetailsElement(d));
    } else {
      const generic = createFailureDetails(d);
      if (generic) li.appendChild(generic);
    }
  }
  return li;
}

function createFailureDetails(d) {
  if (!d || !(d.error || Object.keys(d).length)) return null;
  const details = document.createElement('details');
  const summary = document.createElement('summary'); summary.className = CSS_CLASSES.summary; const label = document.createElement('span'); label.appendChild(document.createTextNode('Details')); summary.appendChild(label); details.appendChild(summary);
  const pre = document.createElement('pre'); pre.className = CSS_CLASSES.pre; pre.textContent = JSON.stringify(d, null, 2); details.appendChild(pre);
  return details;
}

function renderSummary(el, res) {
  while (el.firstChild) el.removeChild(el.firstChild);
  el.appendChild(createReportHeader(res));
  const ul = document.createElement('ul'); ul.className = CSS_CLASSES.cases;
  for (const c of res.cases || []) ul.appendChild(createTestCaseElement(c));
  el.appendChild(ul);
}

async function main() {
  const el = document.getElementById('report-container');
  if (!el) throw new Error("'#report-container' element not found");

  const res = await runAll();
  const v = await verifyIr();
  if (!v.ok) {
    res.failed += 1;
    res.cases.push({ name: 'browser-ir-shape', ok: false, details: v.details });
  } else {
    res.passed += 1;
    res.cases.push({ name: 'browser-ir-shape', ok: true });
  }
  window.__host_contracts = res;
  renderSummary(el, res);
}

main().catch(err => {
  console.error('Fatal error in main():', err);
  const el = document.getElementById('report-container');
  if (el) el.textContent = 'error';
  window.__host_contracts = {
    passed: 0,
    failed: 1,
    cases: [{ name: 'main-crash', ok: false, details: { error: String(err?.message || err) } }]
  };
});
