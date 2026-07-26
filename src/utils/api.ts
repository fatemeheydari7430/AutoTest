import { expect, type APIResponse } from '@playwright/test';

export function expectStatus(res: APIResponse, code: number): void {
  expect(res.status(), `${res.url()} -> ${res.statusText()}`).toBe(code);
}

export async function asJson<T = unknown>(res: APIResponse): Promise<T> {
  return (await res.json()) as T;
}