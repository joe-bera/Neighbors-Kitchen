import { execFileSync } from 'node:child_process';
import { testEnv } from './testEnv';

// Runs once before all tests: make sure Postgres is up and the test database schema is current.
export default function setup() {
  execFileSync('node', ['scripts/db.mjs', 'start'], { stdio: 'pipe' });
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testEnv.DATABASE_URL },
  });
}
