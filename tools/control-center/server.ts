import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../src/config/index.ts';
import {
  E2E_PATHS,
  CAR_LEAD_TYPES,
  CAR_SPECIFICATIONS,
  EMIRATES,
  DRIVING_EXPERIENCES,
  CLAIMS,
  HEALTH_GENDERS,
  HEALTH_MEMBERS,
  SALARY_RANGES,
  COVERAGE_TYPES,
  MONTH_NAMES,
  loadCarConfig,
  loadHealthConfig,
  loadCarPresets,
  loadHealthPresets,
  saveCarConfig,
  saveHealthConfig,
  resetCarConfig,
  resetHealthConfig,
  validateCarConfig,
  validateHealthConfig,
  type CarConfig,
  type HealthConfig,
} from '../../src/config/test-options.ts';
import {
  openPlaywrightUi,
  playwrightUiStatus,
  PLAYWRIGHT_UI_PORT,
} from './playwright-launcher.ts';
import {
  isRunTarget,
  loadTestOptions,
  removeLastBatchResult,
  recoverBatchBackup,
  runState,
  runTest,
  RUN_TARGETS,
  saveTestOptions,
  startBatch,
  stopActive,
  validateScenarios,
  type RunProduct,
  type ScenarioDefinition,
  type TestOptions,
} from './test-runner.ts';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'public');
const CODEMIRROR_DIR = path.resolve(process.cwd(), 'node_modules', 'codemirror');
const SCENARIOS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'scenarios.json');
const CC_PORT = Number(process.env.CC_PORT ?? 4600);
let carCatalogLeadPromise: Promise<string> | null = null;
let carMakeCatalogPromise: Promise<{ id: number; make: string }[]> | null = null;
let carCountryCatalogPromise: Promise<{ id: number | string; name: string }[]> | null = null;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

type ScenarioStore = Record<RunProduct, ScenarioDefinition[]>;

function readScenarioStore(): ScenarioStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(SCENARIOS_FILE, 'utf8')) as Partial<ScenarioStore>;
    return {
      car: Array.isArray(parsed.car) ? parsed.car : [],
      health: Array.isArray(parsed.health) ? parsed.health : [],
    };
  } catch {
    return { car: [], health: [] };
  }
}

function writeScenarioStore(store: ScenarioStore): void {
  fs.mkdirSync(path.dirname(SCENARIOS_FILE), { recursive: true });
  const temporary = `${SCENARIOS_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, SCENARIOS_FILE);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function carCatalogLeadCode(): Promise<string> {
  if (!carCatalogLeadPromise) {
    carCatalogLeadPromise = (async () => {
      const leadResponse = await fetch(`${config.api.baseURL}${config.carInsurance.basePath}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_type: 'RENEW' }),
      });
      if (!leadResponse.ok) throw new Error(`Car catalog lead creation failed (${leadResponse.status})`);
      const leadBody = await leadResponse.json() as { response?: { tracking_code?: unknown } };
      const trackingCode = leadBody.response?.tracking_code;
      if (typeof trackingCode !== 'string' || !trackingCode) {
        throw new Error('Car catalog lead response did not include a tracking code');
      }

      const sourceResponse = await fetch(
        `${config.api.baseURL}${config.carInsurance.basePath}/lead/motor-information-source`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', tracking_code: trackingCode },
          body: JSON.stringify({ motor_information_source: 'MANUAL' }),
        },
      );
      if (!sourceResponse.ok) throw new Error(`Car catalog setup failed (${sourceResponse.status})`);
      return trackingCode;
    })();
  }

  try {
    return await carCatalogLeadPromise;
  } catch (error) {
    carCatalogLeadPromise = null;
    throw error;
  }
}

async function fetchCarCatalog(pathname: string): Promise<unknown> {
  const trackingCode = await carCatalogLeadCode();
  const response = await fetch(`${config.api.baseURL}${config.carInsurance.basePath}${pathname}`, {
    headers: { tracking_code: trackingCode },
  });
  if (!response.ok) throw new Error(`Car catalog request failed (${response.status})`);
  const body = await response.json() as { response?: unknown };
  return body.response;
}

function makeNameFromCatalogItem(item: { id?: unknown; make?: unknown; logo_url?: unknown }): string | null {
  if (typeof item.make === 'string' && item.make.trim()) return item.make.trim();
  if (typeof item.logo_url !== 'string') return null;
  const fileName = item.logo_url.split('/').pop()?.replace(/\.[a-z0-9]+(?:\?.*)?$/i, '');
  if (!fileName) return null;

  const slug = decodeURIComponent(fileName).toLowerCase();
  const acronyms: Record<string, string> = {
    baic: 'BAIC',
    bmw: 'BMW',
    byd: 'BYD',
    gac: 'GAC',
    gmc: 'GMC',
    jac: 'JAC',
    mg: 'MG',
    mini: 'MINI',
    uaz: 'UAZ',
  };
  const name = acronyms[slug]
    ?? slug.split(/[-_\s]+/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
  return name || null;
}

async function allCarMakes(): Promise<{ id: number; make: string }[]> {
  if (!carMakeCatalogPromise) {
    carMakeCatalogPromise = (async () => {
      const terms = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const byId = new Map<number, { id: number; make: string }>();
      for (let index = 0; index < terms.length; index += 5) {
        const batch = terms.slice(index, index + 5);
        const pages = await Promise.all(batch.map((term) => fetchCarCatalog(
          `/lead/manual/makes?searchTerm=${encodeURIComponent(term)}&size=500`,
        )));
        for (const page of pages) {
          const content = (page as { content?: unknown[] } | undefined)?.content ?? [];
          for (const raw of content) {
            const item = raw as { id?: unknown; make?: unknown; logo_url?: unknown };
            const id = Number(item.id);
            const make = makeNameFromCatalogItem(item);
            if (Number.isFinite(id) && make) byId.set(id, { id, make });
          }
        }
      }
      return [...byId.values()].sort((left, right) => left.make.localeCompare(right.make));
    })();
  }

  try {
    return await carMakeCatalogPromise;
  } catch (error) {
    carMakeCatalogPromise = null;
    throw error;
  }
}

async function fetchCarCountries(searchTerm = ''): Promise<{ id: number | string; name: string }[]> {
  const query = new URLSearchParams({ size: '300' });
  if (searchTerm.trim()) query.set('searchTerm', searchTerm.trim());
  const response = await fetch(
    `${config.api.baseURL}${config.carInsurance.basePath}/country?${query}`,
    { headers: { Accept: 'application/json', 'Accept-Language': 'en', 'User-Agent': 'Mozilla/5.0 Lookinsure-QA-Control-Center' } },
  );
  if (!response.ok) throw new Error(`Country catalog request failed (${response.status})`);
  const body = await response.json() as { response?: { content?: unknown[] } };
  return (body.response?.content ?? []).flatMap((raw) => {
    const item = raw as { id?: unknown; name?: unknown };
    return item.id != null && typeof item.name === 'string' && item.name.trim()
      ? [{ id: typeof item.id === 'number' ? item.id : String(item.id), name: item.name.trim() }]
      : [];
  });
}

async function allCarCountries(): Promise<{ id: number | string; name: string }[]> {
  if (!carCountryCatalogPromise) {
    carCountryCatalogPromise = fetchCarCountries();
  }
  try {
    return await carCountryCatalogPromise;
  } catch (error) {
    carCountryCatalogPromise = null;
    throw error;
  }
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function configSource(runtimePath: string): 'runtime' | 'preset-default' {
  return fs.existsSync(runtimePath) ? 'runtime' : 'preset-default';
}

/** Serves CodeMirror from local node_modules (no CDN; works offline). */
function serveVendor(res: http.ServerResponse, url: URL): void {
  const relative = url.pathname.replace(/^\/vendor\/codemirror\//, '');
  const resolved = path.resolve(CODEMIRROR_DIR, relative);
  if (
    !resolved.startsWith(CODEMIRROR_DIR) ||
    !/\.(js|css)$/i.test(resolved) ||
    !fs.existsSync(resolved) ||
    !fs.statSync(resolved).isFile()
  ) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const type = path.extname(resolved).toLowerCase() === '.css'
    ? 'text/css; charset=utf-8'
    : 'text/javascript; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(resolved).pipe(res);
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, relative);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const type = CONTENT_TYPES[path.extname(resolved)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(resolved).pipe(res);
}

function optionsPayload(): unknown {
  return {
    car: {
      leadTypes: CAR_LEAD_TYPES,
      specifications: CAR_SPECIFICATIONS,
      emirates: EMIRATES,
      drivingExperiences: DRIVING_EXPERIENCES,
      claims: CLAIMS,
      months: MONTH_NAMES,
      presets: loadCarPresets(),
    },
    health: {
      genders: HEALTH_GENDERS,
      emirates: EMIRATES,
      salaryRanges: SALARY_RANGES,
      members: HEALTH_MEMBERS,
      coverageTypes: COVERAGE_TYPES,
      months: MONTH_NAMES,
      presets: loadHealthPresets(),
    },
  };
}

async function fetchClaimOptions(drivingExperience: string): Promise<{ options: Record<string, string>; maxNoClaimDiscountYears: number }> {
  const trackingCode = await carCatalogLeadCode();
  const response = await fetch(
    `${config.api.baseURL}${config.carInsurance.basePath}/lead/manual/driving-experience`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', tracking_code: trackingCode },
      body: JSON.stringify({ driving_experience: drivingExperience }),
    },
  );
  if (!response.ok) throw new Error(`Driving experience request failed (${response.status})`);
  const body = await response.json() as {
    successful?: boolean;
    response?: { max_no_claim_discount_years?: unknown };
  };
  const max = Number(body.response?.max_no_claim_discount_years);
  if (body.successful === false || !Number.isInteger(max) || max < 0) {
    throw new Error('Driving experience response did not include a valid max_no_claim_discount_years');
  }

  const options: Record<string, string> = { CLAIM_0: CLAIMS.CLAIM_0 };
  for (let year = 1; year <= Math.min(max, 4); year += 1) {
    const key = `CLAIM_${year}`;
    if (CLAIMS[key]) options[key] = CLAIMS[key];
  }
  if (max >= 4) options.CLAIM_FREE_OVER_4 = CLAIMS.CLAIM_FREE_OVER_4;
  return { options, maxNoClaimDiscountYears: max };
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const method = req.method ?? 'GET';
  const route = `${method} ${url.pathname}`;

  if (method === 'GET' && url.pathname === '/api/car-catalog/makes') {
    const searchTerm = url.searchParams.get('searchTerm') ?? '';
    if (!searchTerm.trim()) {
      const makes = await allCarMakes();
      return sendJson(res, 200, { ok: true, options: makes });
    }
    const page = await fetchCarCatalog(
      `/lead/manual/makes?searchTerm=${encodeURIComponent(searchTerm)}&size=500`,
    ) as { content?: unknown[] } | undefined;
    const makes = (page?.content ?? []).flatMap((raw) => {
      const item = raw as { id?: unknown; make?: unknown; logo_url?: unknown };
      const id = Number(item.id);
      const make = makeNameFromCatalogItem(item);
      return Number.isFinite(id) && make ? [{ id, make }] : [];
    });
    return sendJson(res, 200, { ok: true, options: makes });
  }

  if (method === 'GET' && url.pathname === '/api/car-catalog/countries') {
    const searchTerm = url.searchParams.get('searchTerm') ?? '';
    const countries = searchTerm.trim()
      ? await fetchCarCountries(searchTerm)
      : await allCarCountries();
    return sendJson(res, 200, { ok: true, options: countries });
  }

  if (method === 'GET' && url.pathname === '/api/car-catalog/claims') {
    const drivingExperience = url.searchParams.get('drivingExperience') ?? '';
    if (!Object.prototype.hasOwnProperty.call(DRIVING_EXPERIENCES, drivingExperience)) {
      return sendJson(res, 400, { ok: false, errors: ['A valid drivingExperience is required'] });
    }
    const result = await fetchClaimOptions(drivingExperience);
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (method === 'GET' && url.pathname === '/api/car-catalog/models') {
    const make = url.searchParams.get('make');
    if (!make) return sendJson(res, 400, { ok: false, errors: ['make is required'] });
    const result = await fetchCarCatalog(
      `/lead/manual/models?make=${encodeURIComponent(make)}&size=500&page=1`,
    ) as { content?: unknown[] } | unknown[] | undefined;
    const models = Array.isArray(result) ? result : result?.content;
    return sendJson(res, 200, { ok: true, options: Array.isArray(models) ? models : [] });
  }

  if (method === 'GET' && url.pathname === '/api/car-catalog/trims') {
    const make = url.searchParams.get('make');
    const model = url.searchParams.get('model');
    const year = url.searchParams.get('year');
    if (!make || !model || !year) {
      return sendJson(res, 400, { ok: false, errors: ['make, model and year are required'] });
    }
    const trackingCode = await carCatalogLeadCode();
    const yearResponse = await fetch(
      `${config.api.baseURL}${config.carInsurance.basePath}/lead/manual/year`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', tracking_code: trackingCode },
        body: JSON.stringify({ make, model, year: Number(year) }),
      },
    );
    if (!yearResponse.ok) throw new Error(`Car catalog year selection failed (${yearResponse.status})`);
    const trims = await fetchCarCatalog(
      `/lead/manual/trims?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`,
    );
    return sendJson(res, 200, { ok: true, options: Array.isArray(trims) ? trims : [] });
  }

  switch (route) {
    case 'GET /api/options':
      return sendJson(res, 200, optionsPayload());

    case 'GET /api/config/car':
      return sendJson(res, 200, {
        config: loadCarConfig(),
        source: configSource(E2E_PATHS.carRuntime),
        presets: Object.keys(loadCarPresets()),
      });

    case 'GET /api/config/health':
      return sendJson(res, 200, {
        config: loadHealthConfig(),
        source: configSource(E2E_PATHS.healthRuntime),
        presets: Object.keys(loadHealthPresets()),
      });

    case 'PUT /api/config/car': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const errors = validateCarConfig(body);
      if (errors.length > 0) return sendJson(res, 400, { ok: false, errors });
      saveCarConfig(body as CarConfig);
      return sendJson(res, 200, { ok: true, config: body });
    }

    case 'PUT /api/config/health': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const errors = validateHealthConfig(body);
      if (errors.length > 0) return sendJson(res, 400, { ok: false, errors });
      saveHealthConfig(body as HealthConfig);
      return sendJson(res, 200, { ok: true, config: body });
    }

    case 'POST /api/config/car/validate': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const errors = validateCarConfig(body);
      return errors.length > 0
        ? sendJson(res, 400, { ok: false, errors })
        : sendJson(res, 200, { ok: true });
    }

    case 'POST /api/config/health/validate': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const errors = validateHealthConfig(body);
      return errors.length > 0
        ? sendJson(res, 400, { ok: false, errors })
        : sendJson(res, 200, { ok: true });
    }

    case 'GET /api/scenarios':
      return sendJson(res, 200, { ok: true, scenarios: readScenarioStore() });

    case 'POST /api/scenarios': {
      let body: unknown;
      try { body = await readJsonBody(req); } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const input = body as { product?: unknown; config?: unknown; scenarios?: unknown } | undefined;
      const product = input?.product;
      if (product !== 'car' && product !== 'health') {
        return sendJson(res, 400, { ok: false, errors: ['product must be "car" or "health"'] });
      }

      const scenarioInputs = Array.isArray(input.scenarios)
        ? input.scenarios as { name?: unknown; config?: unknown }[]
        : [{ config: input.config }];
      if (scenarioInputs.length === 0) {
        return sendJson(res, 400, { ok: false, errors: ['At least one scenario configuration is required'] });
      }

      const store = readScenarioStore();
      const existingNames = new Set(store[product].map((scenario) => scenario.name));
      const added: { name: string; config: unknown }[] = [];
      let nextNumber = 1;
      for (const [index, scenarioInput] of scenarioInputs.entries()) {
        const configBody = scenarioInput?.config;
        const errors = product === 'car' ? validateCarConfig(configBody) : validateHealthConfig(configBody);
        if (errors.length) {
          return sendJson(res, 400, { ok: false, errors: errors.map((error) => `Scenario ${index + 1}: ${error}`) });
        }

        let name = typeof scenarioInput.name === 'string' ? scenarioInput.name.trim() : '';
        if (!name) {
          while (existingNames.has(`Scenario ${nextNumber}`)) nextNumber += 1;
          name = `Scenario ${nextNumber++}`;
        }
        const nameKey = name.toLocaleLowerCase();
        if ([...existingNames].some((existing) => existing.toLocaleLowerCase() === nameKey)) {
          return sendJson(res, 409, { ok: false, errors: [`Scenario name already exists: ${name}`] });
        }
        existingNames.add(name);
        added.push({ name, config: configBody });
      }

      store[product].push(...added);
      writeScenarioStore(store);
      return sendJson(res, 201, { ok: true, scenario: added[0], added, scenarios: store });
    }

    case 'PUT /api/scenarios': {
      let body: unknown;
      try { body = await readJsonBody(req); } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const input = body as { product?: unknown; index?: unknown; name?: unknown } | undefined;
      if ((input?.product !== 'car' && input?.product !== 'health')
        || typeof input.index !== 'number' || !Number.isInteger(input.index)
        || typeof input.name !== 'string' || !input.name.trim()) {
        return sendJson(res, 400, { ok: false, errors: ['Valid product, integer index and non-empty name are required'] });
      }
      const store = readScenarioStore();
      if (input.index < 0 || input.index >= store[input.product].length) {
        return sendJson(res, 404, { ok: false, errors: ['Scenario not found'] });
      }
      const name = input.name.trim();
      if (store[input.product].some((scenario, index) => index !== input.index
        && scenario.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        return sendJson(res, 409, { ok: false, errors: ['A scenario with this name already exists'] });
      }
      store[input.product][input.index].name = name;
      writeScenarioStore(store);
      return sendJson(res, 200, { ok: true, scenarios: store });
    }

    case 'DELETE /api/scenarios': {
      let body: unknown;
      try { body = await readJsonBody(req); } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const input = body as { product?: unknown; index?: unknown } | undefined;
      if ((input?.product !== 'car' && input?.product !== 'health')
        || typeof input.index !== 'number' || !Number.isInteger(input.index)) {
        return sendJson(res, 400, { ok: false, errors: ['Valid product and integer index are required'] });
      }
      const store = readScenarioStore();
      if (input.index < 0 || input.index >= store[input.product].length) {
        return sendJson(res, 404, { ok: false, errors: ['Scenario not found'] });
      }
      const [removed] = store[input.product].splice(input.index, 1);
      writeScenarioStore(store);
      return sendJson(res, 200, { ok: true, removed, scenarios: store });
    }

    case 'POST /api/batch/validate': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const product = (body as { product?: unknown } | undefined)?.product;
      if (product !== 'car' && product !== 'health') {
        return sendJson(res, 400, { ok: false, errors: ['product must be "car" or "health"'] });
      }
      const scenarios = (body as { scenarios?: unknown } | undefined)?.scenarios;
      const errors = validateScenarios(product as RunProduct, scenarios);
      return errors.length > 0
        ? sendJson(res, 400, { ok: false, errors })
        : sendJson(res, 200, { ok: true, count: Array.isArray(scenarios) ? scenarios.length : 0 });
    }

    case 'POST /api/batch/results/remove': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const index = (body as { index?: unknown } | undefined)?.index;
      if (typeof index !== 'number' || !Number.isInteger(index)) {
        return sendJson(res, 400, { ok: false, errors: ['index must be an integer'] });
      }
      const result = removeLastBatchResult(index);
      if (!result.removed) {
        return sendJson(res, 409, { ok: false, errors: [result.message ?? 'Could not remove batch result'] });
      }
      return sendJson(res, 200, { ok: true, batch: result.batch ?? null });
    }

    case 'POST /api/batch/run': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const product = (body as { product?: unknown } | undefined)?.product;
      if (product !== 'car' && product !== 'health') {
        return sendJson(res, 400, { ok: false, errors: ['product must be "car" or "health"'] });
      }
      const scenarios = (body as { scenarios?: unknown } | undefined)?.scenarios;
      const result = startBatch(product as RunProduct, (scenarios ?? []) as ScenarioDefinition[]);
      if (!result.started) {
        return sendJson(res, result.errors ? 400 : 409, {
          ok: false,
          errors: result.errors ?? [result.message ?? 'Could not start batch'],
        });
      }
      return sendJson(res, 200, { ok: true, product });
    }

    case 'POST /api/run/stop': {
      const result = stopActive();
      if (!result.stopped) {
        return sendJson(res, 409, { ok: false, errors: [result.message ?? 'No test is running'] });
      }
      return sendJson(res, 200, { ok: true });
    }

    case 'POST /api/config/car/reset':
      return sendJson(res, 200, { ok: true, config: resetCarConfig() });

    case 'POST /api/config/health/reset':
      return sendJson(res, 200, { ok: true, config: resetHealthConfig() });

    case 'GET /api/playwright/status':
      return sendJson(res, 200, { port: PLAYWRIGHT_UI_PORT, ...(await playwrightUiStatus()) });

    case 'POST /api/playwright/open': {
      try {
        return sendJson(res, 200, { ok: true, ...(await openPlaywrightUi()) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return sendJson(res, 500, { ok: false, errors: [message] });
      }
    }

    case 'GET /api/test-options':
      return sendJson(res, 200, { ok: true, options: loadTestOptions() });

    case 'PUT /api/test-options': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const headed = (body as { execution?: { headed?: unknown } } | undefined)?.execution?.headed;
      if (typeof headed !== 'boolean') {
        return sendJson(res, 400, { ok: false, errors: ['execution.headed must be a boolean'] });
      }
      const options: TestOptions = { execution: { headed } };
      saveTestOptions(options);
      return sendJson(res, 200, { ok: true, options });
    }

    case 'GET /api/run/status':
      return sendJson(res, 200, { ok: true, ...runState() });

    case 'POST /api/run': {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, errors: ['Body must be valid JSON'] });
      }
      const target = (body as { target?: unknown } | undefined)?.target;
      if (!isRunTarget(target)) {
        return sendJson(res, 400, {
          ok: false,
          errors: [`target must be one of: ${RUN_TARGETS.join(', ')}`],
        });
      }
      const runBody = body as { config?: unknown };
      const config = target.startsWith('car-') || target.startsWith('health-')
        ? runBody.config
        : undefined;
      if (config !== undefined) {
        const errors = target.startsWith('car-') ? validateCarConfig(config) : validateHealthConfig(config);
        if (errors.length > 0) return sendJson(res, 400, { ok: false, errors });
      }
      const result = runTest(target, config);
      if (!result.started) {
        return sendJson(res, 409, { ok: false, errors: [result.message ?? 'A test is already running'] });
      }
      return sendJson(res, 200, { ok: true, target });
    }

    default:
      return sendJson(res, 404, { ok: false, errors: [`Unknown route: ${route}`] });
  }
}

function handler(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${CC_PORT}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { ok: false, errors: [message] });
    });
    return;
  }
  if (url.pathname.startsWith('/vendor/codemirror/')) {
    serveVendor(res, url);
    return;
  }
  serveStatic(req, res, url);
}

export function startServer(port: number = CC_PORT): Promise<http.Server> {
  // Restore the runtime config if a previous batch was interrupted.
  recoverBatchBackup();
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  startServer()
    .then((server) => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : CC_PORT;
      console.log(`Lookinsure QA Control Center: http://127.0.0.1:${port}/`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
