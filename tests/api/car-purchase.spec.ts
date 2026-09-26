import { test, expect } from '@/fixtures';
import { config } from '@/config';
import { expectStatus, asJson, expectSuccess, emitControlCenterEvent } from '@/utils/api';
import happyPath from '../../test-data/api/car-happy-path.json';

const base = config.carInsurance.basePath;

interface Envelope<T> {
  response: T;
  successful: boolean;
  error_data: unknown;
}

interface LeadState {
  tracking_code?: string;
  next_step?: string;
  step?: string;
}

interface MakePage {
  content: { id: number; make: string }[];
}

interface ModelPage {
  content: string[];
}

interface CountryPage {
  content: { id: number; name: string }[];
}

interface Quote {
  id: number;
  insurance_type: string;
  insurance_provider: { id: number; name: string };
}

interface QuoteList {
  quotes: Quote[];
}

// The motor lead is bound to the authenticated user (no lead id in the path),
// so this flow must never run concurrently with another instance of itself.
test.describe.configure({ mode: 'serial' });

test.describe('Car insurance API / happy path', { tag: ['@car', '@api', '@smoke', '@happy'] }, () => {
  test('completes car API flow up to ready for review', async ({ authRequest }) => {
    let trackingCode = '';
    let makeId = 0;
    let model = '';
    let trim = '';
    let countryId = 0;
    let quoteId = 0;
    let insuranceType = '';

    // Every lead-bound call after creation must carry the tracking_code header.
    const leadHeaders = (): Record<string, string> => ({ tracking_code: trackingCode });

    await test.step('Create motor lead', async () => {
      const res = await authRequest.post(`${base}/lead`, {
        data: { lead_type: happyPath.leadType },
      });
      expectStatus(res, 201);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.tracking_code, 'tracking_code').toBeTruthy();
      trackingCode = body.response.tracking_code!;
      emitControlCenterEvent({ type: 'tracking-code', product: 'car', value: trackingCode });
    });

    await test.step('Set information source', async () => {
      const res = await authRequest.put(`${base}/lead/motor-information-source`, {
        headers: leadHeaders(),
        data: { motor_information_source: happyPath.informationSource },
      });
      expectStatus(res, 200);
      expectSuccess(await asJson<Envelope<unknown>>(res));
    });

    await test.step('Select vehicle make', async () => {
      const res = await authRequest.get(
        `${base}/lead/manual/makes?searchTerm=${encodeURIComponent(happyPath.vehicle.make)}&size=200`,
        { headers: leadHeaders() },
      );
      expectStatus(res, 200);
      const body = await asJson<Envelope<MakePage>>(res);
      expectSuccess(body);
      const make =
        body.response.content.find((m) => m.make === happyPath.vehicle.make) ??
        body.response.content[0];
      expect(make?.id, 'make id').toBeTruthy();
      makeId = make.id;
    });

    await test.step('Select vehicle model', async () => {
      const res = await authRequest.get(
        `${base}/lead/manual/models?make=${makeId}&size=500&page=1`,
        { headers: leadHeaders() },
      );
      expectStatus(res, 200);
      const body = await asJson<Envelope<ModelPage>>(res);
      expectSuccess(body);
      model = body.response.content.includes(happyPath.vehicle.model)
        ? happyPath.vehicle.model
        : body.response.content[0];
      expect(model, 'model').toBeTruthy();
    });

    await test.step('Set model year', async () => {
      const res = await authRequest.put(`${base}/lead/manual/year`, {
        headers: leadHeaders(),
        data: { make: String(makeId), model, year: happyPath.vehicle.year },
      });
      expectStatus(res, 200);
      expectSuccess(await asJson<Envelope<unknown>>(res));
    });

    await test.step('Select vehicle trim', async () => {
      const res = await authRequest.get(
        `${base}/lead/manual/trims?make=${makeId}&model=${encodeURIComponent(model)}&year=${happyPath.vehicle.year}`,
        { headers: leadHeaders() },
      );
      expectStatus(res, 200);
      const body = await asJson<Envelope<string[]>>(res);
      expectSuccess(body);
      trim = body.response[0];
      expect(trim, 'trim').toBeTruthy();
    });

    await test.step('Set trim', async () => {
      const res = await authRequest.put(`${base}/lead/manual/trim`, {
        headers: leadHeaders(),
        data: { make: String(makeId), model, year: happyPath.vehicle.year, trim },
      });
      expectStatus(res, 200);
      expectSuccess(await asJson<Envelope<unknown>>(res));
    });

    await test.step('Set car details', async () => {
      const res = await authRequest.put(`${base}/lead/manual/car-details`, {
        headers: leadHeaders(),
        data: {
          is_gcc: happyPath.carDetails.isGcc,
          is_personally_modified: happyPath.carDetails.isPersonallyModified,
          is_for_personal_use: happyPath.carDetails.isForPersonalUse,
        },
      });
      expectStatus(res, 200);
      expectSuccess(await asJson<Envelope<unknown>>(res));
    });

    await test.step('Set registration emirate', async () => {
      const res = await authRequest.put(`${base}/lead/registration/emirate`, {
        headers: leadHeaders(),
        data: { emirate: happyPath.emirate },
      });
      expectStatus(res, 200);
      expectSuccess(await asJson<Envelope<unknown>>(res));
    });

    await test.step('Select driver nationality', async () => {
      const res = await authRequest.get(
        `${base}/country?searchTerm=${encodeURIComponent(happyPath.driver.country)}&size=300`,
        { headers: leadHeaders() },
      );
      expectStatus(res, 200);
      const body = await asJson<Envelope<CountryPage>>(res);
      expectSuccess(body);
      const country =
        body.response.content.find((c) => c.name === happyPath.driver.country) ??
        body.response.content[0];
      expect(country?.id, 'country id').toBeTruthy();
      countryId = country.id;
    });

    await test.step('Set driver information', async () => {
      const res = await authRequest.put(`${base}/lead/manual/driver-information`, {
        headers: leadHeaders(),
        data: { country_id: countryId, date_of_birth: happyPath.driver.dateOfBirth },
      });
      expectStatus(res, 200);
      expectSuccess(await asJson<Envelope<unknown>>(res));
    });

    await test.step('Set driving experience', async () => {
      const res = await authRequest.put(`${base}/lead/manual/driving-experience`, {
        headers: leadHeaders(),
        data: { driving_experience: happyPath.drivingExperience },
      });
      expectStatus(res, 200);
      expectSuccess(await asJson<Envelope<unknown>>(res));
    });

    await test.step('Set claim-free year', async () => {
      const res = await authRequest.put(`${base}/lead/manual/claim-free-year`, {
        headers: leadHeaders(),
        data: {
          claim_free_year: happyPath.claimFreeYear,
          is_claim_free_year_thresh_hold: happyPath.claimFreeYearThreshold,
        },
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.next_step).toBe('QUOTE_LIST');
    });

    await test.step('Analyse vehicle', async () => {
      const res = await authRequest.get(`${base}/lead/fetch?`, { headers: leadHeaders() });
      expectStatus(res, 200);
      const body = await asJson<Envelope<{ analysis_status?: string }>>(res);
      expectSuccess(body);
      expect(body.response.analysis_status, 'analysis_status').toBeTruthy();
    });

    await test.step('List quotes', async () => {
      const res = await authRequest.get(`${base}/quote/list`, { headers: leadHeaders() });
      expectStatus(res, 200);
      const body = await asJson<Envelope<QuoteList>>(res);
      expectSuccess(body);
      expect(body.response.quotes.length, 'at least one quote').toBeGreaterThan(0);

      const quote = body.response.quotes[0];
      expect(quote?.id, 'quote id').toBeTruthy();
      expect(quote?.insurance_type, 'insurance type').toBeTruthy();
      quoteId = quote.id;
      insuranceType = quote.insurance_type;
    });

    await test.step('Select insurance quote', async () => {
      const res = await authRequest.put(`${base}/lead/add-quote`, {
        headers: leadHeaders(),
        data: { insurance_type: insuranceType, quote_id: quoteId, add_on_ids: [] },
      });
      expectStatus(res, 200);
      const body = await asJson<Envelope<LeadState>>(res);
      expectSuccess(body);
      expect(body.response.step).toBe('READY_FOR_REVIEW');
    });
  });
});

