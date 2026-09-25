import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const PLAYWRIGHT_UI_PORT = Number(process.env.PW_UI_PORT ?? 9323);

export function isPortListening(
  port: number,
  host = '127.0.0.1',
  timeout = 600,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortListening(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

export function openBrowser(url: string): void {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
}

export async function playwrightUiStatus(): Promise<{ running: boolean; url: string }> {
  const url = `http://127.0.0.1:${PLAYWRIGHT_UI_PORT}/`;
  return { running: await isPortListening(PLAYWRIGHT_UI_PORT), url };
}

export async function openPlaywrightUi(): Promise<{ started: boolean; url: string }> {
  const url = `http://127.0.0.1:${PLAYWRIGHT_UI_PORT}/`;

  if (await isPortListening(PLAYWRIGHT_UI_PORT)) {
    openBrowser(url);
    return { started: false, url };
  }

  const cli = path.resolve(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
  const child = spawn(
    process.execPath,
    [
      cli,
      'test',
      '--ui',
      '--ui-host=127.0.0.1',
      `--ui-port=${PLAYWRIGHT_UI_PORT}`,
    ],
    { cwd: process.cwd(), detached: true, stdio: 'ignore', windowsHide: true },
  );
  child.unref();

  const up = await waitForPort(PLAYWRIGHT_UI_PORT, 30_000);
  if (!up) {
    throw new Error(`Playwright UI did not start on port ${PLAYWRIGHT_UI_PORT} within 30s`);
  }
  // Playwright opens the UI in a browser tab itself when --ui-port is specified.
  return { started: true, url };
}
