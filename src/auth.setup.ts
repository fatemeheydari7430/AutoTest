import { test as setup } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '@/config';
import { CLOUDFLARE_STATE_PATH } from '@/config/paths';

const CLOUDFLARE_COOKIE = /^CF[_-]/i;
const CLOUDFLARE_DOMAIN = /cloudflareaccess\.com$/i;

/**
 * Capture ONLY the Cloudflare Access / Azure AD cookies needed to reach the app.
 * The app's own session (access token, lead, car-insurance state) is deliberately
 * excluded, so every test run authenticates inside the app from scratch.
 *
 * Fast path: when the app origin is reachable directly (no Cloudflare Access
 * challenge), the existing state file is already sufficient and the browser is
 * not launched at all. The browser capture only runs when Access is enforced.
 */
setup('capture Cloudflare Access state only', async ({ request, browser }) => {
  mkdirSync(dirname(CLOUDFLARE_STATE_PATH), { recursive: true });

  if (existsSync(CLOUDFLARE_STATE_PATH)) {
    try {
      const reachable = await request.get(config.web.baseURL, { maxRedirects: 5 });
      if (
        reachable.status() < 400 &&
        !/cloudflareaccess\.com|microsoftonline\.com/i.test(reachable.url())
      ) {
        return;
      }
    } catch {
      // fall through to the browser capture below
    }
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(config.web.baseURL, { waitUntil: 'domcontentloaded' });

  // If an identity provider is presented, a human would have to sign in.
  await page.waitForURL(
    (url) => !/cloudflareaccess\.com|microsoftonline\.com/i.test(url.hostname),
    { timeout: 60_000 },
  );

  const state = await context.storageState();
  const cookies = state.cookies.filter(
    (cookie) =>
      CLOUDFLARE_COOKIE.test(cookie.name) || CLOUDFLARE_DOMAIN.test(cookie.domain),
  );

  writeFileSync(
    CLOUDFLARE_STATE_PATH,
    JSON.stringify({ cookies, origins: [] }, null, 2),
  );

  await context.close();
});
