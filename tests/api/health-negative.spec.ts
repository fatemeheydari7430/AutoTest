import { test, expect } from '@/fixtures';
import { config } from '@/config';
import type { APIResponse } from '@playwright/test';
import happyPath from '../../test-data/api/health-happy-path.json';
import invalid from '../../test-data/api/health-negative.json';
import {
  type HealthScenarioData,
  createHealthLead,
  healthHeaders,
  setGender,
  setEmirate,
  setSalaryRange,
  prepareUntilMemberDob,
  prepareUntilQuotes,
} from '@/api/health';

const base = config.healthInsurance.basePath;
const valid = happyPath as HealthScenarioData;

// The health lead is bound to the test user (no lead id in the path); keep the
// suite serial and give every test its own fresh lead.
test.describe.configure({ mode: 'serial' });

/**
 * Asserts the observed rejection contract. The health API uses two error shapes:
 * - service envelope: { response, successful:false, error_data:{message} }
 * - RFC 7807 problem+json: { type, title, status, detail, instance }
 */
async function expectRejected(res: APIResponse, status: number, label: string): Promise<void> {
  expect(res.status(), label).toBe(status);
  const body = (await res.json()) as Record<string, unknown>;
  if ('successful' in body) {
    expect(body.successful, `${label} successful`).toBe(false);
    expect(body.error_data, `${label} error_data`).not.toBeNull();
  } else {
    expect(body.status, `${label} problem.status`).toBe(status);
  }
}

test.describe('Health insurance API / negative', { tag: ['@health', '@api', '@regression', '@negative'] }, () => {
  /**
   * Documented contract (NOT a security assertion): `POST /health/v1/lead` is
   * accepted WITHOUT Authorization and returns a tracking code. It is unclear
   * whether anonymous lead creation is intentional, so this records the actual
   * behavior instead of forcing a 4xx. See KNOWN_ISSUES.md.
   */
  test('H1 potential unauthenticated lead creation (documented contract)', async ({ request }) => {
    const res = await request.post(`${config.api.baseURL}${base}/lead`, {
      data: { plan_type: 'INDIVIDUAL' },
    });
    expect(res.status(), 'missing-auth create lead').toBe(200);
    const body = await res.json();
    expect(body.successful, 'missing-auth successful').toBe(true);
    expect(body.response.tracking_code, 'missing-auth tracking_code').toBeTruthy();
  });

  test('H2 rejects PUT /health/v1/lead/gender without tracking code', async ({ authRequest }) => {
    await createHealthLead(authRequest);
    const res = await authRequest.put(`${base}/lead/gender`, { data: { gender: 'MALE' } });
    await expectRejected(res, 410, 'missing tracking code');
  });

  test('H3 rejects PUT /health/v1/lead/gender with invalid tracking code', async ({
    authRequest,
  }) => {
    const res = await authRequest.put(`${base}/lead/gender`, {
      headers: { 'x-health-tracking-code': invalid.invalidTrackingCode },
      data: { gender: 'MALE' },
    });
    await expectRejected(res, 404, 'invalid tracking code');
  });

  test('H4 rejects an invalid gender on PUT /health/v1/lead/gender', async ({ authRequest }) => {
    const lead = await createHealthLead(authRequest);
    const res = await authRequest.put(`${base}/lead/gender`, {
      headers: healthHeaders(lead),
      data: { gender: invalid.invalidGender },
    });
    await expectRejected(res, 400, 'invalid gender');
  });

  test('H5 rejects an invalid emirate on PUT /health/v1/lead/emirate', async ({ authRequest }) => {
    const lead = await createHealthLead(authRequest);
    await setGender(authRequest, lead, valid.gender);
    const res = await authRequest.put(`${base}/lead/emirate`, {
      headers: healthHeaders(lead),
      data: { emirate_key: invalid.invalidEmirate },
    });
    await expectRejected(res, 400, 'invalid emirate');
  });

  test('H6 rejects an invalid salary range on PUT /health/v1/lead/salary-range', async ({
    authRequest,
  }) => {
    const lead = await createHealthLead(authRequest);
    await setGender(authRequest, lead, valid.gender);
    await setEmirate(authRequest, lead, valid.emirate);
    const res = await authRequest.put(`${base}/lead/salary-range`, {
      headers: healthHeaders(lead),
      data: { salary_range: invalid.invalidSalaryRange },
    });
    await expectRejected(res, 400, 'invalid salary range');
  });

  test('H7 rejects an invalid member payload on POST /health/v1/lead/member', async ({
    authRequest,
  }) => {
    const lead = await createHealthLead(authRequest);
    await setGender(authRequest, lead, valid.gender);
    await setEmirate(authRequest, lead, valid.emirate);
    await setSalaryRange(authRequest, lead, valid.salaryRange);
    const res = await authRequest.post(`${base}/lead/member`, {
      headers: healthHeaders(lead),
      data: invalid.invalidMemberPayload,
    });
    await expectRejected(res, 400, 'invalid member payload');
  });

  test('H8 rejects a future date of birth on PUT /health/v1/lead/member/date-of-birth', async ({
    authRequest,
  }) => {
    const lead = await createHealthLead(authRequest);
    const memberId = await prepareUntilMemberDob(authRequest, lead, valid);
    const res = await authRequest.put(`${base}/lead/member/date-of-birth`, {
      headers: healthHeaders(lead),
      data: [{ id: memberId, date_of_birth: invalid.invalidDateOfBirth }],
    });
    await expectRejected(res, 400, 'future date of birth');
  });

  test('H9 rejects an invalid special-condition payload on PUT /health/v1/lead/special-condition', async ({
    authRequest,
  }) => {
    const lead = await createHealthLead(authRequest);
    const memberId = await prepareUntilMemberDob(authRequest, lead, valid);
    await authRequest.put(`${base}/lead/member/date-of-birth`, {
      headers: healthHeaders(lead),
      data: [{ id: memberId, date_of_birth: valid.dateOfBirth }],
    });
    const res = await authRequest.put(`${base}/lead/special-condition`, {
      headers: healthHeaders(lead),
      data: invalid.invalidSpecialCondition,
    });
    await expectRejected(res, 400, 'invalid special condition');
  });

  test('H10 rejects an invalid quote selection on POST /health/v1/quote/select', async ({
    authRequest,
  }) => {
    const lead = await createHealthLead(authRequest);
    await prepareUntilQuotes(authRequest, lead, valid);
    const res = await authRequest.post(`${base}/quote/select`, {
      headers: healthHeaders(lead),
      data: invalid.invalidQuote,
    });
    await expectRejected(res, 410, 'invalid quote selection');
  });
});
