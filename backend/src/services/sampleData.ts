import type { Env } from '../config/env.js';

// The sample chefs, customers and orders (prisma/seed.ts) belong on this computer and on the preview site only.
// Design: docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md

export const DEVELOPMENT_DEMO_PASSWORD = 'Password123';
const MIN_PREVIEW_PASSWORD_LENGTH = 12;

export type SampleDataPlan =
  | { action: 'load'; password: string }
  | { action: 'skip'; reason: string }
  | { action: 'refuse'; reason: string };

/**
 * Whether the seed may load the sample data, and with which password.
 * previewIfEmpty is the deploy-time run (Railway's pre-deploy command); sampleDataExists is true when
 * any @neighborskitchen.test account is already in the database.
 */
export function sampleDataPlan(
  config: Pick<Env, 'NODE_ENV' | 'PREVIEW_MODE' | 'DEMO_PASSWORD'>,
  run: { previewIfEmpty: boolean; sampleDataExists: boolean },
): SampleDataPlan {
  if (run.previewIfEmpty && !config.PREVIEW_MODE) {
    return { action: 'skip', reason: 'This is not the preview site, so no sample data is loaded.' };
  }
  if (config.NODE_ENV === 'production') {
    if (!config.PREVIEW_MODE) return { action: 'refuse', reason: 'Sample data is never loaded on the live site.' };
    if ((config.DEMO_PASSWORD ?? '').length < MIN_PREVIEW_PASSWORD_LENGTH) {
      return {
        action: 'refuse',
        reason: `Set DEMO_PASSWORD (at least ${MIN_PREVIEW_PASSWORD_LENGTH} characters) before loading sample data on the preview site.`,
      };
    }
  }
  if (run.previewIfEmpty && run.sampleDataExists) return { action: 'skip', reason: 'The sample data is already there.' };
  return { action: 'load', password: config.DEMO_PASSWORD ?? DEVELOPMENT_DEMO_PASSWORD };
}
