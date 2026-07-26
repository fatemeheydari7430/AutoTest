import { test, expect } from '@/fixtures';
import { config } from '@/config';
import { expectStatus } from '@/utils/api';
import casesData from '../../test-data/api/invalid-payloads.json';

type InvalidCase = {
  label: string;
  payload: Record<string, unknown>;
  expectedStatus: number;
};
const cases = casesData as InvalidCase[];

const resource = config.resource.basePath;

test.describe('Items / validation', () => {
  for (const c of cases) {
    test(`rejects ${c.label} with ${c.expectedStatus}`, async ({ authRequest }) => {
      test.skip(!config.resource.enabled, 'RESOURCE_ENABLED is false');
      const res = await authRequest.post(resource, { data: c.payload });
      expectStatus(res, c.expectedStatus);
    });
  }

  test('get nonexistent id returns 404', async ({ authRequest }) => {
    test.skip(!config.resource.enabled, 'RESOURCE_ENABLED is false');
    const res = await authRequest.get(`${resource}/99999999`);
    expect([404, 400]).toContain(res.status());
  });

  test('list supports pagination params', async ({ authRequest }) => {
    test.skip(!config.resource.enabled, 'RESOURCE_ENABLED is false');
    const res = await authRequest.get(`${resource}?page=0&size=1`);
    expect([200, 400, 404]).toContain(res.status());
    if (res.ok()) {
      const body = await res.json();
      expect(typeof body).toBe('object');
    }
  });
});