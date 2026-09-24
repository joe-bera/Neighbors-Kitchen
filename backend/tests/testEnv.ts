import os from 'node:os';
import path from 'node:path';

// Environment for the test run. Tests use their own database on the local Postgres server
// and write uploaded photos to a temporary folder.
export const testEnv = {
  UPLOAD_DIR: path.join(os.tmpdir(), 'neighbors-kitchen-test-uploads'),
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:5433/neighbors_kitchen_test',
  JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters-long',
  JWT_EXPIRE: '15m',
  REFRESH_TOKEN_TTL_DAYS: '7',
  BCRYPT_ROUNDS: '4',
  FRONTEND_URL: 'http://localhost:3000',
  // Tests never call the real address service; tests that need a result mock services/geocoding.
  GEOCODER: 'off',
};
