import { test, expect } from '@/fixtures';
import { config } from '@/config';
import { expectStatus, asJson, expectSuccess } from '@/utils/api';
import happyPath from '../../test-data/api/health-happy-path.json';

const base = config.healthInsurance.basePath;

interface Envelope<T> {
  response: T;
  successful: boolean;
  error_data: unknown;
}

interface LeadState {
  tracking_code?: string;
  next_step?: string;
}

interface Member {
  id: number;
  type: string;
  gender: string;
  birthdate: string | null;
}

interface Copay {
  id: number;
  price: number;
}

interface Plan {
  plan_id: number;
  selected_copay?: Copay | null;
}

interface QuoteGroup {
  provider: { id: number; name: string };
  plans: Plan[];
}

interface QuoteList {
  quotes: QuoteGroup[];
}

// The health lead is bound to the authenticated user (no lead id in the path),
// so this flow must never run concurrently with another instance of itself.
test.describe.configure({ mode: 'serial' });

test.describe('Health insurance API / happy path', () => {
  test('completes health API flow up to ready for payment', async ({ authRequest }) => {
    let trackingCode = '';
    let memberId = 0;
    let copayId = 0;
    let price = 0;

    // Every lead-bound call after creation must carry the tracking code header.
    const leadHeaders = (): Record<string, string> => ({
      'x-health-tracking-code': trackingCode,
    });

    await test.step('Create health lead', async () => {
      const res = await authRequest.post(`${base}/lead`, {
        data: { plan_type: happyPath.planType },
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.tracking_code, 'tracking_code').toBeTruthy();
      expect(body.response.next_step).toBe('SELECT_GENDER');
      trackingCode = body.response.tracking_code!;
    });

    await test.step('Set gender', async () => {
      const res = await authRequest.put(`${base}/lead/gender`, {
        headers: leadHeaders(),
        data: { gender: happyPath.gender },
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.next_step).toBe('VISA_STATE');
    });

    await test.step('Set emirate', async () => {
      const res = await authRequest.put(`${base}/lead/emirate`, {
        headers: leadHeaders(),
        data: { emirate_key: happyPath.emirate },
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.next_step).toBe('SALARY_RANGE');
    });

    await test.step('Set salary range', async () => {
      const res = await authRequest.put(`${base}/lead/salary-range`, {
        headers: leadHeaders(),
        data: { salary_range: happyPath.salaryRange },
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.next_step).toBe('SELECT_MEMBERS');
    });

    await test.step('Add member', async () => {
      const res = await authRequest.post(`${base}/lead/member`, {
        headers: leadHeaders(),
        data: [{ type: happyPath.memberType, count: 1, gender: happyPath.gender }],
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.next_step).toBe('ADD_MEMBER_DETAILS');
    });

    await test.step('Fetch member id', async () => {
      const res = await authRequest.get(`${base}/lead/member`, {
        headers: leadHeaders(),
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<Member[]>>(res);
      expectSuccess(body);
      const member =
        body.response.find((m) => m.type === happyPath.memberType) ?? body.response[0];
      expect(member?.id, 'member id').toBeTruthy();
      memberId = member.id;
    });

    await test.step('Set date of birth', async () => {
      const res = await authRequest.put(`${base}/lead/member/date-of-birth`, {
        headers: leadHeaders(),
        data: [{ id: memberId, date_of_birth: happyPath.dateOfBirth }],
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.next_step).toBe('SPECIAL_MEDICAL_CONDITIONS');
    });

    await test.step('Set special medical condition', async () => {
      const res = await authRequest.put(`${base}/lead/special-condition`, {
        headers: leadHeaders(),
        data: {
          is_any_member_pregnant: happyPath.isAnyMemberPregnant,
          has_medical_condition: happyPath.hasMedicalCondition,
        },
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<null>>(res);
      expectSuccess(body);
      expect(body.response).toBeNull();
    });

    await test.step('List quotes', async () => {
      const res = await authRequest.get(`${base}/quote/list`, {
        headers: leadHeaders(),
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<QuoteList>>(res);
      expectSuccess(body);

      const copay = body.response.quotes
        .flatMap((group) => group.plans)
        .map((plan) => plan.selected_copay)
        .find((candidate): candidate is Copay => Boolean(candidate?.id));

      expect(copay, 'at least one selectable plan').toBeTruthy();
      copayId = copay!.id;
      price = copay!.price;
    });

    await test.step('Select quote (stop before payment)', async () => {
      const res = await authRequest.post(`${base}/quote/select`, {
        headers: leadHeaders(),
        data: { copay_id: copayId, price },
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.next_step).toBe('READY_FOR_PAY');
    });
  });
});
