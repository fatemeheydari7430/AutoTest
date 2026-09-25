import { test, expect } from '@/fixtures';
import { config } from '@/config';
import { expectStatus, asJson } from '@/utils/api';
import payloadsData from '../../test-data/api/payloads.json';

type Payload = Record<string, unknown>;
const resource = config.resource.basePath;
const createPayload = (payloadsData as Payload[])[0];
const t = config.resource.enabled ? test : test.skip;

let createdId: string | undefined;

test.describe('Items CRUD lifecycle', { tag: ['@api'] }, () => {
  test.describe.configure({ mode: 'serial' });

  t('create returns 201 with an id', async ({ authRequest }) => {
    const res = await authRequest.post(resource, { data: createPayload });
    expectStatus(res, 201);

    const body = await asJson<Record<string, unknown>>(res);
    createdId = (body[config.resource.idProperty] ?? body.id) as string | undefined;
    expect(createdId, 'resource id returned').toBeTruthy();
  });

  t('get by id returns 200', async ({ authRequest }) => {
    test.skip(!createdId, 'create must succeed first');
    const res = await authRequest.get(`${resource}/${createdId}`);
    expectStatus(res, 200);
  });

  t('update by id returns 200', async ({ authRequest }) => {
    test.skip(!createdId, 'create must succeed first');
    const res = await authRequest.patch(`${resource}/${createdId}`, {
      data: { ...createPayload, name: `${String(createPayload.name)} (updated)` },
    });
    expectStatus(res, 200);
  });

  t('delete by id returns 204', async ({ authRequest }) => {
    test.skip(!createdId, 'create must succeed first');
    const res = await authRequest.delete(`${resource}/${createdId}`);
    expectStatus(res, 204);
    createdId = undefined;
  });
});