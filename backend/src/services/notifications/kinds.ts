import { NotificationKind, PickupOrDelivery, SuggestionStatus } from '@prisma/client';

// Every kind of notice, which channels it uses, and the data it carries.
// Design: docs/superpowers/specs/2026-09-27-phase7b-notifications-design.md ("Who hears about what")

/** The email settings a person can turn off on their Account page (columns on users). */
export type EmailSwitch = 'emailRateReminders' | 'emailDishRequestNews' | 'emailKitchenFeedback';

interface KindRule {
  bell: boolean;
  email: boolean;
  /** Set for optional emails: the setting that can turn them off. */
  emailSwitch?: EmailSwitch;
}

export const KIND_RULES: Record<NotificationKind, KindRule> = {
  ORDER_PLACED: { bell: false, email: true },
  ORDER_CONFIRMED: { bell: true, email: true },
  ORDER_PREPARING: { bell: true, email: false },
  ORDER_READY: { bell: true, email: true },
  ORDER_CANCELLED_BY_CHEF: { bell: true, email: true },
  ORDER_EXPIRED: { bell: true, email: true },
  RATE_REMINDER: { bell: true, email: true, emailSwitch: 'emailRateReminders' },
  DISH_REQUEST_ANSWERED: { bell: true, email: true, emailSwitch: 'emailDishRequestNews' },
  DISH_REQUEST_ACCEPTED: { bell: true, email: true, emailSwitch: 'emailDishRequestNews' },
  NEW_ORDER: { bell: true, email: true },
  CONFIRM_REMINDER: { bell: true, email: true },
  CHEF_ORDER_EXPIRED: { bell: true, email: true },
  ORDER_CANCELLED_BY_CUSTOMER: { bell: true, email: true },
  NEW_REVIEW: { bell: true, email: true, emailSwitch: 'emailKitchenFeedback' },
  NEW_DISH_REQUEST: { bell: true, email: true, emailSwitch: 'emailKitchenFeedback' },
  PASSWORD_RESET: { bell: false, email: true },
  PASSWORD_CHANGED: { bell: false, email: true },
};

/** What an order notice knows about its order: a snapshot taken when the notice was created. No addresses or phones. */
export interface OrderNoticeData {
  orderId: string;
  orderNumber: string;
  chefId: string;
  kitchenName: string;
  /** How chefs see the customer, e.g. "Dana K." */
  customerName: string;
  items: { name: string; quantity: number }[];
  scheduledFor: string;
  /** The chef's time zone; notice times are shown in it. */
  timezone: string;
  pickupOrDelivery: PickupOrDelivery;
  total: number;
  chefPayout: number;
  /** When the chef must confirm by, or null for orders without a deadline. */
  confirmBy: string | null;
  reason: string | null;
  /** ORDER_CANCELLED_BY_CHEF only: the order was never confirmed, so the chef declined it. */
  declined?: boolean;
}

export interface DishRequestNoticeData {
  suggestionId: string;
  chefId: string;
  kitchenName: string;
  mealName: string;
  description: string | null;
  status: SuggestionStatus;
  reply: string | null;
  /** How the person who asked is shown, e.g. "Dana K." */
  requesterName: string;
}

export interface ReviewNoticeData {
  reviewId: string;
  chefId: string;
  mealName: string;
  rating: number;
  comment: string | null;
  customerName: string;
}

export interface PasswordResetData {
  firstName: string;
  /** Erased (null) once a real email service has sent the email. */
  token: string | null;
}

export interface PasswordChangedData {
  firstName: string;
}

export interface NoticeDataByKind {
  ORDER_PLACED: OrderNoticeData;
  ORDER_CONFIRMED: OrderNoticeData;
  ORDER_PREPARING: OrderNoticeData;
  ORDER_READY: OrderNoticeData;
  ORDER_CANCELLED_BY_CHEF: OrderNoticeData;
  ORDER_EXPIRED: OrderNoticeData;
  RATE_REMINDER: OrderNoticeData;
  DISH_REQUEST_ANSWERED: DishRequestNoticeData;
  DISH_REQUEST_ACCEPTED: DishRequestNoticeData;
  NEW_ORDER: OrderNoticeData;
  CONFIRM_REMINDER: OrderNoticeData;
  CHEF_ORDER_EXPIRED: OrderNoticeData;
  ORDER_CANCELLED_BY_CUSTOMER: OrderNoticeData;
  NEW_REVIEW: ReviewNoticeData;
  NEW_DISH_REQUEST: DishRequestNoticeData;
  PASSWORD_RESET: PasswordResetData;
  PASSWORD_CHANGED: PasswordChangedData;
}
