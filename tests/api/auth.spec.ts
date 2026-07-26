import { test, expect } from '@/fixtures';
import { request } from '@playwright/test';
import { config } from '@/config';
import { getByPath } from '@/utils/json';
import { login } from '@/api/auth';

test.describe('Auth / OTP login flow', () => {
  test('send-otp then login returns a Bearer JWT', async () => {
    const ctx = await request.newContext({
      baseURL: config.api.baseURL,
      extraHTTPHeaders: { Accept: 'application/json' },
    });

    const sendRes = await ctx.post(config.auth.sendOtpEndpoint, {
      data: { mobile: config.auth.mobile },
    });
    const sendErr = await sendRes.text().catch(() => '');
    expect(
      sendRes.ok(),
      `send-otp: ${sendRes.status()} ${sendRes.statusText()} — ${sendErr.slice(0, 300)}`,
    ).toBeTruthy();

    const loginRes = await ctx.post(config.auth.loginEndpoint, {
      multipart: { otp: config.auth.otp, mobile: config.auth.mobile },
    });
    const body = await loginRes.json().catch(() => ({}));
    await ctx.dispose();

    expect(loginRes.ok(), `login: ${loginRes.status()} ${loginRes.statusText()}`).toBeTruthy();

    const token = getByPath(body, config.auth.tokenProperty);
    expect(typeof token, `token at "${config.auth.tokenProperty}"`).toBe('string');
    expect((token as string).split('.')).toHaveLength(3);
  });

  test('login() helper yields a usable token', async () => {
    const { token } = await login();
    expect(token, 'no token extracted').toBeTruthy();
    expect(token!.split('.')).toHaveLength(3);
  });
});