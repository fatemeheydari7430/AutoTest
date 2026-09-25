# AutoTest

Automated API and E2E tests with [Playwright](https://playwright.dev) + TypeScript.

- API tests live in `tests/api` (project `api`).
- E2E tests live in `tests/e2e` (project `e2e-chromium`).
- Auth helper: `AppAuth.login()` (`src/auth/app-auth.ts`) performs the app's own
  mobile + OTP login on every run.
- Page objects live in `src/pages`; test data in `test-data`.

## Setup

```bash
npm install
npx playwright install
```

Configuration comes from `.env` (see `.env.example`).

## QA Control Center

A lightweight local web app that only **configures** the active E2E data and
**launches** Playwright UI. Playwright remains responsible for running tests,
selecting tests, tags, steps, trace, screenshots, video and failure diagnostics.

Main workflow:

```
Desktop: Lookinsure Tests
  -> Control Center
  -> Car / Health configuration
  -> Save
  -> Open Playwright UI
  -> Run configured test
```

```bash
npm run control-center
```

A desktop shortcut ("Lookinsure Tests" by default) can be created with:

```bash
npm run shortcut:create
```

Configuration is split into:

- `test-data/e2e/presets/car-presets.json` and `health-presets.json` — **tracked
  in git**. Presets: `default`, `non-gcc` (Car) and `default`, `under4000`
  (Health). Selecting a preset in the UI only populates the form; nothing is
  written until **Save Settings**.
- `test-data/e2e/runtime/car-config.json` and `health-config.json` — the active
  data written by **Save Settings**. **Gitignored**, so everyday use does not
  dirty the working tree. If a runtime file is missing, the `default` preset is
  used.
- **Reset to Default** copies the `default` preset onto the runtime config.

No credentials, tokens, cookies or OTPs are ever stored in these files.

## Running E2E Tests

اجرای گرافیکی یک تست:

```bash
npm run test:car:ui
```

اجرای گرافیکی همه E2Eها:

```bash
npm run test:e2e:ui
```

اجرای معمولی سناریوی خرید (بدون UI):

```bash
npm run test:car
```

مشاهده آخرین HTML Report:

```bash
npm run report
```

### Notes

- E2E runs are configured: one `Car insurance purchase [configured]` and one
  `Health insurance purchase [configured]` test. Data variations live in the
  Control Center / runtime config, not as separate test cases. The configured
  tests stop at the **payment screen**; they do not place an order or pay.
- The main workflow is **Control Center -> Save config -> Playwright UI**.
  `CAR_SCENARIO` / `HEALTH_SCENARIO` are **deprecated, backward-compatible
  overrides** (useful for CI/debugging/rollback). The data source resolution is:

  ```
  CAR_SCENARIO / HEALTH_SCENARIO set  -> that preset
  otherwise runtime config exists     -> runtime config
  otherwise                           -> default preset
  ```
- `test:car:ui` / `test:e2e:ui` open **Playwright UI Mode**. Pick a test, press
  Run, and watch each step. The `setup` project (Cloudflare Access state) runs
  automatically as a dependency.
- Every execution starts from a **fresh browser context**: only the Cloudflare
  access state is loaded, then `appAuth.login()` signs into the app using
  `AUTH_MOBILE` / `AUTH_OTP` from `.env`. No app session or previous lead is reused.
- The car-purchase scenario stops at the **Payment page**; it never selects a
  payment method and never clicks "Pay now".
- On failure, a screenshot, video and trace are written to `test-results/`.
  Open a trace with:

  ```bash
  npx playwright show-trace test-results/<test-folder>/trace.zip
  ```
