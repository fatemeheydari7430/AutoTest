import { test, expect } from '@/fixtures';
import { config } from '@/config';

const endpoint = config.profile.endpoint;

test.describe('Profile / protected endpoint', () => {
  test('authenticated access succeeds', async ({ authRequest }) => {
    test.skip(!endpoint, 'PROFILE_ENDPOINT not configured');
    const res = await authRequest.get(endpoint);

    expect(res.ok(), `${res.status()} ${res.statusText()}`).toBeTruthy();
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('unauthenticated access is rejected', async ({ request }) => {
    test.skip(!endpoint, 'PROFILE_ENDPOINT not configured');
    const res = await request.get(`${config.api.baseURL}${endpoint}`);
    expect([401, 403]).toContain(res.status());
  });
});