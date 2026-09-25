import { isPortListening, openBrowser } from './playwright-launcher.ts';
import { startServer } from './server.ts';

const PORT = Number(process.env.CC_PORT ?? 4600);
const URL = `http://127.0.0.1:${PORT}/`;

if (await isPortListening(PORT)) {
  console.log(`Control Center already running, opening browser: ${URL}`);
  openBrowser(URL);
  process.exit(0);
}

const server = await startServer(PORT);
console.log(`Lookinsure QA Control Center: ${URL}`);
openBrowser(URL);

const shutdown = (): void => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
