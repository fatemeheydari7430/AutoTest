import { request, type APIRequestContext } from '@playwright/test';
import { config } from '../config';
import { getByPath } from '../utils/json';
import { readTokenCache, writeTokenCache, withTokenLock } from './token-cache';

export interface AuthUser {
  mobile: string;
  otp: string;
}

type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;

export interface LoginResult {
  token: string | undefined;
  storageState: StorageState;
  expiresIn: number;
}

function resolveUser(user?: Partial<AuthUser>): AuthUser {
  return {
    mobile: user?.mobile ?? config.auth.mobile,
    otp: user?.otp ?? config.auth.otp,
  };
}

const emptyState = (): StorageState => ({ cookies: [], origins: [] });

async function performLogin(creds: AuthUser): Promise<LoginResult> {
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

    const expRaw = getByPath(body, 'response.expires_in');
    const expiresIn = typeof expRaw === 'number' && expRaw > 0 ? expRaw : 3600;

    const storageState = await ctx.storageState();
    return { token, storageState, expiresIn };
  } finally {
    await ctx.dispose();
  }
}

export async function login(user?: Partial<AuthUser>): Promise<LoginResult> {
  const creds = resolveUser(user);

  if (user) {
    return performLogin(creds);
  }

  return withTokenLock(async () => {
    const cached = readTokenCache();
    if (cached) {
      return { token: cached, storageState: emptyState(), expiresIn: 0 };
    }

    const result = await performLogin(creds);
    if (result.token) {
      writeTokenCache(result.token, Date.now() + result.expiresIn * 1000);
    }
    return result;
  });
}