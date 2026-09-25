import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export type RunProduct = 'car' | 'health';
export type RunStatus = 'passed' | 'failed';

export interface RunResult {
  product: RunProduct;
  status: RunStatus;
  duration: number;
  finishedAt: string;
  error: string | null;
}

export interface RunState {
  running: boolean;
  product?: RunProduct;
  startedAt?: number;
  last: RunResult | null;
  console: { product: RunProduct | null; lines: string[] };
}

export interface TestOptions {
  execution: { headed: boolean };
}

/**
 * Small Playwright CLI runner used by the Control Center. It shells out to the
 * existing CLI (same projects/specs as `npm run test:car` / `test:health`) and
 * never injects env: the specs read the saved runtime config. Only a compact,
 * non-sensitive result (status/duration/error) is persisted. The live log is
 * kept in memory only (bounded), never written to disk.
 */
const RUNTIME_DIR = path.resolve(process.cwd(), 'test-data', 'e2e', 'runtime');
const LAST_RUN_FILE = path.join(RUNTIME_DIR, 'last-run.json');
const OPTIONS_FILE = path.join(RUNTIME_DIR, 'test-options.json');
const LIVE_REPORTER = './tools/control-center/live-reporter.ts';
const MAX_LINES = 300;

const SPECS: Record<RunProduct, string> = {
  car: 'tests/e2e/car-purchase.spec.ts',
  health: 'tests/e2e/health-purchase.spec.ts',
};

interface CurrentRun {
  product: RunProduct;
  startedAt: number;
  child: ChildProcess;
  output: string[];
}

let current: CurrentRun | null = null;
let retained: { product: RunProduct; lines: string[] } | null = null;

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

function saveLastRun(result: RunResult): void {
  try {
    mkdirSync(RUNTIME_DIR, { recursive: true });
    writeFileSync(LAST_RUN_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  } catch {
    // best-effort: a failed write must not affect the run itself
  }
}

export function loadLastRun(): RunResult | null {
  try {
    if (!existsSync(LAST_RUN_FILE)) return null;
    return JSON.parse(readFileSync(LAST_RUN_FILE, 'utf8')) as RunResult;
  } catch {
    return null;
  }
}

function extractError(lines: string[]): string {
  const meaningful = lines.map((line) => line.trim()).filter(Boolean);
  const tail = meaningful.slice(-6).join('\n');
  return (tail || 'Test run failed').slice(0, 2000);
}

export function runState(): RunState {
  const lines = current ? current.output : retained?.lines ?? [];
  const product = current?.product ?? retained?.product ?? null;
  return {
    running: current !== null,
    product: current?.product,
    startedAt: current?.startedAt,
    last: loadLastRun(),
    console: { product, lines: [...lines] },
  };
}

export function runTest(product: RunProduct): { started: boolean; message?: string } {
  if (current) {
    return { started: false, message: `A ${current.product} test is already running` };
  }

  const cli = path.resolve(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
  const headed = loadTestOptions().execution.headed;
  const args = [
    cli,
    'test',
    '--project=e2e-chromium',
    SPECS[product],
    '--retries=0',
    '--reporter=list',
    `--reporter=${LIVE_REPORTER}`,
  ];
  if (headed) args.push('--headed');

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    // A headed run must be able to create a real browser window, so the child
    // windows are not hidden; headless keeps them hidden.
    windowsHide: !headed,
  });

  const startedAt = Date.now();
  const output: string[] = [
    `Running mode: ${headed ? 'HEADED (browser visible)' : 'HEADLESS'}`,
    '',
  ];
  const run: CurrentRun = { product, startedAt, child, output };
  current = run;

  const onData = (chunk: Buffer): void => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (line.trim()) output.push(line);
    }
    if (output.length > MAX_LINES) output.splice(0, output.length - MAX_LINES);
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  const finish = (status: RunStatus, error: string | null, duration: number): void => {
    if (current === run) current = null;
    retained = { product, lines: [...output] };
    saveLastRun({
      product,
      status,
      duration,
      finishedAt: new Date().toISOString(),
      error,
    });
  };

  child.once('error', (error) => {
    finish('failed', error.message, Date.now() - startedAt);
  });

  child.once('close', (code) => {
    const status: RunStatus = code === 0 ? 'passed' : 'failed';
    finish(status, status === 'failed' ? extractError(output) : null, Date.now() - startedAt);
  });

  return { started: true };
}
