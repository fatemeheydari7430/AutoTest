import { test, expect } from '@/fixtures';
import { request } from '@playwright/test';
import { config } from '@/config';
import sendCasesData from '../../test-data/api/otp-send-cases.json';
import loginCasesData from '../../test-data/api/otp-login-cases.json';

type SendCase = { label: string; payload: Record<string, unknown>; expectedStatus: number[] };
type LoginCase = { label: string; form: Record<string, string>; expectedStatus: number[] };

const sendCases = sendCasesData as SendCase[];
const loginCases = loginCasesData as LoginCase[];

test.describe('Auth / send-otp validation', () => {
  for (const c of sendCases) {
    test(`send-otp: ${c.label}`, async () => {
      const ctx = await request.newContext({
        baseURL: config.api.baseURL,
        extraHTTPHeaders: { Accept: 'application/json' },
      });
      const res = await ctx.post(config.auth.sendOtpEndpoint, { data: c.payload });
      const status = res.status();
      await ctx.dispose();

      expect(
        c.expectedStatus.includes(status),
        `got ${status}, expected one of [${c.expectedStatus.join(', ')}]`,
      ).toBeTruthy();
    });
  }
});

test.describe('Auth / login validation', () => {
  for (const c of loginCases) {
    test(`login: ${c.label}`, async () => {
      const ctx = await request.newContext({
        baseURL: config.api.baseURL,
        extraHTTPHeaders: { Accept: 'application/json' },
      });

      await ctx.post(config.auth.sendOtpEndpoint, {
        data: { mobile: config.auth.mobile },
      });
      const res = await ctx.post(config.auth.loginEndpoint, { multipart: c.form });
      const status = res.status();
      await ctx.dispose();

      expect(
        c.expectedStatus.includes(status),
        `got ${status}, expected one of [${c.expectedStatus.join(', ')}]`,
      ).toBeTruthy();
    });
  }
});