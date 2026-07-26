import { test as setup, expect } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '@/config';
import { STORAGE_STATE_PATH } from '@/config/paths';

const origin = encodeURIComponent(config.web.baseURL);
const authUrl = `${config.web.baseURL}/auth/?space=vault&callback=%2F&origin=${origin}`;
const loginUrl = /^.*\/auth.*step=otp/;

setup('authenticate via UI (OTP) and save storage state', async ({ page }) => {
  mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });
  rmSync(STORAGE_STATE_PATH, { force: true });

  await page.goto(authUrl);

  await page.getByLabel(/mobile|phone|شماره/i).first().fill(config.auth.mobile);
  await page
    .getByRole('button', { name: /submit|continue|send|next|ادامه|ارسال|بعدی/i })
    .first()
    .click();

  await page.waitForURL(loginUrl, { timeout: 30_000 });

  await page.getByLabel(/otp|code|کد/i).first().fill(config.auth.otp);
  await page
    .getByRole('button', { name: /login|submit|confirm|ورود|تأیید|تایید|ارسال/i })
    .first()
    .click();

  await page.waitForURL((url) => !url.toString().includes('/auth'), { timeout: 30_000 });

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  expect(await page.title()).toBeTruthy();
});