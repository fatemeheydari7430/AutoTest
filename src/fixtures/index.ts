import { test as base, request, expect, type APIRequestContext } from '@playwright/test';
import { config } from '../config';
import { login, type AuthUser, type LoginResult } from '../api/auth';

export interface ApiWorkerFixtures {
  authContext: LoginResult;
}

export interface ApiTestFixtures {
  authRequest: APIRequestContext;
}

export const test = base.extend<ApiTestFixtures, ApiWorkerFixtures>({
  authContext: [
    async ({}, use) => {
      await use(await login());
    },
    { scope: 'worker' },
  ],

  authRequest: async ({ authContext }, use) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authContext.token) {
      headers.Authorization = `Bearer ${authContext.token}`;
    }

    const ctx = await request.newContext({
      baseURL: config.api.baseURL,
      timeout: config.api.timeout,
      extraHTTPHeaders: headers,
      storageState:
        authContext.storageState.cookies.length > 0 ? authContext.storageState : undefined,
    });

    await use(ctx);
    await ctx.dispose();
  },
});

export { expect, login, type AuthUser, type LoginResult };