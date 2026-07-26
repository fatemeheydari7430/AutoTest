import { test, expect } from '@/fixtures';
import { config } from '@/config';
import { expectStatus, asJson } from '@/utils/api';
import payloadsData from '../../test-data/api/payloads.json';

type Payload = Record<string, unknown>;
const resource = config.resource.basePath;
const createPayload = (payloadsData as Payload[])[0];

let createdId: string | undefined;

test.describe.serial('Items CRUD lifecycle', () => {
  test('create returns 201 with an id', async ({ authRequest }) => {
    test.skip(!config.resource.enabled, 'RESOURCE_ENABLED is false');
    const res = await authRequest.post(resource, { data: createPayload });
    expectStatus(res, 201);

    const body = await asJson<Record<string, unknown>>(res);
    createdId = (body[config.resource.idProperty] ?? body.id) as string | undefined;
    expect(createdId, 'resource id returned').toBeTruthy();
  });

  test('get by id returns 200', async ({ authRequest }) => {
    test.skip(!config.resource.enabled, 'RESOURCE_ENABLED is false');
    test.skip(!createdId, 'create must succeed first');
    const res = await authRequest.get(`${resource}/${createdId}`);
    expectStatus(res, 200);
  });

  test('update by id returns 200', async ({ authRequest }) => {
    test.skip(!config.resource.enabled, 'RESOURCE_ENABLED is false');
    test.skip(!createdId, 'create must succeed first');
    const res = await authRequest.patch(`${resource}/${createdId}`, {
      data: { ...createPayload, name: `${String(createPayload.name)} (updated)` },
    });
    expectStatus(res, 200);
  });

  test('delete by id returns 204', async ({ authRequest }) => {
    test.skip(!config.resource.enabled, 'RESOURCE_ENABLED is false');
    test.skip(!createdId, 'create must succeed first');
    const res = await authRequest.delete(`${resource}/${createdId}`);
    expectStatus(res, 204);
    createdId = undefined;
  });
});