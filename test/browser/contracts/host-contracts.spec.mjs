import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const OUT = process.env.OUT_JSON || '';

test('host contracts pass in browser', async ({ page }) => {
  await page.goto('http://127.0.0.1:8787/index.html');
  await page.waitForFunction(() => !!window.__host_contracts, null, { timeout: 15000 });
  const res = await page.evaluate(() => window.__host_contracts);
  expect(res && res.failed === 0).toBeTruthy();
  if (OUT) {
    await fs.writeFile(OUT, JSON.stringify(res), 'utf8');
  }
});

