import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const CC_PORT = Number(process.env.CC_PORT ?? 4600);

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
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

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const method = req.method ?? 'GET';
  const route = `${method} ${url.pathname}`;

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
      const result = runTest(target);
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
