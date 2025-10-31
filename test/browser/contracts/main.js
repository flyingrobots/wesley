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
  while (el.firstChild) el.removeChild(el.firstChild);
  const icon = (ok) => (ok ? '✅' : '❌');
  const text = (s) => document.createTextNode(String(s));

  const h1 = document.createElement('h1');
  h1.appendChild(text('Host Contracts (Browser)'));
  el.appendChild(h1);

  const meta = document.createElement('p');
  meta.className = 'meta';
  const s1 = document.createElement('strong'); s1.appendChild(text('Passed:'));
  const s2 = document.createElement('strong'); s2.appendChild(text('Failed:'));
  const s3 = document.createElement('strong'); s3.appendChild(text('Total:'));
  meta.appendChild(s1); meta.appendChild(text(` ${res.passed} `));
  meta.appendChild(text('\u00A0\u00A0'));
  meta.appendChild(s2); meta.appendChild(text(` ${res.failed} `));
  meta.appendChild(text('\u00A0\u00A0'));
  meta.appendChild(s3); meta.appendChild(text(` ${res.passed + res.failed}`));
  el.appendChild(meta);

  const ul = document.createElement('ul');
  ul.className = 'cases';

  for (const c of res.cases || []) {
    const li = document.createElement('li');
    li.className = c.ok ? 'ok' : 'fail';

    li.appendChild(text(icon(c.ok) + ' '));
    const code = document.createElement('code');
    code.textContent = String(c.name || '');
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
          row.appendChild(text(`tables: expected=${d.expectedTableCount} actual=${d.actualTableCount}`));
          wrap.appendChild(row);
        }
        const mt = Array.isArray(d.missingTables) && d.missingTables.length ? d.missingTables.join(', ') : '—';
        const rowMt = document.createElement('div'); rowMt.appendChild(text(`missing tables: ${mt}`)); wrap.appendChild(rowMt);
        const rowMc = document.createElement('div');
        rowMc.appendChild(text('missing columns: '));
        const mcCode = document.createElement('code');
        mcCode.textContent = d.missingColumns && typeof d.missingColumns === 'object' ? JSON.stringify(d.missingColumns) : '—';
        rowMc.appendChild(mcCode); wrap.appendChild(rowMc);
        if (d.summary) { const row = document.createElement('div'); row.appendChild(text(`summary: ${String(d.summary)}`)); wrap.appendChild(row); }
        if (d.sdlSnippet) { const pre = document.createElement('pre'); pre.textContent = String(d.sdlSnippet); wrap.appendChild(pre); }
        details.appendChild(wrap); li.appendChild(details);
      } else if (d && (d.error || Object.keys(d).length)) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const strong = document.createElement('strong'); strong.appendChild(text('Details'));
        summary.appendChild(strong); details.appendChild(summary);
        const pre = document.createElement('pre'); pre.textContent = JSON.stringify(d, null, 2);
        details.appendChild(pre); li.appendChild(details);
      }
    }

    ul.appendChild(li);
  }

  el.appendChild(ul);
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
