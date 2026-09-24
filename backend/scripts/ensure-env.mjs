#!/usr/bin/env node
// Creates backend/.env from .env.example on first setup, with a freshly generated JWT secret.
// Does nothing if .env already exists.

import crypto from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(backendDir, '.env');

if (existsSync(envFile)) {
  console.log('backend/.env already exists');
} else {
  const example = readFileSync(path.join(backendDir, '.env.example'), 'utf8');
  const secret = crypto.randomBytes(48).toString('hex');
  writeFileSync(envFile, example.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log('Created backend/.env');
}
