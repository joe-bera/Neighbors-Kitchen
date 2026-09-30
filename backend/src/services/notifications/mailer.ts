import { env, Env } from '../../config/env.js';

/** An email ready to hand to a sending service. */
export interface OutgoingEmail {
  /** Our id for the email. Resend uses it as the idempotency key, so a retry is never delivered twice. */
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}

/** Something that sends emails: the practice mailbox (development) or Resend (the live site). */
export interface EmailTransport {
  /**
   * True when the emails table is the copy people read (the practice mailbox). A real service keeps its
   * own records, so sent password links are erased from the database and made-up addresses are skipped.
   */
  keepsCopies: boolean;
  send(email: OutgoingEmail): Promise<void>;
}

/** Development: nothing leaves the computer. Sent emails stay in the emails table for the practice mailbox. */
export const mailboxTransport: EmailTransport = {
  keepsCopies: true,
  send: async () => {},
};

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;
// Anything shaped like an email address, so refusal reasons never carry one into the logs or the database.
const ADDRESS = /[^\s<>"'@]+@[^\s<>"'@]+/g;

/** Resend's reason for refusing an email, without any email address in it. */
async function refusalReason(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { name?: string; message?: string } | null;
  const reason = [body?.name, body?.message].filter(Boolean).join(': ') || response.statusText || 'no details';
  return reason.replace(ADDRESS, '(address)').slice(0, 300);
}

export interface ResendOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** The live site: sends through Resend's API (https://resend.com/docs/api-reference/emails/send-email). */
export function resendTransport(apiKey: string, { fetchImpl = fetch, timeoutMs = SEND_TIMEOUT_MS }: ResendOptions = {}): EmailTransport {
  return {
    keepsCopies: false,
    send: async (email) => {
      const response = await fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': email.id },
        body: JSON.stringify({ from: email.from, to: email.to, subject: email.subject, html: email.html, text: email.text }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`Resend ${response.status}: ${await refusalReason(response)}`);
    },
  };
}

/** The transport EMAIL_TRANSPORT asks for. */
export function transportFromEnv(config: Pick<Env, 'EMAIL_TRANSPORT' | 'RESEND_API_KEY'> = env): EmailTransport {
  return config.EMAIL_TRANSPORT === 'resend' ? resendTransport(config.RESEND_API_KEY ?? '') : mailboxTransport;
}

/** The practice mailbox shows everyone's emails, so it only exists outside production. */
export function practiceMailboxEnabled(config: Pick<Env, 'EMAIL_TRANSPORT' | 'NODE_ENV'> = env): boolean {
  return config.EMAIL_TRANSPORT === 'mailbox' && config.NODE_ENV !== 'production';
}
