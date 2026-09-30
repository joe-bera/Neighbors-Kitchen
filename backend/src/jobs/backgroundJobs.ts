import { env } from '../config/env.js';
import { deliverDueEmails } from '../services/notifications/emailDelivery.js';
import { transportFromEnv } from '../services/notifications/mailer.js';
import { expireOverdueOrders, sendChefReminders } from '../services/orderService.js';
import { sendRateReminders } from '../services/reviewService.js';

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

/** The timed tasks and the email sender, in the order each pass runs them. */
function defaultTasks(): BackgroundTask[] {
  const transport = transportFromEnv();
  return [
    // Cancel first, so an order that ran out of time gets no reminder in the same pass.
    { name: 'cancel unconfirmed orders', run: expireOverdueOrders },
    { name: 'chef reminders', run: sendChefReminders },
    { name: 'rate reminders', run: sendRateReminders },
    { name: 'send emails', run: (now) => deliverDueEmails(now, transport) },
  ];
}

/**
 * Starts the helper. The next pass is scheduled when the current one finishes, so passes never overlap.
 * Returns a stop function that resolves once a pass in progress has finished.
 */
export function startBackgroundJobs({
  tasks = defaultTasks(),
  intervalMs = env.JOBS_INTERVAL_MS,
}: { tasks?: BackgroundTask[]; intervalMs?: number } = {}): () => Promise<void> {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> = Promise.resolve();
  const pass = () => {
    running = runBackgroundTasks(tasks).then(() => {
      if (!stopped) timer = setTimeout(pass, intervalMs);
    });
  };
  timer = setTimeout(pass, intervalMs);

  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}
