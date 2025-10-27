import { runAll } from '../../contracts/host-contracts.mjs';

async function main() {
  const el = document.getElementById('app');
  try {
    const res = await runAll();
    window.__host_contracts = res;
    el.textContent = `passed=${res.passed} failed=${res.failed}`;
  } catch (e) {
    window.__host_contracts = { passed: 0, failed: 1, cases: [{ name: 'bootstrap', ok: false, details: { error: String(e?.message || e) } }] };
    el.textContent = 'error';
  }
}

main();

