import { runAll } from '../../contracts/host-contracts.mjs';

// CSS class names used by the browser summary UI
const CSS_CLASSES = Object.freeze({
  cases: 'cases',
  testCase: 'test-case',
  ok: 'ok',
  fail: 'fail',
  meta: 'meta',
  statLabel: 'stat-label'
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

function renderSummary(el, res) {
  while (el.firstChild) el.removeChild(el.firstChild);
  const icon = (ok) => (ok ? '✅' : '❌');
  const text = (s) => document.createTextNode(String(s));

  const h1 = document.createElement('h1');
  h1.appendChild(text('Host Contracts (Browser)'));
  el.appendChild(h1);

  const meta = document.createElement('p');
  meta.className = CSS_CLASSES.meta;
  const s1 = document.createElement('span'); s1.className = CSS_CLASSES.statLabel; s1.appendChild(text('Passed:'));
  const s2 = document.createElement('span'); s2.className = CSS_CLASSES.statLabel; s2.appendChild(text('Failed:'));
  const s3 = document.createElement('span'); s3.className = CSS_CLASSES.statLabel; s3.appendChild(text('Total:'));
  meta.appendChild(s1); meta.appendChild(text(` ${res.passed} `));
  meta.appendChild(s2); meta.appendChild(text(` ${res.failed} `));
  meta.appendChild(s3); meta.appendChild(text(` ${res.passed + res.failed}`));
  el.appendChild(meta);

  const ul = document.createElement('ul');
  ul.className = CSS_CLASSES.cases;

  for (const c of res.cases || []) {
    const li = document.createElement('li');
    li.className = `${CSS_CLASSES.testCase} ${c.ok ? CSS_CLASSES.ok : CSS_CLASSES.fail}`;

    li.appendChild(text(icon(c.ok) + ' '));
    // Add a PASS/FAIL badge and accessible SVG icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14'); svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('role', 'img');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = c.ok ? 'pass' : 'fail';
    svg.appendChild(title);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', c.ok ? 'currentColor' : 'currentColor');
    if (c.ok) {
      path.setAttribute('d', 'M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z');
    } else {
      path.setAttribute('d', 'M18.3 5.71L12 12.01 5.7 5.71 4.29 7.12 10.59 13.4 4.29 19.7l1.41 1.41 6.3-6.3 6.29 6.3 1.41-1.41-6.29-6.3 6.29-6.28z');
    }
    svg.appendChild(path);
    li.appendChild(svg);

    // PASS/FAIL badge
    const badge = document.createElement('span');
    badge.className = 'badge ' + (c.ok ? 'badge-ok' : 'badge-fail');
    badge.appendChild(text(c.ok ? 'PASS' : 'FAIL'));
    li.appendChild(badge);
    const code = document.createElement('code');
    code.textContent = escapeHtml(String(c.name || ''));
    li.appendChild(code);

    if (!c.ok) {
      const d = c.details || {};
      if (c.name === 'browser-ir-shape' && d) {
        const details = document.createElement('details'); details.open = true;
        const summary = document.createElement('summary');
        const strong = document.createElement('strong'); strong.appendChild(text('IR diagnostics'));
        summary.appendChild(strong); details.appendChild(summary);
        const wrap = document.createElement('div');
        if (typeof d.expectedTableCount === 'number' || typeof d.actualTableCount === 'number') {
          const row = document.createElement('div');
          row.appendChild(text(`tables: expected=${escapeHtml(d.expectedTableCount)} actual=${escapeHtml(d.actualTableCount)}`));
          wrap.appendChild(row);
        }
        const mt = Array.isArray(d.missingTables) && d.missingTables.length ? d.missingTables.join(', ') : '—';
        const rowMt = document.createElement('div'); rowMt.appendChild(text(`missing tables: ${mt}`)); wrap.appendChild(rowMt);
        const rowMc = document.createElement('div');
        rowMc.appendChild(text('missing columns: '));
        const mcCode = document.createElement('code');
        mcCode.textContent = d.missingColumns && typeof d.missingColumns === 'object' ? escapeHtml(JSON.stringify(d.missingColumns)) : '—';
        rowMc.appendChild(mcCode); wrap.appendChild(rowMc);
        if (d.summary) { const row = document.createElement('div'); row.appendChild(text(`summary: ${escapeHtml(String(d.summary))}`)); wrap.appendChild(row); }
        if (d.sdlSnippet) { const pre = document.createElement('pre'); pre.textContent = escapeHtml(String(d.sdlSnippet)); wrap.appendChild(pre); }
        details.appendChild(wrap); li.appendChild(details);
      } else if (d && (d.error || Object.keys(d).length)) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const strong = document.createElement('strong'); strong.appendChild(text('Details'));
        summary.appendChild(strong); details.appendChild(summary);
        const pre = document.createElement('pre'); pre.textContent = escapeHtml(JSON.stringify(d, null, 2));
        details.appendChild(pre); li.appendChild(details);
      }
    }

    ul.appendChild(li);
  }

  el.appendChild(ul);
}

async function main() {
  const el = document.getElementById('report-container');
  if (!el) throw new Error("'#app' element not found");

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
