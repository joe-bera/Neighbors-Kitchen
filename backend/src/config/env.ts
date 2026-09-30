import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z
  .object({
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
    // nothing; "resend" sends them through Resend (the live site).
    EMAIL_TRANSPORT: z.enum(['mailbox', 'resend']).default('mailbox'),
    // Resend's API key, needed when EMAIL_TRANSPORT is resend
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).default('Neighbors Kitchen <no-reply@neighborskitchen.test>'),
    // How often the background helper sends emails and runs timed tasks
    JOBS_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
    // Minutes after an order is completed before the rate-your-meal reminder
    RATE_REMINDER_DELAY_MINUTES: z.coerce.number().int().min(1).default(120),
    // The show-and-tell preview (Phase 8a): a banner on every page, search engines kept out, sample data allowed
    PREVIEW_MODE: z.stringbool().default(false),
    // Proxies in front of the app (1 on Railway), so rate limits see each visitor's own address
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    // The built website, which the API serves in production
    WEB_DIST_DIR: z.string().min(1).default(path.resolve('../frontend/dist')),
    // Password of the sample accounts on the preview site (the sample data uses Password123 when it is not set)
    DEMO_PASSWORD: z.string().min(1).optional(),
  })
  .refine((config) => config.EMAIL_TRANSPORT !== 'resend' || config.RESEND_API_KEY !== undefined, {
    path: ['RESEND_API_KEY'],
    message: 'RESEND_API_KEY is required when EMAIL_TRANSPORT is resend',
  });

export type Env = z.infer<typeof envSchema>;

// The example value from .env.example: a live site must never use it.
const EXAMPLE_JWT_SECRET = 'replace-with-a-long-random-string-at-least-32-characters';
// Plain http is fine on this computer (the dress rehearsal), never on the internet.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Settings that would make the live site unsafe or broken; empty when all is well. */
export function productionProblems(config: Env, fileExists: (file: string) => boolean = existsSync): string[] {
  const problems: string[] = [];
  const site = new URL(config.FRONTEND_URL);
  if (site.protocol !== 'https:' && !LOCAL_HOSTS.has(site.hostname)) problems.push('FRONTEND_URL must start with https://');
  if (config.EMAIL_TRANSPORT !== 'resend') problems.push('EMAIL_TRANSPORT must be resend, so emails are really sent');
  if (config.JWT_SECRET === EXAMPLE_JWT_SECRET) problems.push('JWT_SECRET is still the example value from .env.example');
  if (!fileExists(path.join(config.WEB_DIST_DIR, 'index.html'))) {
    problems.push(`The website was not found in WEB_DIST_DIR (${config.WEB_DIST_DIR})`);
  }
  return problems;
}

/** Reads and checks the settings. In production it also refuses unsafe ones. */
export function readEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  if (result.data.NODE_ENV === 'production') {
    const problems = productionProblems(result.data);
    if (problems.length > 0) {
      throw new Error(`Unsafe production settings:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    }
  }
  return result.data;
}

export const env = readEnv(process.env);
export const isProduction = env.NODE_ENV === 'production';
