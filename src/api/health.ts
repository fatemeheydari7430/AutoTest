import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { config } from '../config';

/**
 * Small Health-specific prerequisite helper for API tests. It only builds valid
 * health lead state so a test can then perform a single invalid action.
 */

const base = config.healthInsurance.basePath;
const TRACKING_HEADER = 'x-health-tracking-code';

export interface HealthLead {
  trackingCode: string;
}

export interface HealthMember {
  id: number;
  type: string;
}

export interface Copay {
  id: number;
  price: number;
}

export interface HealthScenarioData {
  planType: string;
  gender: string;
  emirate: string;
  salaryRange: string;
  memberType: string;
  dateOfBirth: string;
  hasMedicalCondition: boolean;
  isAnyMemberPregnant: boolean;
}

export function healthHeaders(lead: HealthLead): Record<string, string> {
  return { [TRACKING_HEADER]: lead.trackingCode };
}

export async function asBody<T>(res: APIResponse): Promise<T> {
  return (await res.json()) as T;
}

async function expectOk(res: APIResponse, label: string): Promise<void> {
  expect(res.status(), label).toBe(200);
}

export async function createHealthLead(
  request: APIRequestContext,
  planType = 'INDIVIDUAL',
): Promise<HealthLead> {
  const res = await request.post(`${base}/lead`, { data: { plan_type: planType } });
  expect(res.status(), 'create health lead').toBe(200);
  const body = await asBody<{ response: { tracking_code: string } }>(res);
  expect(body.response.tracking_code, 'tracking_code').toBeTruthy();
  return { trackingCode: body.response.tracking_code };
}

export async function setGender(
  request: APIRequestContext,
  lead: HealthLead,
  gender: string,
): Promise<void> {
  const res = await request.put(`${base}/lead/gender`, {
    headers: healthHeaders(lead),
    data: { gender },
  });
  await expectOk(res, 'set gender');
}

export async function setEmirate(
  request: APIRequestContext,
  lead: HealthLead,
  emirateKey: string,
): Promise<void> {
  const res = await request.put(`${base}/lead/emirate`, {
    headers: healthHeaders(lead),
    data: { emirate_key: emirateKey },
  });
  await expectOk(res, 'set emirate');
}

export async function setSalaryRange(
  request: APIRequestContext,
  lead: HealthLead,
  salaryRange: string,
): Promise<void> {
  const res = await request.put(`${base}/lead/salary-range`, {
    headers: healthHeaders(lead),
    data: { salary_range: salaryRange },
  });
  await expectOk(res, 'set salary range');
}

export async function addMember(
  request: APIRequestContext,
  lead: HealthLead,
  members: unknown,
): Promise<void> {
  const res = await request.post(`${base}/lead/member`, {
    headers: healthHeaders(lead),
    data: members,
  });
  await expectOk(res, 'add member');
}

export async function getMembers(
  request: APIRequestContext,
  lead: HealthLead,
): Promise<HealthMember[]> {
  const res = await request.get(`${base}/lead/member`, { headers: healthHeaders(lead) });
  await expectOk(res, 'get members');
  const body = await asBody<{ response: HealthMember[] }>(res);
  return body.response;
}

export async function setDateOfBirth(
  request: APIRequestContext,
  lead: HealthLead,
  payload: unknown,
): Promise<void> {
  const res = await request.put(`${base}/lead/member/date-of-birth`, {
    headers: healthHeaders(lead),
    data: payload,
  });
  await expectOk(res, 'set date of birth');
}

export async function setSpecialCondition(
  request: APIRequestContext,
  lead: HealthLead,
  payload: unknown,
): Promise<void> {
  const res = await request.put(`${base}/lead/special-condition`, {
    headers: healthHeaders(lead),
    data: payload,
  });
  await expectOk(res, 'set special condition');
}

export async function getQuotes(
  request: APIRequestContext,
  lead: HealthLead,
): Promise<Copay[]> {
  const res = await request.get(`${base}/quote/list`, { headers: healthHeaders(lead) });
  await expectOk(res, 'quote list');
  const body = await asBody<{
    response: { quotes: { plans: { selected_copay?: Copay | null }[] }[] };
  }>(res);
  return body.response.quotes
    .flatMap((group) => group.plans)
    .map((plan) => plan.selected_copay)
    .filter((c): c is Copay => Boolean(c?.id));
}

// ---- Composite prerequisites (keep negative tests short) ----

export async function prepareUntilSalary(
  request: APIRequestContext,
  lead: HealthLead,
  data: HealthScenarioData,
): Promise<void> {
  await setGender(request, lead, data.gender);
  await setEmirate(request, lead, data.emirate);
  await setSalaryRange(request, lead, data.salaryRange);
}

export async function prepareUntilMemberDob(
  request: APIRequestContext,
  lead: HealthLead,
  data: HealthScenarioData,
): Promise<number> {
  await prepareUntilSalary(request, lead, data);
  await addMember(request, lead, [{ type: data.memberType, count: 1, gender: data.gender }]);
  const members = await getMembers(request, lead);
  const member = members.find((m) => m.type === data.memberType) ?? members[0];
  expect(member?.id, 'member id').toBeTruthy();
  return member.id;
}

export async function prepareUntilQuotes(
  request: APIRequestContext,
  lead: HealthLead,
  data: HealthScenarioData,
): Promise<Copay[]> {
  const memberId = await prepareUntilMemberDob(request, lead, data);
  await setDateOfBirth(request, lead, [{ id: memberId, date_of_birth: data.dateOfBirth }]);
  await setSpecialCondition(request, lead, {
    is_any_member_pregnant: data.isAnyMemberPregnant,
    has_medical_condition: data.hasMedicalCondition,
  });
  return getQuotes(request, lead);
}
