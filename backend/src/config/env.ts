import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRE: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),
  // Where uploaded photos are stored and served from (/uploads/...)
  UPLOAD_DIR: z.string().min(1).default(path.resolve('uploads')),
  // Commission kept by Neighbors Kitchen, as a percent of each order's meal subtotal
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(10),
  // Address lookups for the map: "census" uses the free US Census Bureau geocoder, "off" skips them (tests)
  GEOCODER: z.enum(['census', 'off']).default('census'),
  // Where emails go: "mailbox" keeps them in the database for the practice mailbox page and sends
  // nothing. A real email service is added at launch (Phase 8).
  EMAIL_TRANSPORT: z.enum(['mailbox']).default('mailbox'),
  EMAIL_FROM: z.string().min(3).default('Neighbors Kitchen <no-reply@neighborskitchen.test>'),
  // How often the background helper sends emails and runs timed tasks
  JOBS_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  // Minutes after an order is completed before the rate-your-meal reminder
  RATE_REMINDER_DELAY_MINUTES: z.coerce.number().int().min(1).default(120),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
