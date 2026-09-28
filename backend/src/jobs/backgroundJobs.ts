import { env } from '../config/env.js';
import { deliverDueEmails } from '../services/notifications/emailDelivery.js';
import { transportFromEnv } from '../services/notifications/mailer.js';

// The background helper: every JOBS_INTERVAL_MS it runs the timed tasks and sends due emails.
// Started by index.ts only, so tests never run it.

export interface BackgroundTask {
  name: string;
  run: (now: Date) => Promise<unknown>;
}

/** One pass of the helper. Every task runs, even when an earlier one fails. */
export async function runBackgroundTasks(tasks: BackgroundTask[], now: Date = new Date()): Promise<void> {
  for (const task of tasks) {
    try {
      await task.run(now);
    } catch (error) {
      console.error(`Background task "${task.name}" failed:`, error instanceof Error ? error.message : error);
    }
  }
}

/** Starts the helper. The next pass is scheduled when the current one finishes, so passes never overlap. */
export function startBackgroundJobs(): () => void {
  const transport = transportFromEnv();
  const tasks: BackgroundTask[] = [{ name: 'send emails', run: (now) => deliverDueEmails(now, transport) }];

  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const pass = async () => {
    await runBackgroundTasks(tasks);
    if (!stopped) timer = setTimeout(pass, env.JOBS_INTERVAL_MS);
  };
  timer = setTimeout(pass, env.JOBS_INTERVAL_MS);

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
