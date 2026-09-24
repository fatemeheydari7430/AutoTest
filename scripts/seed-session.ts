import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../src/config/index.ts';
import { STORAGE_STATE_PATH } from '../src/config/paths.ts';

/**
 * Step 1 bootstrap: open a dedicated, persistent browser profile and let us
 * inspect the Cloudflare Access / app-login handoff.
 *
 * Cloudflare Access is passed automatically from this machine's network (IP
 * based), so no manual Azure AD step is normally required. The app itself is
 * browsable as a guest; the account login lives at /auth (mobile + OTP).
 *
 * Run with:  npm run session:seed
 */

const ROOT = process.cwd();
const AUTH_DIR = path.join(ROOT, '.auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'profile');
const EXPLORE_DIR = path.join(AUTH_DIR, 'explore');
const STATUS_FILE = path.join(AUTH_DIR, 'seed-status.json');
const LOG_FILE = path.join(AUTH_DIR, 'seed.log');

const CHANNEL = process.env.SEED_CHANNEL ?? 'msedge';
const HEADLESS = (process.env.SEED_HEADLESS ?? '0') === '1';
const WAIT_MS = Number(process.env.SEED_WAIT_MS ?? 600_000);
const KEEP_OPEN = (process.env.SEED_KEEP_OPEN ?? '0') === '1';
const AUTOLOGIN = (process.env.SEED_AUTOLOGIN ?? '1') === '1';

const loginUrl = `${config.web.baseURL}/auth/?space=vault&callback=%2F&origin=${encodeURIComponent(
  config.web.baseURL,
)}`;

type Stage =
  | 'starting'
  | 'waiting_cloudflare'
  | 'app_login_required'
  | 'waiting_app_login'
  | 'authenticated'
  | 'error';

interface SeedStatus {
  stage: Stage;
  url: string;
  title: string;
  message: string;
  updatedAt: string;
}

let context: BrowserContext | undefined;
let page: Page | undefined;

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // best-effort logging
  }
}

async function setStatus(stage: Stage, message: string): Promise<void> {
  const status: SeedStatus = {
    stage,
    url: page?.url() ?? '',
    title: page ? await page.title().catch(() => '') : '',
    message,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  log(`status=${stage} :: ${message}`);
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2500);
}

function classify(url: string): 'cloudflare' | 'app-login' | 'app' {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'cloudflare';
  }
  const host = u.hostname.toLowerCase();
  if (
    host.includes('cloudflareaccess.com') ||
    host.includes('microsoftonline.com') ||
    host.includes('login.microsoft') ||
    u.pathname.includes('/cdn-cgi/access')
  ) {
    return 'cloudflare';
  }
  if (/\/auth(\/|$|\?)/i.test(u.pathname) || u.searchParams.get('step') === 'otp') {
    return 'app-login';
  }
  return 'app';
}

/** True when a real, visible credential field is present (ignores radio/checkbox/faq inputs). */
async function looksLikeLogin(page: Page): Promise<boolean> {
  const candidates = page
    .getByLabel(/otp|one.?time|verification|mobile|phone|شماره|کد/i)
    .or(page.getByPlaceholder(/otp|code|mobile|phone|شماره|کد/i))
    .or(page.locator('input[type="tel"], input[type="password"], input[inputmode="numeric"]'));
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    const type = (await el.getAttribute('type').catch(() => null)) ?? '';
    if (type === 'radio' || type === 'checkbox') continue;
    if (await el.isVisible().catch(() => false)) return true;
  }
  return false;
}

/** Guest sessions expose a link pointing at the /auth flow. */
async function isGuest(page: Page): Promise<boolean> {
  const authLink = page.locator('a[href*="/auth"]');
  for (let i = 0; i < (await authLink.count()); i++) {
    if (await authLink.nth(i).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function collectInteractive(page: Page): Promise<unknown> {
  return await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map((el) => {
      const e = el as HTMLInputElement;
      let label = '';
      if (e.labels && e.labels.length > 0) {
        label = Array.from(e.labels)
          .map((l) => l.textContent?.trim() ?? '')
          .join(' ');
      }
      return {
        tag: e.tagName.toLowerCase(),
        type: e.type,
        name: e.name,
        id: e.id,
        placeholder: e.placeholder,
        ariaLabel: e.getAttribute('aria-label'),
        label,
        testid: e.getAttribute('data-testid'),
        visible: e.offsetParent !== null,
      };
    });

    const buttons = Array.from(
      document.querySelectorAll(
        'button, a[role="button"], input[type="submit"], input[type="button"]',
      ),
    ).map((el) => {
      const e = el as HTMLInputElement;
      return {
        tag: e.tagName.toLowerCase(),
        text: (e.textContent ?? '').trim().slice(0, 80),
        ariaLabel: e.getAttribute('aria-label'),
        testid: e.getAttribute('data-testid'),
        type: e.type ?? null,
        visible: e.offsetParent !== null,
      };
    });

    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((h) => ({
      level: h.tagName.toLowerCase(),
      text: (h.textContent ?? '').trim().slice(0, 120),
    }));

    return { url: location.href, title: document.title, inputs, buttons, headings };
  });
}

async function dumpArtifacts(page: Page, name: string): Promise<void> {
  mkdirSync(EXPLORE_DIR, { recursive: true });
  const html = await page.content().catch(() => '');
  writeFileSync(path.join(EXPLORE_DIR, `${name}.html`), html);
  const aria = await page
    .locator('body')
    .ariaSnapshot()
    .catch(() => 'ariaSnapshot unavailable');
  writeFileSync(path.join(EXPLORE_DIR, `${name}.aria.yml`), aria);
  const interactive = await collectInteractive(page).catch(() => ({}));
  writeFileSync(
    path.join(EXPLORE_DIR, `${name}.locators.json`),
    JSON.stringify(interactive, null, 2),
  );
  await page.screenshot({ path: path.join(EXPLORE_DIR, `${name}.png`), fullPage: true }).catch(() => {});
  log(`artifacts dumped to .auth/explore/${name}.*`);
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  stage: Stage,
  message: string,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let lastReport = 0;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    if (Date.now() - lastReport > 10_000) {
      await setStatus(stage, message);
      lastReport = Date.now();
    }
    await page!.waitForTimeout(1000);
  }
  return false;
}

async function handleLoginScreen(): Promise<void> {
  await dumpArtifacts(page!, 'app-login');
  await setStatus(
    'app_login_required',
    'App login/OTP screen detected; DOM + locators dumped. Waiting for login to complete.',
  );

  if (AUTOLOGIN) {
    try {
      await performAppLogin(page!);
    } catch (e) {
      log(`auto-login attempt failed, falling back to manual: ${String(e)}`);
    }
  }

  const authenticated = await waitUntil(
    () => classify(page!.url()) === 'app',
    WAIT_MS,
    'waiting_app_login',
    'Waiting for app login/OTP to complete (manual for now)',
  );

  if (!authenticated) {
    await dumpArtifacts(page!, 'app-login-timeout');
    throw new Error('Timed out waiting for app login to complete.');
  }
}

/** Drive the app's own mobile + OTP login using credentials from .env (config.auth). */
async function performAppLogin(page: Page): Promise<void> {
  const phone = page
    .getByRole('textbox', { name: /phone number/i })
    .or(page.getByLabel(/phone number/i))
    .or(page.getByPlaceholder(/enter your phone number/i));
  if ((await phone.count()) === 0) return;
  if (await phone.first().isVisible().catch(() => false)) {
    log(`filling phone number (${config.auth.mobile})`);
    await phone.first().fill(config.auth.mobile);
    await page.getByRole('button', { name: /^continue$/i }).first().click();
  }

  const otp = page
    .getByLabel(/otp|one.?time|verification|code|کد/i)
    .or(page.getByPlaceholder(/otp|code|کد/i))
    .or(page.locator('input[inputmode="numeric"], input[maxlength="1"]'));
  await otp.first().waitFor({ state: 'visible', timeout: 30_000 });

  await dumpArtifacts(page, 'app-otp');
  await setStatus('waiting_app_login', 'OTP screen detected; submitting code.');

  const inputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]');
  const count = await inputs.count();
  if (count > 1) {
    const digits = config.auth.otp.split('');
    for (let i = 0; i < count && i < digits.length; i++) {
      await inputs.nth(i).fill(digits[i]);
    }
  } else {
    await otp.first().fill(config.auth.otp);
  }

  const submit = page.getByRole('button', {
    name: /verify|login|sign in|confirm|continue|submit|ورود|تأیید|تایید|ادامه/i,
  });
  if ((await submit.count()) > 0) {
    await submit
      .first()
      .click({ timeout: 5_000 })
      .catch(() => {
        // Many OTP widgets submit automatically once all digits are entered.
      });
  }

  await page
    .waitForURL((u) => !u.toString().includes('/auth'), { timeout: 30_000 })
    .catch(() => {});
}

/** Authenticated sessions expose a link to /my-account and a token cookie. */
async function verifyAuthenticated(page: Page): Promise<boolean> {
  const accountLink = page.getByRole('link', { name: /my account/i });
  const hasAccountLink =
    (await accountLink.count()) > 0 && (await accountLink.first().isVisible().catch(() => false));
  if (hasAccountLink) return true;

  const cookies = await page.context().cookies();
  return cookies.some((c) => /access_token|token/i.test(c.name) && c.value.length > 0);
}

async function main(): Promise<void> {
  mkdirSync(PROFILE_DIR, { recursive: true });
  mkdirSync(EXPLORE_DIR, { recursive: true });
  await setStatus('starting', `launching ${CHANNEL} persistent context`);

  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: CHANNEL,
    headless: HEADLESS,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  page = context.pages()[0] ?? (await context.newPage());

  log(`navigating to ${config.web.baseURL}`);
  await page.goto(config.web.baseURL, { waitUntil: 'domcontentloaded' }).catch((e) => {
    log(`initial navigation error: ${String(e)}`);
  });

  const passedCloudflare = await waitUntil(
    () => classify(page!.url()) !== 'cloudflare',
    WAIT_MS,
    'waiting_cloudflare',
    'Waiting for operator to finish Cloudflare Access / Azure AD sign-in',
  );

  if (!passedCloudflare) {
    await dumpArtifacts(page, 'cloudflare-timeout');
    throw new Error('Timed out waiting for Cloudflare Access / Azure AD sign-in.');
  }

  await settle(page);

  const onLogin = classify(page.url()) === 'app-login' || (await looksLikeLogin(page));

  if (onLogin) {
    await handleLoginScreen();
  } else {
    await dumpArtifacts(page, 'home');
    if (await isGuest(page)) {
      await setStatus(
        'app_login_required',
        'Public home reached as guest; opening the app login page to inspect it.',
      );
      log(`opening login page: ${loginUrl}`);
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page);
      await handleLoginScreen();
    }
  }

  await settle(page);
  await dumpArtifacts(page, 'authenticated');

  if (!(await verifyAuthenticated(page))) {
    await setStatus('error', 'Reached the app but the session does not look authenticated.');
    throw new Error('Login did not persist: no account link / token cookie found.');
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  log(`storageState saved to ${STORAGE_STATE_PATH}`);
  await setStatus('authenticated', 'Authenticated and storageState saved.');

  if (KEEP_OPEN) {
    log('SEED_KEEP_OPEN=1 -> leaving browser open. Close the window or Ctrl+C to exit.');
    await new Promise(() => {});
  }
}

main()
  .catch(async (error: unknown) => {
    await setStatus('error', error instanceof Error ? error.message : String(error));
    if (page && context) {
      await dumpArtifacts(page, 'error').catch(() => {});
    }
    if (KEEP_OPEN && context) {
      log('Error occurred; leaving browser open for inspection (SEED_KEEP_OPEN=1).');
      await new Promise(() => {});
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    if (context) {
      await context.tracing
        .stop({ path: path.join(EXPLORE_DIR, 'trace.zip') })
        .catch((e) => log(`tracing stop failed: ${String(e)}`));
      await context.close().catch(() => {});
    }
    log('seed session finished');
  });
