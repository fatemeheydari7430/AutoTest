import { chromium, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../src/config/index.ts';

/**
 * Reusable explorer / mini-driver.
 *
 * Opens the authenticated persistent profile (seeded by `npm run session:seed`),
 * navigates to a URL and optionally runs a JSON "plan" of actions, dumping the
 * aria snapshot, DOM, candidate locators and a screenshot after each dump step.
 *
 * Run with:
 *   npm run session:explore -- --url <url> --name <name>
 *   npm run session:explore -- --url <url> --plan <plan.json>
 */

const ROOT = process.cwd();
const AUTH_DIR = path.join(ROOT, '.auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'profile');
const EXPLORE_DIR = path.join(AUTH_DIR, 'explore');
const STATUS_FILE = path.join(AUTH_DIR, 'explore-status.json');
const LOG_FILE = path.join(AUTH_DIR, 'explore.log');

const CHANNEL = process.env.SEED_CHANNEL ?? 'msedge';
const HEADLESS = (process.env.SEED_HEADLESS ?? '0') === '1';

const argv = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const targetUrl = flag('url', config.web.baseURL);
const name = flag('name', 'explore');
const waitMs = Number(flag('wait', '3000'));
const planPath = flag('plan', '');

interface StepSelector {
  role?: string;
  name?: string;
  exact?: boolean;
  label?: string;
  placeholder?: string;
  testid?: string;
  text?: string;
  nth?: number;
  visible?: boolean;
}

interface Step {
  action:
    | 'goto'
    | 'click'
    | 'clickIfVisible'
    | 'fill'
    | 'fillIfVisible'
    | 'wait'
    | 'dump'
    | 'saveState';
  url?: string;
  ms?: number;
  dumpName?: string;
  value?: string;
  selector?: StepSelector;
}

let context: BrowserContext | undefined;
let page: Page | undefined;

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // best-effort
  }
}

function locatorFor(page: Page, sel: StepSelector): Locator {
  let base: Locator;
  if (sel.testid) {
    base = page.getByTestId(sel.testid);
  } else if (sel.role) {
    base = page.getByRole(sel.role as Parameters<Page['getByRole']>[0], {
      name: sel.name,
      exact: sel.exact ?? true,
    });
  } else if (sel.label) {
    base = page.getByLabel(sel.label, { exact: sel.exact ?? false });
  } else if (sel.placeholder) {
    base = page.getByPlaceholder(sel.placeholder, { exact: sel.exact ?? false });
  } else if (sel.text) {
    base = page.getByText(sel.text, { exact: sel.exact ?? false });
  } else {
    throw new Error(`step selector has no criteria: ${JSON.stringify(sel)}`);
  }
  if (sel.visible !== false) {
    base = base.filter({ visible: true });
  }
  return base.nth(sel.nth ?? 0);
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

    const links = Array.from(document.querySelectorAll('a[href]')).map((a) => ({
      text: (a.textContent ?? '').trim().slice(0, 80),
      href: (a as HTMLAnchorElement).getAttribute('href'),
      ariaLabel: a.getAttribute('aria-label'),
      visible: (a as HTMLElement).offsetParent !== null,
    }));

    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((h) => ({
      level: h.tagName.toLowerCase(),
      text: (h.textContent ?? '').trim().slice(0, 120),
    }));

    return { url: location.href, title: document.title, inputs, buttons, links, headings };
  });
}

async function dumpArtifacts(page: Page, dumpName: string): Promise<void> {
  mkdirSync(EXPLORE_DIR, { recursive: true });
  const html = await page.content().catch(() => '');
  writeFileSync(path.join(EXPLORE_DIR, `${dumpName}.html`), html);
  const aria = await page
    .locator('body')
    .ariaSnapshot()
    .catch(() => 'ariaSnapshot unavailable');
  writeFileSync(path.join(EXPLORE_DIR, `${dumpName}.aria.yml`), aria);
  const interactive = await collectInteractive(page).catch(() => ({}));
  writeFileSync(
    path.join(EXPLORE_DIR, `${dumpName}.locators.json`),
    JSON.stringify(interactive, null, 2),
  );
  await page
    .screenshot({ path: path.join(EXPLORE_DIR, `${dumpName}.png`), fullPage: true })
    .catch(() => {});
  log(`artifacts dumped to .auth/explore/${dumpName}.*`);
}

async function runPlan(page: Page, steps: Step[]): Promise<void> {
  for (const step of steps) {
    log(`step: ${JSON.stringify(step)}`);
    switch (step.action) {
      case 'goto':
        await page.goto(step.url ?? targetUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('load').catch(() => {});
        await page.waitForTimeout(waitMs);
        break;
      case 'click':
        await locatorFor(page, step.selector ?? {}).click();
        await page.waitForLoadState('load').catch(() => {});
        await page.waitForTimeout(waitMs);
        break;
      case 'clickIfVisible': {
        const loc = locatorFor(page, step.selector ?? {});
        if (await loc.isVisible({ timeout: 3000 }).catch(() => false)) {
          await loc.click();
          await page.waitForLoadState('load').catch(() => {});
          await page.waitForTimeout(waitMs);
        } else {
          log('clickIfVisible: element not visible, skipping');
        }
        break;
      }
      case 'fill':
        await locatorFor(page, step.selector ?? {}).fill(step.value ?? '');
        await page.waitForTimeout(500);
        break;
      case 'fillIfVisible': {
        const loc = locatorFor(page, step.selector ?? {});
        if (await loc.isVisible({ timeout: 3000 }).catch(() => false)) {
          await loc.fill(step.value ?? '');
          await page.waitForTimeout(500);
        } else {
          log('fillIfVisible: element not visible, skipping');
        }
        break;
      }
      case 'wait':
        await page.waitForTimeout(step.ms ?? 1000);
        break;
      case 'dump':
        await dumpArtifacts(page, step.dumpName ?? name);
        break;
      case 'saveState':
        await page.context().storageState({ path: path.join(AUTH_DIR, 'storageState.json') });
        log('storageState saved');
        break;
    }
  }
}

async function main(): Promise<void> {
  mkdirSync(PROFILE_DIR, { recursive: true });
  mkdirSync(EXPLORE_DIR, { recursive: true });

  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: CHANNEL,
    headless: HEADLESS,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
  });
  page = context.pages()[0] ?? (await context.newPage());

  page.on('request', (req) => {
    const type = req.resourceType();
    if (type === 'xhr' || type === 'fetch') {
      let suffix = '';
      if (process.env.EXPLORE_LOG_BODIES === '1' && req.postData()) {
        suffix = ` body=${req.postData()!.slice(0, 600)}`;
      }
      log(`req ${req.method()} ${req.url()}${suffix}`);
    }
  });
  page.on('response', async (res) => {
    const req = res.request();
    const type = req.resourceType();
    const isApi = /alpha-api/.test(req.url());
    const logBodies = process.env.EXPLORE_LOG_BODIES === '1';
    if ((type === 'xhr' || type === 'fetch') && (res.status() >= 400 || (logBodies && isApi))) {
      let suffix = '';
      if (logBodies && isApi && res.status() < 400) {
        try {
          suffix = ` body=${(await res.text()).slice(0, 400)}`;
        } catch {
          // ignore
        }
      }
      log(`res ${res.status()} ${req.method()} ${req.url()}${suffix}`);
    }
  });
  page.on('pageerror', (err) => log(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') log(`console.error: ${msg.text()}`);
  });

  const steps: Step[] = planPath
    ? (JSON.parse(
        readFileSync(path.resolve(ROOT, planPath), 'utf8').replace(/^\uFEFF/, ''),
      ) as Step[])
    : [];

  if (planPath) {
    await runPlan(page, steps);
  } else {
    log(`navigating to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(waitMs);
    await dumpArtifacts(page, name);
  }

  writeFileSync(
    STATUS_FILE,
    JSON.stringify(
      { url: page.url(), title: await page.title(), name, updatedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  log(`done: ${page.url()} :: ${await page.title()}`);
}

main()
  .catch((error: unknown) => {
    log(`error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await context?.close().catch(() => {});
    log('explorer finished');
  });
