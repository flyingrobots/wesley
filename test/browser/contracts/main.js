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
  el.textContent = `passed=${res.passed} failed=${res.failed}`;
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
