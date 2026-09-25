import { test, expect, request } from '@playwright/test';
import { config } from '@/config';

test('service health is UP', { tag: ['@api'] }, async () => {
  test.skip(!config.health.endpoint, 'HEALTH_URL not configured');

  const ctx = await request.newContext();
  const res = await ctx.get(config.health.endpoint);
  await ctx.dispose();

  expect(res.ok(), `${res.status()} ${res.statusText()}`).toBeTruthy();
  const body = await res.json().catch(() => ({ status: 'DOWN' }));
  expect(body.status ?? body.state ?? 'DOWN').toBe('UP');
});