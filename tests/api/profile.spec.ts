import { test, expect } from '@/fixtures';
import { config } from '@/config';

const endpoint = config.profile.endpoint;
const t = endpoint ? test : test.skip;

test.describe('Profile / protected endpoint', { tag: ['@api'] }, () => {
  t('authenticated access succeeds', async ({ authRequest }) => {
    const res = await authRequest.get(endpoint);
    expect(res.ok(), `${res.status()} ${res.statusText()}`).toBeTruthy();
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  t('unauthenticated access is rejected', async ({ request }) => {
    const res = await request.get(`${config.api.baseURL}${endpoint}`);
    expect([401, 403]).toContain(res.status());
  });
});