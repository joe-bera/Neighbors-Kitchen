import { describe, expect, it } from 'vitest';
import { sampleDataPlan } from '../src/services/sampleData.js';

const development = { NODE_ENV: 'development' as const, PREVIEW_MODE: false, DEMO_PASSWORD: undefined };
const preview = { NODE_ENV: 'production' as const, PREVIEW_MODE: true, DEMO_PASSWORD: 'twelve-chars' };
const fullSeed = { previewIfEmpty: false, sampleDataExists: true };
const deploy = (sampleDataExists: boolean) => ({ previewIfEmpty: true, sampleDataExists });

describe('sampleDataPlan', () => {
  it('loads the samples on this computer with the usual password', () => {
    expect(sampleDataPlan(development, fullSeed)).toEqual({ action: 'load', password: 'Password123' });
    expect(sampleDataPlan({ ...development, DEMO_PASSWORD: 'mine' }, fullSeed)).toEqual({ action: 'load', password: 'mine' });
  });

  it('never loads them on the real live site', () => {
    expect(sampleDataPlan({ ...preview, PREVIEW_MODE: false }, fullSeed)).toEqual({
      action: 'refuse',
      reason: 'Sample data is never loaded on the live site.',
    });
  });

  it('does nothing at deploy time on a site that is not the preview', () => {
    expect(sampleDataPlan({ ...preview, PREVIEW_MODE: false }, deploy(false))).toEqual({
      action: 'skip',
      reason: 'This is not the preview site, so no sample data is loaded.',
    });
    expect(sampleDataPlan(development, deploy(false))).toEqual({
      action: 'skip',
      reason: 'This is not the preview site, so no sample data is loaded.',
    });
  });

  it('needs a private password of at least 12 characters on the preview site', () => {
    const refusal = { action: 'refuse', reason: 'Set DEMO_PASSWORD (at least 12 characters) before loading sample data on the preview site.' };

    expect(sampleDataPlan({ ...preview, DEMO_PASSWORD: undefined }, deploy(false))).toEqual(refusal);
    expect(sampleDataPlan({ ...preview, DEMO_PASSWORD: 'eleven-char' }, deploy(false))).toEqual(refusal);
    expect(sampleDataPlan(preview, deploy(false))).toEqual({ action: 'load', password: 'twelve-chars' });
  });

  it('loads them once on the preview, then keeps what happened since', () => {
    expect(sampleDataPlan(preview, deploy(true))).toEqual({ action: 'skip', reason: 'The sample data is already there.' });
  });

  it('can reload them on the preview by hand', () => {
    expect(sampleDataPlan(preview, fullSeed)).toEqual({ action: 'load', password: 'twelve-chars' });
  });
});
