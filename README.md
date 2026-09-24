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
