import 'dotenv/config';

export type EnvName = 'local' | 'staging' | 'qa' | 'prod';

const apiBaseURL = process.env.API_BASE_URL ?? 'http://localhost:8080';

const origin = (() => {
  try {
    return new URL(apiBaseURL).origin;
  } catch {
    return 'http://localhost:8080';
  }
})();

export const config = {
  env: (process.env.ENV ?? 'staging') as EnvName,

  web: {
    baseURL: process.env.WEB_BASE_URL ?? 'http://localhost:5173',
  },

  api: {
    baseURL: apiBaseURL,
    timeout: Number(process.env.API_TIMEOUT ?? 30000),
  },

  auth: {
    mobile: process.env.AUTH_MOBILE ?? '528888888',
    otp: process.env.AUTH_OTP ?? '1111',
    sendOtpEndpoint: process.env.AUTH_SENDOTP_ENDPOINT ?? '/user/auth/sms/send',
    loginEndpoint: process.env.AUTH_LOGIN_ENDPOINT ?? '/user/auth/login',
    tokenProperty: process.env.AUTH_TOKEN_PROPERTY ?? 'accessToken',
    storageKey: process.env.AUTH_STORAGE_KEY ?? 'accessToken',
  },

  health: {
    endpoint: process.env.HEALTH_URL ?? '',
  },

  profile: {
    endpoint: process.env.PROFILE_ENDPOINT ?? '',
  },

  resource: {
    basePath: process.env.API_RESOURCE_ENDPOINT ?? '',
    idProperty: process.env.API_RESOURCE_ID_PROPERTY ?? 'id',
    enabled: (process.env.RESOURCE_ENABLED ?? 'false').toLowerCase() === 'true',
  },
} as const;