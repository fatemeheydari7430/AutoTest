import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { config } from '../config';

/**
 * Small Car-specific prerequisite helper for API tests. It only builds valid
 * motor lead state so a test can then perform a single invalid action.
 */

const base = config.carInsurance.basePath;

export interface MotorLead {
  trackingCode: string;
}

export interface VehicleRef {
  makeId: number;
  model: string;
  year: number;
  trim: string;
}

export interface CarScenarioData {
  vehicle: { make: string; model: string; year: number };
  emirate: string;
  driver: { country: string; dateOfBirth: string };
  drivingExperience: string;
  claimFreeYear: number;
  claimFreeYearThreshold: boolean;
}

export function leadHeaders(lead: MotorLead): Record<string, string> {
  return { tracking_code: lead.trackingCode };
}

export async function asBody<T>(res: APIResponse): Promise<T> {
  return (await res.json()) as T;
}

export async function createMotorLead(
  request: APIRequestContext,
  leadType = 'RENEW',
): Promise<MotorLead> {
  const res = await request.post(`${base}/lead`, { data: { lead_type: leadType } });
  expect(res.status(), 'create motor lead').toBe(201);
  const body = await asBody<{ response: { tracking_code: string } }>(res);
  expect(body.response.tracking_code, 'tracking_code').toBeTruthy();
  return { trackingCode: body.response.tracking_code };
}

async function expectOk(res: APIResponse, label: string): Promise<void> {
  expect(res.status(), label).toBe(200);
}

export async function setInformationSource(request: APIRequestContext, lead: MotorLead): Promise<void> {
  const res = await request.put(`${base}/lead/motor-information-source`, {
    headers: leadHeaders(lead),
    data: { motor_information_source: 'MANUAL' },
  });
  await expectOk(res, 'set information source');
}

export async function resolveMake(
  request: APIRequestContext,
  lead: MotorLead,
  make: string,
): Promise<number> {
  const res = await request.get(
    `${base}/lead/manual/makes?searchTerm=${encodeURIComponent(make)}&size=200`,
    { headers: leadHeaders(lead) },
  );
  await expectOk(res, 'resolve make');
  const body = await asBody<{ response: { content: { id: number; make: string }[] } }>(res);
  const found = body.response.content.find((m) => m.make === make) ?? body.response.content[0];
  expect(found?.id, 'make id').toBeTruthy();
  return found.id;
}

export async function resolveModel(
  request: APIRequestContext,
  lead: MotorLead,
  makeId: number,
  model: string,
): Promise<string> {
  const res = await request.get(`${base}/lead/manual/models?make=${makeId}&size=500&page=1`, {
    headers: leadHeaders(lead),
  });
  await expectOk(res, 'resolve model');
  const body = await asBody<{ response: { content: string[] } }>(res);
  return body.response.content.includes(model) ? model : body.response.content[0];
}

export async function setYear(
  request: APIRequestContext,
  lead: MotorLead,
  makeId: number,
  model: string,
  year: number,
): Promise<void> {
  const res = await request.put(`${base}/lead/manual/year`, {
    headers: leadHeaders(lead),
    data: { make: String(makeId), model, year },
  });
  await expectOk(res, 'set year');
}

export async function resolveTrim(
  request: APIRequestContext,
  lead: MotorLead,
  makeId: number,
  model: string,
  year: number,
): Promise<string> {
  const res = await request.get(
    `${base}/lead/manual/trims?make=${makeId}&model=${encodeURIComponent(model)}&year=${year}`,
    { headers: leadHeaders(lead) },
  );
  await expectOk(res, 'resolve trim');
  const body = await asBody<{ response: string[] }>(res);
  expect(body.response[0], 'trim').toBeTruthy();
  return body.response[0];
}

export async function setTrim(
  request: APIRequestContext,
  lead: MotorLead,
  ref: VehicleRef,
): Promise<void> {
  const res = await request.put(`${base}/lead/manual/trim`, {
    headers: leadHeaders(lead),
    data: { make: String(ref.makeId), model: ref.model, year: ref.year, trim: ref.trim },
  });
  await expectOk(res, 'set trim');
}

export async function setCarDetails(
  request: APIRequestContext,
  lead: MotorLead,
  isGcc = true,
): Promise<void> {
  const res = await request.put(`${base}/lead/manual/car-details`, {
    headers: leadHeaders(lead),
    data: { is_gcc: isGcc, is_personally_modified: false, is_for_personal_use: true },
  });
  await expectOk(res, 'set car details');
}

export async function setEmirate(
  request: APIRequestContext,
  lead: MotorLead,
  emirate: string,
): Promise<void> {
  const res = await request.put(`${base}/lead/registration/emirate`, {
    headers: leadHeaders(lead),
    data: { emirate },
  });
  await expectOk(res, 'set emirate');
}

export async function resolveCountry(
  request: APIRequestContext,
  lead: MotorLead,
  country: string,
): Promise<number> {
  const res = await request.get(
    `${base}/country?searchTerm=${encodeURIComponent(country)}&size=300`,
    { headers: leadHeaders(lead) },
  );
  await expectOk(res, 'resolve country');
  const body = await asBody<{ response: { content: { id: number; name: string }[] } }>(res);
  const found = body.response.content.find((c) => c.name === country) ?? body.response.content[0];
  expect(found?.id, 'country id').toBeTruthy();
  return found.id;
}

export async function setDriverInformation(
  request: APIRequestContext,
  lead: MotorLead,
  countryId: number,
  dateOfBirth: string,
): Promise<void> {
  const res = await request.put(`${base}/lead/manual/driver-information`, {
    headers: leadHeaders(lead),
    data: { country_id: countryId, date_of_birth: dateOfBirth },
  });
  await expectOk(res, 'set driver information');
}

export async function setDrivingExperience(
  request: APIRequestContext,
  lead: MotorLead,
  drivingExperience: string,
): Promise<void> {
  const res = await request.put(`${base}/lead/manual/driving-experience`, {
    headers: leadHeaders(lead),
    data: { driving_experience: drivingExperience },
  });
  await expectOk(res, 'set driving experience');
}

export async function setClaimFreeYear(
  request: APIRequestContext,
  lead: MotorLead,
  claimFreeYear: number,
  threshold: boolean,
): Promise<void> {
  const res = await request.put(`${base}/lead/manual/claim-free-year`, {
    headers: leadHeaders(lead),
    data: { claim_free_year: claimFreeYear, is_claim_free_year_thresh_hold: threshold },
  });
  await expectOk(res, 'set claim-free year');
}

export async function fetchLead(request: APIRequestContext, lead: MotorLead): Promise<void> {
  const res = await request.get(`${base}/lead/fetch?`, { headers: leadHeaders(lead) });
  await expectOk(res, 'fetch lead');
}

export interface Quote {
  id: number;
  insurance_type: string;
}

export async function getQuoteList(
  request: APIRequestContext,
  lead: MotorLead,
): Promise<Quote[]> {
  const res = await request.get(`${base}/quote/list`, { headers: leadHeaders(lead) });
  await expectOk(res, 'quote list');
  const body = await asBody<{ response: { quotes: Quote[] } }>(res);
  expect(body.response.quotes.length, 'quotes').toBeGreaterThan(0);
  return body.response.quotes;
}

// ---- Composite prerequisites (keep negative tests short) ----

export async function prepareLead(request: APIRequestContext): Promise<MotorLead> {
  const lead = await createMotorLead(request);
  await setInformationSource(request, lead);
  return lead;
}

export async function prepareVehicle(
  request: APIRequestContext,
  lead: MotorLead,
  vehicle: { make: string; model: string; year: number },
): Promise<VehicleRef> {
  const makeId = await resolveMake(request, lead, vehicle.make);
  const model = await resolveModel(request, lead, makeId, vehicle.model);
  await setYear(request, lead, makeId, model, vehicle.year);
  const trim = await resolveTrim(request, lead, makeId, model, vehicle.year);
  const ref: VehicleRef = { makeId, model, year: vehicle.year, trim };
  await setTrim(request, lead, ref);
  await setCarDetails(request, lead, true);
  return ref;
}

export async function prepareUntilDriver(
  request: APIRequestContext,
  lead: MotorLead,
  data: CarScenarioData,
): Promise<{ countryId: number }> {
  await prepareVehicle(request, lead, data.vehicle);
  await setEmirate(request, lead, data.emirate);
  const countryId = await resolveCountry(request, lead, data.driver.country);
  return { countryId };
}

export async function prepareUntilQuotes(
  request: APIRequestContext,
  lead: MotorLead,
  data: CarScenarioData,
): Promise<Quote[]> {
  const { countryId } = await prepareUntilDriver(request, lead, data);
  await setDriverInformation(request, lead, countryId, data.driver.dateOfBirth);
  await setDrivingExperience(request, lead, data.drivingExperience);
  await setClaimFreeYear(request, lead, data.claimFreeYear, data.claimFreeYearThreshold);
  await fetchLead(request, lead);
  return getQuoteList(request, lead);
}
