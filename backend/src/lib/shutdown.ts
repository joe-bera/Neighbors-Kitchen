import type { Server } from 'node:http';

export interface ShutdownSteps {
  /** Stops the background helper; resolves once its pass in progress has finished. */
  stopJobs: () => Promise<void>;
  server: Pick<Server, 'close' | 'closeIdleConnections' | 'closeAllConnections'>;
  disconnect: () => Promise<void>;
  /** How long open requests may take before their connections are closed anyway. */
  graceMs: number;
}

/** Stops the app in order: no new timed work, no new requests (open ones may finish), then the database. */
export async function shutDown({ stopJobs, server, disconnect, graceMs }: ShutdownSteps): Promise<void> {
  await stopJobs();
  await new Promise<void>((resolve) => {
    const force = setTimeout(() => server.closeAllConnections(), graceMs);
    server.close(() => {
      clearTimeout(force);
      resolve();
    });
    server.closeIdleConnections();
  });
  await disconnect();
}
