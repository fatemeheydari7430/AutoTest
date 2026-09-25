import { test, expect } from '@/fixtures';
import { config } from '@/config';
import type { APIResponse } from '@playwright/test';
import happyPath from '../../test-data/api/car-happy-path.json';
import invalid from '../../test-data/api/car-negative.json';
import {
  createMotorLead,
  prepareLead,
  prepareVehicle,
  prepareUntilDriver,
  prepareUntilQuotes,
  resolveMake,
  resolveModel,
  setDriverInformation,
  setDrivingExperience,
  leadHeaders,
} from '@/api/car';

const base = config.carInsurance.basePath;
const valid = happyPath as {
  vehicle: { make: string; model: string; year: number };
  emirate: string;
  driver: { country: string; dateOfBirth: string };
  drivingExperience: string;
  claimFreeYear: number;
  claimFreeYearThreshold: boolean;
};

// The motor lead is bound to the test user (no lead id in the path); keep the
// suite serial and give every test its own fresh lead.
test.describe.configure({ mode: 'serial' });

/** Asserts the observed rejection contract: status + unsuccessful + error_data. */
async function expectError(res: APIResponse, status: number, label: string): Promise<void> {
  expect(res.status(), label).toBe(status);
  const body = await res.json();
  expect(body.successful, `${label} successful`).toBe(false);
  expect(body.error_data, `${label} error_data`).not.toBeNull();
}

test.describe('Car insurance API / negative', { tag: ['@car', '@api', '@regression', '@negative'] }, () => {
  /**
   * Documented contract (NOT a security assertion): the whole motor lead flow is
   * usable WITHOUT Authorization, keyed only by tracking_code. It is unclear
   * whether anonymous lead creation is intentional, so this records the actual
   * behavior instead of forcing a 4xx. See KNOWN_ISSUES.md.
   */
  test('N1 potential unauthenticated lead creation (documented contract)', async ({ request }) => {
    const res = await request.post(`${config.api.baseURL}${base}/lead`, {
      data: { lead_type: 'RENEW' },
    });
    expect(res.status(), 'missing-auth create lead').toBe(201);
    const body = await res.json();
    expect(body.successful, 'missing-auth successful').toBe(true);
    expect(body.response.tracking_code, 'missing-auth tracking_code').toBeTruthy();
  });

  test('N2 rejects PUT /motor/lead/manual/year without tracking_code', async ({ authRequest }) => {
    await createMotorLead(authRequest);
    const res = await authRequest.put(`${base}/lead/manual/year`, {
      data: { make: '1', model: 'COROLLA', year: 2024 },
    });
    await expectError(res, 410, 'missing tracking_code');
  });

  test('N3 rejects PUT /motor/lead/manual/year with invalid tracking_code', async ({
    authRequest,
  }) => {
    const res = await authRequest.put(`${base}/lead/manual/year`, {
      headers: { tracking_code: invalid.invalidTrackingCode },
      data: { make: '1', model: 'COROLLA', year: 2024 },
    });
    await expectError(res, 410, 'invalid tracking_code');
  });

  test('N4 rejects an invalid vehicle year on PUT /motor/lead/manual/year', async ({
    authRequest,
  }) => {
    const lead = await prepareLead(authRequest);
    const makeId = await resolveMake(authRequest, lead, valid.vehicle.make);
    const model = await resolveModel(authRequest, lead, makeId, valid.vehicle.model);
    const res = await authRequest.put(`${base}/lead/manual/year`, {
      headers: leadHeaders(lead),
      data: { make: String(makeId), model, year: invalid.invalidYear },
    });
    await expectError(res, 418, 'invalid year');
  });

  test('N5 rejects an invalid emirate on PUT /motor/lead/registration/emirate', async ({
    authRequest,
  }) => {
    const lead = await prepareLead(authRequest);
    await prepareVehicle(authRequest, lead, valid.vehicle);
    const res = await authRequest.put(`${base}/lead/registration/emirate`, {
      headers: leadHeaders(lead),
      data: { emirate: invalid.invalidEmirate },
    });
    await expectError(res, 400, 'invalid emirate');
  });

  test('N6 rejects a future driver DOB on PUT /motor/lead/manual/driver-information', async ({
    authRequest,
  }) => {
    test.fail(
      true,
      'Known backend validation gap: a future DOB is currently accepted (200). See KNOWN_ISSUES.md.',
    );

    const lead = await prepareLead(authRequest);
    const { countryId } = await prepareUntilDriver(authRequest, lead, valid);
    const res = await authRequest.put(`${base}/lead/manual/driver-information`, {
      headers: leadHeaders(lead),
      data: { country_id: countryId, date_of_birth: invalid.invalidDateOfBirth },
    });

    // Desired behavior: an impossible/future DOB must be rejected.
    expect(res.status(), 'future DOB must be rejected').toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.successful, 'future DOB successful').toBe(false);
  });

  test('N7 rejects an invalid driving experience on PUT /motor/lead/manual/driving-experience', async ({
    authRequest,
  }) => {
    const lead = await prepareLead(authRequest);
    const { countryId } = await prepareUntilDriver(authRequest, lead, valid);
    await setDriverInformation(authRequest, lead, countryId, valid.driver.dateOfBirth);
    const res = await authRequest.put(`${base}/lead/manual/driving-experience`, {
      headers: leadHeaders(lead),
      data: { driving_experience: invalid.invalidDrivingExperience },
    });
    await expectError(res, 400, 'invalid driving experience');
  });

  test('N8 rejects an out-of-range claim-free year on PUT /motor/lead/manual/claim-free-year', async ({
    authRequest,
  }) => {
    test.fail(
      true,
      'Known backend validation gap: claim_free_year=99 is currently accepted (200). See KNOWN_ISSUES.md.',
    );

    const lead = await prepareLead(authRequest);
    const { countryId } = await prepareUntilDriver(authRequest, lead, valid);
    await setDriverInformation(authRequest, lead, countryId, valid.driver.dateOfBirth);
    await setDrivingExperience(authRequest, lead, valid.drivingExperience);
    const res = await authRequest.put(`${base}/lead/manual/claim-free-year`, {
      headers: leadHeaders(lead),
      data: {
        claim_free_year: invalid.invalidClaimFreeYear,
        is_claim_free_year_thresh_hold: false,
      },
    });

    // Desired behavior: an out-of-contract claim-free year must be rejected.
    expect(res.status(), 'invalid claim-free year must be rejected').toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.successful, 'invalid claim-free year successful').toBe(false);
  });

  test('N9 rejects an invalid quote selection on PUT /motor/lead/add-quote', async ({
    authRequest,
  }) => {
    const lead = await prepareLead(authRequest);
    const quotes = await prepareUntilQuotes(authRequest, lead, valid);
    const res = await authRequest.put(`${base}/lead/add-quote`, {
      headers: leadHeaders(lead),
      data: {
        insurance_type: quotes[0].insurance_type,
        quote_id: invalid.invalidQuoteId,
        add_on_ids: [],
      },
    });
    await expectError(res, 418, 'invalid quote selection');
  });
});
