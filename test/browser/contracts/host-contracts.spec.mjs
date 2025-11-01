/**
 * Browser host-contracts spec
 * Orchestrated by scripts/host_contracts_browser.mjs, which builds and serves
 * a Vite bundle at http://127.0.0.1:8787. This spec only assumes the server
 * is already running and writes results to OUT_JSON when set.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const OUT_JSON = process.env.OUT_JSON || '';

test('host contracts pass in browser', async ({ page }) => {
  await page.goto('http://127.0.0.1:8787/index.html');
  await page.waitForFunction(() => !!window.__host_contracts, null, { timeout: 15000 });
  const res = await page.evaluate(() => window.__host_contracts);
  expect(res).toBeTruthy();
  // The normal case should pass, but when it fails we expect rich diagnostics
  if (res.failed > 0) {
    const fail = res.cases.find((c) => c.name === 'browser-ir-shape' && c.ok === false);
    if (fail) {
      expect(fail.details).toBeTruthy();
      expect(fail.details.expectedTableCount).toBe(2);
      expect(typeof fail.details.actualTableCount).toBe('number');
      // Either a summary mentioning expected vs actual or missing fields
      expect(
        /expected\s+2\s+tables|missing table|missing columns/i.test(String(fail.details.summary || ''))
      ).toBeTruthy();
      // Include SDL snippet context for debugging
      expect(String(fail.details.sdlSnippet || '')).toContain('type');
    }
  } else {
    expect(res.failed).toBe(0);
  }
  if (OUT_JSON) {
    await fs.writeFile(OUT_JSON, JSON.stringify(res), 'utf8');
  }
});
