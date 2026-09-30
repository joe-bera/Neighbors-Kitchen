import { describe, expect, it } from 'vitest';
import { Env, productionProblems, readEnv } from '../src/config/env.js';

const required = {
  DATABASE_URL: 'postgresql://postgres@localhost:5433/neighbors_kitchen_test',
  JWT_SECRET: 'a-test-secret-that-is-at-least-32-characters',
};

// A complete, safe configuration for the preview site on Railway.
const live: Env = {
  NODE_ENV: 'production',
  PORT: 8080,
  FRONTEND_URL: 'https://neighborskitchen.app',
  DATABASE_URL: 'postgresql://postgres:secret@postgres.railway.internal:5432/railway',
  JWT_SECRET: 'a-random-secret-that-is-long-enough-for-the-live-site-0123456789',
  JWT_EXPIRE: '15m',
  REFRESH_TOKEN_TTL_DAYS: 7,
  BCRYPT_ROUNDS: 12,
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX_REQUESTS: 1000,
  UPLOAD_DIR: '/data/uploads',
  PLATFORM_FEE_PERCENT: 10,
  GEOCODER: 'census',
  EMAIL_TRANSPORT: 'resend',
  RESEND_API_KEY: 're_test_123',
  EMAIL_FROM: 'Neighbors Kitchen <no-reply@neighborskitchen.app>',
  JOBS_INTERVAL_MS: 5000,
  RATE_REMINDER_DELAY_MINUTES: 120,
  PREVIEW_MODE: true,
  TRUST_PROXY_HOPS: 1,
  WEB_DIST_DIR: '/app/frontend/dist',
  DEMO_PASSWORD: 'a-long-demo-password',
};
const websiteBuilt = () => true;

describe('readEnv', () => {
  it('reads the preview and proxy settings', () => {
    const config = readEnv({ ...required, PREVIEW_MODE: 'true', TRUST_PROXY_HOPS: '1' });

    expect(config.PREVIEW_MODE).toBe(true);
    expect(config.TRUST_PROXY_HOPS).toBe(1);
  });

  it('is not a preview and trusts no proxy unless told', () => {
    const config = readEnv(required);

    expect(config.PREVIEW_MODE).toBe(false);
    expect(config.TRUST_PROXY_HOPS).toBe(0);
    expect(config.EMAIL_TRANSPORT).toBe('mailbox');
    expect(config.DEMO_PASSWORD).toBeUndefined();
  });

  it('needs the Resend key when emails go through Resend', () => {
    expect(() => readEnv({ ...required, EMAIL_TRANSPORT: 'resend' })).toThrow(
      'RESEND_API_KEY: RESEND_API_KEY is required when EMAIL_TRANSPORT is resend',
    );
  });

  it('refuses to start a live site with unsafe settings', () => {
    expect(() =>
      readEnv({ ...required, NODE_ENV: 'production', FRONTEND_URL: 'http://neighborskitchen.app', WEB_DIST_DIR: '/nowhere' }),
    ).toThrow(
      'Unsafe production settings:\n  - FRONTEND_URL must start with https://\n  - EMAIL_TRANSPORT must be resend, so emails are really sent\n  - The website was not found in WEB_DIST_DIR (/nowhere)',
    );
  });
});

describe('productionProblems', () => {
  it('accepts a complete live configuration', () => {
    expect(productionProblems(live, websiteBuilt)).toEqual([]);
  });

  it('names every unsafe setting', () => {
    const unsafe = {
      ...live,
      FRONTEND_URL: 'http://neighborskitchen.app',
      EMAIL_TRANSPORT: 'mailbox' as const,
      JWT_SECRET: 'replace-with-a-long-random-string-at-least-32-characters',
    };

    expect(productionProblems(unsafe, () => false)).toEqual([
      'FRONTEND_URL must start with https://',
      'EMAIL_TRANSPORT must be resend, so emails are really sent',
      'JWT_SECRET is still the example value from .env.example',
      'The website was not found in WEB_DIST_DIR (/app/frontend/dist)',
    ]);
  });

  it('allows plain http on this computer, for the dress rehearsal', () => {
    expect(productionProblems({ ...live, FRONTEND_URL: 'http://localhost:4100' }, websiteBuilt)).toEqual([]);
  });
});
