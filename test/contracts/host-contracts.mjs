/**
 * Host Contracts – shared, host-agnostic checks
 * Intent: quick viability tests across Node, Deno, Bun, Browser.
 * No Node built-ins here; only Web APIs available everywhere.
 */

function te(str) { return new TextEncoder().encode(str); }

async function sha256Hex(input) {
  const data = typeof input === 'string' ? te(input) : te(JSON.stringify(input));
  const d = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function byteLen(str) { return te(str).length; }

function sanitizeGraphQL(sdl, maxBytes = 5 * 1024 * 1024) {
  if (typeof sdl !== 'string') throw new Error('Schema must be a string');
  if (byteLen(sdl) > maxBytes) { const e = new Error(`Schema exceeds max size (${maxBytes} bytes)`); e.code = 'EINPUTSIZE'; throw e; }
  return sdl.replace(/^\uFEFF/, '').replace(/\u0000/g, '');
}

function detectTables(sdl) {
  const out = [];
  const re = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^\{]*)\{/g;
  let m;
  while ((m = re.exec(sdl)) !== null) {
    const name = m[1];
    const head = m[2] || '';
    if (/@wes_table\b|@wesley_table\b|\b@table\b/.test(head)) out.push({ name });
  }
  return out;
}

async function makeToken(schemaObj) {
  const digest = await sha256Hex(schemaObj);
  return `HC_OK:${digest.slice(0, 12)}`;
}

export async function runAll(opts = {}) {
  const results = [];
  const add = (name, ok, details) => results.push({ name, ok, ...(details ? { details } : {}) });

  // Case 1: minimal schema with two tables
  try {
    const sdl = `type Org @wes_table { id: ID! @wes_pk }\n` +
                `type User @wes_table { id: ID! @wes_pk, org_id: ID! @wes_fk(ref: "Org.id") }`;
    const clean = sanitizeGraphQL(sdl, opts.maxBytes ?? 1024 * 1024);
    const tables = detectTables(clean);
    const token = await makeToken({ tables: tables.map(t => t.name).sort() });
    const ok = tables.length === 2 && token.startsWith('HC_OK:');
    add('basic-two-tables', ok, { tables: tables.length, token });
  } catch (e) { add('basic-two-tables', false, { error: String(e?.message || e) }); }

  // Case 2: size guard trips with small limit
  try {
    const sdl = 'type A @wes_table { id: ID! @wes_pk }\n' + 'x'.repeat(2048);
    let threw = false;
    try {
      sanitizeGraphQL(sdl, 128);
    } catch (e) {
      threw = e?.code === 'EINPUTSIZE';
    }
    add('size-guard', threw, null);
  } catch (e) { add('size-guard', false, { error: String(e?.message || e) }); }

  // Case 3: token stability for same input
  try {
    const obj = { hello: 'world', n: 42 };
    const t1 = await makeToken(obj);
    const t2 = await makeToken(obj);
    add('token-stability', t1 === t2, { t1, t2 });
  } catch (e) { add('token-stability', false, { error: String(e?.message || e) }); }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  return { passed, failed, cases: results };
}

// If executed directly under Node/Bun/Deno (not imported), run and print JSON
if (import.meta.main || (typeof Deno !== 'undefined' && Deno?.mainModule === import.meta.url)) {
  const out = await runAll();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out));
}

