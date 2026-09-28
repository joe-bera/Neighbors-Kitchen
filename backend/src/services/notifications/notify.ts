import { NotificationKind, Prisma } from '@prisma/client';
import { bellText } from './bellText.js';
import { KIND_RULES, NoticeDataByKind } from './kinds.js';

/** The user fields notify() needs. Load them with `recipientSelect`. */
export interface Recipient {
  id: string;
  email: string;
  isActive: boolean;
  emailRateReminders: boolean;
  emailDishRequestNews: boolean;
  emailKitchenFeedback: boolean;
}

export const recipientSelect = {
  id: true,
  email: true,
  isActive: true,
  emailRateReminders: true,
  emailDishRequestNews: true,
  emailKitchenFeedback: true,
} satisfies Prisma.UserSelect;

/**
 * Creates the bell item and queues the email for one notice. The only way notices are made: call it
 * inside the transaction of the change it describes, so a notice exists exactly when that change was saved.
 * Emails are written and sent later by the background helper (emailDelivery.ts).
 */
export async function notify<K extends NotificationKind>(
  tx: Prisma.TransactionClient,
  recipient: Recipient,
  kind: K,
  data: NoticeDataByKind[K],
): Promise<void> {
  if (!recipient.isActive) return;
  const rule = KIND_RULES[kind];

  const bell = rule.bell ? bellText(kind, data) : null;
  if (bell) {
    await tx.notification.create({ data: { userId: recipient.id, kind, title: bell.title, body: bell.body, link: bell.link } });
  }
  if (rule.email && (!rule.emailSwitch || recipient[rule.emailSwitch])) {
    await tx.email.create({
      data: { userId: recipient.id, toAddress: recipient.email, kind, data: data as unknown as Prisma.InputJsonValue },
    });
  }
}
