import { test, expect } from '@playwright/test';

test('browser smoke renders token', async ({ page }) => {
  await page.goto('http://127.0.0.1:8787/index.html');
  await page.waitForFunction(() => !!window.__wesley_smoke, null, { timeout: 15000 });
  const res = await page.evaluate(() => window.__wesley_smoke);
  expect(res && res.ok).toBeTruthy();
  expect(String(res.token)).toContain('BROWSER_SMOKE_OK:');
});

