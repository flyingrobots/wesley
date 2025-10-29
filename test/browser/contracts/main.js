import { runAll } from '../../contracts/host-contracts.mjs';

// Extend: verify minimal IR shape on the browser parser for one case
async function verifyIr() {
  const { createBrowserRuntime } = await import('../../../packages/wesley-host-browser/src/createBrowserRuntime.mjs');
  const rt = await createBrowserRuntime();
  const sdl = `type Org @wes_table { id: ID! @wes_pk }\n`+
              `type User @wes_table { id: ID! @wes_pk, org_id: ID! @wes_fk(ref: "Org.id") }`;
  const ir = await rt.parsers.graphql.parse(sdl);
  if (!Array.isArray(ir.tables) || ir.tables.length !== 2) return false;
  const u = ir.tables.find(t => t.name === 'User');
  return !!(u && Array.isArray(u.columns) && u.columns.some(c => c.name === 'id'));
}

async function main() {
  const el = document.getElementById('app');
  if (!el) {
    window.__host_contracts = { passed: 0, failed: 1, cases: [{ name: 'bootstrap', ok: false, details: { error: "'#app' element not found" } }] };
    return;
  }
  try {
    const res = await runAll();
    const irOk = await verifyIr();
    if (!irOk) {
      res.failed += 1;
      res.cases.push({ name: 'browser-ir-shape', ok: false });
    } else {
      res.passed += 1;
      res.cases.push({ name: 'browser-ir-shape', ok: true });
    }
    window.__host_contracts = res;
    el.textContent = `passed=${res.passed} failed=${res.failed}`;
  } catch (e) {
    window.__host_contracts = { passed: 0, failed: 1, cases: [{ name: 'bootstrap', ok: false, details: { error: String(e?.message || e) } }] };
    el.textContent = 'error';
  }
}

main().catch(err => {
  console.error('Fatal error in main():', err);
  window.__host_contracts = {
    passed: 0,
    failed: 1,
    cases: [{ name: 'main-crash', ok: false, details: { error: String(err) } }]
  };
});
