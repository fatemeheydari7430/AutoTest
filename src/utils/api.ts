import { expect, type APIResponse } from '@playwright/test';

export function expectStatus(res: APIResponse, code: number): void {
  expect(res.status(), `${res.url()} -> ${res.statusText()}`).toBe(code);
}

export async function asJson<T = unknown>(res: APIResponse): Promise<T> {
  return (await res.json()) as T;
}

/** Asserts the shared API envelope success contract. */
export function expectSuccess(body: { successful?: boolean; error_data?: unknown }): void {
  expect(body.successful, 'successful === true').toBe(true);
  expect(body.error_data, 'error_data === null').toBeNull();
}

/**
 * Emits a machine-readable event for the Control Center (parsed from test
 * stdout). Only non-sensitive fields (product + tracking code) are ever sent.
 */
export function emitControlCenterEvent(event: Record<string, unknown>): void {
  console.log(`CONTROL_CENTER_EVENT ${JSON.stringify(event)}`);
}