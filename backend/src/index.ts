import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { startBackgroundJobs } from './jobs/backgroundJobs.js';
import { prisma } from './lib/prisma.js';
import { shutDown } from './lib/shutdown.js';

const app = createApp();
let stopJobs: () => Promise<void> = async () => {};

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Neighbors-Kitchen API server running on port ${env.PORT}`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${env.PORT}/api/v1`);
  stopJobs = startBackgroundJobs();
});

// Railway sends SIGTERM before it replaces this version (Ctrl+C sends SIGINT): finish up, then leave.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`${signal} received: finishing the current work`);
    shutDown({ stopJobs: () => stopJobs(), server, disconnect: () => prisma.$disconnect(), graceMs: 25_000 }).then(
      () => process.exit(0),
      (error: unknown) => {
        console.error('Shutdown failed:', error);
        process.exit(1);
      },
    );
  });
}
