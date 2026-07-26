import { request, type APIRequestContext } from '@playwright/test';
import { config } from '../config';
import { getByPath } from '../utils/json';

export interface AuthUser {
  mobile: string;
  otp: string;
}

export interface LoginResult {
  token: string | undefined;
  storageState: Awaited<ReturnType<APIRequestContext['storageState']>>;
}

function resolveUser(user?: Partial<AuthUser>): AuthUser {
  return {
    mobile: user?.mobile ?? config.auth.mobile,
    otp: user?.otp ?? config.auth.otp,
  };
}

export async function login(user?: Partial<AuthUser>): Promise<LoginResult> {
  const creds = resolveUser(user);

  const ctx = await request.newContext({
    baseURL: config.api.baseURL,
    timeout: config.api.timeout,
    extraHTTPHeaders: { Accept: 'application/json' },
  });

  try {
    const sendRes = await ctx.post(config.auth.sendOtpEndpoint, {
      data: { mobile: creds.mobile },
    });

    if (!sendRes.ok()) {
      const body = await sendRes.text().catch(() => '');
      throw new Error(
        `Send OTP failed: ${sendRes.status()} ${sendRes.statusText()}${body ? ` — ${body}` : ''}`,
      );
    }

    const loginRes = await ctx.post(config.auth.loginEndpoint, {
      multipart: { otp: creds.otp, mobile: creds.mobile },
    });

    if (!loginRes.ok()) {
      const body = await loginRes.text().catch(() => '');
      throw new Error(
        `Login failed: ${loginRes.status()} ${loginRes.statusText()}${body ? ` — ${body}` : ''}`,
      );
    }

    const body = (await loginRes.json().catch(() => ({}))) as unknown;
    const raw = getByPath(body, config.auth.tokenProperty);
    const token = typeof raw === 'string' && raw.length > 0 ? raw : undefined;

    const storageState = await ctx.storageState();
    return { token, storageState };
  } finally {
    await ctx.dispose();
  }
}