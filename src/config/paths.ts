import path from 'node:path';

/** Full app storageState (Cloudflare + app session). Used by dev helper scripts. */
export const STORAGE_STATE_PATH = path.resolve(process.cwd(), '.auth', 'storageState.json');

/** Cloudflare Access / Azure AD cookies only — never the app session. */
export const CLOUDFLARE_STATE_PATH = path.resolve(
  process.cwd(),
  '.auth',
  'cloudflare-state.json',
);
