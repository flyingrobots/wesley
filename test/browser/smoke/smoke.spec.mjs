import { test, expect } from '@playwright/test';

test('browser smoke renders token', async ({ page }) => {
  const port = process.env.TEST_SERVER_PORT || '8787';
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => !!window.__WESLEY_TEST_SMOKE, null, { timeout: 15000 });
  const res = await page.evaluate(() => window.__WESLEY_TEST_SMOKE);
  expect(res && res.ok).toBeTruthy();
  expect(res.token).toContain('BROWSER_SMOKE_OK:');
});
