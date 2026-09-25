import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import {
  E2E_PATHS,
  validateCarConfig,
  validateHealthConfig,
} from '../../src/config/test-options.ts';

export type RunProduct = 'car' | 'health';
export type RunStatus = 'passed' | 'failed' | 'stopped';
export type ScenarioStatus = RunStatus | 'not-run';
export type BatchStatus = 'running' | 'completed' | 'stopped' | 'failed';

export interface RunResult {
  product: RunProduct;
  status: RunStatus;
  duration: number;
  trackingCode: string | null;
  finishedAt: string;
  error: string | null;
}

export interface ScenarioDefinition {
  name: string;
  config: unknown;
}

export interface ScenarioResult {
  name: string;
  status: ScenarioStatus;
  duration: number | null;
  trackingCode: string | null;
  error: string | null;
}

export interface BatchResult {
  product: RunProduct;
  status: BatchStatus;
  startedAt: string;
  finishedAt: string | null;
  results: ScenarioResult[];
}

export interface RunState {
  running: boolean;
  mode: 'single' | 'batch' | null;
  product?: RunProduct;
  startedAt?: number;
  currentScenario: { index: number; total: number; name: string } | null;
  last: RunResult | null;
  batch: BatchResult | null;
  console: { product: RunProduct | null; lines: string[] };
}

export interface TestOptions {
  execution: { headed: boolean };
}

/**
 * Playwright CLI runner for the Control Center. It shells out to the existing
 * CLI (same projects/specs as `npm run test:car` / `test:health`) and never
 * injects env: the specs read the saved runtime config. Only a compact,
 * non-sensitive result (status/duration/tracking code/error) is persisted. The
 * live log is kept in memory only (bounded), never written to disk.
 */
const RUNTIME_DIR = path.resolve(process.cwd(), 'test-data', 'e2e', 'runtime');
const LAST_RUN_FILE = path.join(RUNTIME_DIR, 'last-run.json');
const LAST_BATCH_FILE = path.join(RUNTIME_DIR, 'last-batch.json');
const OPTIONS_FILE = path.join(RUNTIME_DIR, 'test-options.json');
const BACKUP_FILE = path.join(RUNTIME_DIR, 'batch-backup.json');
const LIVE_REPORTER = './tools/control-center/live-reporter.ts';
const EVENT_MARKER = 'CONTROL_CENTER_EVENT ';
const MAX_LINES = 300;

const SPECS: Record<RunProduct, string> = {
  car: 'tests/e2e/car-purchase.spec.ts',
  health: 'tests/e2e/health-purchase.spec.ts',
};

interface Controller {
  mode: 'single' | 'batch';
  product: RunProduct;
  startedAt: number;
  childStartedAt: number | null;
  output: string[];
  trackingCode: string | null;
  stopped: boolean;
  child: ChildProcess | null;
  scenarios?: ScenarioDefinition[];
  index?: number;
  results?: ScenarioResult[];
  backup?: string | null;
}

let active: Controller | null = null;
let retained: { product: RunProduct; lines: string[] } | null = null;
let lastBatch: BatchResult | null = loadLastBatch();

// ---- options ----

export function loadTestOptions(): TestOptions {
  try {
    if (!existsSync(OPTIONS_FILE)) return { execution: { headed: false } };
    const parsed = JSON.parse(readFileSync(OPTIONS_FILE, 'utf8')) as Partial<TestOptions>;
    return { execution: { headed: parsed.execution?.headed === true } };
  } catch {
    return { execution: { headed: false } };
  }
}

export function saveTestOptions(value: TestOptions): void {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  writeFileSync(OPTIONS_FILE, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// ---- persistence ----

function writeJson(file: string, value: unknown): void {
  try {
    mkdirSync(RUNTIME_DIR, { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } catch {
    // best-effort: a failed write must not affect the run itself
  }
}

function saveLastRun(result: RunResult): void {
  writeJson(LAST_RUN_FILE, result);
}

export function loadLastRun(): RunResult | null {
  try {
    if (!existsSync(LAST_RUN_FILE)) return null;
    return JSON.parse(readFileSync(LAST_RUN_FILE, 'utf8')) as RunResult;
  } catch {
    return null;
  }
}

function saveLastBatch(batch: BatchResult): void {
  writeJson(LAST_BATCH_FILE, batch);
}

function loadLastBatch(): BatchResult | null {
  try {
    if (!existsSync(LAST_BATCH_FILE)) return null;
    return JSON.parse(readFileSync(LAST_BATCH_FILE, 'utf8')) as BatchResult;
  } catch {
    return null;
  }
}

// ---- runtime config backup / restore (batch only) ----

function runtimeConfigPath(product: RunProduct): string {
  return product === 'car' ? E2E_PATHS.carRuntime : E2E_PATHS.healthRuntime;
}

function readRuntimeConfig(product: RunProduct): string | null {
  const file = runtimeConfigPath(product);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function applyScenarioConfig(product: RunProduct, config: unknown): void {
  writeFileSync(runtimeConfigPath(product), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function restoreRuntime(product: RunProduct, content: string | null): void {
  const file = runtimeConfigPath(product);
  if (content === null) {
    rmSync(file, { force: true });
    return;
  }
  writeFileSync(file, content, 'utf8');
}

function deleteBackup(): void {
  rmSync(BACKUP_FILE, { force: true });
}

/** Simple crash resilience: restore an interrupted batch's runtime config. */
export function recoverBatchBackup(): void {
  try {
    if (!existsSync(BACKUP_FILE)) return;
    const data = JSON.parse(readFileSync(BACKUP_FILE, 'utf8')) as {
      product: RunProduct;
      content: string | null;
    };
    restoreRuntime(data.product, data.content ?? null);
  } catch {
    // ignore malformed backup
  } finally {
    deleteBackup();
  }
}

// ---- validation ----

export function validateScenarios(product: RunProduct, scenarios: unknown): string[] {
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return ['scenarios must be a non-empty array'];
  }
  const errors: string[] = [];
  const names = new Set<string>();
  scenarios.forEach((scenario, index) => {
    const record = scenario as { name?: unknown; config?: unknown } | null;
    const name = typeof record?.name === 'string' ? record.name.trim() : '';
    if (!name) {
      errors.push(`scenarios[${index}].name is required`);
    } else if (names.has(name)) {
      errors.push(`scenarios[${index}].name "${name}" is duplicated`);
    } else {
      names.add(name);
    }
    const configErrors =
      product === 'car' ? validateCarConfig(record?.config) : validateHealthConfig(record?.config);
    const label = name || `scenarios[${index}]`;
    for (const error of configErrors) errors.push(`${label}: ${error}`);
  });
  return errors;
}

// ---- state ----

function currentBatch(controller: Controller): BatchResult {
  return {
    product: controller.product,
    status: 'running',
    startedAt: new Date(controller.startedAt).toISOString(),
    finishedAt: null,
    results: controller.results ?? [],
  };
}

export function runState(): RunState {
  const lines = active ? active.output : retained?.lines ?? [];
  const product = active?.product ?? retained?.product ?? null;
  let batch: BatchResult | null = lastBatch;
  let currentScenario: RunState['currentScenario'] = null;
  if (active && active.mode === 'batch') {
    batch = currentBatch(active);
    const index = active.index ?? 0;
    const scenario = active.scenarios?.[index];
    if (scenario) {
      currentScenario = { index: index + 1, total: active.scenarios?.length ?? 0, name: scenario.name };
    }
  }
  return {
    running: active !== null,
    mode: active?.mode ?? null,
    product: active?.product,
    startedAt: active?.startedAt,
    currentScenario,
    last: loadLastRun(),
    batch,
    console: { product, lines: [...lines] },
  };
}

// ---- child process handling ----

function modeLine(): string {
  return `Running mode: ${loadTestOptions().execution.headed ? 'HEADED (browser visible)' : 'HEADLESS'}`;
}

function extractError(lines: string[]): string {
  const meaningful = lines.map((line) => line.trim()).filter(Boolean);
  return (meaningful.slice(-6).join('\n') || 'Test run failed').slice(0, 2000);
}

function handleLine(controller: Controller, line: string): void {
  const markerIndex = line.indexOf(EVENT_MARKER);
  if (markerIndex >= 0) {
    const payload = line.slice(markerIndex + EVENT_MARKER.length).trim();
    try {
      const event = JSON.parse(payload) as { type?: string; product?: string; value?: unknown };
      if (
        event.type === 'tracking-code' &&
        (event.product === 'car' || event.product === 'health') &&
        typeof event.value === 'string' &&
        event.value
      ) {
        controller.trackingCode = event.value;
        controller.output.push(`Tracking code: ${event.value}`);
        return;
      }
    } catch {
      // ignore malformed event
    }
    return; // never surface the raw event payload
  }
  controller.output.push(line);
}

function beginChild(controller: Controller): void {
  const cli = path.resolve(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
  const headed = loadTestOptions().execution.headed;
  const args = [
    cli,
    'test',
    '--project=e2e-chromium',
    SPECS[controller.product],
    '--retries=0',
    `--reporter=${LIVE_REPORTER}`,
  ];
  if (headed) args.push('--headed');

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    // A headed run must be able to create a real browser window.
    windowsHide: !headed,
  });

  controller.child = child;
  controller.childStartedAt = Date.now();
  controller.trackingCode = null;

  const onData = (chunk: Buffer): void => {
    for (const raw of chunk.toString('utf8').split(/\r?\n/)) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      handleLine(controller, line);
    }
    if (controller.output.length > MAX_LINES) {
      controller.output.splice(0, controller.output.length - MAX_LINES);
    }
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  child.once('error', (error) => onChildClose(controller, null, error.message));
  child.once('close', (code) => onChildClose(controller, code, null));
}

function onChildClose(controller: Controller, code: number | null, errorMessage: string | null): void {
  controller.child = null;
  const duration = Date.now() - (controller.childStartedAt ?? controller.startedAt);
  const status: RunStatus = controller.stopped
    ? 'stopped'
    : code === 0
      ? 'passed'
      : 'failed';
  const error = status === 'failed' ? errorMessage ?? extractError(controller.output) : null;

  if (controller.stopped) controller.output.push('Test stopped by user.');

  if (controller.mode === 'single') {
    saveLastRun({
      product: controller.product,
      status,
      duration,
      trackingCode: controller.trackingCode,
      finishedAt: new Date().toISOString(),
      error,
    });
    retained = { product: controller.product, lines: [...controller.output] };
    active = null;
    return;
  }

  const index = controller.index ?? 0;
  const scenarios = controller.scenarios ?? [];
  if (controller.results) {
    controller.results[index] = {
      name: scenarios[index]?.name ?? `scenario ${index + 1}`,
      status,
      duration,
      trackingCode: controller.trackingCode,
      error,
    };
  }
  saveLastRun({
    product: controller.product,
    status,
    duration,
    trackingCode: controller.trackingCode,
    finishedAt: new Date().toISOString(),
    error,
  });

  if (controller.stopped) {
    for (let i = index + 1; i < (controller.results?.length ?? 0); i += 1) {
      if (controller.results) controller.results[i].status = 'not-run';
    }
    finishBatch(controller, 'stopped');
    return;
  }

  if (index + 1 < scenarios.length) {
    controller.index = index + 1;
    controller.stopped = false;
    const next = scenarios[controller.index];
    applyScenarioConfig(controller.product, next.config);
    controller.output.push('');
    controller.output.push(`Running scenario ${controller.index + 1} of ${scenarios.length}: ${next.name}`);
    beginChild(controller);
    return;
  }

  finishBatch(controller, 'completed');
}

function finishBatch(controller: Controller, status: BatchStatus): void {
  const batch: BatchResult = {
    product: controller.product,
    status,
    startedAt: new Date(controller.startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    results: controller.results ?? [],
  };
  lastBatch = batch;
  saveLastBatch(batch);
  restoreRuntime(controller.product, controller.backup ?? null);
  deleteBackup();
  retained = { product: controller.product, lines: [...controller.output] };
  active = null;
}

// ---- public actions ----

export function runTest(product: RunProduct): { started: boolean; message?: string } {
  if (active) return { started: false, message: `A ${active.product} run is already active` };
  const controller: Controller = {
    mode: 'single',
    product,
    startedAt: Date.now(),
    childStartedAt: null,
    output: [modeLine(), ''],
    trackingCode: null,
    stopped: false,
    child: null,
  };
  active = controller;
  beginChild(controller);
  return { started: true };
}

export function startBatch(
  product: RunProduct,
  scenarios: ScenarioDefinition[],
): { started: boolean; errors?: string[]; message?: string } {
  if (active) return { started: false, message: `A ${active.product} run is already active` };

  recoverBatchBackup();

  const errors = validateScenarios(product, scenarios);
  if (errors.length > 0) return { started: false, errors };

  const backup = readRuntimeConfig(product);
  writeJson(BACKUP_FILE, { product, content: backup });

  const controller: Controller = {
    mode: 'batch',
    product,
    startedAt: Date.now(),
    childStartedAt: null,
    output: [modeLine(), ''],
    trackingCode: null,
    stopped: false,
    child: null,
    scenarios,
    index: 0,
    results: scenarios.map((scenario) => ({
      name: scenario.name,
      status: 'not-run',
      duration: null,
      trackingCode: null,
      error: null,
    })),
    backup,
  };
  active = controller;

  applyScenarioConfig(product, scenarios[0].config);
  controller.output.push(`Running scenario 1 of ${scenarios.length}: ${scenarios[0].name}`);
  beginChild(controller);
  return { started: true };
}

export function stopActive(): { stopped: boolean; message?: string } {
  if (!active) return { stopped: false, message: 'No test is running' };
  active.stopped = true;
  const child = active.child;
  if (child?.pid) {
    if (process.platform === 'win32') {
      // Kill only this run's process tree; the Playwright UI is a separate tree.
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      child.kill('SIGTERM');
    }
  }
  return { stopped: true };
}
