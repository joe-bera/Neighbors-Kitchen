import { NotificationKind } from '@prisma/client';
import { excerpt, formatWhen, REQUEST_STATUS_WORDS } from './format.js';
import { DishRequestNoticeData, NoticeDataByKind, OrderNoticeData } from './kinds.js';

/** One item under the bell: a title, a line under it, and where tapping it goes (an in-app path). */
export interface BellText {
  title: string;
  body: string | null;
  link: string;
}

const CHEF_ORDERS = '/chef/orders';
const CHEF_FEEDBACK = '/chef/feedback';
const CHEF_REQUESTS = '/chef/feedback?view=requests';
const orderPage = (data: OrderNoticeData) => `/orders/${data.orderId}`;
const requestsSection = (data: DishRequestNoticeData) => `/chefs/${data.chefId}#requests-heading`;
const when = (data: OrderNoticeData) => formatWhen(data.scheduledFor, data.timezone);
/** "Confirm by <time>" when the order has a deadline, otherwise the pickup or delivery time. */
const deadline = (data: OrderNoticeData) =>
  data.confirmBy ? `Confirm by ${formatWhen(data.confirmBy, data.timezone)}` : when(data);
const short = (text: string | null) => (text === null ? null : excerpt(text));

type BellKind = Exclude<NotificationKind, 'ORDER_PLACED' | 'PASSWORD_RESET' | 'PASSWORD_CHANGED'>;

const BELL_TEXT: { [K in BellKind]: (data: NoticeDataByKind[K]) => BellText } = {
  ORDER_CONFIRMED: (data) => ({
    title: `${data.kitchenName} confirmed your order`,
    body: `${data.orderNumber} · ${when(data)}`,
    link: orderPage(data),
  }),
  ORDER_PREPARING: (data) => ({ title: `${data.kitchenName} started cooking your order`, body: data.orderNumber, link: orderPage(data) }),
  ORDER_READY: (data) => ({
    title: data.pickupOrDelivery === 'PICKUP' ? 'Your order is ready for pickup' : 'Your order is on its way',
    body: `${data.orderNumber} from ${data.kitchenName}`,
    link: orderPage(data),
  }),
  ORDER_CANCELLED_BY_CHEF: (data) => ({
    title: `${data.kitchenName} ${data.declined ? 'declined' : 'cancelled'} your order`,
    body: short(data.reason) ?? data.orderNumber,
    link: orderPage(data),
  }),
  ORDER_EXPIRED: (data) => ({
    title: 'Your order was cancelled',
    body: `${data.kitchenName} didn't confirm ${data.orderNumber} in time`,
    link: orderPage(data),
  }),
  RATE_REMINDER: (data) => ({ title: `How was your meal from ${data.kitchenName}?`, body: 'Tap to rate your meals', link: orderPage(data) }),
  DISH_REQUEST_ANSWERED: (data) => ({
    title: `${data.kitchenName} answered your dish request`,
    body: `${data.mealName}: ${REQUEST_STATUS_WORDS[data.status]}`,
    link: requestsSection(data),
  }),
  DISH_REQUEST_ACCEPTED: (data) => ({
    title: `Good news: ${data.kitchenName} will make ${data.mealName}`,
    body: 'You voted for this dish',
    link: requestsSection(data),
  }),
  NEW_ORDER: (data) => ({ title: `New order from ${data.customerName}`, body: `${data.orderNumber} · ${deadline(data)}`, link: CHEF_ORDERS }),
  CONFIRM_REMINDER: (data) => ({
    title: `Order ${data.orderNumber} still needs your confirmation`,
    body: `${deadline(data)} or it will be cancelled automatically`,
    link: CHEF_ORDERS,
  }),
  CHEF_ORDER_EXPIRED: (data) => ({ title: `Order ${data.orderNumber} was cancelled`, body: "It wasn't confirmed in time", link: CHEF_ORDERS }),
  ORDER_CANCELLED_BY_CUSTOMER: (data) => ({
    title: `${data.customerName} cancelled order ${data.orderNumber}`,
    body: short(data.reason),
    link: CHEF_ORDERS,
  }),
  NEW_REVIEW: (data) => ({
    title: `New ${data.rating}-star review for ${data.mealName}`,
    body: short(data.comment) ?? `From ${data.customerName}`,
    link: CHEF_FEEDBACK,
  }),
  NEW_DISH_REQUEST: (data) => ({ title: `New dish request: ${data.mealName}`, body: `From ${data.requesterName}`, link: CHEF_REQUESTS }),
};

/** The bell text for a notice, or null for kinds that never go under the bell (receipts and password emails). */
export function bellText<K extends NotificationKind>(kind: K, data: NoticeDataByKind[K]): BellText | null {
  const make = BELL_TEXT[kind as BellKind] as unknown as ((data: NoticeDataByKind[K]) => BellText) | undefined;
  return make ? make(data) : null;
}
