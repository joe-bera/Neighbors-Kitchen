import { describe, expect, it } from 'vitest';
import { shutDown, ShutdownSteps } from '../src/lib/shutdown.js';

type FakeServer = ShutdownSteps['server'];

describe('shutDown', () => {
  it('stops the helper, lets open requests finish, then closes the database', async () => {
    const steps: string[] = [];
    const server = {
      close: (done: () => void) => {
        steps.push('stop taking requests');
        setTimeout(done, 10);
      },
      closeIdleConnections: () => steps.push('close idle connections'),
      closeAllConnections: () => steps.push('close busy connections'),
    } as unknown as FakeServer;

    await shutDown({
      stopJobs: async () => {
        steps.push('stop helper');
      },
      server,
      disconnect: async () => {
        steps.push('close database');
      },
      graceMs: 1000,
    });

    expect(steps).toEqual(['stop helper', 'stop taking requests', 'close idle connections', 'close database']);
  });

  it('closes connections still busy after the grace period', async () => {
    const steps: string[] = [];
    let closed: () => void = () => {};
    const server = {
      close: (done: () => void) => {
        closed = done;
      },
      closeIdleConnections: () => {},
      closeAllConnections: () => {
        steps.push('close busy connections');
        closed();
      },
    } as unknown as FakeServer;

    await shutDown({ stopJobs: async () => {}, server, disconnect: async () => {}, graceMs: 20 });

    expect(steps).toEqual(['close busy connections']);
  });
});
