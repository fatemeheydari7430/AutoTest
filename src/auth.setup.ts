import { test as setup } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '@/config';
import { CLOUDFLARE_STATE_PATH } from '@/config/paths';

const CLOUDFLARE_COOKIE = /^CF[_-]/i;
const CLOUDFLARE_DOMAIN = /cloudflareaccess\.com$/i;

/**
 * Capture ONLY the Cloudflare Access / Azure AD cookies needed to reach the app.
 * The app's own session (access token, lead, car-insurance state) is deliberately
 * excluded, so every test run authenticates inside the app from scratch.
 */
setup('capture Cloudflare Access state only', async ({ page }) => {
  mkdirSync(dirname(CLOUDFLARE_STATE_PATH), { recursive: true });

  await page.goto(config.web.baseURL, { waitUntil: 'domcontentloaded' });

  // If an identity provider is presented, a human would have to sign in.
  await page.waitForURL(
    (url) => !/cloudflareaccess\.com|microsoftonline\.com/i.test(url.hostname),
    { timeout: 60_000 },
  );

  const state = await page.context().storageState();
  const cookies = state.cookies.filter(
    (cookie) =>
      CLOUDFLARE_COOKIE.test(cookie.name) || CLOUDFLARE_DOMAIN.test(cookie.domain),
  );

  writeFileSync(
    CLOUDFLARE_STATE_PATH,
    JSON.stringify({ cookies, origins: [] }, null, 2),
  );
});
