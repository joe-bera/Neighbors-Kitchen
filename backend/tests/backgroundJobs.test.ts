import { describe, expect, it, vi } from 'vitest';
import { runBackgroundTasks, startBackgroundJobs } from '../src/jobs/backgroundJobs.js';

describe('runBackgroundTasks', () => {
  it('runs every task in order with the same time, even after one fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ran: string[] = [];
    const now = new Date('2026-09-29T20:00:00.000Z');

    await runBackgroundTasks(
      [
        { name: 'first', run: async (at) => { ran.push(`first ${at.toISOString()}`); } },
        { name: 'broken', run: async () => { throw new Error('database unavailable'); } },
        { name: 'last', run: async (at) => { ran.push(`last ${at.toISOString()}`); } },
      ],
      now,
    );

    expect(ran).toEqual(['first 2026-09-29T20:00:00.000Z', 'last 2026-09-29T20:00:00.000Z']);
    expect(logged).toHaveBeenCalledWith('Background task "broken" failed:', 'database unavailable');
    logged.mockRestore();
  });
});

describe('startBackgroundJobs', () => {
  it('stops after the pass in progress, and starts no new one', async () => {
    let started = 0;
    let finished = 0;
    let release: () => void = () => {};
    // The first pass waits inside this task until the test lets it finish.
    const gated = {
      name: 'gated',
      run: async () => {
        started += 1;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        finished += 1;
      },
    };

    const stop = startBackgroundJobs({ tasks: [gated], intervalMs: 5 });
    await vi.waitFor(() => expect(started).toBe(1));
    let stopped = false;
    const stopping = stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(stopped).toBe(false);
    release();
    await stopping;
    expect(finished).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(started).toBe(1);
  });
});
