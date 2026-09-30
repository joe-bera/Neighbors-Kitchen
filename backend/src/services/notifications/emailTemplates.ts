import { NotificationKind } from '@prisma/client';
import { env } from '../../config/env.js';
import { formatItems, formatMoney, formatWhen, REQUEST_STATUS_WORDS } from './format.js';
import { NoticeDataByKind, OrderNoticeData } from './kinds.js';

// The wording of every email. Emails show no more than the website does: never a street address,
// phone number or delivery address, and customers never see the platform fee.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface EmailContent {
  subject: string;
  heading: string;
  /** Short paragraphs; null entries are left out. */
  lines: (string | null)[];
  /** Label and value rows, such as the meals and the pickup time. */
  details?: [string, string][];
  button?: { label: string; path: string };
  /** An email people can turn off: the footer says where. */
  switchable?: boolean;
  /** Replaces the footer's usual reason line. */
  footerNote?: string;
}

const handover = (data: OrderNoticeData) => (data.pickupOrDelivery === 'PICKUP' ? 'Pickup' : 'Delivery');
const whenRow = (data: OrderNoticeData): [string, string] => [handover(data), formatWhen(data.scheduledFor, data.timezone)];
const mealsRow = (data: OrderNoticeData): [string, string] => ['Meals', formatItems(data.items)];
const orderRow = (data: OrderNoticeData): [string, string] => ['Order', data.orderNumber];
const orderButton = (data: OrderNoticeData) => ({ label: 'View your order', path: `/orders/${data.orderId}` });
const chefOrdersButton = { label: 'Open your orders', path: '/chef/orders' };
const browseButton = { label: 'Browse meals', path: '/meals' };
const quoted = (text: string) => `“${text}”`;
const NOT_CHARGED = "You won't be charged for this order. You can order from another chef anytime.";

type EmailKind = Exclude<NotificationKind, 'ORDER_PREPARING'>;

const CONTENT: { [K in EmailKind]: (data: NoticeDataByKind[K]) => EmailContent } = {
  ORDER_PLACED: (data) => ({
    subject: `Your order ${data.orderNumber} was sent to ${data.kitchenName}`,
    heading: `Your order was sent to ${data.kitchenName}`,
    lines: [
      data.confirmBy
        ? `${data.kitchenName} will confirm it by ${formatWhen(data.confirmBy, data.timezone)}. If it isn't confirmed by then, it's cancelled automatically and we'll tell you right away.`
        : `We'll email you as soon as ${data.kitchenName} confirms it.`,
    ],
    details: [orderRow(data), whenRow(data), mealsRow(data), ['Total', formatMoney(data.total)]],
    button: orderButton(data),
  }),
  ORDER_CONFIRMED: (data) => ({
    subject: `${data.kitchenName} confirmed your order ${data.orderNumber}`,
    heading: `${data.kitchenName} confirmed your order`,
    lines: [data.pickupOrDelivery === 'PICKUP' ? 'The pickup address is on your order page.' : "We'll let you know when it's on its way."],
    details: [orderRow(data), whenRow(data), mealsRow(data), ['Total', formatMoney(data.total)]],
    button: orderButton(data),
  }),
  ORDER_READY: (data) => {
    const pickup = data.pickupOrDelivery === 'PICKUP';
    return {
      subject: `Your order ${data.orderNumber} ${pickup ? 'is ready for pickup' : 'is on its way'}`,
      heading: pickup ? 'Your order is ready for pickup' : 'Your order is on its way',
      lines: [
        pickup
          ? `${data.kitchenName} has your order ready. The pickup address is on your order page.`
          : `${data.kitchenName} is on the way with your order.`,
      ],
      details: [orderRow(data), mealsRow(data)],
      button: orderButton(data),
    };
  },
  ORDER_CANCELLED_BY_CHEF: (data) => {
    const verb = data.declined ? 'declined' : 'cancelled';
    return {
      subject: `${data.kitchenName} ${verb} your order ${data.orderNumber}`,
      heading: `${data.kitchenName} ${verb} your order`,
      lines: [data.reason ? `The chef's note: ${quoted(data.reason)}` : null, NOT_CHARGED],
      details: [orderRow(data), mealsRow(data)],
      button: browseButton,
    };
  },
  ORDER_EXPIRED: (data) => ({
    subject: `Your order ${data.orderNumber} was cancelled`,
    heading: 'Your order was cancelled',
    lines: [`${data.kitchenName} didn't confirm your order in time, so it was cancelled automatically.`, NOT_CHARGED],
    details: [orderRow(data), mealsRow(data)],
    button: browseButton,
  }),
  RATE_REMINDER: (data) => ({
    subject: `How was your meal from ${data.kitchenName}?`,
    heading: `How was your meal from ${data.kitchenName}?`,
    lines: ['Your rating helps neighbors find great home cooking, and it helps the chef too. It only takes a few seconds.'],
    details: [orderRow(data), mealsRow(data)],
    button: { label: 'Rate your meals', path: `/orders/${data.orderId}` },
    switchable: true,
  }),
  DISH_REQUEST_ANSWERED: (data) => ({
    subject: `${data.kitchenName} answered your dish request`,
    heading: `${data.kitchenName} answered your dish request`,
    lines: [`${data.mealName}: ${REQUEST_STATUS_WORDS[data.status]}`, data.reply ? `The chef's reply: ${quoted(data.reply)}` : null],
    button: { label: 'See your request', path: `/chefs/${data.chefId}#requests-heading` },
    switchable: true,
  }),
  DISH_REQUEST_ACCEPTED: (data) => ({
    subject: `Good news: ${data.kitchenName} will make ${data.mealName}`,
    heading: `Good news: ${data.kitchenName} will make ${data.mealName}`,
    lines: ['You voted for this dish. Keep an eye on the menu.', data.reply ? `The chef's reply: ${quoted(data.reply)}` : null],
    button: { label: `See ${data.kitchenName}`, path: `/chefs/${data.chefId}#requests-heading` },
    switchable: true,
  }),
  NEW_ORDER: (data) => ({
    subject: data.confirmBy
      ? `New order ${data.orderNumber}: please confirm by ${formatWhen(data.confirmBy, data.timezone)}`
      : `New order ${data.orderNumber} from ${data.customerName}`,
    heading: `New order from ${data.customerName}`,
    lines: [
      data.confirmBy
        ? `Please confirm or decline it by ${formatWhen(data.confirmBy, data.timezone)}. Orders that aren't confirmed by then are cancelled automatically.`
        : 'Please confirm or decline it from your dashboard.',
    ],
    details: [orderRow(data), whenRow(data), mealsRow(data), ['Your payout', formatMoney(data.chefPayout)]],
    button: chefOrdersButton,
  }),
  CONFIRM_REMINDER: (data) => {
    const by = formatWhen(data.confirmBy ?? data.scheduledFor, data.timezone);
    return {
      subject: `Reminder: order ${data.orderNumber} needs your confirmation by ${by}`,
      heading: `Order ${data.orderNumber} still needs your confirmation`,
      lines: [`${data.customerName} is waiting to hear from you. If you don't confirm or decline it by ${by}, it's cancelled automatically.`],
      details: [whenRow(data), mealsRow(data)],
      button: chefOrdersButton,
    };
  },
  CHEF_ORDER_EXPIRED: (data) => ({
    subject: `Order ${data.orderNumber} was cancelled because it wasn't confirmed in time`,
    heading: `Order ${data.orderNumber} was cancelled`,
    lines: [
      `It wasn't confirmed by ${formatWhen(data.confirmBy ?? data.scheduledFor, data.timezone)}, so it was cancelled automatically and ${data.customerName} was told.`,
      'You can change how quickly you promise to confirm new orders under Hours & delivery.',
    ],
    details: [whenRow(data), mealsRow(data)],
    button: chefOrdersButton,
  }),
  ORDER_CANCELLED_BY_CUSTOMER: (data) => ({
    subject: `${data.customerName} cancelled order ${data.orderNumber}`,
    heading: `${data.customerName} cancelled order ${data.orderNumber}`,
    lines: [data.reason ? `The customer's note: ${quoted(data.reason)}` : null, "You don't need to do anything."],
    details: [whenRow(data), mealsRow(data)],
    button: chefOrdersButton,
  }),
  NEW_REVIEW: (data) => {
    const stars = `${data.rating} star${data.rating === 1 ? '' : 's'}`;
    return {
      subject: `New review: ${stars} for ${data.mealName}`,
      heading: `${data.customerName} gave ${data.mealName} ${stars}`,
      lines: [data.comment ? quoted(data.comment) : null, 'You can reply publicly from your Feedback page.'],
      button: { label: 'See your reviews', path: '/chef/feedback' },
      switchable: true,
    };
  },
  NEW_DISH_REQUEST: (data) => ({
    subject: `New dish request: ${data.mealName}`,
    heading: `${data.requesterName} asked for ${data.mealName}`,
    lines: [data.description ? quoted(data.description) : null, 'Neighbors can vote for it too. You can answer from your Feedback page.'],
    button: { label: 'Answer the request', path: '/chef/feedback?view=requests' },
    switchable: true,
  }),
  PASSWORD_RESET: (data) => ({
    subject: 'Reset your Neighbors Kitchen password',
    heading: 'Reset your password',
    lines: [
      `Hi ${data.firstName}, someone (hopefully you) asked to reset the password for your Neighbors Kitchen account.`,
      'The button works once, for 1 hour.',
    ],
    // After #, so the token never reaches a server log or another site's Referer.
    button: { label: 'Choose a new password', path: `/reset-password#token=${encodeURIComponent(data.token ?? '')}` },
    footerNote: "If you didn't ask for this, you can ignore this email. Your password stays the same.",
  }),
  PASSWORD_CHANGED: (data) => ({
    subject: 'Your Neighbors Kitchen password was changed',
    heading: 'Your password was changed',
    lines: [
      `Hi ${data.firstName}, the password for your Neighbors Kitchen account was just changed, and every device was logged out.`,
      "If this wasn't you, reset your password right away.",
    ],
    button: { label: 'Reset my password', path: '/forgot-password' },
    footerNote: 'We send this email whenever a password changes, to keep your account safe.',
  }),
};

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

const SETTINGS_PATH = '/account#email-settings';
const REASON = "You're getting this email because you have a Neighbors Kitchen account.";
const TAGLINE = 'Neighbors Kitchen · Home-cooked meals from local chefs';
const fullUrl = (path: string) => new URL(path, env.FRONTEND_URL).toString();
const present = (lines: (string | null)[]) => lines.filter((line): line is string => line !== null);

function toHtml(content: EmailContent): string {
  const paragraphs = present(content.lines)
    .map((line) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;">${escapeHtml(line)}</p>`)
    .join('');
  const details = content.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 12px;border-collapse:collapse;">${content.details
        .map(
          ([label, value]) =>
            `<tr><td style="padding:6px 12px 6px 0;font-size:14px;color:#718096;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;color:#2d3748;">${escapeHtml(value)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;"><tr><td style="border-radius:8px;background:#5a67d8;"><a href="${escapeHtml(fullUrl(content.button.path))}" style="display:inline-block;padding:12px 20px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(content.button.label)}</a></td></tr></table>`
    : '';
  const footer = [
    escapeHtml(content.footerNote ?? REASON),
    content.switchable
      ? `Don't want these emails? <a href="${escapeHtml(fullUrl(SETTINGS_PATH))}" style="color:#5a67d8;">Turn them off in your account settings</a>.`
      : null,
    escapeHtml(TAGLINE),
  ]
    .filter((line): line is string => line !== null)
    .map((line) => `<p style="margin:0 0 6px;">${line}</p>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2d3748;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
<tr><td style="background:#667eea;background-image:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:12px 12px 0 0;padding:20px 24px;color:#ffffff;font-size:20px;font-weight:700;">Neighbors Kitchen</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#2d3748;">${escapeHtml(content.heading)}</h1>
${paragraphs}${details}${button}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.5;color:#718096;">${footer}</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

function toText(content: EmailContent): string {
  const parts = [content.heading, ...present(content.lines)];
  if (content.details?.length) parts.push(content.details.map(([label, value]) => `${label}: ${value}`).join('\n'));
  if (content.button) parts.push(`${content.button.label}: ${fullUrl(content.button.path)}`);
  const footer = present([
    '---',
    content.footerNote ?? REASON,
    content.switchable ? `Turn these emails off in your account settings: ${fullUrl(SETTINGS_PATH)}` : null,
    TAGLINE,
  ]);
  parts.push(footer.join('\n'));
  return `${parts.join('\n\n')}\n`;
}

/** Writes an email from the data captured when it was queued. Throws when there is no email for the kind or the data is unusable. */
export function renderEmail(kind: NotificationKind, data: unknown): RenderedEmail {
  const make = CONTENT[kind as EmailKind] as unknown as ((data: unknown) => EmailContent) | undefined;
  if (!make) throw new Error(`There is no email for ${kind}`);
  const content = make(data);
  return { subject: content.subject, html: toHtml(content), text: toText(content) };
}
