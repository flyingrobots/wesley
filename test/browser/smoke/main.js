import { runInBrowser } from '@wesley/host-browser';

const schema = /* GraphQL */ `
  type Org @wes_table { id: ID! @wes_pk }
  type User @wes_table { id: ID! @wes_pk, org_id: ID! @wes_fk(ref: "Org.id") }
`;

async function main() {
  const el = document.getElementById('result');
  if (!el) {
    window.__WESLEY_TEST_SMOKE = { ok: false, error: "missing #result" };
    return;
  }
  try {
    const res = await runInBrowser(schema);
    const ok = res.ok && typeof res.token === 'string' && res.token.startsWith('BROWSER_SMOKE_OK:');
    window.__WESLEY_TEST_SMOKE = ok ? { ok, token: res.token } : { ok, token: res.token, reason: JSON.stringify(res) };
    el.textContent = ok ? `OK: ${res.token}` : `FAILED: ${JSON.stringify(res)}`;
    el.className = ok ? 'ok' : 'err';
  } catch (err) {
    window.__WESLEY_TEST_SMOKE = { ok: false, error: String(err?.message || err) };
    el.textContent = `ERROR: ${String(err?.message || err)}`;
    el.className = 'err';
    console.error(err);
  }
}

main();
