import { describe, expect, it, vi } from 'vitest';
import { runBackgroundTasks } from '../src/jobs/backgroundJobs.js';

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
