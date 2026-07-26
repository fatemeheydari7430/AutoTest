import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const AUTH_DIR = path.resolve(process.cwd(), '.auth');
const CACHE_FILE = path.join(AUTH_DIR, 'api-token.json');
const LOCK_FILE = path.join(AUTH_DIR, 'api-token.lock');

interface CacheEntry {
  token: string;
  expiresAt: number;
}

export function readTokenCache(): string | undefined {
  try {
    if (!existsSync(CACHE_FILE)) return undefined;
    const entry = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as CacheEntry;
    if (entry?.token && Date.now() < entry.expiresAt - 60_000) return entry.token;
    return undefined;
  } catch {
    return undefined;
  }
}

export function writeTokenCache(token: string, expiresAtMs: number): void {
  try {
    mkdirSync(AUTH_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ token, expiresAt: expiresAtMs }, null, 2));
  } catch {
    // best-effort cache write; ignore failures
  }
}

export function clearTokenCache(): void {
  try {
    if (existsSync(CACHE_FILE)) unlinkSync(CACHE_FILE);
  } catch {
    // ignore
  }
}

export async function withTokenLock<T>(fn: () => Promise<T>): Promise<T> {
  mkdirSync(AUTH_DIR, { recursive: true });

  let acquired = false;
  for (let i = 0; i < 100; i++) {
    try {
      const fd = openSync(LOCK_FILE, 'wx');
      closeSync(fd);
      acquired = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  try {
    return await fn();
  } finally {
    if (acquired) {
      try {
        unlinkSync(LOCK_FILE);
      } catch {
        // ignore
      }
    }
  }
}

export { AUTH_DIR, CACHE_FILE };