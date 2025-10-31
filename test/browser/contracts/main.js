import { runAll } from '../../contracts/host-contracts.mjs';

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
  const esc = (s) => String(s).replace(/[&<>"]+/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const icon = (ok) => ok ? '✅' : '❌';
  const rows = [];
  rows.push('<h1>Host Contracts (Browser)</h1>');
  rows.push(`<p><strong>Passed:</strong> ${res.passed} &nbsp; <strong>Failed:</strong> ${res.failed} &nbsp; <strong>Total:</strong> ${res.passed + res.failed}</p>`);
  rows.push('<ul>');
  for (const c of res.cases || []) {
    if (c.ok) {
      rows.push(`<li>${icon(true)} <code>${esc(c.name)}</code></li>`);
      continue;
    }
    // Failure — include rich diagnostics when available
    rows.push('<li>');
    rows.push(`${icon(false)} <code>${esc(c.name)}</code>`);
    const d = c.details || {};
    if (c.name === 'browser-ir-shape' && d) {
      const mt = Array.isArray(d.missingTables) && d.missingTables.length ? d.missingTables.join(', ') : '—';
      const mc = d.missingColumns && typeof d.missingColumns === 'object' ? esc(JSON.stringify(d.missingColumns)) : '—';
      rows.push('<div style="margin:6px 0 10px 24px;">');
      rows.push('<div><strong>IR diagnostics</strong></div>');
      if (typeof d.expectedTableCount === 'number' || typeof d.actualTableCount === 'number') {
        rows.push(`<div>tables: expected=${esc(d.expectedTableCount)} actual=${esc(d.actualTableCount)}</div>`);
      }
      rows.push(`<div>missing tables: ${esc(mt)}</div>`);
      rows.push(`<div>missing columns: <code>${mc}</code></div>`);
      if (d.summary) rows.push(`<div>summary: ${esc(d.summary)}</div>`);
      if (d.sdlSnippet) rows.push(`<pre style="background:#f6f8fa;padding:8px;border-radius:6px;">${esc(d.sdlSnippet)}</pre>`);
      rows.push('</div>');
    } else if (d && (d.error || Object.keys(d).length)) {
      rows.push('<div style="margin:6px 0 10px 24px;">');
      rows.push('<div><strong>Details</strong></div>');
      rows.push(`<pre style="background:#f6f8fa;padding:8px;border-radius:6px;">${esc(JSON.stringify(d, null, 2))}</pre>`);
      rows.push('</div>');
    }
    rows.push('</li>');
  }
  rows.push('</ul>');
  el.innerHTML = rows.join('\n');
}

async function main() {
  const el = document.getElementById('app');
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
  const el = document.getElementById('app');
  if (el) el.textContent = 'error';
  window.__host_contracts = {
    passed: 0,
    failed: 1,
    cases: [{ name: 'main-crash', ok: false, details: { error: String(err?.message || err) } }]
  };
});
