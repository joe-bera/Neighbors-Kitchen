import { env, Env } from '../../config/env.js';

/** An email ready to hand to a sending service. */
export interface OutgoingEmail {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}

/** Something that sends emails. Phase 8 adds a real email service next to the practice mailbox. */
export interface EmailTransport {
  /**
   * True when the emails table is the copy people read (the practice mailbox). A real service keeps its
   * own records, so sent password links are erased from the database.
   */
  keepsCopies: boolean;
  send(email: OutgoingEmail): Promise<void>;
}

/** Development: nothing leaves the computer. Sent emails stay in the emails table for the practice mailbox. */
export const mailboxTransport: EmailTransport = {
  keepsCopies: true,
  send: async () => {},
};

/** The transport EMAIL_TRANSPORT asks for ("mailbox" is the only one until Phase 8). */
export function transportFromEnv(): EmailTransport {
  return mailboxTransport;
}

/** The practice mailbox shows everyone's emails, so it only exists outside production. */
export function practiceMailboxEnabled(config: Pick<Env, 'EMAIL_TRANSPORT' | 'NODE_ENV'> = env): boolean {
  return config.EMAIL_TRANSPORT === 'mailbox' && config.NODE_ENV !== 'production';
}
