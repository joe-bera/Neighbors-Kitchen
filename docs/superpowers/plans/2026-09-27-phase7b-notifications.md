# Phase 7b Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One notification system for Neighbors Kitchen: a bell in the app plus emails (kept in a practice mailbox during development), a chef-chosen confirm-time promise with a halfway reminder and automatic cancellation, and forgot-password emails.

**Architecture:** Every notice is created by `notify(tx, recipient, kind, data)` inside the database transaction of the change it describes: a `notifications` row for the bell and/or an `emails` row (a to-do list). A background helper inside the API process (`jobs/backgroundJobs.ts`, every 5 seconds) writes and sends due emails through a transport (only the practice-mailbox transport exists this phase) and runs the timed tasks (rate reminders, chef reminders, automatic cancellation) with conditional updates so nothing happens twice.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL, Zod 4, Luxon, Vitest + Supertest (backend); React 19, React Router 7, Zustand, Vitest + Testing Library + MSW (frontend).

**Spec:** `docs/superpowers/specs/2026-09-27-phase7b-notifications-design.md` (read it first; this plan argues from it).

## Global Constraints

- Notice kinds are exactly the 17 in the spec's "Who hears about what" table, with the same bell / email / switch rules.
- Email retries: send again after 1, 5, 30, then 120 minutes; the 5th failed send marks the email `FAILED`; a writing (template) failure marks it `FAILED` at once; emails stuck in `SENDING` for over 10 minutes go back to `PENDING`.
- `JOBS_INTERVAL_MS` default 5000. `RATE_REMINDER_DELAY_MINUTES` default 120 (set to 2 in `.env.example` and the owner's `backend/.env`).
- Confirm promise: only 1, 4, 12 or 24 hours; default 4. `confirm_by` = the earlier of (placed + promise) and `scheduledFor`; `chef_reminder_at` = halfway between placing and `confirm_by`. Orders with no `confirm_by` are never reminded or cancelled.
- Automatic cancellation reason: "<Kitchen name> didn't confirm this order in time."
- Reset links: 32 random bytes, base64url; only the SHA-256 hash is stored; valid 1 hour; one reset email per account every 2 minutes; the answer is always "If there's an account for that email, we sent a link to reset the password."; an unusable link gets 400 `INVALID_RESET_LINK` "This link has expired or was already used. Ask for a new one."
- Bell: latest 8 in the drop-down; the notifications page shows the latest 50; `GET /notifications` `limit` 1 to 50, default 20; the bell checks the count on every page change and every 60 seconds.
- Practice mailbox API mounted only when `EMAIL_TRANSPORT` is `mailbox` and `NODE_ENV` is not `production`; the `/dev/mailbox` page exists only in development builds.
- Emails never contain a street address, a phone number or a delivery address; customer emails never mention the platform fee; user text is HTML-escaped; links are `FRONTEND_URL` + path; switchable emails link to `/account#email-settings`.
- Wording: customers appear to chefs as "Dana K."; kitchens by kitchen name, falling back to "Maria's Kitchen"; times in the chef's time zone as "Tue, Sep 29 at 6:00 PM"; copy never guesses anyone's pronouns.
- Project conventions (repo `CLAUDE.md`): backend relative imports end in `.js`; read settings from `env`; throw `AppError`; `validateBody(schema)`; convert Prisma `Decimal` with `.toNumber()`; another chef's record looks like a 404; test expectations are literals, never computed by the code under test.
- Never run `prisma format` (it re-aligns the whole schema). Create migrations with `prisma migrate diff` (steps below), then `prisma migrate deploy` + `prisma generate`.
- One deliberate change from the spec: emails are claimed with a conditional update (`PENDING` to `SENDING` only if still `PENDING`) instead of `FOR UPDATE SKIP LOCKED`. The guarantee is the same (two helpers never send the same email) and it needs no raw SQL.

## Review Focus

1. A chef confirms an order at the moment its deadline passes: exactly one outcome wins; a confirm that arrives after the automatic cancellation gets the usual clear 409. (Test in Task 20.)
2. A chef changes their promise after orders were placed: those orders keep their original deadline. (Test in Task 19.)
3. A kitchen in another time zone: every notice time is in the chef's zone, not Los Angeles and not UTC. (Test in Task 1.)
4. Someone who is both a chef and a customer (a chef ordering from another kitchen) gets customer notices in the same bell. (Test in Task 4.)
5. Long text a person typed (a 300-character decline reason, a 1,000-character review) keeps the bell readable: bell lines are shortened to 120 characters; emails show the full text, escaped. (Test in Task 1.)

## File Map

Backend (`backend/`):
- `prisma/schema.prisma` + four migrations (one per part)
- `src/config/env.ts`, `.env.example` - new settings
- `src/services/notifications/kinds.ts` - kinds, rules, data types
- `src/services/notifications/format.ts` - time, money, item and excerpt wording
- `src/services/notifications/bellText.ts` - bell title, line and link per kind
- `src/services/notifications/emailTemplates.ts` - subject, HTML and text per kind
- `src/services/notifications/notify.ts` - `notify()`, `recipientSelect`
- `src/services/notifications/orderNotices.ts` - order snapshot for notices, order parties
- `src/services/notifications/mailer.ts` - transports, `practiceMailboxEnabled`
- `src/services/notifications/emailDelivery.ts` - `deliverDueEmails`
- `src/services/notifications/practiceMailbox.ts` - practice mailbox queries
- `src/jobs/backgroundJobs.ts` - the helper
- `src/services/notificationService.ts`, `src/controllers/notificationController.ts`, `src/routes/notificationRoutes.ts`, `src/validators/notificationSchemas.ts` - bell API
- `src/controllers/devController.ts`, `src/routes/devRoutes.ts` - practice mailbox API
- Modified: `src/services/orderService.ts`, `reviewService.ts`, `suggestionService.ts`, `kitchenService.ts`, `chefService.ts`, `userService.ts`, `authService.ts`, `catalogShared.ts`, controllers/routes/validators for users, auth and kitchens, `src/routes/index.ts`, `src/index.ts`, `prisma/seed.ts`
- Tests: `tests/noticeFixtures.ts`, `tests/notificationHelpers.ts`, `tests/notificationText.test.ts`, `tests/emailTemplates.test.ts`, `tests/notify.test.ts`, `tests/orderNotifications.test.ts`, `tests/emailDelivery.test.ts`, `tests/backgroundJobs.test.ts`, `tests/notifications.test.ts`, `tests/practiceMailbox.test.ts`, `tests/feedbackNotifications.test.ts`, `tests/rateReminders.test.ts`, `tests/emailSettings.test.ts`, `tests/confirmPromise.test.ts`, `tests/passwordReset.test.ts`; modified `tests/helpers.ts`, `tests/testEnv.ts`

Frontend (`frontend/src/`):
- `types/notification.types.ts`; modified `types/user.types.ts`, `types/kitchen.types.ts`, `types/catalog.types.ts`, `types/order.types.ts`
- `services/notificationService.ts`, `services/practiceMailboxService.ts`, `services/accountService.ts` (email settings and password recovery)
- `store/notificationStore.ts`
- `utils/timeAgo.ts`, `utils/practiceMailbox.ts`; modified `utils/orders.ts`
- `components/notifications/NotificationBell.tsx`, `NotificationItem.tsx`, `Notifications.css`
- `components/account/EmailSettingsCard.tsx`
- `pages/NotificationsPage.tsx`, `pages/dev/PracticeMailboxPage.tsx`, `pages/dev/PracticeMailbox.css`, `pages/ForgotPasswordPage.tsx`, `pages/ResetPasswordPage.tsx`
- Modified: `App.tsx`, `components/layout/Navbar.tsx`, `Navbar.css`, `Footer.tsx`, `pages/AccountPage.tsx`, `AccountPage.css`, `LoginPage.tsx`, `AuthPages.css`, `pages/chef/AvailabilityPage.tsx`, `pages/ChefProfilePage.tsx`, `pages/CheckoutPage.tsx`, `pages/OrderDetailPage.tsx`, `pages/Orders.css`, `components/order/KitchenOrderCard.tsx`

Docs: `README.md`, `CLAUDE.md`, `backend/.env.example`.

## Working Notes

- Run backend tests from `backend/`: `npx vitest run tests/<file>.test.ts` for one file, `npm test` for all. Frontend: `cd frontend && npx vitest run src/<path>` or `npm test`. Everything: `npm test` in the repo root.
- Type checks: `cd backend && npx tsc --noEmit -p .`; website: `cd frontend && npm run lint && npm run build`.
- The local Postgres runs on port 5433 (`npm run db:start` in `backend/` starts it if needed; `npm run dev` also starts it). The test database is migrated automatically when tests start.
- **Creating a migration** (used in Tasks 1, 14, 18, 23), from `backend/`:
  ```bash
  npm run db:start
  STAMP=$(date -u +%Y%m%d%H%M%S)
  DIR="prisma/migrations/${STAMP}_<name>"
  mkdir -p "$DIR"
  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > "$DIR/migration.sql"
  cat "$DIR/migration.sql"
  npx prisma migrate deploy
  npx prisma generate
  ```
  Read the SQL before deploying: it must only contain the changes the task describes. If it shows anything else (drift), stop and find out why.
- The dev server (`npm run dev`, preview config `neighbors-kitchen`) restarts on file changes; restart it after `prisma generate` (preview_stop, then preview_start).
- Browser checks: log in with the demo buttons on `/login` (Customer demo = Chris Walker `customer@neighborskitchen.test`, Chef demo = Maria Delgado `maria@neighborskitchen.test`, password `Password123`, from the seed). Screenshots of scrolled content come out blank in the browser pane: use a tall viewport (1000x1300) or JS DOM checks. The Enter key does not submit forms: click the button. Stop processes only by exact PID. Re-run `npm run db:seed` in `backend/` afterwards to restore demo data.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never add the untracked `AGENTS.md`. Push to `claude/neighbors-kitchen-chat-dk4r07` at the end of each part.

---

# Part 1: Order alerts

At the end of Part 1: placing, confirming, cooking, readying and cancelling orders ring the right bells and write the right emails, which appear in the practice mailbox.

### Task 1: Notice kinds, wording helpers and the new tables

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<stamp>_notifications_foundation/migration.sql` (generated)
- Modify: `backend/src/config/env.ts`, `backend/.env.example`, `backend/tests/testEnv.ts`
- Create: `backend/src/services/notifications/kinds.ts`, `format.ts`, `bellText.ts`
- Create: `backend/tests/noticeFixtures.ts`
- Test: `backend/tests/notificationText.test.ts`

**Interfaces:**
- Produces: Prisma enums `NotificationKind`, `EmailStatus`; models `Notification` (`notifications`), `Email` (`emails`); `User.emailRateReminders / emailDishRequestNews / emailKitchenFeedback`.
- Produces: `kinds.ts` exports `EmailSwitch`, `KIND_RULES: Record<NotificationKind, { bell: boolean; email: boolean; emailSwitch?: EmailSwitch }>`, `OrderNoticeData`, `DishRequestNoticeData`, `ReviewNoticeData`, `PasswordResetData`, `PasswordChangedData`, `NoticeDataByKind`.
- Produces: `format.ts` exports `formatWhen(iso, timezone)`, `formatMoney(amount)`, `formatItems(items)`, `excerpt(text, max = 120)`, `REQUEST_STATUS_WORDS`.
- Produces: `bellText.ts` exports `BellText { title; body: string | null; link }` and `bellText<K>(kind: K, data: NoticeDataByKind[K]): BellText | null`.
- Produces: `env.EMAIL_TRANSPORT` (`'mailbox'`), `env.EMAIL_FROM`, `env.JOBS_INTERVAL_MS`.
- Produces: `tests/noticeFixtures.ts` exports `sampleOrder`, `sampleRequest`, `sampleReview`.

- [ ] **Step 1: Add the enums, tables and switch columns to the schema**

In `backend/prisma/schema.prisma`, add after the `Priority` enum:

```prisma
// What a notice is about: one list for the bell and for email.
// Design: docs/superpowers/specs/2026-09-27-phase7b-notifications-design.md
enum NotificationKind {
  ORDER_PLACED
  ORDER_CONFIRMED
  ORDER_PREPARING
  ORDER_READY
  ORDER_CANCELLED_BY_CHEF
  ORDER_EXPIRED
  RATE_REMINDER
  DISH_REQUEST_ANSWERED
  DISH_REQUEST_ACCEPTED
  NEW_ORDER
  CONFIRM_REMINDER
  CHEF_ORDER_EXPIRED
  ORDER_CANCELLED_BY_CUSTOMER
  NEW_REVIEW
  NEW_DISH_REQUEST
  PASSWORD_RESET
  PASSWORD_CHANGED
}

enum EmailStatus {
  PENDING // waiting to be sent, or to be tried again
  SENDING // being sent right now
  SENT
  FAILED  // gave up
}
```

In `model User`, add after the `isActive` line:

```prisma
  // Optional emails a person can turn off (order and password emails always go out)
  emailRateReminders      Boolean   @default(true) @map("email_rate_reminders")
  emailDishRequestNews    Boolean   @default(true) @map("email_dish_request_news")
  emailKitchenFeedback    Boolean   @default(true) @map("email_kitchen_feedback")
```

and in its relations list, after `refreshTokens           RefreshToken[]`:

```prisma
  notifications           Notification[]
  emails                  Email[]
```

Add these models after `model SuggestionVote`:

```prisma
// One item under the bell.
model Notification {
  id          String           @id @default(uuid())
  userId      String           @map("user_id")
  kind        NotificationKind
  title       String
  body        String?          @db.Text
  // Where tapping it goes, e.g. /orders/<id>
  link        String
  readAt      DateTime?        @map("read_at")
  createdAt   DateTime         @default(now()) @map("created_at")

  // Relations
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("notifications")
}

// Emails to send (the background helper works through the due PENDING ones) and, in development,
// the practice mailbox's copy of every email.
model Email {
  id          String           @id @default(uuid())
  userId      String           @map("user_id")
  toAddress   String           @map("to_address")
  kind        NotificationKind
  // Everything the email's wording needs, captured when it was queued
  data        Json
  status      EmailStatus      @default(PENDING)
  attempts    Int              @default(0)
  sendAfter   DateTime         @default(now()) @map("send_after")
  lastError   String?          @map("last_error") @db.Text
  // Written just before sending
  subject     String?
  html        String?          @db.Text
  textBody    String?          @map("text_body") @db.Text
  sentAt      DateTime?        @map("sent_at")
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  // Relations
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, sendAfter])
  @@map("emails")
}
```

- [ ] **Step 2: Create and apply the migration**

Follow "Creating a migration" in Working Notes with `<name>` = `notifications_foundation`. The SQL must contain only: `CREATE TYPE "NotificationKind"`, `CREATE TYPE "EmailStatus"`, `ALTER TABLE "users" ADD COLUMN` for the three `email_*` columns (each `BOOLEAN NOT NULL DEFAULT true`), `CREATE TABLE "notifications"`, `CREATE TABLE "emails"`, their indexes and their two foreign keys `ON DELETE CASCADE`.

- [ ] **Step 3: Add the new settings**

In `backend/src/config/env.ts`, add inside `envSchema` after `GEOCODER`:

```ts
  // Where emails go: "mailbox" keeps them in the database for the practice mailbox page and sends
  // nothing. A real email service is added at launch (Phase 8).
  EMAIL_TRANSPORT: z.enum(['mailbox']).default('mailbox'),
  EMAIL_FROM: z.string().min(3).default('Neighbors Kitchen <no-reply@neighborskitchen.test>'),
  // How often the background helper sends emails and runs timed tasks
  JOBS_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
```

In `backend/.env.example`, add after the `GEOCODER=census` line:

```bash

# Email (Phase 7): "mailbox" keeps every email in the database for the practice mailbox page
# (http://localhost:3000/dev/mailbox) and sends nothing. A real email service comes at launch (Phase 8).
EMAIL_TRANSPORT=mailbox
EMAIL_FROM="Neighbors Kitchen <no-reply@neighborskitchen.test>"

# How often (in milliseconds) the background helper sends emails and runs timed tasks
JOBS_INTERVAL_MS=5000
```

and delete these three lines further down (the old placeholder):

```bash
# Email notifications (Phase 7)
# EMAIL_FROM=noreply@neighbors-kitchen.com
# EMAIL_FROM_NAME=Neighbors Kitchen
```

In `backend/tests/testEnv.ts`, add to `testEnv` after `GEOCODER: 'off',` (the Prisma client can load `backend/.env` into the process, so tests pin every value they assert on):

```ts
  EMAIL_TRANSPORT: 'mailbox',
  EMAIL_FROM: 'Neighbors Kitchen <no-reply@neighborskitchen.test>',
```

- [ ] **Step 4: Write the kinds, their rules and their data types**

Create `backend/src/services/notifications/kinds.ts`:

```ts
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
```

- [ ] **Step 5: Write the sample data the wording tests use**

Create `backend/tests/noticeFixtures.ts`:

```ts
import { DishRequestNoticeData, OrderNoticeData, ReviewNoticeData } from '../src/services/notifications/kinds.js';

// Sample notice data for tests of the wording.
// 2026-09-30T01:00Z is 6:00 PM and 2026-09-29T22:15Z is 3:15 PM on Tuesday, September 29, 2026, in Los Angeles.

export const sampleOrder: OrderNoticeData = {
  orderId: 'order-1',
  orderNumber: 'NK-7QX4PD',
  chefId: 'chef-1',
  kitchenName: "Abuela's Table",
  customerName: 'Dana K.',
  items: [
    { name: 'Chicken Enchilada Casserole', quantity: 2 },
    { name: 'Churros', quantity: 1 },
  ],
  scheduledFor: '2026-09-30T01:00:00.000Z',
  timezone: 'America/Los_Angeles',
  pickupOrDelivery: 'PICKUP',
  total: 33,
  chefPayout: 29.7,
  confirmBy: '2026-09-29T22:15:00.000Z',
  reason: null,
};

export const sampleRequest: DishRequestNoticeData = {
  suggestionId: 'request-1',
  chefId: 'chef-1',
  kitchenName: "Abuela's Table",
  mealName: 'Birria tacos',
  description: 'Slow-cooked beef birria with consommé for dipping, please!',
  status: 'CONSIDERING',
  reply: 'Testing my family recipe this month.',
  requesterName: 'Dana K.',
};

export const sampleReview: ReviewNoticeData = {
  reviewId: 'review-1',
  chefId: 'chef-1',
  mealName: 'Chicken Enchilada Casserole',
  rating: 5,
  comment: "Tasted just like my tía's.",
  customerName: 'Dana K.',
};
```

- [ ] **Step 6: Write the failing tests for the bell text**

Create `backend/tests/notificationText.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bellText } from '../src/services/notifications/bellText.js';
import { sampleOrder, sampleRequest, sampleReview } from './noticeFixtures.js';

describe('bellText', () => {
  it('shows order updates to the customer in the chef time zone, linking to the order', () => {
    expect(bellText('ORDER_CONFIRMED', sampleOrder)).toEqual({
      title: "Abuela's Table confirmed your order",
      body: 'NK-7QX4PD · Tue, Sep 29 at 6:00 PM',
      link: '/orders/order-1',
    });
  });

  it("uses the chef's own time zone", () => {
    const newYorkKitchen = { ...sampleOrder, timezone: 'America/New_York' };
    expect(bellText('ORDER_CONFIRMED', newYorkKitchen)?.body).toBe('NK-7QX4PD · Tue, Sep 29 at 9:00 PM');
  });

  it('says ready for pickup, or on its way for delivery', () => {
    expect(bellText('ORDER_READY', sampleOrder)).toEqual({
      title: 'Your order is ready for pickup',
      body: "NK-7QX4PD from Abuela's Table",
      link: '/orders/order-1',
    });
    expect(bellText('ORDER_READY', { ...sampleOrder, pickupOrDelivery: 'DELIVERY' })?.title).toBe('Your order is on its way');
  });

  it('says declined for an order the chef never confirmed, cancelled otherwise, with the reason', () => {
    expect(bellText('ORDER_CANCELLED_BY_CHEF', { ...sampleOrder, declined: true, reason: 'Out of masa today' })).toEqual({
      title: "Abuela's Table declined your order",
      body: 'Out of masa today',
      link: '/orders/order-1',
    });
    expect(bellText('ORDER_CANCELLED_BY_CHEF', { ...sampleOrder, declined: false })).toEqual({
      title: "Abuela's Table cancelled your order",
      body: 'NK-7QX4PD',
      link: '/orders/order-1',
    });
  });

  it('shortens a long reason to one bell line', () => {
    const reason = 'We ran out. '.repeat(25);
    const body = bellText('ORDER_CANCELLED_BY_CUSTOMER', { ...sampleOrder, reason })!.body!;
    expect(body).toHaveLength(120);
    expect(body.endsWith('…')).toBe(true);
  });

  it('tells the chef about a new order, with the confirm deadline when there is one', () => {
    expect(bellText('NEW_ORDER', sampleOrder)).toEqual({
      title: 'New order from Dana K.',
      body: 'NK-7QX4PD · Confirm by Tue, Sep 29 at 3:15 PM',
      link: '/chef/orders',
    });
    expect(bellText('NEW_ORDER', { ...sampleOrder, confirmBy: null })?.body).toBe('NK-7QX4PD · Tue, Sep 29 at 6:00 PM');
  });

  it('reminds the chef of the deadline', () => {
    expect(bellText('CONFIRM_REMINDER', sampleOrder)).toEqual({
      title: 'Order NK-7QX4PD still needs your confirmation',
      body: 'Confirm by Tue, Sep 29 at 3:15 PM or it will be cancelled automatically',
      link: '/chef/orders',
    });
  });

  it('words dish-request answers like the website does, linking to the requests', () => {
    expect(bellText('DISH_REQUEST_ANSWERED', sampleRequest)).toEqual({
      title: "Abuela's Table answered your dish request",
      body: 'Birria tacos: Chef is considering it',
      link: '/chefs/chef-1#requests-heading',
    });
    expect(bellText('DISH_REQUEST_ACCEPTED', { ...sampleRequest, status: 'ACCEPTED' })).toEqual({
      title: "Good news: Abuela's Table will make Birria tacos",
      body: 'You voted for this dish',
      link: '/chefs/chef-1#requests-heading',
    });
  });

  it('shows a review comment, shortened when long, or who wrote it', () => {
    expect(bellText('NEW_REVIEW', sampleReview)).toEqual({
      title: 'New 5-star review for Chicken Enchilada Casserole',
      body: "Tasted just like my tía's.",
      link: '/chef/feedback',
    });
    const long = bellText('NEW_REVIEW', { ...sampleReview, comment: 'So good! '.repeat(30) })!.body!;
    expect(long).toHaveLength(120);
    expect(long.endsWith('So…')).toBe(true);
    expect(bellText('NEW_REVIEW', { ...sampleReview, comment: null })?.body).toBe('From Dana K.');
  });

  it('has no bell text for receipts and password emails', () => {
    expect(bellText('ORDER_PLACED', sampleOrder)).toBeNull();
    expect(bellText('PASSWORD_RESET', { firstName: 'Dana', token: 'abc' })).toBeNull();
    expect(bellText('PASSWORD_CHANGED', { firstName: 'Dana' })).toBeNull();
  });
});
```

- [ ] **Step 7: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/notificationText.test.ts`
Expected: FAIL, "Failed to load url ../src/services/notifications/bellText.js" (the module does not exist yet).

- [ ] **Step 8: Write the wording helpers**

Create `backend/src/services/notifications/format.ts`:

```ts
import { DateTime } from 'luxon';

// Wording shared by the bell and email text. Times are shown in the chef's time zone, like the rest of the app.

/** E.g. "Tue, Sep 29 at 6:00 PM". */
export function formatWhen(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone, locale: 'en-US' }).toFormat("ccc, LLL d 'at' h:mm a");
}

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** E.g. "$29.70". */
export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount);
}

/** E.g. "2 × Tamales, 1 × Churros". */
export function formatItems(items: { name: string; quantity: number }[]): string {
  return items.map((item) => `${item.quantity} × ${item.name}`).join(', ');
}

/** Text shortened to at most `max` characters, ending in "…" when something was cut. */
export function excerpt(text: string, max = 120): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** What a dish request's status is called on the website. */
export const REQUEST_STATUS_WORDS = {
  PENDING: 'Waiting for the chef',
  CONSIDERING: 'Chef is considering it',
  ACCEPTED: 'Coming soon',
  DECLINED: 'Not planned',
} as const;
```

- [ ] **Step 9: Write the bell text**

Create `backend/src/services/notifications/bellText.ts`:

```ts
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
  NEW_DISH_REQUEST: (data) => ({ title: `New dish request: ${data.mealName}`, body: `From ${data.requesterName}`, link: CHEF_FEEDBACK }),
};

/** The bell text for a notice, or null for kinds that never go under the bell (receipts and password emails). */
export function bellText<K extends NotificationKind>(kind: K, data: NoticeDataByKind[K]): BellText | null {
  const make = BELL_TEXT[kind as BellKind] as unknown as ((data: NoticeDataByKind[K]) => BellText) | undefined;
  return make ? make(data) : null;
}
```

- [ ] **Step 10: Run the tests to watch them pass, and type-check**

Run: `cd backend && npx vitest run tests/notificationText.test.ts && npx tsc --noEmit -p .`
Expected: 10 tests pass; tsc prints nothing.

- [ ] **Step 11: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/config/env.ts backend/.env.example backend/tests/testEnv.ts backend/src/services/notifications backend/tests/noticeFixtures.ts backend/tests/notificationText.test.ts
git commit -F - <<'EOF'
feat(api): notification kinds, bell wording and the notifications/emails tables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 2: Email templates

**Files:**
- Create: `backend/src/services/notifications/emailTemplates.ts`
- Test: `backend/tests/emailTemplates.test.ts`

**Interfaces:**
- Consumes: `NoticeDataByKind` and data types (`kinds.ts`); `formatWhen`, `formatMoney`, `formatItems`, `REQUEST_STATUS_WORDS` (`format.ts`); `env.FRONTEND_URL`.
- Produces: `RenderedEmail { subject: string; html: string; text: string }`, `escapeHtml(text)`, `renderEmail(kind: NotificationKind, data: unknown): RenderedEmail` (throws for `ORDER_PREPARING` and for data it cannot use).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/emailTemplates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderEmail } from '../src/services/notifications/emailTemplates.js';
import { sampleOrder, sampleRequest, sampleReview } from './noticeFixtures.js';

describe('renderEmail', () => {
  it('writes the receipt with the order details and a button to the order', () => {
    const email = renderEmail('ORDER_PLACED', sampleOrder);

    expect(email.subject).toBe("Your order NK-7QX4PD was sent to Abuela's Table");
    expect(email.html).toContain('Abuela&#39;s Table');
    expect(email.html).toContain('2 × Chicken Enchilada Casserole, 1 × Churros');
    expect(email.html).toContain('href="http://localhost:3000/orders/order-1"');
    expect(email.text).toContain('Pickup: Tue, Sep 29 at 6:00 PM');
    expect(email.text).toContain('Total: $33.00');
    expect(email.text).toContain('View your order: http://localhost:3000/orders/order-1');
  });

  it("tells the customer the chef's deadline when there is one", () => {
    expect(renderEmail('ORDER_PLACED', sampleOrder).text).toContain(
      "Abuela's Table will confirm it by Tue, Sep 29 at 3:15 PM. If it isn't confirmed by then, it's cancelled automatically and we'll tell you right away.",
    );
    expect(renderEmail('ORDER_PLACED', { ...sampleOrder, confirmBy: null }).text).toContain(
      "We'll email you as soon as Abuela's Table confirms it.",
    );
  });

  it('escapes everything people typed', () => {
    const email = renderEmail('ORDER_CANCELLED_BY_CHEF', {
      ...sampleOrder,
      kitchenName: '<b>Bold</b> & "Co"',
      reason: '<script>alert(1)</script>',
    });

    expect(email.html).toContain('&lt;b&gt;Bold&lt;/b&gt; &amp; &quot;Co&quot;');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<b>Bold');
  });

  it('says declined or cancelled, and shows the whole reason', () => {
    const reason = 'We ran out. '.repeat(25).trim();
    const declined = renderEmail('ORDER_CANCELLED_BY_CHEF', { ...sampleOrder, declined: true, reason });
    expect(declined.subject).toBe("Abuela's Table declined your order NK-7QX4PD");
    expect(declined.text).toContain(`The chef's note: “${reason}”`);
    expect(renderEmail('ORDER_CANCELLED_BY_CHEF', { ...sampleOrder, declined: false }).subject).toBe(
      "Abuela's Table cancelled your order NK-7QX4PD",
    );
  });

  it('shows the chef the payout, with the deadline in the subject', () => {
    const email = renderEmail('NEW_ORDER', sampleOrder);
    expect(email.subject).toBe('New order NK-7QX4PD: please confirm by Tue, Sep 29 at 3:15 PM');
    expect(email.text).toContain('Your payout: $29.70');
    expect(renderEmail('NEW_ORDER', { ...sampleOrder, confirmBy: null }).subject).toBe('New order NK-7QX4PD from Dana K.');
  });

  it('never shows customers the payout or a fee', () => {
    for (const kind of ['ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_READY', 'ORDER_EXPIRED', 'RATE_REMINDER'] as const) {
      const { text } = renderEmail(kind, sampleOrder);
      expect(text).not.toContain('29.70');
      expect(text.toLowerCase()).not.toContain('fee');
    }
  });

  it('adds the turn-off link only to emails people can switch off', () => {
    expect(renderEmail('RATE_REMINDER', sampleOrder).html).toContain('href="http://localhost:3000/account#email-settings"');
    expect(renderEmail('NEW_REVIEW', sampleReview).text).toContain(
      'Turn these emails off in your account settings: http://localhost:3000/account#email-settings',
    );
    expect(renderEmail('DISH_REQUEST_ANSWERED', sampleRequest).html).toContain('account#email-settings');
    expect(renderEmail('ORDER_CONFIRMED', sampleOrder).html).not.toContain('account#email-settings');
    expect(renderEmail('PASSWORD_RESET', { firstName: 'Dana', token: 'abc' }).html).not.toContain('account#email-settings');
  });

  it('puts the reset token in the link, with the reassurance in the footer', () => {
    const email = renderEmail('PASSWORD_RESET', { firstName: 'Dana', token: 'abc-DEF_123' });
    expect(email.text).toContain('Hi Dana,');
    expect(email.text).toContain('Choose a new password: http://localhost:3000/reset-password?token=abc-DEF_123');
    expect(email.text).toContain("If you didn't ask for this, you can ignore this email. Your password stays the same.");
    expect(email.text).not.toContain("You're getting this email because");
  });

  it('refuses kinds that have no email, and data it cannot use', () => {
    expect(() => renderEmail('ORDER_PREPARING', sampleOrder)).toThrow('There is no email for ORDER_PREPARING');
    expect(() => renderEmail('ORDER_CONFIRMED', {})).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/emailTemplates.test.ts`
Expected: FAIL, the module `emailTemplates.js` cannot be found.

- [ ] **Step 3: Write the templates**

Create `backend/src/services/notifications/emailTemplates.ts`:

```ts
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
    button: { label: `See ${data.kitchenName}`, path: `/chefs/${data.chefId}` },
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
    button: { label: 'Answer the request', path: '/chef/feedback' },
    switchable: true,
  }),
  PASSWORD_RESET: (data) => ({
    subject: 'Reset your Neighbors Kitchen password',
    heading: 'Reset your password',
    lines: [
      `Hi ${data.firstName}, someone (hopefully you) asked to reset the password for your Neighbors Kitchen account.`,
      'The button works once, for 1 hour.',
    ],
    button: { label: 'Choose a new password', path: `/reset-password?token=${encodeURIComponent(data.token ?? '')}` },
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
```

- [ ] **Step 4: Run the tests to watch them pass, and type-check**

Run: `cd backend && npx vitest run tests/emailTemplates.test.ts && npx tsc --noEmit -p .`
Expected: 9 tests pass; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/emailTemplates.ts backend/tests/emailTemplates.test.ts
git commit -F - <<'EOF'
feat(api): email templates for every notice, escaped, with no addresses or fees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 3: `notify()` and the order snapshot

**Files:**
- Create: `backend/src/services/notifications/notify.ts`, `backend/src/services/notifications/orderNotices.ts`
- Modify: `backend/src/services/catalogShared.ts`
- Create: `backend/tests/notificationHelpers.ts`
- Test: `backend/tests/notify.test.ts`

**Interfaces:**
- Consumes: `KIND_RULES`, `NoticeDataByKind`, `OrderNoticeData` (`kinds.ts`); `bellText` (`bellText.ts`); `chefDisplayName` (`catalogShared.ts`).
- Produces: `notify.ts`: `Recipient` (`id, email, isActive, emailRateReminders, emailDishRequestNews, emailKitchenFeedback`), `recipientSelect` (Prisma user select of those fields), `notify<K>(tx: Prisma.TransactionClient, recipient: Recipient, kind: K, data: NoticeDataByKind[K]): Promise<void>`.
- Produces: `orderNotices.ts`: `OrderForNotice`, `orderNoticeInclude`, `orderNoticeData(order: OrderForNotice, extra?: { reason?: string | null; declined?: boolean }): OrderNoticeData`, `orderParties(tx, order: { customerId: string; chef: { userId: string } }): Promise<{ customer: Recipient; chef: Recipient }>`.
- Produces: `catalogShared.ts`: `kitchenTitle(chef: { kitchenName: string | null; user: { firstName: string } }): string`.
- Produces: `tests/notificationHelpers.ts`: `bellFor(userId)` (rows `{ kind, title, body, link }`) and `emailsFor(userId)` (rows `{ kind, toAddress, data, status }`), both ordered by kind (the enum's order), then creation time.

- [ ] **Step 1: Write the test helpers for reading notices**

Create `backend/tests/notificationHelpers.ts`:

```ts
import { prisma } from '../src/lib/prisma.js';

// Test-only helpers for reading notices. Rows come back in the order the kinds are listed in the
// NotificationKind enum (then oldest first), so assertions never depend on timing.

export function bellFor(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    select: { kind: true, title: true, body: true, link: true },
  });
}

export function emailsFor(userId: string) {
  return prisma.email.findMany({
    where: { userId },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    select: { kind: true, toAddress: true, data: true, status: true },
  });
}
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/notify.test.ts`:

```ts
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { notify, recipientSelect } from '../src/services/notifications/notify.js';
import { orderNoticeData } from '../src/services/notifications/orderNotices.js';
import { bellFor, emailsFor } from './notificationHelpers.js';
import { sampleOrder } from './noticeFixtures.js';

let sequence = 0;

function person(overrides: Partial<Prisma.UserCreateInput> = {}) {
  sequence += 1;
  return prisma.user.create({
    data: { email: `dana${sequence}@example.com`, passwordHash: 'not-a-real-hash', firstName: 'Dana', lastName: 'Kim', ...overrides },
    select: recipientSelect,
  });
}

describe('notify', () => {
  it('puts a notice under the bell and queues its email', async () => {
    const dana = await person();

    await notify(prisma, dana, 'ORDER_CONFIRMED', sampleOrder);

    expect(await bellFor(dana.id)).toEqual([
      { kind: 'ORDER_CONFIRMED', title: "Abuela's Table confirmed your order", body: 'NK-7QX4PD · Tue, Sep 29 at 6:00 PM', link: '/orders/order-1' },
    ]);
    expect(await emailsFor(dana.id)).toEqual([{ kind: 'ORDER_CONFIRMED', toAddress: dana.email, data: sampleOrder, status: 'PENDING' }]);
  });

  it('only emails a receipt', async () => {
    const dana = await person();

    await notify(prisma, dana, 'ORDER_PLACED', sampleOrder);

    expect(await bellFor(dana.id)).toEqual([]);
    expect((await emailsFor(dana.id)).map((email) => email.kind)).toEqual(['ORDER_PLACED']);
  });

  it('only rings the bell for "started cooking"', async () => {
    const dana = await person();

    await notify(prisma, dana, 'ORDER_PREPARING', sampleOrder);

    expect((await bellFor(dana.id)).map((notice) => notice.kind)).toEqual(['ORDER_PREPARING']);
    expect(await emailsFor(dana.id)).toEqual([]);
  });

  it('skips only the emails a person switched off', async () => {
    const dana = await person({ emailRateReminders: false });

    await notify(prisma, dana, 'RATE_REMINDER', sampleOrder);
    await notify(prisma, dana, 'ORDER_READY', sampleOrder);

    expect((await bellFor(dana.id)).map((notice) => notice.kind)).toEqual(['ORDER_READY', 'RATE_REMINDER']);
    expect((await emailsFor(dana.id)).map((email) => email.kind)).toEqual(['ORDER_READY']);
  });

  it('sends nothing to a deactivated account', async () => {
    const dana = await person({ isActive: false });

    await notify(prisma, dana, 'ORDER_CONFIRMED', sampleOrder);

    expect(await bellFor(dana.id)).toEqual([]);
    expect(await emailsFor(dana.id)).toEqual([]);
  });

  it('is part of the change that caused it: nothing is left when that change fails', async () => {
    const dana = await person();

    const change = prisma.$transaction(async (tx) => {
      await notify(tx, dana, 'ORDER_CONFIRMED', sampleOrder);
      throw new Error('the order change failed');
    });

    await expect(change).rejects.toThrow('the order change failed');
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.email.count()).toBe(0);
  });
});

describe('orderNoticeData', () => {
  it('takes a snapshot of the order with display names and money as numbers', () => {
    const order = {
      id: 'order-1',
      orderNumber: 'NK-7QX4PD',
      chefId: 'chef-1',
      customerId: 'customer-1',
      scheduledFor: new Date('2026-09-30T01:00:00.000Z'),
      pickupOrDelivery: 'DELIVERY' as const,
      total: new Prisma.Decimal('33.00'),
      platformFee: new Prisma.Decimal('3.30'),
      cancellationReason: null,
      orderItems: [{ mealName: 'Churros', quantity: 1 }],
      chef: { userId: 'chef-user', kitchenName: null, timezone: 'America/Los_Angeles', user: { firstName: 'Maria' } },
      customer: { firstName: 'Dana', lastName: 'Kim' },
    };

    expect(orderNoticeData(order, { declined: true, reason: 'Out of masa' })).toEqual({
      orderId: 'order-1',
      orderNumber: 'NK-7QX4PD',
      chefId: 'chef-1',
      kitchenName: "Maria's Kitchen",
      customerName: 'Dana K.',
      items: [{ name: 'Churros', quantity: 1 }],
      scheduledFor: '2026-09-30T01:00:00.000Z',
      timezone: 'America/Los_Angeles',
      pickupOrDelivery: 'DELIVERY',
      total: 33,
      chefPayout: 29.7,
      confirmBy: null,
      reason: 'Out of masa',
      declined: true,
    });
  });
});
```

- [ ] **Step 3: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/notify.test.ts`
Expected: FAIL, the module `notify.js` cannot be found.

- [ ] **Step 4: Add `kitchenTitle` to the catalog helpers**

In `backend/src/services/catalogShared.ts`, add after `chefDisplayName`:

```ts
/** The kitchen's name, or "Maria's Kitchen" when the chef has not named it. */
export function kitchenTitle(chef: { kitchenName: string | null; user: { firstName: string } }): string {
  return chef.kitchenName ?? `${chef.user.firstName}'s Kitchen`;
}
```

- [ ] **Step 5: Write `notify()`**

Create `backend/src/services/notifications/notify.ts`:

```ts
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
```

- [ ] **Step 6: Write the order snapshot and the order parties**

Create `backend/src/services/notifications/orderNotices.ts`:

```ts
import { PickupOrDelivery, Prisma } from '@prisma/client';
import { chefDisplayName, kitchenTitle } from '../catalogShared.js';
import { OrderNoticeData } from './kinds.js';
import { Recipient, recipientSelect } from './notify.js';

/** The order fields an order notice is built from. The order views in orderService load all of them. */
export interface OrderForNotice {
  id: string;
  orderNumber: string;
  chefId: string;
  customerId: string;
  scheduledFor: Date;
  pickupOrDelivery: PickupOrDelivery;
  total: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  cancellationReason: string | null;
  orderItems: { mealName: string; quantity: number }[];
  chef: { userId: string; kitchenName: string | null; timezone: string; user: { firstName: string } };
  customer: { firstName: string; lastName: string };
}

/** Loads what orderNoticeData needs, for code that does not already have the full order. */
export const orderNoticeInclude = {
  orderItems: { orderBy: { createdAt: 'asc' }, select: { mealId: true, mealName: true, quantity: true } },
  chef: { select: { userId: true, kitchenName: true, timezone: true, user: { select: { firstName: true } } } },
  customer: { select: { firstName: true, lastName: true } },
} satisfies Prisma.OrderInclude;

/** A snapshot of the order for its notices. It never holds addresses or phone numbers. */
export function orderNoticeData(
  order: OrderForNotice,
  extra: { reason?: string | null; declined?: boolean } = {},
): OrderNoticeData {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    chefId: order.chefId,
    kitchenName: kitchenTitle(order.chef),
    customerName: chefDisplayName(order.customer),
    items: order.orderItems.map((item) => ({ name: item.mealName, quantity: item.quantity })),
    scheduledFor: order.scheduledFor.toISOString(),
    timezone: order.chef.timezone,
    pickupOrDelivery: order.pickupOrDelivery,
    total: order.total.toNumber(),
    chefPayout: order.total.sub(order.platformFee).toNumber(),
    confirmBy: null,
    reason: extra.reason ?? order.cancellationReason,
    ...(extra.declined !== undefined && { declined: extra.declined }),
  };
}

/** The customer and the chef of an order, ready to pass to notify(). */
export async function orderParties(
  tx: Prisma.TransactionClient,
  order: { customerId: string; chef: { userId: string } },
): Promise<{ customer: Recipient; chef: Recipient }> {
  const [customer, chef] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: order.customerId }, select: recipientSelect }),
    tx.user.findUniqueOrThrow({ where: { id: order.chef.userId }, select: recipientSelect }),
  ]);
  return { customer, chef };
}
```

- [ ] **Step 7: Run the tests to watch them pass, and type-check**

Run: `cd backend && npx vitest run tests/notify.test.ts && npx tsc --noEmit -p .`
Expected: 7 tests pass; tsc prints nothing.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/notifications/notify.ts backend/src/services/notifications/orderNotices.ts backend/src/services/catalogShared.ts backend/tests/notificationHelpers.ts backend/tests/notify.test.ts
git commit -F - <<'EOF'
feat(api): notify() creates bell items and queued emails inside the change's transaction

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 4: Order notices

**Files:**
- Modify: `backend/src/services/orderService.ts`
- Modify: `backend/tests/helpers.ts`
- Test: `backend/tests/orderNotifications.test.ts`

**Interfaces:**
- Consumes: `notify` (`notify.ts`); `orderNoticeData`, `orderParties` (`orderNotices.ts`).
- Produces: `signUp(app, role, names?)` in `tests/helpers.ts` takes an optional third argument `{ firstName?: string; lastName?: string }` and also returns `email`. Order changes now create `NEW_ORDER`, `ORDER_PLACED`, `ORDER_CONFIRMED`, `ORDER_PREPARING`, `ORDER_READY`, `ORDER_CANCELLED_BY_CHEF` (with `declined`) and `ORDER_CANCELLED_BY_CUSTOMER` notices.

- [ ] **Step 1: Let tests name the people they sign up**

In `backend/tests/helpers.ts`, replace the `signUp` function with:

```ts
export async function signUp(
  _app: Express = app,
  role: 'CUSTOMER' | 'CHEF' = 'CUSTOMER',
  names: { firstName?: string; lastName?: string } = {},
) {
  sequence += 1;
  const email = `person${sequence}@example.com`;
  const res = await request(app).post(`${API}/auth/register`).send({
    email,
    password: 'Tacos4ever',
    firstName: names.firstName ?? 'Sam',
    lastName: names.lastName ?? 'Rivera',
    role,
  });
  if (res.status !== 201) throw new Error(`sign-up failed: ${JSON.stringify(res.body)}`);
  const refreshCookie = res.get('Set-Cookie')?.find((cookie) => cookie.startsWith('nk_refresh='))?.split(';')[0] ?? '';
  return {
    userId: res.body.data.user.id as string,
    accessToken: res.body.data.accessToken as string,
    refreshCookie,
    email,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/orderNotifications.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, type Kitchen, openKitchen, pickupOrder, placeOrder, setOrderStatus, signUp } from './helpers.js';
import { bellFor, emailsFor } from './notificationHelpers.js';

const app = createApp();

type Person = Awaited<ReturnType<typeof signUp>>;

// Test chefs are Sam Rivera of "Sam's Kitchen"; the customer is Dana Kim, so notices can tell them apart.
const signUpDana = () => signUp(app, 'CUSTOMER', { firstName: 'Dana', lastName: 'Kim' });

async function placedOrder(kitchen: Kitchen, customer: { accessToken: string }, overrides: Record<string, unknown> = {}) {
  const res = await placeOrder(customer.accessToken, pickupOrder(kitchen, overrides));
  expect(res.status).toBe(201);
  return res.body.data.order as { id: string; orderNumber: string };
}

function cancelAsCustomer(customer: Person, orderId: string, reason?: string) {
  return request(app).post(`${API}/orders/${orderId}/cancel`).set(bearer(customer.accessToken)).send({ reason });
}

function cancelAsChef(kitchen: Kitchen, orderId: string, reason?: string) {
  return request(app).post(`${API}/chefs/me/orders/${orderId}/cancel`).set(bearer(kitchen.accessToken)).send({ reason });
}

describe('New orders', () => {
  it('ring the chef\'s bell, email the chef, and send the customer a receipt', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();

    const order = await placedOrder(kitchen, customer);

    const chefBell = await bellFor(kitchen.userId);
    expect(chefBell).toHaveLength(1);
    expect(chefBell[0]).toMatchObject({ kind: 'NEW_ORDER', title: 'New order from Dana K.', link: '/chef/orders' });
    expect(chefBell[0].body?.startsWith(`${order.orderNumber} · `)).toBe(true);
    expect((await emailsFor(kitchen.userId)).map((email) => email.kind)).toEqual(['NEW_ORDER']);

    const receipts = await emailsFor(customer.userId);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      kind: 'ORDER_PLACED',
      toAddress: customer.email,
      status: 'PENDING',
      data: {
        orderNumber: order.orderNumber,
        kitchenName: "Sam's Kitchen",
        customerName: 'Dana K.',
        items: [{ name: 'Tamales', quantity: 2 }],
        total: 27,
        chefPayout: 24.3,
      },
    });
    expect(await bellFor(customer.userId)).toEqual([]);
  });

  it('keep addresses and phone numbers out of every notice', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUpDana();

    await placedOrder(kitchen, customer, {
      pickupOrDelivery: 'DELIVERY',
      deliveryAddress: '1 Orange St, Redlands, CA 92373',
      contactPhone: '(909) 555-0142',
    });

    const everything = JSON.stringify([await bellFor(kitchen.userId), await emailsFor(kitchen.userId), await emailsFor(customer.userId)]);
    expect(everything).not.toContain('Orange St');
    expect(everything).not.toContain('555-0142');
    expect(everything).not.toContain('Evergreen');
  });

  it('create nothing when the order is refused', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen, { scheduledFor: '2020-01-01T01:00:00.000Z' }));

    expect(res.status).toBe(422);
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.email.count()).toBe(0);
  });

  it('treat a chef who orders from another kitchen as a customer', async () => {
    const kitchen = await openKitchen();
    const otherChef = await openKitchen();

    await placedOrder(kitchen, otherChef);

    expect((await emailsFor(otherChef.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED']);
    expect((await bellFor(kitchen.userId)).map((notice) => notice.kind)).toEqual(['NEW_ORDER']);
  });
});

describe('Chef updates', () => {
  it('tell the customer when the order is confirmed, being cooked and ready, emailing only confirmed and ready', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);

    for (const status of ['CONFIRMED', 'PREPARING', 'READY']) {
      expect((await setOrderStatus(kitchen, order.id, status)).status).toBe(200);
    }

    expect(await bellFor(customer.userId)).toEqual([
      { kind: 'ORDER_CONFIRMED', title: "Sam's Kitchen confirmed your order", body: expect.stringContaining(order.orderNumber), link: `/orders/${order.id}` },
      { kind: 'ORDER_PREPARING', title: "Sam's Kitchen started cooking your order", body: order.orderNumber, link: `/orders/${order.id}` },
      { kind: 'ORDER_READY', title: 'Your order is ready for pickup', body: `${order.orderNumber} from Sam's Kitchen`, link: `/orders/${order.id}` },
    ]);
    expect((await emailsFor(customer.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_READY']);
  });

  it('send nothing when the order is completed', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);
    for (const status of ['CONFIRMED', 'PREPARING', 'READY']) await setOrderStatus(kitchen, order.id, status);

    expect((await setOrderStatus(kitchen, order.id, 'COMPLETED')).status).toBe(200);

    expect(await bellFor(customer.userId)).toHaveLength(3);
    expect(await emailsFor(customer.userId)).toHaveLength(3);
  });

  it('create nothing for a step that is not allowed', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);

    expect((await setOrderStatus(kitchen, order.id, 'READY')).status).toBe(409);

    expect(await bellFor(customer.userId)).toEqual([]);
    expect((await emailsFor(customer.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED']);
  });
});

describe('Cancellations', () => {
  it('say the chef declined a waiting order, with the reason', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);

    expect((await cancelAsChef(kitchen, order.id, 'Out of masa today')).status).toBe(200);

    expect(await bellFor(customer.userId)).toEqual([
      { kind: 'ORDER_CANCELLED_BY_CHEF', title: "Sam's Kitchen declined your order", body: 'Out of masa today', link: `/orders/${order.id}` },
    ]);
    const emails = await emailsFor(customer.userId);
    expect(emails.map((email) => email.kind)).toEqual(['ORDER_PLACED', 'ORDER_CANCELLED_BY_CHEF']);
    expect(emails[1].data).toMatchObject({ declined: true, reason: 'Out of masa today' });
  });

  it('say the chef cancelled an order that was already confirmed', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);
    await setOrderStatus(kitchen, order.id, 'CONFIRMED');

    expect((await cancelAsChef(kitchen, order.id)).status).toBe(200);

    const cancelled = (await bellFor(customer.userId)).find((notice) => notice.kind === 'ORDER_CANCELLED_BY_CHEF');
    expect(cancelled).toEqual({
      kind: 'ORDER_CANCELLED_BY_CHEF',
      title: "Sam's Kitchen cancelled your order",
      body: order.orderNumber,
      link: `/orders/${order.id}`,
    });
  });

  it('tell the chef when the customer cancels, and send the customer nothing more', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);

    expect((await cancelAsCustomer(customer, order.id, 'Plans changed')).status).toBe(200);

    expect((await bellFor(kitchen.userId))[1]).toEqual({
      kind: 'ORDER_CANCELLED_BY_CUSTOMER',
      title: `Dana K. cancelled order ${order.orderNumber}`,
      body: 'Plans changed',
      link: '/chef/orders',
    });
    expect((await emailsFor(kitchen.userId)).map((email) => email.kind)).toEqual(['NEW_ORDER', 'ORDER_CANCELLED_BY_CUSTOMER']);
    expect(await bellFor(customer.userId)).toEqual([]);
    expect((await emailsFor(customer.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED']);
  });
});
```

- [ ] **Step 3: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/orderNotifications.test.ts`
Expected: FAIL; e.g. "New orders > ring the chef's bell..." fails with `expected [] to have a length of 1` (orders create no notices yet). The "refused" test passes already; it guards against notices from failed changes.

- [ ] **Step 4: Add the notices to the order service**

In `backend/src/services/orderService.ts`:

1. Add to the imports (keep them sorted by path):

```ts
import { notify } from './notifications/notify.js';
import { orderNoticeData, orderParties } from './notifications/orderNotices.js';
```

2. Add after the `STATUS_WORDS` constant:

```ts
// What the customer hears when the chef moves their order along.
const CUSTOMER_NOTICE: Partial<Record<OrderStatus, 'ORDER_CONFIRMED' | 'ORDER_PREPARING' | 'ORDER_READY'>> = {
  CONFIRMED: 'ORDER_CONFIRMED',
  PREPARING: 'ORDER_PREPARING',
  READY: 'ORDER_READY',
};
```

3. In `placeOrder`, change `    return tx.order.create({` to `    const created = await tx.order.create({`, and replace the end of the transaction:

```ts
      include: orderInclude,
    });
  });

  return customerView(order);
```

with:

```ts
      include: orderInclude,
    });
    const parties = await orderParties(tx, created);
    const notice = orderNoticeData(created);
    await notify(tx, parties.chef, 'NEW_ORDER', notice);
    await notify(tx, parties.customer, 'ORDER_PLACED', notice);
    return created;
  });

  return customerView(order);
```

4. In `advanceOrderStatus`, replace the last line inside the transaction,

```ts
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
```

with:

```ts
    const changed = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    const kind = CUSTOMER_NOTICE[status];
    if (kind) {
      const { customer } = await orderParties(tx, changed);
      await notify(tx, customer, kind, orderNoticeData(changed));
    }
    return changed;
```

5. Replace `cancelOrder`, `cancelOrderAsCustomer` and `cancelOrderAsChef` with:

```ts
async function cancelOrder(orderId: string, allowedStatuses: OrderStatus[], reason: string | null, cancelledBy: 'customer' | 'chef') {
  return prisma.$transaction(async (tx) => {
    // Lock the order, so the status read here is still the status when it is cancelled.
    const [current] = await tx.$queryRaw<{ status: OrderStatus }[]>`SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: { in: allowedStatuses } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
    });
    if (count === 0) {
      throw new AppError(409, 'CANNOT_CANCEL', 'This order can no longer be cancelled. Please contact the chef.');
    }
    await tx.orderEvent.create({ data: { orderId, status: 'CANCELLED', note: reason } });
    const cancelled = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });

    const parties = await orderParties(tx, cancelled);
    if (cancelledBy === 'chef') {
      // A chef who never confirmed the order declined it.
      const notice = orderNoticeData(cancelled, { declined: current.status === 'PENDING' });
      await notify(tx, parties.customer, 'ORDER_CANCELLED_BY_CHEF', notice);
    } else {
      await notify(tx, parties.chef, 'ORDER_CANCELLED_BY_CUSTOMER', orderNoticeData(cancelled));
    }
    return cancelled;
  });
}

export async function cancelOrderAsCustomer(userId: string, orderId: string, reason: string | null) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId: userId } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'We could not find that order');
  return customerView(await cancelOrder(order.id, CUSTOMER_CANCELLABLE, reason, 'customer'));
}

export async function cancelOrderAsChef(userId: string, orderId: string, reason: string | null) {
  const order = await findChefOrder(userId, orderId);
  return chefView(await cancelOrder(order.id, OPEN_STATUSES, reason, 'chef'));
}
```

- [ ] **Step 5: Run the new tests and the existing order tests**

Run: `cd backend && npx vitest run tests/orderNotifications.test.ts tests/orders.test.ts tests/deliveryDistance.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/orderService.ts backend/tests/helpers.ts backend/tests/orderNotifications.test.ts
git commit -F - <<'EOF'
feat(api): order notices for chefs and customers (new, confirmed, cooking, ready, declined, cancelled)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 5: Sending emails and the background helper

**Files:**
- Create: `backend/src/services/notifications/mailer.ts`, `backend/src/services/notifications/emailDelivery.ts`, `backend/src/jobs/backgroundJobs.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/tests/emailDelivery.test.ts`, `backend/tests/backgroundJobs.test.ts`

**Interfaces:**
- Consumes: `renderEmail` (`emailTemplates.ts`); `env.EMAIL_FROM`, `env.EMAIL_TRANSPORT`, `env.NODE_ENV`, `env.JOBS_INTERVAL_MS`.
- Produces: `mailer.ts`: `OutgoingEmail { to, from, subject, html, text }`, `EmailTransport { keepsCopies: boolean; send(email: OutgoingEmail): Promise<void> }`, `mailboxTransport`, `transportFromEnv(): EmailTransport`, `practiceMailboxEnabled(config?: Pick<Env, 'EMAIL_TRANSPORT' | 'NODE_ENV'>): boolean`.
- Produces: `emailDelivery.ts`: `deliverDueEmails(now: Date, transport: EmailTransport): Promise<{ sent: number; failed: number }>`.
- Produces: `backgroundJobs.ts`: `BackgroundTask { name: string; run: (now: Date) => Promise<unknown> }`, `runBackgroundTasks(tasks, now?)`, `startBackgroundJobs(): () => void` (returns a stop function). Later parts add tasks to the list in `startBackgroundJobs`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/emailDelivery.test.ts`:

```ts
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { deliverDueEmails } from '../src/services/notifications/emailDelivery.js';
import { EmailTransport, OutgoingEmail } from '../src/services/notifications/mailer.js';
import { sampleOrder } from './noticeFixtures.js';

const MINUTE = 60 * 1000;
const NOW = new Date('2026-09-29T20:00:00.000Z');
let sequence = 0;

/** A stand-in for an email service that records what it was asked to send. */
function recordingTransport(keepsCopies = true) {
  const sent: OutgoingEmail[] = [];
  const transport: EmailTransport = {
    keepsCopies,
    send: async (email) => {
      sent.push(email);
    },
  };
  return { sent, transport };
}

const brokenTransport: EmailTransport = {
  keepsCopies: true,
  send: async () => {
    throw new Error('service unavailable');
  },
};

async function queueEmail(overrides: Partial<Prisma.EmailUncheckedCreateInput> = {}) {
  sequence += 1;
  const user = await prisma.user.create({
    data: { email: `mail${sequence}@example.com`, passwordHash: 'not-a-real-hash', firstName: 'Dana', lastName: 'Kim' },
  });
  return prisma.email.create({
    data: {
      userId: user.id,
      toAddress: 'dana@example.com',
      kind: 'ORDER_CONFIRMED',
      data: sampleOrder as unknown as Prisma.InputJsonValue,
      sendAfter: NOW,
      ...overrides,
    },
  });
}

const reload = (id: string) => prisma.email.findUniqueOrThrow({ where: { id } });

describe('deliverDueEmails', () => {
  it('writes and sends due emails, keeping them for the practice mailbox', async () => {
    const email = await queueEmail();
    const { sent, transport } = recordingTransport();

    expect(await deliverDueEmails(NOW, transport)).toEqual({ sent: 1, failed: 0 });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: 'dana@example.com',
      from: 'Neighbors Kitchen <no-reply@neighborskitchen.test>',
      subject: "Abuela's Table confirmed your order NK-7QX4PD",
    });
    const row = await reload(email.id);
    expect(row).toMatchObject({
      status: 'SENT',
      attempts: 1,
      sentAt: NOW,
      lastError: null,
      subject: "Abuela's Table confirmed your order NK-7QX4PD",
    });
    expect(row.html).toContain('View your order');
    expect(row.textBody).toContain('View your order');
  });

  it('leaves emails that are not due yet', async () => {
    await queueEmail({ sendAfter: new Date(NOW.getTime() + MINUTE) });
    const { sent, transport } = recordingTransport();

    expect(await deliverDueEmails(NOW, transport)).toEqual({ sent: 0, failed: 0 });
    expect(sent).toEqual([]);
  });

  it('tries again after 1, 5, 30 and 120 minutes, then gives up', async () => {
    const email = await queueEmail();
    let now = NOW;
    const waits: number[] = [];

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect(await deliverDueEmails(now, brokenTransport)).toEqual({ sent: 0, failed: 0 });
      const row = await reload(email.id);
      expect(row).toMatchObject({ status: 'PENDING', attempts: attempt, lastError: 'service unavailable' });
      waits.push((row.sendAfter.getTime() - now.getTime()) / MINUTE);
      now = row.sendAfter;
    }

    expect(waits).toEqual([1, 5, 30, 120]);
    expect(await deliverDueEmails(now, brokenTransport)).toEqual({ sent: 0, failed: 1 });
    expect(await reload(email.id)).toMatchObject({ status: 'FAILED', attempts: 5, lastError: 'service unavailable' });
  });

  it('fails an email it cannot write, without sending it', async () => {
    const email = await queueEmail({ data: {} });
    const { sent, transport } = recordingTransport();

    expect(await deliverDueEmails(NOW, transport)).toEqual({ sent: 0, failed: 1 });

    expect(sent).toEqual([]);
    const row = await reload(email.id);
    expect(row).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(row.lastError?.startsWith('Could not write this email: ')).toBe(true);
  });

  it('picks up an email left half-sent by a crash, but not one still being sent', async () => {
    const stuck = await queueEmail({ status: 'SENDING', attempts: 1, updatedAt: new Date(NOW.getTime() - 11 * MINUTE) });
    const busy = await queueEmail({ status: 'SENDING', attempts: 1, updatedAt: new Date(NOW.getTime() - 5 * MINUTE) });
    const { sent, transport } = recordingTransport();

    await deliverDueEmails(NOW, transport);

    expect(sent).toHaveLength(1);
    expect((await reload(stuck.id)).status).toBe('SENT');
    expect((await reload(busy.id)).status).toBe('SENDING');
  });

  it('sends an email once, even when two helpers run at the same time', async () => {
    await queueEmail();
    const { sent, transport } = recordingTransport();

    await Promise.all([deliverDueEmails(NOW, transport), deliverDueEmails(NOW, transport)]);

    expect(sent).toHaveLength(1);
  });

  it('erases a password link once a real email service has sent it', async () => {
    const email = await queueEmail({ kind: 'PASSWORD_RESET', data: { firstName: 'Dana', token: 'secret-token-123' } });
    const { sent, transport } = recordingTransport(false);

    await deliverDueEmails(NOW, transport);

    expect(sent[0].text).toContain('secret-token-123');
    expect(await reload(email.id)).toMatchObject({
      status: 'SENT',
      html: '(removed after sending)',
      textBody: '(removed after sending)',
      data: { firstName: 'Dana', token: null },
    });
  });

  it('keeps password links in the practice mailbox', async () => {
    const email = await queueEmail({ kind: 'PASSWORD_RESET', data: { firstName: 'Dana', token: 'secret-token-123' } });
    const { transport } = recordingTransport(true);

    await deliverDueEmails(NOW, transport);

    expect((await reload(email.id)).textBody).toContain('secret-token-123');
  });
});
```

Create `backend/tests/backgroundJobs.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runBackgroundTasks } from '../src/jobs/backgroundJobs.js';

describe('runBackgroundTasks', () => {
  it('runs every task in order with the same time, even after one fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ran: string[] = [];
    const now = new Date('2026-09-29T20:00:00.000Z');

    await runBackgroundTasks(
      [
        { name: 'first', run: async (at) => { ran.push(`first ${at.toISOString()}`); } },
        { name: 'broken', run: async () => { throw new Error('database unavailable'); } },
        { name: 'last', run: async (at) => { ran.push(`last ${at.toISOString()}`); } },
      ],
      now,
    );

    expect(ran).toEqual(['first 2026-09-29T20:00:00.000Z', 'last 2026-09-29T20:00:00.000Z']);
    expect(logged).toHaveBeenCalledWith('Background task "broken" failed:', 'database unavailable');
    logged.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/emailDelivery.test.ts tests/backgroundJobs.test.ts`
Expected: FAIL, the modules `emailDelivery.js` and `backgroundJobs.js` cannot be found.

- [ ] **Step 3: Write the transports**

Create `backend/src/services/notifications/mailer.ts`:

```ts
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
```

- [ ] **Step 4: Write the delivery**

Create `backend/src/services/notifications/emailDelivery.ts`:

```ts
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { RenderedEmail, renderEmail } from './emailTemplates.js';
import { EmailTransport } from './mailer.js';

// Works through the emails table: writes each due email, sends it, and retries on failure.
// Email addresses and contents are never written to the logs.

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const MINUTE_MS = 60 * 1000;
// Minutes to wait after the 1st, 2nd, 3rd and 4th failed try.
const RETRY_DELAYS_MINUTES = [1, 5, 30, 120];
// An email in SENDING for longer than this was being sent when the server stopped.
const STUCK_AFTER_MS = 10 * MINUTE_MS;
const REMOVED = '(removed after sending)';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function deliverDueEmails(now: Date, transport: EmailTransport): Promise<{ sent: number; failed: number }> {
  await prisma.email.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
    data: { status: 'PENDING' },
  });

  const due = await prisma.email.findMany({
    where: { status: 'PENDING', sendAfter: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    // Claim it: only one helper can move it from PENDING to SENDING. updatedAt records when, for the stuck check above.
    const { count } = await prisma.email.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'SENDING', attempts: { increment: 1 }, updatedAt: now },
    });
    if (count === 0) continue;
    const email = await prisma.email.findUniqueOrThrow({ where: { id } });

    let written: RenderedEmail;
    try {
      written = renderEmail(email.kind, email.data);
    } catch (error) {
      // A template problem will not fix itself by waiting.
      await prisma.email.update({ where: { id }, data: { status: 'FAILED', lastError: `Could not write this email: ${messageOf(error)}` } });
      failed += 1;
      continue;
    }
    const copy = { subject: written.subject, html: written.html, textBody: written.text };

    try {
      await transport.send({ to: email.toAddress, from: env.EMAIL_FROM, ...written });
    } catch (error) {
      const retry = email.attempts < MAX_ATTEMPTS;
      await prisma.email.update({
        where: { id },
        data: {
          ...copy,
          status: retry ? 'PENDING' : 'FAILED',
          lastError: messageOf(error),
          ...(retry && { sendAfter: new Date(now.getTime() + RETRY_DELAYS_MINUTES[email.attempts - 1] * MINUTE_MS) }),
        },
      });
      if (!retry) failed += 1;
      continue;
    }

    // Once a real service has a password link, the database does not keep a working copy.
    const erase = !transport.keepsCopies && email.kind === 'PASSWORD_RESET';
    await prisma.email.update({
      where: { id },
      data: {
        ...copy,
        status: 'SENT',
        sentAt: now,
        lastError: null,
        ...(erase && {
          html: REMOVED,
          textBody: REMOVED,
          data: { ...(email.data as Prisma.JsonObject), token: null } as Prisma.InputJsonObject,
        }),
      },
    });
    sent += 1;
  }
  return { sent, failed };
}
```

- [ ] **Step 5: Write the helper and start it with the server**

Create `backend/src/jobs/backgroundJobs.ts`:

```ts
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
```

Replace `backend/src/index.ts` with:

```ts
import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { startBackgroundJobs } from './jobs/backgroundJobs.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`🚀 Neighbors-Kitchen API server running on port ${env.PORT}`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${env.PORT}/api/v1`);
  startBackgroundJobs();
});
```

- [ ] **Step 6: Run the tests to watch them pass, and type-check**

Run: `cd backend && npx vitest run tests/emailDelivery.test.ts tests/backgroundJobs.test.ts && npx tsc --noEmit -p .`
Expected: 9 tests pass; tsc prints nothing.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/notifications/mailer.ts backend/src/services/notifications/emailDelivery.ts backend/src/jobs backend/src/index.ts backend/tests/emailDelivery.test.ts backend/tests/backgroundJobs.test.ts
git commit -F - <<'EOF'
feat(api): background helper that writes and sends queued emails, with retries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 6: Bell API

**Files:**
- Create: `backend/src/services/notificationService.ts`, `backend/src/controllers/notificationController.ts`, `backend/src/routes/notificationRoutes.ts`, `backend/src/validators/notificationSchemas.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/notifications.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/notifications?limit=` → `{ data: { notifications: [{ id, kind, title, body, link, createdAt, read }], unreadCount } }`; `GET /api/v1/notifications/unread-count` → `{ data: { unreadCount } }`; `POST /api/v1/notifications/read-all` → `{ data: { unreadCount: 0 } }`. Signed-in users only; own notices only.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/notifications.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, signUp } from './helpers.js';

const app = createApp();

function notice(userId: string, title: string, minutesAgo: number, read = false) {
  const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  return prisma.notification.create({
    data: { userId, kind: 'ORDER_CONFIRMED', title, body: null, link: '/orders/x', createdAt, readAt: read ? createdAt : null },
  });
}

const list = (accessToken: string, query = '') => request(app).get(`${API}/notifications${query}`).set(bearer(accessToken));
const unread = (accessToken: string) => request(app).get(`${API}/notifications/unread-count`).set(bearer(accessToken));

describe('GET /notifications', () => {
  it('lists my notifications newest first, with how many are unread', async () => {
    const me = await signUp(app);
    await notice(me.userId, 'Oldest', 30, true);
    await notice(me.userId, 'Newest', 1);
    await notice(me.userId, 'Middle', 10);

    const res = await list(me.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(2);
    expect(res.body.data.notifications.map((item: { title: string; read: boolean }) => [item.title, item.read])).toEqual([
      ['Newest', false],
      ['Middle', false],
      ['Oldest', true],
    ]);
    expect(Object.keys(res.body.data.notifications[0]).sort()).toEqual(['body', 'createdAt', 'id', 'kind', 'link', 'read', 'title']);
  });

  it("never shows someone else's notifications", async () => {
    const me = await signUp(app);
    const someoneElse = await signUp(app);
    await notice(someoneElse.userId, 'Not mine', 1);

    const res = await list(me.accessToken);

    expect(res.body.data).toEqual({ notifications: [], unreadCount: 0 });
  });

  it('returns at most `limit` notifications, from 1 to 50', async () => {
    const me = await signUp(app);
    for (const minutes of [1, 2, 3]) await notice(me.userId, `Notice ${minutes}`, minutes);

    expect((await list(me.accessToken, '?limit=2')).body.data.notifications).toHaveLength(2);
    expect((await list(me.accessToken, '?limit=0')).status).toBe(422);
    expect((await list(me.accessToken, '?limit=51')).status).toBe(422);
  });

  it('requires login', async () => {
    expect((await request(app).get(`${API}/notifications`)).status).toBe(401);
  });
});

describe('GET /notifications/unread-count', () => {
  it('counts only my unread notifications', async () => {
    const me = await signUp(app);
    const someoneElse = await signUp(app);
    await notice(me.userId, 'Unread', 1);
    await notice(me.userId, 'Read', 2, true);
    await notice(someoneElse.userId, 'Not mine', 1);

    const res = await unread(me.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ unreadCount: 1 });
  });
});

describe('POST /notifications/read-all', () => {
  it('marks all of my notifications read, and nobody else\'s', async () => {
    const me = await signUp(app);
    const someoneElse = await signUp(app);
    await notice(me.userId, 'One', 1);
    await notice(me.userId, 'Two', 2);
    await notice(someoneElse.userId, 'Not mine', 1);

    const res = await request(app).post(`${API}/notifications/read-all`).set(bearer(me.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ unreadCount: 0 });
    expect((await unread(me.accessToken)).body.data.unreadCount).toBe(0);
    expect((await unread(someoneElse.accessToken)).body.data.unreadCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/notifications.test.ts`
Expected: FAIL with 404s (the routes do not exist yet).

- [ ] **Step 3: Write the service, validator, controller and routes**

Create `backend/src/services/notificationService.ts`:

```ts
import { Notification } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// The signed-in person's bell: their own notices only.

function toNotificationView(notification: Notification) {
  return {
    id: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    createdAt: notification.createdAt,
    read: notification.readAt !== null,
  };
}

export function countUnread(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string, limit: number) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit }),
    countUnread(userId),
  ]);
  return { notifications: notifications.map(toNotificationView), unreadCount };
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
```

Create `backend/src/validators/notificationSchemas.ts`:

```ts
import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```

Create `backend/src/controllers/notificationController.ts`:

```ts
import { Request, Response } from 'express';
import { parseInput } from '../middleware/validateRequest.js';
import * as notificationService from '../services/notificationService.js';
import { notificationListQuerySchema } from '../validators/notificationSchemas.js';

export async function listNotifications(req: Request, res: Response) {
  const { limit } = parseInput(notificationListQuerySchema, req.query);
  const data = await notificationService.listNotifications(req.user!.id, limit);
  res.status(200).json({ success: true, data });
}

export async function getUnreadCount(req: Request, res: Response) {
  const unreadCount = await notificationService.countUnread(req.user!.id);
  res.status(200).json({ success: true, data: { unreadCount } });
}

export async function markAllRead(req: Request, res: Response) {
  await notificationService.markAllRead(req.user!.id);
  res.status(200).json({ success: true, data: { unreadCount: 0 } });
}
```

Create `backend/src/routes/notificationRoutes.ts`:

```ts
import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

// The signed-in person's bell: /api/v1/notifications/...
export const notificationRoutes = Router();
notificationRoutes.use(requireAuth);

notificationRoutes.get('/', notificationController.listNotifications);
notificationRoutes.get('/unread-count', notificationController.getUnreadCount);
notificationRoutes.post('/read-all', notificationController.markAllRead);
```

In `backend/src/routes/index.ts`, add the import `import { notificationRoutes } from './notificationRoutes.js';` and, after `apiRoutes.use('/suggestions', suggestionRoutes);`:

```ts
apiRoutes.use('/notifications', notificationRoutes);
```

- [ ] **Step 4: Run the tests to watch them pass, and type-check**

Run: `cd backend && npx vitest run tests/notifications.test.ts && npx tsc --noEmit -p .`
Expected: 6 tests pass; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notificationService.ts backend/src/validators/notificationSchemas.ts backend/src/controllers/notificationController.ts backend/src/routes/notificationRoutes.ts backend/src/routes/index.ts backend/tests/notifications.test.ts
git commit -F - <<'EOF'
feat(api): bell endpoints - list, unread count, mark all read

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 7: Practice mailbox API

**Files:**
- Create: `backend/src/services/notifications/practiceMailbox.ts`, `backend/src/controllers/devController.ts`, `backend/src/routes/devRoutes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/practiceMailbox.test.ts`

**Interfaces:**
- Consumes: `practiceMailboxEnabled` (`mailer.ts`).
- Produces: `GET /api/v1/dev/emails` → `{ data: { emails: [{ id, to, kind, subject, status, attempts, lastError, createdAt, sentAt }] } }` (latest 100, newest first); `GET /api/v1/dev/emails/:id` → `{ data: { email: { ...same, html, text } } }`; 404 `NOT_FOUND` for an unknown id. Mounted only when `practiceMailboxEnabled()`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/practiceMailbox.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { practiceMailboxEnabled } from '../src/services/notifications/mailer.js';
import { API } from './helpers.js';

const app = createApp();

async function someone() {
  return prisma.user.create({ data: { email: 'dana@example.com', passwordHash: 'not-a-real-hash', firstName: 'Dana', lastName: 'Kim' } });
}

describe('Practice mailbox', () => {
  it('lists the latest emails, newest first, without their contents', async () => {
    const dana = await someone();
    await prisma.email.create({
      data: { userId: dana.id, toAddress: 'dana@example.com', kind: 'ORDER_PLACED', data: {}, status: 'SENT', subject: 'Older email', createdAt: new Date(Date.now() - 60 * 1000) },
    });
    await prisma.email.create({ data: { userId: dana.id, toAddress: 'dana@example.com', kind: 'NEW_ORDER', data: {} } });

    const res = await request(app).get(`${API}/dev/emails`);

    expect(res.status).toBe(200);
    expect(res.body.data.emails).toMatchObject([
      { to: 'dana@example.com', kind: 'NEW_ORDER', subject: null, status: 'PENDING', attempts: 0, lastError: null, sentAt: null },
      { to: 'dana@example.com', kind: 'ORDER_PLACED', subject: 'Older email', status: 'SENT' },
    ]);
    expect(res.body.data.emails[0]).not.toHaveProperty('html');
  });

  it('shows one email as it was written', async () => {
    const dana = await someone();
    const email = await prisma.email.create({
      data: { userId: dana.id, toAddress: 'dana@example.com', kind: 'ORDER_PLACED', data: {}, status: 'SENT', subject: 'Hello', html: '<p>Hello</p>', textBody: 'Hello' },
    });

    const res = await request(app).get(`${API}/dev/emails/${email.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toMatchObject({ id: email.id, subject: 'Hello', html: '<p>Hello</p>', text: 'Hello' });
  });

  it('answers 404 for an email that does not exist', async () => {
    const res = await request(app).get(`${API}/dev/emails/no-such-email`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('is switched off in production', () => {
    expect(practiceMailboxEnabled({ EMAIL_TRANSPORT: 'mailbox', NODE_ENV: 'production' })).toBe(false);
    expect(practiceMailboxEnabled({ EMAIL_TRANSPORT: 'mailbox', NODE_ENV: 'development' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/practiceMailbox.test.ts`
Expected: the list and show tests FAIL with 404 route-not-found responses. The unknown-email and production tests already pass: they guard behavior that must stay true once the routes exist.

- [ ] **Step 3: Write the queries, controller and routes**

Create `backend/src/services/notifications/practiceMailbox.ts`:

```ts
import { Email } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/errors.js';

// The practice mailbox (development only): every email the app has queued, as it was written.

function toListItem(email: Email) {
  return {
    id: email.id,
    to: email.toAddress,
    kind: email.kind,
    subject: email.subject,
    status: email.status,
    attempts: email.attempts,
    lastError: email.lastError,
    createdAt: email.createdAt,
    sentAt: email.sentAt,
  };
}

export async function listPracticeEmails() {
  const emails = await prisma.email.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  return emails.map(toListItem);
}

export async function getPracticeEmail(id: string) {
  const email = await prisma.email.findUnique({ where: { id } });
  if (!email) throw new AppError(404, 'NOT_FOUND', 'We could not find that email');
  return { ...toListItem(email), html: email.html, text: email.textBody };
}
```

Create `backend/src/controllers/devController.ts`:

```ts
import { Request, Response } from 'express';
import * as practiceMailbox from '../services/notifications/practiceMailbox.js';

export async function listEmails(_req: Request, res: Response) {
  const emails = await practiceMailbox.listPracticeEmails();
  res.status(200).json({ success: true, data: { emails } });
}

export async function getEmail(req: Request<{ id: string }>, res: Response) {
  const email = await practiceMailbox.getPracticeEmail(req.params.id);
  res.status(200).json({ success: true, data: { email } });
}
```

Create `backend/src/routes/devRoutes.ts`:

```ts
import { Router } from 'express';
import * as devController from '../controllers/devController.js';

// Development-only tools: /api/v1/dev/... Mounted only when practiceMailboxEnabled() (never in production).
export const devRoutes = Router();

devRoutes.get('/emails', devController.listEmails);
devRoutes.get('/emails/:id', devController.getEmail);
```

In `backend/src/routes/index.ts`, add the imports

```ts
import { practiceMailboxEnabled } from '../services/notifications/mailer.js';
import { devRoutes } from './devRoutes.js';
```

and after the notifications line:

```ts
// The practice mailbox shows everyone's emails, so it only exists outside production.
if (practiceMailboxEnabled()) apiRoutes.use('/dev', devRoutes);
```

- [ ] **Step 4: Run the tests to watch them pass, and type-check**

Run: `cd backend && npx vitest run tests/practiceMailbox.test.ts && npx tsc --noEmit -p .`
Expected: 4 tests pass; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/practiceMailbox.ts backend/src/controllers/devController.ts backend/src/routes/devRoutes.ts backend/src/routes/index.ts backend/tests/practiceMailbox.test.ts
git commit -F - <<'EOF'
feat(api): practice mailbox endpoints (development only)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 8: Website: notification types, services, store and "time ago"

**Files:**
- Create: `frontend/src/types/notification.types.ts`
- Create: `frontend/src/services/notificationService.ts`, `frontend/src/services/practiceMailboxService.ts`
- Create: `frontend/src/store/notificationStore.ts`
- Create: `frontend/src/utils/timeAgo.ts`
- Test: `frontend/src/services/notificationService.test.ts`, `frontend/src/utils/timeAgo.test.ts`

**Interfaces:**
- Produces: types `AppNotification { id; kind; title; body: string | null; link; createdAt; read }`, `NotificationList { notifications; unreadCount }`, `EmailSettings { rateReminders; dishRequestNews; kitchenFeedback }`, `PracticeEmailStatus`, `PracticeEmail`, `PracticeEmailDetail` (adds `html`, `text`).
- Produces: `fetchNotifications(limit: number): Promise<NotificationList>`, `fetchUnreadCount(): Promise<number>`, `markAllNotificationsRead(): Promise<void>`, `fetchPracticeEmails(): Promise<PracticeEmail[]>`, `fetchPracticeEmail(id): Promise<PracticeEmailDetail>`.
- Produces: `useNotificationStore` (`unreadCount`, `setUnreadCount(count)`), shared by the bell and the notifications page.
- Produces: `timeAgo(iso: string, now?: Date): string`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/timeAgo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { timeAgo } from './timeAgo'

const now = new Date('2026-09-29T20:00:00.000Z')

describe('timeAgo', () => {
  it.each([
    ['2026-09-29T19:59:30.000Z', 'Just now'],
    ['2026-09-29T20:00:05.000Z', 'Just now'],
    ['2026-09-29T19:55:00.000Z', '5 min ago'],
    ['2026-09-29T19:00:00.000Z', '1 hr ago'],
    ['2026-09-29T08:00:00.000Z', '12 hr ago'],
    ['2026-09-28T20:00:00.000Z', '1 day ago'],
    ['2026-09-24T20:00:00.000Z', '5 days ago'],
    ['2026-09-10T12:00:00.000Z', 'Sep 10'],
  ])('%s is "%s"', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected)
  })
})
```

Create `frontend/src/services/notificationService.test.ts`:

```ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { AppNotification } from '../types/notification.types'
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from './notificationService'

const API = 'http://api.test/api/v1'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const confirmed: AppNotification = {
  id: 'n1',
  kind: 'ORDER_CONFIRMED',
  title: "Abuela's Table confirmed your order",
  body: 'NK-7QX4PD · Tue, Sep 29 at 6:00 PM',
  link: '/orders/o1',
  createdAt: '2026-09-29T20:00:00.000Z',
  read: false,
}

describe('notificationService', () => {
  it('asks for the latest notifications, up to the limit', async () => {
    let limit: string | null = null
    server.use(
      http.get(`${API}/notifications`, ({ request }) => {
        limit = new URL(request.url).searchParams.get('limit')
        return HttpResponse.json({ success: true, data: { notifications: [confirmed], unreadCount: 1 } })
      }),
    )

    expect(await fetchNotifications(8)).toEqual({ notifications: [confirmed], unreadCount: 1 })
    expect(limit).toBe('8')
  })

  it('reads the unread count', async () => {
    server.use(http.get(`${API}/notifications/unread-count`, () => HttpResponse.json({ success: true, data: { unreadCount: 4 } })))

    expect(await fetchUnreadCount()).toBe(4)
  })

  it('marks everything read', async () => {
    let called = false
    server.use(
      http.post(`${API}/notifications/read-all`, () => {
        called = true
        return HttpResponse.json({ success: true, data: { unreadCount: 0 } })
      }),
    )

    await markAllNotificationsRead()

    expect(called).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd frontend && npx vitest run src/utils/timeAgo.test.ts src/services/notificationService.test.ts`
Expected: FAIL, `./timeAgo` and `./notificationService` cannot be resolved.

- [ ] **Step 3: Write the types**

Create `frontend/src/types/notification.types.ts`:

```ts
/** One item under the bell. */
export interface AppNotification {
  id: string
  kind: string
  title: string
  body: string | null
  /** Where tapping it goes, e.g. /orders/<id>. */
  link: string
  createdAt: string
  read: boolean
}

export interface NotificationList {
  notifications: AppNotification[]
  unreadCount: number
}

/** The optional emails a person can turn off. Order and password emails always go out. */
export interface EmailSettings {
  rateReminders: boolean
  dishRequestNews: boolean
  kitchenFeedback: boolean
}

export type PracticeEmailStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED'

/** An email in the practice mailbox (development only). */
export interface PracticeEmail {
  id: string
  to: string
  kind: string
  /** Null until the email is written, a few seconds after it is queued. */
  subject: string | null
  status: PracticeEmailStatus
  attempts: number
  lastError: string | null
  createdAt: string
  sentAt: string | null
}

export interface PracticeEmailDetail extends PracticeEmail {
  html: string | null
  text: string | null
}
```

- [ ] **Step 4: Write the services, the store and `timeAgo`**

Create `frontend/src/services/notificationService.ts`:

```ts
import type { ApiSuccess } from '../types/api.types'
import type { NotificationList } from '../types/notification.types'
import { api } from './api'

export async function fetchNotifications(limit: number): Promise<NotificationList> {
  const { data } = await api.get<ApiSuccess<NotificationList>>('/notifications', { params: { limit } })
  return data.data
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<ApiSuccess<{ unreadCount: number }>>('/notifications/unread-count')
  return data.data.unreadCount
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all')
}
```

Create `frontend/src/services/practiceMailboxService.ts`:

```ts
import type { ApiSuccess } from '../types/api.types'
import type { PracticeEmail, PracticeEmailDetail } from '../types/notification.types'
import { api } from './api'

// Development only: the emails the app has written, from /api/v1/dev/emails.

export async function fetchPracticeEmails(): Promise<PracticeEmail[]> {
  const { data } = await api.get<ApiSuccess<{ emails: PracticeEmail[] }>>('/dev/emails')
  return data.data.emails
}

export async function fetchPracticeEmail(id: string): Promise<PracticeEmailDetail> {
  const { data } = await api.get<ApiSuccess<{ email: PracticeEmailDetail }>>(`/dev/emails/${encodeURIComponent(id)}`)
  return data.data.email
}
```

Create `frontend/src/store/notificationStore.ts`:

```ts
import { create } from 'zustand'

interface NotificationState {
  /** How many notifications are unread; shown on the bell. */
  unreadCount: number
  setUnreadCount: (unreadCount: number) => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
}))
```

Create `frontend/src/utils/timeAgo.ts`:

```ts
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** How long ago something happened: "Just now", "5 min ago", "3 hr ago", "2 days ago", or the date after a week. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime()
  if (elapsed < MINUTE) return 'Just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} hr ago`
  if (elapsed < 7 * DAY) {
    const days = Math.floor(elapsed / DAY)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }
  return dateFormatter.format(new Date(iso))
}
```

- [ ] **Step 5: Run the tests to watch them pass**

Run: `cd frontend && npx vitest run src/utils/timeAgo.test.ts src/services/notificationService.test.ts`
Expected: 11 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/notification.types.ts frontend/src/services/notificationService.ts frontend/src/services/practiceMailboxService.ts frontend/src/store/notificationStore.ts frontend/src/utils/timeAgo.ts frontend/src/utils/timeAgo.test.ts frontend/src/services/notificationService.test.ts
git commit -F - <<'EOF'
feat(web): notification types, services, unread-count store and "time ago"

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 9: Website: the bell and the notifications page

**Files:**
- Create: `frontend/src/components/notifications/NotificationItem.tsx`, `NotificationBell.tsx`, `Notifications.css`
- Create: `frontend/src/pages/NotificationsPage.tsx`
- Modify: `frontend/src/components/layout/Navbar.tsx`, `frontend/src/components/layout/Navbar.css`, `frontend/src/App.tsx`
- Test: `frontend/src/components/notifications/NotificationBell.test.tsx`

**Interfaces:**
- Consumes: `fetchNotifications`, `fetchUnreadCount`, `markAllNotificationsRead`, `useNotificationStore`, `timeAgo`, `AppNotification` (Task 8).
- Produces: `<NotificationBell />` (signed-in users, in the navbar), `<NotificationItem notification onOpen? />`, route `/notifications`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/notifications/NotificationBell.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from '../../services/notificationService'
import { useNotificationStore } from '../../store/notificationStore'
import type { AppNotification } from '../../types/notification.types'
import NotificationBell from './NotificationBell'

// The bell talks to the API through these calls; replace them so no network is needed.
vi.mock('../../services/notificationService', () => ({
  fetchUnreadCount: vi.fn(),
  fetchNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))
const unreadCount = vi.mocked(fetchUnreadCount)
const latest = vi.mocked(fetchNotifications)
const markAllRead = vi.mocked(markAllNotificationsRead)

const confirmed: AppNotification = {
  id: 'n1',
  kind: 'ORDER_CONFIRMED',
  title: "Abuela's Table confirmed your order",
  body: 'NK-7QX4PD · Tue, Sep 29 at 6:00 PM',
  link: '/orders/o1',
  createdAt: new Date().toISOString(),
  read: false,
}

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useNotificationStore.setState({ unreadCount: 0 })
  markAllRead.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('NotificationBell', () => {
  it('shows how many notifications are unread', async () => {
    unreadCount.mockResolvedValue(3)

    renderBell()

    await screen.findByRole('button', { name: 'Notifications, 3 unread' })
  })

  it('opens the latest notifications and marks them read', async () => {
    unreadCount.mockResolvedValue(1)
    latest.mockResolvedValue({ notifications: [confirmed], unreadCount: 1 })
    renderBell()

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))

    await screen.findByText("Abuela's Table confirmed your order")
    expect(latest).toHaveBeenCalledWith(8)
    await waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1))
    await screen.findByRole('button', { name: 'Notifications' })
    expect(screen.getByRole('link', { name: /Abuela's Table confirmed your order/ }).getAttribute('href')).toBe('/orders/o1')
  })

  it('does not mark anything read when nothing is new', async () => {
    unreadCount.mockResolvedValue(0)
    latest.mockResolvedValue({ notifications: [{ ...confirmed, read: true }], unreadCount: 0 })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    await screen.findByText("Abuela's Table confirmed your order")
    expect(markAllRead).not.toHaveBeenCalled()
  })

  it('says when there is nothing yet', async () => {
    unreadCount.mockResolvedValue(0)
    latest.mockResolvedValue({ notifications: [], unreadCount: 0 })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    await screen.findByText("Nothing yet. We'll let you know when something happens.")
  })

  it('closes with the Escape key', async () => {
    unreadCount.mockResolvedValue(0)
    latest.mockResolvedValue({ notifications: [confirmed], unreadCount: 0 })
    renderBell()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    await screen.findByText("Abuela's Table confirmed your order")

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText("Abuela's Table confirmed your order")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd frontend && npx vitest run src/components/notifications/NotificationBell.test.tsx`
Expected: FAIL, `./NotificationBell` cannot be resolved.

- [ ] **Step 3: Write the notification item and the bell**

Create `frontend/src/components/notifications/NotificationItem.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { AppNotification } from '../../types/notification.types'
import { timeAgo } from '../../utils/timeAgo'

interface NotificationItemProps {
  notification: AppNotification
  /** Called when the item is opened, e.g. to close the bell's drop-down. */
  onOpen?: () => void
}

/** One update, in the bell or on the notifications page. Unread ones stand out. */
export default function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  return (
    <Link
      to={notification.link}
      className={`notification-item${notification.read ? '' : ' notification-item--unread'}`}
      onClick={onOpen}
    >
      <span className="notification-item-title">
        {!notification.read && <span className="visually-hidden">New: </span>}
        {notification.title}
      </span>
      {notification.body && <span className="notification-item-body">{notification.body}</span>}
      <span className="notification-item-time">{timeAgo(notification.createdAt)}</span>
    </Link>
  )
}
```

Create `frontend/src/components/notifications/NotificationBell.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from '../../services/notificationService'
import { useNotificationStore } from '../../store/notificationStore'
import type { AppNotification } from '../../types/notification.types'
import { getApiError } from '../../utils/apiError'
import NotificationItem from './NotificationItem'
import './Notifications.css'

const CHECK_EVERY_MS = 60_000
const PANEL_SIZE = 8

/** The bell in the menu bar: how many updates are unread, and the latest ones in a drop-down. */
export default function NotificationBell() {
  const { pathname } = useLocation()
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Check for news whenever the page changes, and once a minute.
  useEffect(() => {
    let cancelled = false
    const check = () => {
      fetchUnreadCount().then(
        (count) => {
          if (!cancelled) setUnreadCount(count)
        },
        () => {}, // try again at the next check
      )
    }
    check()
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pathname, setUnreadCount])

  // Escape or a click outside closes the drop-down.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open])

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setItems(null)
    setError(null)
    try {
      const list = await fetchNotifications(PANEL_SIZE)
      setItems(list.notifications)
      if (list.unreadCount > 0) {
        await markAllNotificationsRead()
        setUnreadCount(0)
      }
    } catch (loadError) {
      setError(getApiError(loadError).message)
    }
  }

  return (
    <div className="bell" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className="bell-button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls="bell-panel"
        onClick={toggle}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="bell-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div id="bell-panel" className="bell-panel" role="region" aria-label="Latest notifications">
          <p className="bell-panel-title">Notifications</p>
          {error ? (
            <p className="bell-panel-message" role="alert">{error}</p>
          ) : items === null ? (
            <p className="bell-panel-message">Loading...</p>
          ) : items.length === 0 ? (
            <p className="bell-panel-message">Nothing yet. We&apos;ll let you know when something happens.</p>
          ) : (
            <ul className="notification-list">
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationItem notification={item} onOpen={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className="bell-panel-all" onClick={() => setOpen(false)}>
            See all
          </Link>
        </div>
      )}
    </div>
  )
}
```

Create `frontend/src/components/notifications/Notifications.css`:

```css
/* The bell in the menu bar */
.bell {
  position: relative;
  order: 2; /* after the menu links on wide screens, next to the menu button on phones */
}

.bell-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.navbar--solid .bell-button {
  color: var(--color-text-muted);
}

.navbar--solid .bell-button:hover {
  color: var(--color-brand-strong);
}

.navbar--transparent .bell-button:hover {
  opacity: 0.8;
}

.bell-button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.bell-count {
  position: absolute;
  top: 4px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-danger);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}

.bell-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 360px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  color: var(--color-text);
}

.bell-panel-title {
  margin: 0 0 0.5rem;
  font-weight: 700;
}

.bell-panel-message {
  margin: 0.5rem 0;
  color: var(--color-text-muted);
}

.bell-panel-all {
  display: block;
  margin-top: 0.5rem;
  text-align: center;
  font-weight: 600;
  color: var(--color-brand-strong);
}

/* Lists of notifications, in the bell and on the notifications page */
.notification-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.notification-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--color-text);
}

.notification-item:hover {
  background: var(--color-surface-muted);
}

.notification-item--unread {
  background: var(--color-brand-soft);
}

.notification-item--unread .notification-item-title {
  font-weight: 700;
}

.notification-item-body {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.notification-item-time {
  color: var(--color-text-subtle);
  font-size: 0.8rem;
}

.notifications-page {
  max-width: 720px;
}

.notifications-page .notification-list {
  margin-top: 1rem;
}

@media (max-width: 860px) {
  .bell-panel {
    position: fixed;
    top: 64px;
    left: 16px;
    right: 16px;
    width: auto;
  }
}
```

- [ ] **Step 4: Put the bell in the menu bar**

In `frontend/src/components/layout/Navbar.tsx`, add the import `import NotificationBell from '../notifications/NotificationBell'` and, between the logo's closing `</Link>` and the `nav-toggle` button:

```tsx
      {status === 'authenticated' && <NotificationBell />}
```

In `frontend/src/components/layout/Navbar.css`, add `margin-right: auto;` to the `.logo` rule (everything else then sits on the right) and `order: 3;` to the `.nav-toggle` rule (the menu button stays last, after the bell).

- [ ] **Step 5: Write the notifications page and its route**

Create `frontend/src/pages/NotificationsPage.tsx`:

```tsx
import { useEffect } from 'react'
import PageLoader from '../components/common/PageLoader'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import NotificationItem from '../components/notifications/NotificationItem'
import '../components/notifications/Notifications.css'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchNotifications, markAllNotificationsRead } from '../services/notificationService'
import { useNotificationStore } from '../store/notificationStore'

const PAGE_SIZE = 50

export default function NotificationsPage() {
  usePageTitle('Notifications')
  const list = useAsyncData('notifications', () => fetchNotifications(PAGE_SIZE))
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount)
  const hasUnread = (list.data?.unreadCount ?? 0) > 0

  // Everything on this page counts as seen.
  useEffect(() => {
    if (!hasUnread) return
    markAllNotificationsRead().then(
      () => setUnreadCount(0),
      () => {}, // the bell will still show them; nothing else to do
    )
  }, [hasUnread, setUnreadCount])

  if (list.status === 'error' && !list.data) {
    return (
      <div className="container">
        <ErrorState message={list.error ?? ''} onRetry={list.retry} />
      </div>
    )
  }
  if (!list.data) return <PageLoader label="Loading your notifications" />

  return (
    <div className="container notifications-page">
      <h1>Notifications</h1>
      {list.data.notifications.length === 0 ? (
        <EmptyState title="Nothing yet" text="We'll let you know here when something happens with your orders, reviews or dish requests." />
      ) : (
        <ul className="notification-list">
          {list.data.notifications.map((item) => (
            <li key={item.id}>
              <NotificationItem notification={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

In `frontend/src/App.tsx`, add `import NotificationsPage from './pages/NotificationsPage'` and, after the `/orders/:id` route:

```tsx
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
```

- [ ] **Step 6: Run the tests, lint and build**

Run: `cd frontend && npx vitest run src/components/notifications/NotificationBell.test.tsx && npm run lint && npm run build`
Expected: 5 tests pass; lint and build succeed.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/notifications frontend/src/pages/NotificationsPage.tsx frontend/src/components/layout/Navbar.tsx frontend/src/components/layout/Navbar.css frontend/src/App.tsx
git commit -F - <<'EOF'
feat(web): notification bell in the menu bar and a notifications page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 10: Website: practice mailbox page

**Files:**
- Create: `frontend/src/utils/practiceMailbox.ts`, `frontend/src/pages/dev/PracticeMailboxPage.tsx`, `frontend/src/pages/dev/PracticeMailbox.css`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/layout/Footer.tsx`, `frontend/src/components/layout/Footer.css`
- Test: `frontend/src/utils/practiceMailbox.test.ts`

**Interfaces:**
- Consumes: `fetchPracticeEmails`, `fetchPracticeEmail`, `PracticeEmail`, `timeAgo` (Task 8).
- Produces: `withLinksInNewTab(html: string): string`; route `/dev/mailbox` (development builds only).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/practiceMailbox.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { withLinksInNewTab } from './practiceMailbox'

describe('withLinksInNewTab', () => {
  it('makes the links in an email preview open in a new tab', () => {
    expect(withLinksInNewTab('<html><head><title>Hi</title></head><body><a href="x">x</a></body></html>')).toBe(
      '<html><head><base target="_blank"><title>Hi</title></head><body><a href="x">x</a></body></html>',
    )
  })

  it('works for an email without a head', () => {
    expect(withLinksInNewTab('<p>Hi</p>')).toBe('<base target="_blank"><p>Hi</p>')
  })
})
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `cd frontend && npx vitest run src/utils/practiceMailbox.test.ts`
Expected: FAIL, `./practiceMailbox` cannot be resolved.

- [ ] **Step 3: Write the helper**

Create `frontend/src/utils/practiceMailbox.ts`:

```ts
const NEW_TAB = '<base target="_blank">'

/** Makes the links inside an email preview open in a new tab instead of inside the preview frame. */
export function withLinksInNewTab(html: string): string {
  return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${NEW_TAB}`) : `${NEW_TAB}${html}`
}
```

- [ ] **Step 4: Run the test to watch it pass**

Run: `cd frontend && npx vitest run src/utils/practiceMailbox.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Write the page, its route and the footer link**

Create `frontend/src/pages/dev/PracticeMailboxPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import PageLoader from '../../components/common/PageLoader'
import { EmptyState, ErrorState } from '../../components/common/StatusStates'
import { useAsyncData } from '../../hooks/useAsyncData'
import { usePageTitle } from '../../hooks/usePageTitle'
import { fetchPracticeEmail, fetchPracticeEmails } from '../../services/practiceMailboxService'
import type { PracticeEmailStatus } from '../../types/notification.types'
import { withLinksInNewTab } from '../../utils/practiceMailbox'
import { timeAgo } from '../../utils/timeAgo'
import './PracticeMailbox.css'

const CHECK_EVERY_MS = 5_000

const STATUS_WORDS: Record<PracticeEmailStatus, string> = {
  PENDING: 'Waiting to send',
  SENDING: 'Sending',
  SENT: 'Sent',
  FAILED: 'Failed',
}

/** Development only: every email the app has written, shown as it would look. Nothing leaves this computer. */
export default function PracticeMailboxPage() {
  usePageTitle('Practice mailbox')
  const emails = useAsyncData('practice-emails', fetchPracticeEmails)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { retry } = emails

  // New emails show up within a few seconds.
  useEffect(() => {
    const timer = window.setInterval(retry, CHECK_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [retry])

  if (emails.status === 'error' && !emails.data) {
    return (
      <div className="container">
        <ErrorState message={emails.error ?? ''} onRetry={retry} />
      </div>
    )
  }
  if (!emails.data) return <PageLoader label="Loading the practice mailbox" />

  const current = emails.data.find((email) => email.id === selectedId) ?? emails.data[0]

  return (
    <div className="container practice-mailbox">
      <header className="practice-mailbox-header">
        <h1>Practice mailbox</h1>
        <p className="card-text">
          Every email the app sends while we build it lands here, newest first. Nothing leaves this computer, and this page does not exist on the live site.
        </p>
      </header>

      {emails.data.length === 0 ? (
        <EmptyState title="No emails yet" text="Place an order or ask for a password reset, and the emails show up here within a few seconds." />
      ) : (
        <div className="practice-mailbox-layout">
          <ul className="practice-mailbox-list">
            {emails.data.map((email) => (
              <li key={email.id}>
                <button
                  type="button"
                  className={`practice-mailbox-item${email.id === current?.id ? ' is-selected' : ''}`}
                  aria-pressed={email.id === current?.id}
                  onClick={() => setSelectedId(email.id)}
                >
                  <span className="practice-mailbox-subject">{email.subject ?? `${email.kind} (being written)`}</span>
                  <span className="practice-mailbox-meta">
                    To {email.to} · {timeAgo(email.createdAt)}
                  </span>
                  {email.status !== 'SENT' && (
                    <span className={`practice-mailbox-status practice-mailbox-status--${email.status.toLowerCase()}`}>
                      {STATUS_WORDS[email.status]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {/* Loads again when the email's status changes, e.g. once it has been written. */}
          {current && <EmailPreview key={`${current.id}:${current.status}`} id={current.id} />}
        </div>
      )}
    </div>
  )
}

function EmailPreview({ id }: { id: string }) {
  const email = useAsyncData(`practice-email:${id}`, () => fetchPracticeEmail(id))
  const [view, setView] = useState<'email' | 'text'>('email')

  if (email.status === 'error' && !email.data) return <ErrorState message={email.error ?? ''} onRetry={email.retry} />
  if (!email.data) return <PageLoader label="Loading the email" />
  const { data } = email

  return (
    <section className="card practice-mailbox-preview" aria-label="Email preview">
      <p className="practice-mailbox-preview-subject">{data.subject ?? 'Not written yet'}</p>
      <p className="card-text">To {data.to}</p>
      {data.lastError && <div className="alert alert-error" role="alert">{data.lastError}</div>}
      <div className="practice-mailbox-tabs" role="group" aria-label="Show the email as">
        <button type="button" className={`btn btn-small ${view === 'email' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={view === 'email'} onClick={() => setView('email')}>
          Email
        </button>
        <button type="button" className={`btn btn-small ${view === 'text' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={view === 'text'} onClick={() => setView('text')}>
          Plain text
        </button>
      </div>
      {view === 'email' ? (
        data.html ? (
          <iframe
            className="practice-mailbox-frame"
            title={`Email: ${data.subject ?? data.kind}`}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={withLinksInNewTab(data.html)}
          />
        ) : (
          <p className="card-text">This email has not been written yet. It will appear in a few seconds.</p>
        )
      ) : (
        <pre className="practice-mailbox-text">{data.text ?? 'Not written yet.'}</pre>
      )}
    </section>
  )
}
```

Create `frontend/src/pages/dev/PracticeMailbox.css`:

```css
.practice-mailbox-header {
  margin-bottom: 1.5rem;
}

.practice-mailbox-layout {
  display: grid;
  grid-template-columns: minmax(240px, 320px) 1fr;
  gap: 1.5rem;
  align-items: start;
}

.practice-mailbox-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.practice-mailbox-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  width: 100%;
  padding: 0.75rem;
  text-align: left;
  font: inherit;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.practice-mailbox-item:hover {
  border-color: var(--color-brand);
}

.practice-mailbox-item.is-selected {
  border-color: var(--color-brand-strong);
  background: var(--color-brand-soft);
}

.practice-mailbox-subject {
  font-weight: 600;
}

.practice-mailbox-meta {
  font-size: 0.85rem;
  color: var(--color-text-subtle);
}

.practice-mailbox-status {
  align-self: flex-start;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.practice-mailbox-status--failed {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.practice-mailbox-preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.practice-mailbox-preview-subject {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.practice-mailbox-tabs {
  display: flex;
  gap: 0.5rem;
}

.practice-mailbox-frame {
  width: 100%;
  height: 640px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: white;
}

.practice-mailbox-text {
  margin: 0;
  padding: 1rem;
  white-space: pre-wrap;
  font-size: 0.9rem;
  background: var(--color-surface-muted);
  border-radius: var(--radius-sm);
}

@media (max-width: 860px) {
  .practice-mailbox-layout {
    grid-template-columns: 1fr;
  }
}
```

In `frontend/src/App.tsx`:
1. Change the React import to `import { lazy, Suspense, useEffect } from 'react'` and add `import PageLoader from './components/common/PageLoader'`.
2. Add below the imports:

```tsx
// Development only: this route and its page are left out of the live site's bundle.
const PracticeMailboxPage = import.meta.env.DEV ? lazy(() => import('./pages/dev/PracticeMailboxPage')) : null
```

3. Add before the `path="*"` route:

```tsx
          {PracticeMailboxPage && (
            <Route
              path="/dev/mailbox"
              element={
                <Suspense fallback={<PageLoader label="Loading the practice mailbox" />}>
                  <PracticeMailboxPage />
                </Suspense>
              }
            />
          )}
```

In `frontend/src/components/layout/Footer.tsx`, add inside `footer-bottom`, after the copyright paragraph:

```tsx
        {import.meta.env.DEV && (
          <p className="footer-dev">
            <Link to="/dev/mailbox">Practice mailbox</Link> (development only)
          </p>
        )}
```

and in `frontend/src/components/layout/Footer.css`:

```css
.footer-dev {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.footer-dev a {
  text-decoration: underline;
}
```

- [ ] **Step 6: Check that the live-site bundle leaves the page out**

Run: `cd frontend && npm run lint && npm run build && ! grep -rl "Practice mailbox" dist/assets`
Expected: lint and build succeed, and the final `grep` finds no file (the command exits 0 only when no built file contains the page's text).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/practiceMailbox.ts frontend/src/utils/practiceMailbox.test.ts frontend/src/pages/dev frontend/src/App.tsx frontend/src/components/layout/Footer.tsx frontend/src/components/layout/Footer.css
git commit -F - <<'EOF'
feat(web): practice mailbox page for reading every email during development

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 11: Part 1 check-in: docs, full verification, browser check, push

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: Update the README**

In `README.md`:
1. In the Project Status table, change the Phase 7 status cell to `🚧 Map done, notifications in progress`.
2. In "Available now", add after the `/api/v1/chefs/me/suggestions/:id` row:

```markdown
| GET | `/api/v1/notifications?limit=20` | The signed-in person's notifications, newest first (up to 50), and how many are unread |
| GET | `/api/v1/notifications/unread-count` | Just the unread count (the bell checks it every minute) |
| POST | `/api/v1/notifications/read-all` | Mark all of your notifications read |
| GET | `/api/v1/dev/emails`, `/api/v1/dev/emails/:id` | Practice mailbox: every email the app has written (development only, never on the live site) |
```

3. Replace the "Coming in later phases" line with: `Payments (Phase 5). At launch (Phase 8) a real email service replaces the practice mailbox.`
4. In "Website pages", add the rows `| Notifications | /notifications |` and `| Practice mailbox (development only) | /dev/mailbox |` (with the addresses in backticks, like the other rows).
5. After the "How location works" paragraph, add:

```markdown
**How notifications work (Phase 7b):** a bell in the menu bar shows what happened, with a count of unread items; opening it marks them read, and "See all" (`/notifications`) keeps the history. Chefs hear about new orders and customer cancellations; customers get an emailed receipt and hear when their order is confirmed, being cooked, ready, or declined or cancelled. The important updates are also emailed. Each notice is saved together with the change that caused it, and a helper inside the API server writes and sends emails every few seconds, trying again after 1, 5, 30 and 120 minutes if sending fails. Until launch nothing is really sent: every email lands in the practice mailbox at http://localhost:3000/dev/mailbox. Emails never include street addresses or phone numbers.
```

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`:
1. Set both "Last Updated" dates to 2026-09-27 and the Repository Status line to: `Phases 1-4 and 6 complete, Phase 7 map done and notifications in progress; Phase 5 waits for Stripe test keys (see "Build Plan" below)`.
2. In the Build Plan list, change item 7 to `Map of nearby chefs (done), notifications: bell and email (in progress)`.
3. In "Current State", add `jobs/` to the backend `src/` list and `notifications` to the frontend components list.
4. In "Environment Variables", add `GEOCODER`, `EMAIL_TRANSPORT`, `EMAIL_FROM` and `JOBS_INTERVAL_MS` to the "Currently used" list.
5. Add this bullet at the end of "Key conventions already in place":

```markdown
- Notifications (`services/notifications/`): every bell item and email is created by `notify(tx, recipient, kind, data)` inside the transaction of the change it describes (load recipients with `recipientSelect`; order data with `orderNoticeData` / `orderParties`). `kinds.ts` holds each kind's rules (bell, email, which user switch turns the email off) and data type; `bellText.ts` and `emailTemplates.ts` hold the wording (user text is HTML-escaped; emails never contain street addresses, phone numbers or, for customers, the platform fee; copy never guesses pronouns). Emails are rows in `emails`, written and sent by `deliverDueEmails`, which `jobs/backgroundJobs.ts` runs every `JOBS_INTERVAL_MS` (started only from `index.ts`, never in tests); failed sends retry after 1, 5, 30 and 120 minutes. `EMAIL_TRANSPORT=mailbox` sends nothing; the practice mailbox (`/api/v1/dev/emails`, page `/dev/mailbox`) exists only outside production. Backend tests read notices with `tests/notificationHelpers.ts` (`bellFor`, `emailsFor`).
```

- [ ] **Step 3: Run the full verification**

Run, from the repo root:

```bash
npm test
cd backend && npx tsc --noEmit -p . && cd ../frontend && npm run lint && npm run build
```

Expected: every backend and frontend test passes (report the counts), tsc prints nothing, lint and build succeed. Any failure, including one not caused by this work, gets reported by name.

- [ ] **Step 4: Try it in the browser**

1. `cd backend && npm run db:seed`, then restart the preview server (preview_stop, then preview_start `neighbors-kitchen`).
2. Log in with **Customer demo** (Chris). Open Abuela's Table, add the Chicken Enchilada Casserole, check out for pickup at the first time offered.
3. Open `/dev/mailbox`. Within about 5 seconds: "Your order NK-… was sent to Abuela's Table" (to `customer@neighborskitchen.test`) and "New order NK-… from Chris W." (to `maria@neighborskitchen.test`). Open each: the preview shows the purple header, the details and the button; "Plain text" shows the text version. Take a screenshot.
4. Log out and log in with **Chef demo** (Maria). The bell shows 1. Open it: "New order from Chris W.". Follow it to `/chef/orders` and press **Confirm order**.
5. Log out and log in as Chris. The bell shows 1: "Abuela's Table confirmed your order". Open **See all**. Take a screenshot of the bell's drop-down.
6. Check the browser console for errors. Switch to the mobile preset: the bell sits next to the menu button and its drop-down fits the screen. Switch back to desktop.
7. `cd backend && npm run db:seed` to restore the demo data.

- [ ] **Step 5: Commit the docs and push**

```bash
git add README.md CLAUDE.md
git commit -F - <<'EOF'
docs: phase 7b part 1 - notification bell, order emails and the practice mailbox

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push origin claude/neighbors-kitchen-chat-dk4r07
```

---

# Part 2: Reviews, dish requests, reminders and email settings

At the end of Part 2: chefs hear about new reviews and dish requests, customers hear chef answers (voters hear a yes), completed orders get a rate-your-meal reminder, people can switch off the optional emails, and the demo accounts start with a few bell items.

### Task 12: New review and new dish request notices

**Files:**
- Modify: `backend/src/services/reviewService.ts`, `backend/src/services/suggestionService.ts`
- Test: `backend/tests/feedbackNotifications.test.ts`

**Interfaces:**
- Consumes: `notify`, `recipientSelect` (Task 3); `kitchenTitle`, `chefDisplayName` (`catalogShared.ts`).
- Produces: `NEW_REVIEW` notices from `createReview`; `NEW_DISH_REQUEST` notices from `createSuggestion` (which now runs in a transaction). `findVisibleChef` also selects `kitchenName` and the owner's `firstName`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/feedbackNotifications.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, completedOrder, type Kitchen, openKitchen, signUp } from './helpers.js';
import { bellFor, emailsFor } from './notificationHelpers.js';

const app = createApp();

type Person = { userId: string; accessToken: string };

// Test chefs are Sam Rivera of "Sam's Kitchen"; the customer is Dana Kim.
const signUpDana = () => signUp(app, 'CUSTOMER', { firstName: 'Dana', lastName: 'Kim' });

const birria = { mealName: 'Birria tacos', description: 'Slow-cooked beef birria with consommé for dipping, please!' };

function review(customer: Person, orderId: string, mealId: string) {
  return request(app).post(`${API}/reviews`).set(bearer(customer.accessToken)).send({ orderId, mealId, rating: 5, comment: 'Tasted like home.' });
}

function requestDish(person: Person, chefId: string) {
  return request(app).post(`${API}/chefs/${chefId}/suggestions`).set(bearer(person.accessToken)).send(birria);
}

async function newRequest(kitchen: Kitchen, asker: Person) {
  const res = await requestDish(asker, kitchen.chefId);
  expect(res.status).toBe(201);
  return res.body.data.suggestion.id as string;
}

function answer(kitchen: Kitchen, suggestionId: string, status: string, chefResponse: string | null = null) {
  return request(app).put(`${API}/chefs/me/suggestions/${suggestionId}`).set(bearer(kitchen.accessToken)).send({ status, chefResponse });
}

function vote(person: Person, suggestionId: string) {
  return request(app).post(`${API}/suggestions/${suggestionId}/vote`).set(bearer(person.accessToken));
}

const kinds = (rows: { kind: string }[]) => rows.map((row) => row.kind);

describe('New reviews', () => {
  it('ring the chef\'s bell and email the chef', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const orderId = await completedOrder(kitchen, customer.accessToken);

    expect((await review(customer, orderId, kitchen.mealId)).status).toBe(201);

    expect((await bellFor(kitchen.userId)).filter((notice) => notice.kind === 'NEW_REVIEW')).toEqual([
      { kind: 'NEW_REVIEW', title: 'New 5-star review for Tamales', body: 'Tasted like home.', link: '/chef/feedback' },
    ]);
    const [email] = (await emailsFor(kitchen.userId)).filter((row) => row.kind === 'NEW_REVIEW');
    expect(email.data).toMatchObject({ mealName: 'Tamales', rating: 5, comment: 'Tasted like home.', customerName: 'Dana K.' });
  });

  it("still ring the bell when the chef turned those emails off", async () => {
    const kitchen = await openKitchen();
    await prisma.user.update({ where: { id: kitchen.userId }, data: { emailKitchenFeedback: false } });
    const customer = await signUpDana();
    const orderId = await completedOrder(kitchen, customer.accessToken);

    await review(customer, orderId, kitchen.mealId);

    expect(kinds(await bellFor(kitchen.userId))).toContain('NEW_REVIEW');
    expect(kinds(await emailsFor(kitchen.userId))).not.toContain('NEW_REVIEW');
  });
});

describe('New dish requests', () => {
  it('ring the chef\'s bell and email the request to the chef', async () => {
    const kitchen = await openKitchen();
    const asker = await signUpDana();

    await newRequest(kitchen, asker);

    expect(await bellFor(kitchen.userId)).toEqual([
      { kind: 'NEW_DISH_REQUEST', title: 'New dish request: Birria tacos', body: 'From Dana K.', link: '/chef/feedback' },
    ]);
    const [email] = await emailsFor(kitchen.userId);
    expect(email).toMatchObject({
      kind: 'NEW_DISH_REQUEST',
      data: { kitchenName: "Sam's Kitchen", mealName: 'Birria tacos', description: birria.description, status: 'PENDING', requesterName: 'Dana K.' },
    });
  });

  it('create nothing when the request is refused', async () => {
    const kitchen = await openKitchen();

    expect((await requestDish(kitchen, kitchen.chefId)).status).toBe(409);

    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.email.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/feedbackNotifications.test.ts`
Expected: the review and new-request tests FAIL (no `NEW_REVIEW` / `NEW_DISH_REQUEST` rows); "create nothing when the request is refused" passes already (it guards against notices from refused requests).

- [ ] **Step 3: Notify the chef about new reviews**

In `backend/src/services/reviewService.ts`, add the import `import { notify, recipientSelect } from './notifications/notify.js';` and, in `createReview`, replace

```ts
      await refreshRatings(tx, input.mealId, order.chefId);
      return created;
    });
```

with:

```ts
      await refreshRatings(tx, input.mealId, order.chefId);
      const { user: chef } = await tx.chefProfile.findUniqueOrThrow({
        where: { id: order.chefId },
        select: { user: { select: recipientSelect } },
      });
      await notify(tx, chef, 'NEW_REVIEW', {
        reviewId: created.id,
        chefId: order.chefId,
        mealName: created.meal.name,
        rating: created.rating,
        comment: created.comment,
        customerName: chefDisplayName(created.customer),
      });
      return created;
    });
```

- [ ] **Step 4: Notify the chef about new dish requests**

In `backend/src/services/suggestionService.ts`:
1. Change the catalog import to `import { chefDisplayName, kitchenTitle, visibleChefWhere } from './catalogShared.js';` and add `import { notify, recipientSelect } from './notifications/notify.js';`.
2. In `findVisibleChef`, change the `select` to `{ id: true, userId: true, kitchenName: true, user: { select: { firstName: true } } }`.
3. In `createSuggestion`, replace everything from `  const suggestion = await prisma.suggestion.create({` to the end of the function with:

```ts
  const suggestion = await prisma.$transaction(async (tx) => {
    const created = await tx.suggestion.create({
      data: {
        chefId: chef.id,
        customerId: userId,
        mealName: input.mealName,
        description: input.description,
        dietaryRequirements: input.dietaryRequirements,
        votes: 1,
        voters: { create: { userId } },
      },
      select: suggestionSelect(userId),
    });
    const chefUser = await tx.user.findUniqueOrThrow({ where: { id: chef.userId }, select: recipientSelect });
    await notify(tx, chefUser, 'NEW_DISH_REQUEST', {
      suggestionId: created.id,
      chefId: chef.id,
      kitchenName: kitchenTitle(chef),
      mealName: created.mealName,
      description: created.description,
      status: created.status,
      reply: null,
      requesterName: chefDisplayName(created.customer),
    });
    return created;
  });
  return toSuggestion(suggestion);
}
```

- [ ] **Step 5: Run the tests to watch them pass, plus the existing feedback tests**

Run: `cd backend && npx vitest run tests/feedbackNotifications.test.ts tests/reviews.test.ts tests/suggestions.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/reviewService.ts backend/src/services/suggestionService.ts backend/tests/feedbackNotifications.test.ts
git commit -F - <<'EOF'
feat(api): tell chefs about new reviews and dish requests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 13: Dish request answers

**Files:**
- Modify: `backend/src/services/suggestionService.ts`
- Test: `backend/tests/feedbackNotifications.test.ts`

**Interfaces:**
- Consumes: `notify`, `recipientSelect`; `kitchenTitle`, `chefDisplayName`.
- Produces: `updateSuggestion` sends `DISH_REQUEST_ANSWERED` to the asker when the status or reply changes, and `DISH_REQUEST_ACCEPTED` to every voter except the asker when the status changes to `ACCEPTED`. Another chef's request is still a 404.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/feedbackNotifications.test.ts`:

```ts
describe('Chef answers to dish requests', () => {
  it('tell the person who asked', async () => {
    const kitchen = await openKitchen();
    const asker = await signUpDana();
    const id = await newRequest(kitchen, asker);

    expect((await answer(kitchen, id, 'CONSIDERING', 'Testing it this month')).status).toBe(200);

    expect(await bellFor(asker.userId)).toEqual([
      {
        kind: 'DISH_REQUEST_ANSWERED',
        title: "Sam's Kitchen answered your dish request",
        body: 'Birria tacos: Chef is considering it',
        link: `/chefs/${kitchen.chefId}#requests-heading`,
      },
    ]);
    const [email] = await emailsFor(asker.userId);
    expect(email).toMatchObject({ kind: 'DISH_REQUEST_ANSWERED', data: { status: 'CONSIDERING', reply: 'Testing it this month' } });
  });

  it('say nothing new when the same answer is saved again, but do when the reply changes', async () => {
    const kitchen = await openKitchen();
    const asker = await signUpDana();
    const id = await newRequest(kitchen, asker);

    await answer(kitchen, id, 'CONSIDERING', 'Testing it');
    await answer(kitchen, id, 'CONSIDERING', 'Testing it');
    expect(await bellFor(asker.userId)).toHaveLength(1);

    await answer(kitchen, id, 'CONSIDERING', 'Almost ready!');
    expect(await bellFor(asker.userId)).toHaveLength(2);
  });

  it('tell everyone who voted when the chef says yes, and the asker only once', async () => {
    const kitchen = await openKitchen();
    const asker = await signUpDana();
    const fan = await signUp(app);
    const otherFan = await signUp(app);
    const id = await newRequest(kitchen, asker);
    await vote(fan, id);
    await vote(otherFan, id);

    expect((await answer(kitchen, id, 'ACCEPTED', 'Coming next Saturday!')).status).toBe(200);

    for (const person of [fan, otherFan]) {
      expect(await bellFor(person.userId)).toEqual([
        {
          kind: 'DISH_REQUEST_ACCEPTED',
          title: "Good news: Sam's Kitchen will make Birria tacos",
          body: 'You voted for this dish',
          link: `/chefs/${kitchen.chefId}#requests-heading`,
        },
      ]);
      expect(kinds(await emailsFor(person.userId))).toEqual(['DISH_REQUEST_ACCEPTED']);
    }
    expect(kinds(await bellFor(asker.userId))).toEqual(['DISH_REQUEST_ANSWERED']);
  });

  it('tell voters only when the request first becomes a yes', async () => {
    const kitchen = await openKitchen();
    const asker = await signUpDana();
    const fan = await signUp(app);
    const id = await newRequest(kitchen, asker);
    await vote(fan, id);

    await answer(kitchen, id, 'ACCEPTED', 'Coming soon');
    await answer(kitchen, id, 'ACCEPTED', 'Coming next Saturday!');

    expect(await bellFor(fan.userId)).toHaveLength(1);
    expect(await bellFor(asker.userId)).toHaveLength(2);
  });

  it('do not tell voters about a no', async () => {
    const kitchen = await openKitchen();
    const asker = await signUpDana();
    const fan = await signUp(app);
    const id = await newRequest(kitchen, asker);
    await vote(fan, id);

    await answer(kitchen, id, 'DECLINED', 'Cannot get the chiles');

    expect(await bellFor(fan.userId)).toEqual([]);
    expect(kinds(await bellFor(asker.userId))).toEqual(['DISH_REQUEST_ANSWERED']);
  });

  it("keep another chef's requests out of reach", async () => {
    const kitchen = await openKitchen();
    const otherKitchen = await openKitchen();
    const asker = await signUpDana();
    const id = await newRequest(kitchen, asker);

    expect((await answer(otherKitchen, id, 'ACCEPTED')).status).toBe(404);
    expect(await bellFor(asker.userId)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/feedbackNotifications.test.ts`
Expected: the new answer tests FAIL (no `DISH_REQUEST_*` rows); the 404 test passes already.

- [ ] **Step 3: Rewrite `updateSuggestion`**

In `backend/src/services/suggestionService.ts`, replace `updateSuggestion` with:

```ts
/**
 * The chef's answer to a request. The person who asked hears about any change of status or reply;
 * everyone else who voted for the dish hears only when it first becomes a yes.
 */
export async function updateSuggestion(userId: string, suggestionId: string, input: SuggestionUpdateInput) {
  const chef = await requireOwnKitchen(userId);
  return prisma.$transaction(async (tx) => {
    const before = await tx.suggestion.findFirst({
      where: { id: suggestionId, chefId: chef.id },
      select: { status: true, chefResponse: true, mealName: true, description: true, customerId: true, customer: { select: { firstName: true, lastName: true } } },
    });
    if (!before) throw notFound();
    const after = await tx.suggestion.update({
      where: { id: suggestionId },
      data: { status: input.status, chefResponse: input.chefResponse },
      select: suggestionSelect(userId),
    });

    const statusChanged = before.status !== input.status;
    if (statusChanged || before.chefResponse !== input.chefResponse) {
      const owner = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true } });
      const notice = {
        suggestionId,
        chefId: chef.id,
        kitchenName: kitchenTitle({ kitchenName: chef.kitchenName, user: owner }),
        mealName: before.mealName,
        description: before.description,
        status: input.status,
        reply: input.chefResponse,
        requesterName: chefDisplayName(before.customer),
      };
      const asker = await tx.user.findUniqueOrThrow({ where: { id: before.customerId }, select: recipientSelect });
      await notify(tx, asker, 'DISH_REQUEST_ANSWERED', notice);

      if (statusChanged && input.status === 'ACCEPTED') {
        const voters = await tx.suggestionVote.findMany({
          where: { suggestionId, userId: { not: before.customerId } },
          select: { user: { select: recipientSelect } },
        });
        for (const { user } of voters) await notify(tx, user, 'DISH_REQUEST_ACCEPTED', notice);
      }
    }
    return toSuggestion(after);
  });
}
```

- [ ] **Step 4: Run the tests to watch them pass**

Run: `cd backend && npx vitest run tests/feedbackNotifications.test.ts tests/suggestions.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/suggestionService.ts backend/tests/feedbackNotifications.test.ts
git commit -F - <<'EOF'
feat(api): tell the asker when a chef answers a dish request, and voters when it is a yes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 14: Rate-your-meal reminder

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<stamp>_rate_reminders/migration.sql` (generated)
- Modify: `backend/src/config/env.ts`, `backend/.env.example`, `backend/.env` (append one line), `backend/tests/testEnv.ts`
- Modify: `backend/src/services/orderService.ts`, `backend/src/services/reviewService.ts`, `backend/src/jobs/backgroundJobs.ts`
- Test: `backend/tests/rateReminders.test.ts`

**Interfaces:**
- Consumes: `orderNoticeData`, `orderNoticeInclude` (Task 3), `notify`, `recipientSelect`.
- Produces: `orders.rate_reminder_at`; `env.RATE_REMINDER_DELAY_MINUTES`; `sendRateReminders(now?: Date): Promise<number>` in `reviewService.ts` (returns how many reminders it sent); the helper runs it before sending emails.

- [ ] **Step 1: Add the column and the setting**

In `backend/prisma/schema.prisma`, `model Order`: add after the `completedAt` line

```prisma
  // When to remind the customer to rate the meals; cleared once handled
  rateReminderAt      DateTime?         @map("rate_reminder_at")
```

and after `@@index([chefId, scheduledFor])`:

```prisma
  @@index([status, rateReminderAt])
```

Create and apply the migration ("Creating a migration", `<name>` = `rate_reminders`). The SQL must only add the nullable `rate_reminder_at` column and its index.

In `backend/src/config/env.ts`, add after `JOBS_INTERVAL_MS`:

```ts
  // Minutes after an order is completed before the rate-your-meal reminder
  RATE_REMINDER_DELAY_MINUTES: z.coerce.number().int().min(1).default(120),
```

In `backend/.env.example`, add after the `JOBS_INTERVAL_MS=5000` line:

```bash

# Minutes after an order is completed before the rate-your-meal reminder
# (120 on the live site; 2 here so it can be tried quickly)
RATE_REMINDER_DELAY_MINUTES=2
```

Add the same setting to the owner's local `backend/.env` without printing the file (it holds secrets):

```bash
cd backend && grep -q '^RATE_REMINDER_DELAY_MINUTES=' .env || printf '\n# Try the rate-your-meal reminder quickly on this computer (120 minutes on the live site)\nRATE_REMINDER_DELAY_MINUTES=2\n' >> .env
```

In `backend/tests/testEnv.ts`, add `RATE_REMINDER_DELAY_MINUTES: '120',` after the email settings.

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/rateReminders.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { sendRateReminders } from '../src/services/reviewService.js';
import { API, bearer, completedOrder, openKitchen, signUp } from './helpers.js';
import { bellFor, emailsFor } from './notificationHelpers.js';

const app = createApp();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const threeHoursFromNow = () => new Date(Date.now() + 3 * HOUR);

async function finishedOrder() {
  const kitchen = await openKitchen();
  const customer = await signUp(app);
  const orderId = await completedOrder(kitchen, customer.accessToken);
  return { kitchen, customer, orderId };
}

const reminders = async (userId: string) => (await bellFor(userId)).filter((notice) => notice.kind === 'RATE_REMINDER');
const reminderEmails = async (userId: string) => (await emailsFor(userId)).filter((email) => email.kind === 'RATE_REMINDER');

describe('Rate-your-meal reminders', () => {
  it('are scheduled 120 minutes after the order is completed', async () => {
    const { orderId } = await finishedOrder();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    expect(order.rateReminderAt!.getTime() - order.completedAt!.getTime()).toBe(120 * MINUTE);
  });

  it('remind the customer once the time comes, when a meal is not rated yet', async () => {
    const { customer, orderId } = await finishedOrder();

    expect(await sendRateReminders(threeHoursFromNow())).toBe(1);

    expect(await reminders(customer.userId)).toEqual([
      { kind: 'RATE_REMINDER', title: "How was your meal from Sam's Kitchen?", body: 'Tap to rate your meals', link: `/orders/${orderId}` },
    ]);
    expect(await reminderEmails(customer.userId)).toHaveLength(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).rateReminderAt).toBeNull();
  });

  it('wait until they are due', async () => {
    const { customer } = await finishedOrder();

    expect(await sendRateReminders(new Date())).toBe(0);

    expect(await reminders(customer.userId)).toEqual([]);
  });

  it('are skipped when every meal is already rated', async () => {
    const { kitchen, customer, orderId } = await finishedOrder();
    await request(app).post(`${API}/reviews`).set(bearer(customer.accessToken)).send({ orderId, mealId: kitchen.mealId, rating: 4 });

    expect(await sendRateReminders(threeHoursFromNow())).toBe(0);

    expect(await reminders(customer.userId)).toEqual([]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).rateReminderAt).toBeNull();
  });

  it('come only once', async () => {
    const { customer } = await finishedOrder();

    expect(await sendRateReminders(threeHoursFromNow())).toBe(1);
    expect(await sendRateReminders(threeHoursFromNow())).toBe(0);

    expect(await reminders(customer.userId)).toHaveLength(1);
  });

  it("ring the bell but send no email when the customer turned them off", async () => {
    const { customer } = await finishedOrder();
    await prisma.user.update({ where: { id: customer.userId }, data: { emailRateReminders: false } });

    await sendRateReminders(threeHoursFromNow());

    expect(await reminders(customer.userId)).toHaveLength(1);
    expect(await reminderEmails(customer.userId)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/rateReminders.test.ts`
Expected: FAIL; `sendRateReminders` is not exported yet.

- [ ] **Step 4: Schedule the reminder when an order is completed**

In `backend/src/services/orderService.ts`, add after the imports' constants (next to `NEXT_STATUS` is fine):

```ts
const MINUTE_MS = 60 * 1000;
```

In `advanceOrderStatus`, replace

```ts
  const updated = await prisma.$transaction(async (tx) => {
    // Only succeeds if nobody else changed the order in the meantime (e.g. a double click).
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status, ...(status === 'COMPLETED' && { completedAt: new Date() }) },
    });
```

with:

```ts
  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date();
    // Only succeeds if nobody else changed the order in the meantime (e.g. a double click).
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status,
        // A completed order gets its rate-your-meal reminder a little later.
        ...(status === 'COMPLETED' && {
          completedAt: now,
          rateReminderAt: new Date(now.getTime() + env.RATE_REMINDER_DELAY_MINUTES * MINUTE_MS),
        }),
      },
    });
```

- [ ] **Step 5: Send the reminders that are due**

In `backend/src/services/reviewService.ts`, change the notify import to `import { notify, recipientSelect } from './notifications/notify.js';` (already there from Task 12) and add `import { orderNoticeData, orderNoticeInclude } from './notifications/orderNotices.js';`. Add at the end of the file:

```ts
/** Sends the rate-your-meal reminders that are due. Returns how many were sent. */
export async function sendRateReminders(now: Date = new Date()): Promise<number> {
  const due = await prisma.order.findMany({
    where: { status: 'COMPLETED', rateReminderAt: { lte: now } },
    orderBy: { rateReminderAt: 'asc' },
    take: 50,
    select: { id: true },
  });

  let sent = 0;
  for (const { id } of due) {
    const reminded = await prisma.$transaction(async (tx) => {
      // Only one helper can take the reminder. It is cleared whether or not it is sent.
      const { count } = await tx.order.updateMany({ where: { id, rateReminderAt: { lte: now } }, data: { rateReminderAt: null } });
      if (count === 0) return false;
      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { ...orderNoticeInclude, reviews: { select: { mealId: true } } },
      });
      const somethingUnrated = order.orderItems.some((item) => !order.reviews.some((rated) => rated.mealId === item.mealId));
      if (!somethingUnrated) return false;
      const customer = await tx.user.findUniqueOrThrow({ where: { id: order.customerId }, select: recipientSelect });
      await notify(tx, customer, 'RATE_REMINDER', orderNoticeData(order));
      return true;
    });
    if (reminded) sent += 1;
  }
  return sent;
}
```

In `backend/src/jobs/backgroundJobs.ts`, add the import `import { sendRateReminders } from '../services/reviewService.js';` and change the task list to:

```ts
  const tasks: BackgroundTask[] = [
    { name: 'rate reminders', run: sendRateReminders },
    { name: 'send emails', run: (now) => deliverDueEmails(now, transport) },
  ];
```

- [ ] **Step 6: Run the tests to watch them pass**

Run: `cd backend && npx vitest run tests/rateReminders.test.ts tests/orders.test.ts tests/orderNotifications.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/config/env.ts backend/.env.example backend/tests/testEnv.ts backend/src/services/orderService.ts backend/src/services/reviewService.ts backend/src/jobs/backgroundJobs.ts backend/tests/rateReminders.test.ts
git commit -F - <<'EOF'
feat(api): rate-your-meal reminder a while after an order is completed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

(`backend/.env` is git-ignored; never add it.)

### Task 15: Email settings API

**Files:**
- Create: `backend/src/validators/userSchemas.ts`
- Modify: `backend/src/services/userService.ts`, `backend/src/controllers/userController.ts`, `backend/src/routes/userRoutes.ts`
- Test: `backend/tests/emailSettings.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/users/me` includes `emailSettings: { rateReminders, dishRequestNews, kitchenFeedback }`; `PUT /api/v1/users/me/email-settings` takes any of those booleans and returns `{ data: { emailSettings } }`; an empty change or a non-boolean is a 422.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/emailSettings.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, signUp } from './helpers.js';

const app = createApp();

const save = (accessToken: string, body: Record<string, unknown>) =>
  request(app).put(`${API}/users/me/email-settings`).set(bearer(accessToken)).send(body);

describe('Email settings', () => {
  it('are all on for a new account', async () => {
    const me = await signUp(app);

    const res = await request(app).get(`${API}/users/me`).set(bearer(me.accessToken));

    expect(res.body.data.user.emailSettings).toEqual({ rateReminders: true, dishRequestNews: true, kitchenFeedback: true });
  });

  it('change only the switches sent', async () => {
    const me = await signUp(app);

    const res = await save(me.accessToken, { rateReminders: false });

    expect(res.status).toBe(200);
    expect(res.body.data.emailSettings).toEqual({ rateReminders: false, dishRequestNews: true, kitchenFeedback: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.userId } });
    expect([user.emailRateReminders, user.emailDishRequestNews, user.emailKitchenFeedback]).toEqual([false, true, true]);
  });

  it('need at least one on/off value', async () => {
    const me = await signUp(app);

    expect((await save(me.accessToken, {})).status).toBe(422);
    expect((await save(me.accessToken, { rateReminders: 'no' })).status).toBe(422);
  });

  it('require login', async () => {
    expect((await request(app).put(`${API}/users/me/email-settings`).send({ rateReminders: false })).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/emailSettings.test.ts`
Expected: FAIL; `emailSettings` is undefined and the PUT route returns 404.

- [ ] **Step 3: Write the validator, service, controller and route**

Create `backend/src/validators/userSchemas.ts`:

```ts
import { z } from 'zod';

export const emailSettingsSchema = z
  .object({ rateReminders: z.boolean(), dishRequestNews: z.boolean(), kitchenFeedback: z.boolean() })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Choose a setting to change');

export type EmailSettingsInput = z.infer<typeof emailSettingsSchema>;
```

In `backend/src/services/userService.ts`:
1. Add the import `import { EmailSettingsInput } from '../validators/userSchemas.js';`.
2. Add before `CurrentUser`:

```ts
/** The optional emails a person can turn off. Order and password emails always go out. */
export interface EmailSettings {
  rateReminders: boolean;
  dishRequestNews: boolean;
  kitchenFeedback: boolean;
}

function toEmailSettings(user: { emailRateReminders: boolean; emailDishRequestNews: boolean; emailKitchenFeedback: boolean }): EmailSettings {
  return {
    rateReminders: user.emailRateReminders,
    dishRequestNews: user.emailDishRequestNews,
    kitchenFeedback: user.emailKitchenFeedback,
  };
}
```

3. Add `emailSettings: EmailSettings;` to `CurrentUser`, and `emailSettings: toEmailSettings(user),` to the object `getCurrentUser` returns (after `chefProfile`).
4. Add at the end:

```ts
/** Turns optional emails on or off. Settings left out stay as they are. */
export async function updateEmailSettings(userId: string, changes: EmailSettingsInput): Promise<EmailSettings> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      emailRateReminders: changes.rateReminders,
      emailDishRequestNews: changes.dishRequestNews,
      emailKitchenFeedback: changes.kitchenFeedback,
    },
  });
  return toEmailSettings(user);
}
```

Replace `backend/src/controllers/userController.ts` with:

```ts
import { Request, Response } from 'express';
import { getCurrentUser, updateEmailSettings as saveEmailSettings } from '../services/userService.js';

export async function getMe(req: Request, res: Response) {
  const user = await getCurrentUser(req.user!.id);
  res.status(200).json({ success: true, data: { user } });
}

export async function updateEmailSettings(req: Request, res: Response) {
  const emailSettings = await saveEmailSettings(req.user!.id, req.body);
  res.status(200).json({ success: true, data: { emailSettings }, message: 'Email settings saved' });
}
```

Replace `backend/src/routes/userRoutes.ts` with:

```ts
import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { emailSettingsSchema } from '../validators/userSchemas.js';

export const userRoutes = Router();

userRoutes.get('/me', requireAuth, userController.getMe);
userRoutes.put('/me/email-settings', requireAuth, validateBody(emailSettingsSchema), userController.updateEmailSettings);
```

- [ ] **Step 4: Run the tests to watch them pass**

Run: `cd backend && npx vitest run tests/emailSettings.test.ts tests/users.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/validators/userSchemas.ts backend/src/services/userService.ts backend/src/controllers/userController.ts backend/src/routes/userRoutes.ts backend/tests/emailSettings.test.ts
git commit -F - <<'EOF'
feat(api): email settings - switch off the optional emails

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 16: Website: email settings on the Account page

**Files:**
- Create: `frontend/src/services/accountService.ts`, `frontend/src/components/account/EmailSettingsCard.tsx`
- Modify: `frontend/src/types/user.types.ts`, `frontend/src/pages/AccountPage.tsx`, `frontend/src/pages/AccountPage.css`
- Test: `frontend/src/services/accountService.test.ts`, `frontend/src/components/account/EmailSettingsCard.test.tsx`

**Interfaces:**
- Consumes: `EmailSettings` (Task 8); `Toggle` (`components/common/Toggle.tsx`).
- Produces: `CurrentUser.emailSettings`; `services/accountService.ts` (account settings and password recovery; it imports no stores, so it tests in the plain Node environment) with `updateEmailSettings(changes: Partial<EmailSettings>): Promise<EmailSettings>`; `<EmailSettingsCard initial isChef />` with `id="email-settings"`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/services/accountService.test.ts`:

```ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { updateEmailSettings } from './accountService'

const API = 'http://api.test/api/v1'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('updateEmailSettings', () => {
  it('sends only the changed setting and returns all of them', async () => {
    let body: unknown = null
    server.use(
      http.put(`${API}/users/me/email-settings`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { emailSettings: { rateReminders: false, dishRequestNews: true, kitchenFeedback: true } } })
      }),
    )

    expect(await updateEmailSettings({ rateReminders: false })).toEqual({ rateReminders: false, dishRequestNews: true, kitchenFeedback: true })
    expect(body).toEqual({ rateReminders: false })
  })
})
```

Create `frontend/src/components/account/EmailSettingsCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateEmailSettings } from '../../services/accountService'
import EmailSettingsCard from './EmailSettingsCard'

vi.mock('../../services/accountService', () => ({ updateEmailSettings: vi.fn() }))
const save = vi.mocked(updateEmailSettings)

const allOn = { rateReminders: true, dishRequestNews: true, kitchenFeedback: true }
const switchNamed = (name: string) => screen.getByRole('switch', { name }) as HTMLInputElement

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('EmailSettingsCard', () => {
  it('shows customers two switches, and chefs a third for their kitchen', () => {
    const { unmount } = render(<EmailSettingsCard initial={allOn} isChef={false} />)
    expect(screen.getAllByRole('switch').map((toggle) => toggle.closest('label')?.textContent)).toEqual([
      'Rate-your-meal reminders',
      'Answers to my dish requests',
    ])
    unmount()

    render(<EmailSettingsCard initial={allOn} isChef />)
    expect(switchNamed('New reviews and dish requests').checked).toBe(true)
  })

  it('saves just the switch that was flipped', async () => {
    save.mockResolvedValue({ ...allOn, rateReminders: false })
    render(<EmailSettingsCard initial={allOn} isChef={false} />)

    fireEvent.click(switchNamed('Rate-your-meal reminders'))

    await screen.findByText('Saved.')
    expect(save).toHaveBeenCalledWith({ rateReminders: false })
    expect(switchNamed('Rate-your-meal reminders').checked).toBe(false)
  })

  it('puts the switch back when saving fails', async () => {
    save.mockRejectedValue(new Error('offline'))
    render(<EmailSettingsCard initial={allOn} isChef={false} />)

    fireEvent.click(switchNamed('Answers to my dish requests'))

    await screen.findByRole('alert')
    expect(switchNamed('Answers to my dish requests').checked).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd frontend && npx vitest run src/services/accountService.test.ts src/components/account/EmailSettingsCard.test.tsx`
Expected: FAIL, `./accountService` and `./EmailSettingsCard` cannot be resolved.

- [ ] **Step 3: Add the type and the service call**

In `frontend/src/types/user.types.ts`, add at the top `import type { EmailSettings } from './notification.types';` and add `emailSettings: EmailSettings;` to `CurrentUser`.

Create `frontend/src/services/accountService.ts`:

```ts
import type { ApiSuccess } from '../types/api.types'
import type { EmailSettings } from '../types/notification.types'
import { api } from './api'

// Account settings and password recovery.

/** Turns optional emails on or off; returns all the settings as saved. */
export async function updateEmailSettings(changes: Partial<EmailSettings>): Promise<EmailSettings> {
  const { data } = await api.put<ApiSuccess<{ emailSettings: EmailSettings }>>('/users/me/email-settings', changes)
  return data.data.emailSettings
}
```

- [ ] **Step 4: Write the card**

Create `frontend/src/components/account/EmailSettingsCard.tsx`:

```tsx
import { useState } from 'react'
import { updateEmailSettings } from '../../services/accountService'
import type { EmailSettings } from '../../types/notification.types'
import { getApiError } from '../../utils/apiError'
import Toggle from '../common/Toggle'

type SettingKey = keyof EmailSettings

const SETTINGS: { key: SettingKey; label: string; hint: string; chefsOnly?: boolean }[] = [
  { key: 'rateReminders', label: 'Rate-your-meal reminders', hint: 'An email a couple of hours after an order is done.' },
  { key: 'dishRequestNews', label: 'Answers to my dish requests', hint: 'When a chef answers your request, or says yes to a dish you voted for.' },
  { key: 'kitchenFeedback', label: 'New reviews and dish requests', hint: 'When a customer reviews one of your meals or asks for a dish.', chefsOnly: true },
]

interface EmailSettingsCardProps {
  initial: EmailSettings
  isChef: boolean
}

/** The optional emails a person can switch off. Each switch saves as soon as it is flipped. */
export default function EmailSettingsCard({ initial, isChef }: EmailSettingsCardProps) {
  const [settings, setSettings] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const change = async (key: SettingKey, value: boolean) => {
    const previous = settings
    setSettings({ ...settings, [key]: value })
    setSaving(true)
    setMessage(null)
    try {
      setSettings(await updateEmailSettings({ [key]: value } as Partial<EmailSettings>))
      setMessage({ kind: 'success', text: 'Saved.' })
    } catch (error) {
      setSettings(previous)
      setMessage({ kind: 'error', text: getApiError(error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card email-settings" id="email-settings" aria-labelledby="email-settings-heading">
      <h2 id="email-settings-heading">Email settings</h2>
      <div className="email-settings-list">
        {SETTINGS.filter((setting) => isChef || !setting.chefsOnly).map((setting) => (
          <div key={setting.key} className="email-setting">
            <Toggle label={setting.label} checked={settings[setting.key]} disabled={saving} onChange={(value) => change(setting.key, value)} />
            <p className="field-hint">{setting.hint}</p>
          </div>
        ))}
      </div>
      <p className="card-note">Order updates and password emails always go out. The bell shows everything.</p>
      {message && (
        <p className={message.kind === 'error' ? 'field-error' : 'email-settings-saved'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Show the card on the Account page**

In `frontend/src/pages/AccountPage.tsx`:
1. Add `import EmailSettingsCard from '../components/account/EmailSettingsCard'`.
2. After the second `useEffect` (the one that loads the user), add:

```tsx
  // Email footers link to #email-settings: scroll there once the page has loaded.
  const loaded = state.status === 'ready'
  useEffect(() => {
    if (loaded && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [loaded, location.hash])
```

3. In the `account-grid`, directly after the "Account details" `</section>`, add:

```tsx
        <EmailSettingsCard initial={user.emailSettings} isChef={isChef} />
```

In `frontend/src/pages/AccountPage.css`, add:

```css
.email-settings-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0.5rem 0 1rem;
}

.email-setting .field-hint {
  margin: 0.25rem 0 0 3.25rem;
}

.email-settings-saved {
  color: var(--color-success);
  font-weight: 600;
}
```

- [ ] **Step 6: Run the tests, lint and build**

Run: `cd frontend && npx vitest run src/services/accountService.test.ts src/components/account/EmailSettingsCard.test.tsx && npm run lint && npm run build`
Expected: 4 tests pass; lint and build succeed.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/account frontend/src/types/user.types.ts frontend/src/services/accountService.ts frontend/src/services/accountService.test.ts frontend/src/pages/AccountPage.tsx frontend/src/pages/AccountPage.css
git commit -F - <<'EOF'
feat(web): email settings on the Account page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 17: Demo bell items and the Part 2 check-in

**Files:**
- Modify: `backend/prisma/seed.ts`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Give the demo accounts a few bell items**

In `backend/prisma/seed.ts`, add the import `import { bellText } from '../src/services/notifications/bellText.js';` and, after `refreshStats`:

```ts
/** A few unread bell items for the demo accounts, matching the sample data. Replaced on every run. */
async function seedDemoNotifications() {
  const [chris, maria, tanaka, abuela] = await Promise.all([
    findUser(CHRIS),
    findUser('maria@neighborskitchen.test'),
    findChef('kenji@neighborskitchen.test'),
    findChef('maria@neighborskitchen.test'),
  ]);
  const notices = [
    {
      userId: chris.id,
      kind: 'DISH_REQUEST_ACCEPTED' as const,
      hoursAgo: 20,
      text: bellText('DISH_REQUEST_ACCEPTED', {
        suggestionId: '',
        chefId: tanaka.id,
        kitchenName: tanaka.kitchenName ?? 'Tanaka Home Kitchen',
        mealName: 'Chicken karaage bento',
        description: null,
        status: 'ACCEPTED',
        reply: 'Coming to the menu next Saturday!',
        requesterName: 'Hannah L.',
      }),
    },
    {
      userId: maria.id,
      kind: 'NEW_DISH_REQUEST' as const,
      hoursAgo: 30,
      text: bellText('NEW_DISH_REQUEST', {
        suggestionId: '',
        chefId: abuela.id,
        kitchenName: abuela.kitchenName ?? "Abuela's Table",
        mealName: 'Birria tacos with consommé',
        description: 'Slow-cooked beef birria with a cup of consommé for dipping. Would order every weekend!',
        status: 'PENDING',
        reply: null,
        requesterName: 'Dana K.',
      }),
    },
    {
      userId: maria.id,
      kind: 'NEW_REVIEW' as const,
      hoursAgo: 70,
      text: bellText('NEW_REVIEW', {
        reviewId: '',
        chefId: abuela.id,
        mealName: 'Smoky Chickpea Fajitas',
        rating: 5,
        comment: "Best vegetarian fajitas I've had. Great smoky flavor.",
        customerName: 'Hannah L.',
      }),
    },
  ];
  await prisma.notification.deleteMany({ where: { userId: { in: [chris.id, maria.id] } } });
  await prisma.notification.createMany({
    data: notices.map(({ userId, kind, hoursAgo, text }) => ({
      userId,
      kind,
      title: text!.title,
      body: text!.body,
      link: text!.link,
      createdAt: new Date(Date.now() - hoursAgo * HOUR),
    })),
  });
  return notices.length;
}
```

In `main()`, add after `await refreshStats();`:

```ts
  const demoNotices = await seedDemoNotifications();
```

and after the "Added … past orders" log line:

```ts
  console.log(`Gave the demo accounts ${demoNotices} bell items.`);
```

Run: `cd backend && npm run db:seed`
Expected: the log includes "Gave the demo accounts 3 bell items."; running it a second time prints the same and does not add more.

- [ ] **Step 2: Update the README and CLAUDE.md**

In `README.md`:
1. Add after the notifications rows in "Available now": ``| PUT | `/api/v1/users/me/email-settings` | Turn the optional emails on or off: `rateReminders`, `dishRequestNews`, `kitchenFeedback` (order and password emails always go out) |`` and change the `/api/v1/users/me` description to `The signed-in user, with a kitchen summary for chefs and their email settings`.
2. Replace the "How notifications work (Phase 7b)" paragraph with:

```markdown
**How notifications work (Phase 7b):** a bell in the menu bar shows what happened, with a count of unread items; opening it marks them read, and "See all" (`/notifications`) keeps the history. Chefs hear about new orders, customer cancellations, new reviews and new dish requests. Customers get an emailed receipt, hear when their order is confirmed, being cooked, ready, or declined or cancelled, get a "How was your meal?" reminder a couple of hours after an order is done (only if a meal is still unrated), and hear when a chef answers their dish request; everyone who voted for a dish hears when the chef says yes. The important updates are also emailed; on the Account page people can switch off the optional emails (rate-your-meal reminders, dish-request answers, and for chefs new reviews and requests), while the bell always shows everything. Each notice is saved together with the change that caused it, and a helper inside the API server writes and sends emails every few seconds, trying again after 1, 5, 30 and 120 minutes if sending fails. Until launch nothing is really sent: every email lands in the practice mailbox at http://localhost:3000/dev/mailbox. Emails never include street addresses or phone numbers. On this computer the rate reminder comes 2 minutes after an order is completed (`RATE_REMINDER_DELAY_MINUTES`), so it is easy to try.
```

In `CLAUDE.md`:
1. Add `RATE_REMINDER_DELAY_MINUTES` to the "Currently used" environment list.
2. Append to the Notifications bullet: `Optional emails are switched off with users.email_rate_reminders / email_dish_request_news / email_kitchen_feedback (the bell always shows everything). Completing an order sets rate_reminder_at; sendRateReminders (reviewService) sends the reminder only if a meal is unrated. Dish-request answers notify the asker when the status or reply changes and other voters only when the status first becomes ACCEPTED.`

- [ ] **Step 3: Run the full verification**

Run, from the repo root:

```bash
npm test
cd backend && npx tsc --noEmit -p . && cd ../frontend && npm run lint && npm run build
```

Expected: every test passes (report the counts); tsc, lint and build are clean. Report any failure by name.

- [ ] **Step 4: Try it in the browser**

1. Restart the preview server (the new setting in `backend/.env` is read at start).
2. Log in as Maria (Chef demo): the bell shows 2 (the demo review and dish request). Open it, then open See all.
3. Log in as Chris (Customer demo): the bell shows 1, "Good news: Tanaka Home Kitchen will make Chicken karaage bento". Open Account: the Email settings card shows two switches. Switch off "Answers to my dish requests" and see "Saved."; switch it back on.
4. As Chris, open Abuela's Table and request a dish. Log in as Maria: the bell shows "New dish request: …"; answer it from Feedback (choose "thinking about it" with a message). Log in as Chris: the bell shows "Abuela's Table answered your dish request".
5. As Chris, place an order at Abuela's Table. As Maria, confirm it, start preparing, mark it ready and picked up. Wait 2 minutes (the helper runs every 5 seconds). As Chris: the bell shows "How was your meal from Abuela's Table?" and the practice mailbox has the email. Screenshot the bell and the email.
6. Check the browser console for errors, then `cd backend && npm run db:seed`.

- [ ] **Step 5: Commit and push**

```bash
git add backend/prisma/seed.ts README.md CLAUDE.md
git commit -F - <<'EOF'
docs: phase 7b part 2 - reviews, dish requests, rate reminders and email settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push origin claude/neighbors-kitchen-chat-dk4r07
```

---

# Part 3: The confirm-time promise

At the end of Part 3: each chef picks how fast they confirm orders, customers see it, new orders get a deadline, chefs get a reminder halfway, and orders still waiting at the deadline are cancelled automatically with both sides told.

### Task 18: The promise setting

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<stamp>_confirm_deadlines/migration.sql` (generated)
- Modify: `backend/src/validators/kitchenSchemas.ts`, `backend/src/services/kitchenService.ts`, `backend/src/services/chefService.ts`
- Modify: `backend/tests/helpers.ts`
- Test: `backend/tests/confirmPromise.test.ts`

**Interfaces:**
- Produces: `chef_profiles.confirm_within_hours` (default 4); `orders.confirm_by`, `orders.chef_reminder_at` (both nullable; used from Task 19).
- Produces: `PUT /api/v1/chefs/me/availability` accepts optional `confirmWithinHours` (1, 4, 12 or 24; left out = unchanged); `GET /api/v1/chefs/me` and `GET /api/v1/chefs/:id` return `confirmWithinHours`.
- Produces: `availabilityInput(overrides?)` in `tests/helpers.ts` (a full availability body: every day 8 AM to 9 PM, pickup only, 1-hour lead time) and an `openKitchen({ confirmWithinHours })` option.

- [ ] **Step 1: Add the columns and create the migration**

In `backend/prisma/schema.prisma`, `model ChefProfile`, add after the `timezone` line:

```prisma
  // How many hours the chef promises to confirm new orders within: 1, 4, 12 or 24
  confirmWithinHours      Int      @default(4) @map("confirm_within_hours")
```

In `model Order`, add after the `rateReminderAt` line:

```prisma
  // Confirm by this time or the order is cancelled automatically; null for orders placed before deadlines existed
  confirmBy           DateTime?         @map("confirm_by")
  // When to remind the chef (halfway to confirmBy); cleared once handled
  chefReminderAt      DateTime?         @map("chef_reminder_at")
```

and after `@@index([status, rateReminderAt])`:

```prisma
  @@index([status, confirmBy])
  @@index([status, chefReminderAt])
```

Create and apply the migration ("Creating a migration", `<name>` = `confirm_deadlines`). The SQL must only add `confirm_within_hours INTEGER NOT NULL DEFAULT 4`, the two nullable order columns and the two indexes.

- [ ] **Step 2: Add the test helper for saving hours**

In `backend/tests/helpers.ts`, add after `everyDay`:

```ts
/** A full body for PUT /chefs/me/availability: open every day 8 AM to 9 PM, pickup only, a one-hour lead time. */
export function availabilityInput(overrides: Record<string, unknown> = {}) {
  return { schedule: everyDay, orderLeadTimeHours: 1, offersPickup: true, offersDelivery: false, deliveryFee: 0, ...overrides };
}
```

and replace `openKitchen` with:

```ts
/** A chef open every day 8 AM to 9 PM with a one-hour lead time and one meal on the menu. */
export async function openKitchen(
  options: { offersDelivery?: boolean; deliveryFee?: number; leadHours?: number; confirmWithinHours?: number } = {},
) {
  const chef = await signUpChefWithKitchen(app);
  await request(app)
    .put(`${API}/chefs/me/availability`)
    .set(bearer(chef.accessToken))
    .send(
      availabilityInput({
        orderLeadTimeHours: options.leadHours ?? 1,
        offersDelivery: options.offersDelivery ?? false,
        deliveryFee: options.deliveryFee ?? 0,
        confirmWithinHours: options.confirmWithinHours,
      }),
    );
  const mealId = await addMeal(chef.accessToken);
  return { ...chef, mealId };
}
```

(`confirmWithinHours: undefined` is dropped when the body is sent as JSON, so the kitchen keeps the default.)

- [ ] **Step 3: Write the failing tests**

Create `backend/tests/confirmPromise.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { API, availabilityInput, bearer, type Kitchen, openKitchen } from './helpers.js';

const app = createApp();

const saveHours = (kitchen: Kitchen, overrides: Record<string, unknown> = {}) =>
  request(app).put(`${API}/chefs/me/availability`).set(bearer(kitchen.accessToken)).send(availabilityInput(overrides));
const publicProfile = (kitchen: Kitchen) => request(app).get(`${API}/chefs/${kitchen.chefId}`);
const ownKitchen = (kitchen: Kitchen) => request(app).get(`${API}/chefs/me`).set(bearer(kitchen.accessToken));

describe('The confirm-time promise', () => {
  it('is 4 hours for a new kitchen, and customers see the one the chef picks', async () => {
    const kitchen = await openKitchen();
    expect((await publicProfile(kitchen)).body.data.confirmWithinHours).toBe(4);

    const saved = await saveHours(kitchen, { confirmWithinHours: 12 });

    expect(saved.status).toBe(200);
    expect(saved.body.data.chefProfile.confirmWithinHours).toBe(12);
    expect((await publicProfile(kitchen)).body.data.confirmWithinHours).toBe(12);
  });

  it('stays the same when the hours are saved without it', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 12 });

    await saveHours(kitchen);

    expect((await ownKitchen(kitchen)).body.data.chefProfile.confirmWithinHours).toBe(12);
  });

  it('can only be 1, 4, 12 or 24 hours', async () => {
    const kitchen = await openKitchen();

    const res = await saveHours(kitchen, { confirmWithinHours: 5 });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual({ confirmWithinHours: 'Choose 1, 4, 12 or 24 hours' });
  });
});
```

- [ ] **Step 4: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/confirmPromise.test.ts`
Expected: FAIL; `confirmWithinHours` is undefined in the responses and the 5-hour value is accepted.

- [ ] **Step 5: Accept and return the setting**

In `backend/src/validators/kitchenSchemas.ts`, in `availabilitySchema`, add after the `deliveryFee` line:

```ts
    // Left out: the chef's current promise stays as it is.
    confirmWithinHours: z.literal([1, 4, 12, 24], 'Choose 1, 4, 12 or 24 hours').optional(),
```

(`updateAvailability` already saves every non-schedule field it is given.)

In `backend/src/services/kitchenService.ts`, `toOwnKitchen`, add after `orderLeadTimeHours: chef.orderLeadTimeHours,`:

```ts
    confirmWithinHours: chef.confirmWithinHours,
```

In `backend/src/services/chefService.ts`, `getChefProfile`, add the same line after `orderLeadTimeHours: chef.orderLeadTimeHours,`.

- [ ] **Step 6: Run the tests to watch them pass**

Run: `cd backend && npx vitest run tests/confirmPromise.test.ts tests/kitchen.test.ts tests/chefs.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/validators/kitchenSchemas.ts backend/src/services/kitchenService.ts backend/src/services/chefService.ts backend/tests/helpers.ts backend/tests/confirmPromise.test.ts
git commit -F - <<'EOF'
feat(api): chefs choose how fast they promise to confirm new orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 19: Deadlines on new orders

**Files:**
- Modify: `backend/src/services/orderService.ts`, `backend/src/services/notifications/orderNotices.ts`
- Test: `backend/tests/confirmPromise.test.ts`, `backend/tests/notify.test.ts`

**Interfaces:**
- Produces: `confirmationTimes(placedAt: Date, scheduledFor: Date, confirmWithinHours: number): { confirmBy: Date; chefReminderAt: Date }` (exported from `orderService.ts`); new orders store both; customer and chef order views include `confirmBy`; `OrderForNotice.confirmBy: Date | null` and `orderNoticeData` fills `confirmBy` from it.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/confirmPromise.test.ts` (and add `prisma`, `confirmationTimes`, `pickupOrder`, `placeOrder`, `signUp` and `emailsFor`/`bellFor` to its imports, as below):

```ts
import { prisma } from '../src/lib/prisma.js';
import { confirmationTimes } from '../src/services/orderService.js';
import { pickupOrder, placeOrder, signUp } from './helpers.js';
import { bellFor, emailsFor } from './notificationHelpers.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('confirmationTimes', () => {
  it("gives the chef their promised hours, with a reminder halfway", () => {
    expect(confirmationTimes(new Date('2026-09-29T10:00:00.000Z'), new Date('2026-09-30T01:00:00.000Z'), 4)).toEqual({
      confirmBy: new Date('2026-09-29T14:00:00.000Z'),
      chefReminderAt: new Date('2026-09-29T12:00:00.000Z'),
    });
  });

  it('ends at the pickup time when that comes first', () => {
    expect(confirmationTimes(new Date('2026-09-29T10:00:00.000Z'), new Date('2026-09-30T01:00:00.000Z'), 24)).toEqual({
      confirmBy: new Date('2026-09-30T01:00:00.000Z'),
      chefReminderAt: new Date('2026-09-29T17:30:00.000Z'),
    });
  });
});

describe('Deadlines on new orders', () => {
  it('give the chef their promised time, with a reminder halfway', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 1 });
    const customer = await signUp(app);
    const before = Date.now();

    // Tomorrow at 6 PM: always more than an hour away.
    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    expect(res.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.data.order.id } });
    expect(order.confirmBy!.getTime()).toBeGreaterThanOrEqual(before + HOUR);
    expect(order.confirmBy!.getTime()).toBeLessThanOrEqual(Date.now() + HOUR);
    expect(order.chefReminderAt!.getTime()).toBe(order.confirmBy!.getTime() - 30 * MINUTE);
    expect(res.body.data.order.confirmBy).toBe(order.confirmBy!.toISOString());
  });

  it('end at the pickup time when that comes before the promise', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 24 });
    const customer = await signUp(app);
    const slots = await request(app).get(`${API}/chefs/${kitchen.chefId}/order-slots`);
    // Open 8 AM to 9 PM with a one-hour lead time, so the first slot is always less than 24 hours away.
    const firstSlot = slots.body.data.days[0].slots[0] as string;

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen, { scheduledFor: firstSlot }));

    expect(res.status).toBe(201);
    expect(new Date(res.body.data.order.confirmBy).getTime()).toBe(new Date(firstSlot).getTime());
  });

  it('show the chef the deadline in the new-order notice', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    const [notice] = await bellFor(kitchen.userId);
    expect(notice.body).toContain(' · Confirm by ');
    const [email] = await emailsFor(kitchen.userId);
    expect((email.data as { confirmBy: string }).confirmBy).toBe(res.body.data.order.confirmBy);
  });

  it('keep their deadline when the chef later changes the promise', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 4 });
    const customer = await signUp(app);
    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));
    const placed = await prisma.order.findUniqueOrThrow({ where: { id: res.body.data.order.id } });

    await saveHours(kitchen, { confirmWithinHours: 24 });

    const later = await prisma.order.findUniqueOrThrow({ where: { id: placed.id } });
    expect(later.confirmBy).toEqual(placed.confirmBy);
    expect(later.chefReminderAt).toEqual(placed.chefReminderAt);
  });
});
```

(Put the new imports with the file's other imports at the top; keep one `describe` per block.)

In `backend/tests/notify.test.ts`, add `confirmBy: null,` to the `order` object in the `orderNoticeData` test, and add a second test in that `describe`:

```ts
  it('includes the confirm deadline when the order has one', () => {
    const order = {
      id: 'order-1',
      orderNumber: 'NK-7QX4PD',
      chefId: 'chef-1',
      customerId: 'customer-1',
      scheduledFor: new Date('2026-09-30T01:00:00.000Z'),
      pickupOrDelivery: 'PICKUP' as const,
      total: new Prisma.Decimal('33.00'),
      platformFee: new Prisma.Decimal('3.30'),
      cancellationReason: null,
      confirmBy: new Date('2026-09-29T22:15:00.000Z'),
      orderItems: [{ mealName: 'Churros', quantity: 1 }],
      chef: { userId: 'chef-user', kitchenName: "Abuela's Table", timezone: 'America/Los_Angeles', user: { firstName: 'Maria' } },
      customer: { firstName: 'Dana', lastName: 'Kim' },
    };

    expect(orderNoticeData(order).confirmBy).toBe('2026-09-29T22:15:00.000Z');
  });
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/confirmPromise.test.ts tests/notify.test.ts`
Expected: FAIL; `confirmationTimes` is not exported, orders have no `confirmBy`, and `orderNoticeData` still returns `confirmBy: null`.

- [ ] **Step 3: Compute and store the deadlines**

In `backend/src/services/orderService.ts`, add after `const MINUTE_MS = 60 * 1000;`:

```ts
const HOUR_MS = 60 * MINUTE_MS;

/**
 * When a new order must be confirmed by: the chef's promise, or the pickup or delivery time if that
 * comes first. The chef is reminded halfway there.
 */
export function confirmationTimes(placedAt: Date, scheduledFor: Date, confirmWithinHours: number) {
  const confirmBy = new Date(Math.min(placedAt.getTime() + confirmWithinHours * HOUR_MS, scheduledFor.getTime()));
  const chefReminderAt = new Date(placedAt.getTime() + (confirmBy.getTime() - placedAt.getTime()) / 2);
  return { confirmBy, chefReminderAt };
}
```

In `placeOrder`, in the `data` of `tx.order.create`, add after `scheduledFor: input.scheduledFor,`:

```ts
        // Pickup times are at least the chef's lead time (1 hour or more) away, so the deadline is always ahead.
        ...confirmationTimes(new Date(), input.scheduledFor, chef.confirmWithinHours),
```

In `sharedView`, add after `scheduledFor: order.scheduledFor,`:

```ts
    confirmBy: order.confirmBy,
```

In `backend/src/services/notifications/orderNotices.ts`, add `confirmBy: Date | null;` to `OrderForNotice` (after `cancellationReason`), and in `orderNoticeData` replace `confirmBy: null,` with:

```ts
    confirmBy: order.confirmBy?.toISOString() ?? null,
```

- [ ] **Step 4: Run the tests to watch them pass**

Run: `cd backend && npx vitest run tests/confirmPromise.test.ts tests/notify.test.ts tests/orders.test.ts tests/orderNotifications.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/orderService.ts backend/src/services/notifications/orderNotices.ts backend/tests/confirmPromise.test.ts backend/tests/notify.test.ts
git commit -F - <<'EOF'
feat(api): new orders get a confirm deadline and a halfway reminder time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 20: Reminders and automatic cancellation

**Files:**
- Modify: `backend/src/services/orderService.ts`, `backend/src/jobs/backgroundJobs.ts`
- Test: `backend/tests/confirmPromise.test.ts`

**Interfaces:**
- Consumes: `orderNoticeInclude`, `orderNoticeData`, `orderParties`, `notify`, `kitchenTitle`.
- Produces: `expireOverdueOrders(now?: Date): Promise<number>` and `sendChefReminders(now?: Date): Promise<number>` in `orderService.ts`; the helper runs, in order: expire, chef reminders, rate reminders, send emails.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/confirmPromise.test.ts` (adding `expireOverdueOrders`, `sendChefReminders` to the `orderService.js` import and `setOrderStatus` to the helpers import):

```ts
describe('Reminders and automatic cancellation', () => {
  async function waitingOrder() {
    const kitchen = await openKitchen();
    const customer = await signUp(app, 'CUSTOMER', { firstName: 'Dana', lastName: 'Kim' });
    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));
    expect(res.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.data.order.id } });
    return { kitchen, customer, order };
  }
  const minuteBefore = (date: Date) => new Date(date.getTime() - MINUTE);
  const minuteAfter = (date: Date) => new Date(date.getTime() + MINUTE);

  it('remind the chef once, halfway to the deadline', async () => {
    const { kitchen, order } = await waitingOrder();

    expect(await sendChefReminders(minuteBefore(order.chefReminderAt!))).toBe(0);
    expect(await sendChefReminders(minuteAfter(order.chefReminderAt!))).toBe(1);
    expect(await sendChefReminders(minuteAfter(order.chefReminderAt!))).toBe(0);

    expect((await bellFor(kitchen.userId)).filter((notice) => notice.kind === 'CONFIRM_REMINDER')).toEqual([
      {
        kind: 'CONFIRM_REMINDER',
        title: `Order ${order.orderNumber} still needs your confirmation`,
        body: expect.stringMatching(/^Confirm by .+ or it will be cancelled automatically$/),
        link: '/chef/orders',
      },
    ]);
    expect((await emailsFor(kitchen.userId)).filter((email) => email.kind === 'CONFIRM_REMINDER')).toHaveLength(1);
  });

  it('leave orders alone once the chef has confirmed them', async () => {
    const { kitchen, order } = await waitingOrder();
    await setOrderStatus(kitchen, order.id, 'CONFIRMED');

    expect(await sendChefReminders(minuteAfter(order.confirmBy!))).toBe(0);
    expect(await expireOverdueOrders(minuteAfter(order.confirmBy!))).toBe(0);
  });

  it('cancel an order still waiting at its deadline, and tell both sides', async () => {
    const { kitchen, customer, order } = await waitingOrder();

    expect(await expireOverdueOrders(minuteBefore(order.confirmBy!))).toBe(0);
    expect(await expireOverdueOrders(minuteAfter(order.confirmBy!))).toBe(1);

    const reason = "Sam's Kitchen didn't confirm this order in time.";
    const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { events: { orderBy: { createdAt: 'asc' } } } });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancellationReason: reason });
    expect(cancelled.events.at(-1)).toMatchObject({ status: 'CANCELLED', note: reason });
    expect(await bellFor(customer.userId)).toEqual([
      { kind: 'ORDER_EXPIRED', title: 'Your order was cancelled', body: `Sam's Kitchen didn't confirm ${order.orderNumber} in time`, link: `/orders/${order.id}` },
    ]);
    expect((await bellFor(kitchen.userId)).map((notice) => notice.kind)).toEqual(['NEW_ORDER', 'CHEF_ORDER_EXPIRED']);
    expect((await emailsFor(customer.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED', 'ORDER_EXPIRED']);
    expect((await emailsFor(kitchen.userId)).map((email) => email.kind)).toEqual(['NEW_ORDER', 'CHEF_ORDER_EXPIRED']);
  });

  it('tell a chef who confirms too late that the order was cancelled', async () => {
    const { kitchen, order } = await waitingOrder();
    await expireOverdueOrders(minuteAfter(order.confirmBy!));

    const res = await setOrderStatus(kitchen, order.id, 'CONFIRMED');

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This order is cancelled, so it cannot be marked confirmed.');
  });

  it('never touch orders placed before deadlines existed', async () => {
    const { order } = await waitingOrder();
    await prisma.order.update({ where: { id: order.id }, data: { confirmBy: null, chefReminderAt: null } });
    const muchLater = new Date(Date.now() + 30 * 24 * HOUR);

    expect(await sendChefReminders(muchLater)).toBe(0);
    expect(await expireOverdueOrders(muchLater)).toBe(0);
  });

  it('act only once when two helpers run at the same time', async () => {
    const { customer, order } = await waitingOrder();

    const results = await Promise.all([expireOverdueOrders(minuteAfter(order.confirmBy!)), expireOverdueOrders(minuteAfter(order.confirmBy!))]);

    expect(results[0] + results[1]).toBe(1);
    expect((await bellFor(customer.userId)).filter((notice) => notice.kind === 'ORDER_EXPIRED')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/confirmPromise.test.ts`
Expected: FAIL; `expireOverdueOrders` and `sendChefReminders` are not exported.

- [ ] **Step 3: Write the two timed tasks**

In `backend/src/services/orderService.ts`:
1. Change the catalog import to include `kitchenTitle`, and the order-notices import to `import { orderNoticeData, orderNoticeInclude, orderParties } from './notifications/orderNotices.js';`.
2. Add after `confirmationTimes`:

```ts
// Timed tasks handle at most this many orders per pass of the background helper.
const TIMED_TASK_BATCH = 50;
```

3. Add at the end of the file:

```ts
/** Cancels orders still waiting for the chef at their deadline, and tells both sides. Returns how many. */
export async function expireOverdueOrders(now: Date = new Date()): Promise<number> {
  const overdue = await prisma.order.findMany({
    where: { status: 'PENDING', confirmBy: { lte: now } },
    orderBy: { confirmBy: 'asc' },
    take: TIMED_TASK_BATCH,
    select: { id: true },
  });

  let expired = 0;
  for (const { id } of overdue) {
    const cancelled = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id }, include: orderNoticeInclude });
      const reason = `${kitchenTitle(order.chef)} didn't confirm this order in time.`;
      // Only while it is still waiting: the chef may have confirmed it a moment ago.
      const { count } = await tx.order.updateMany({
        where: { id, status: 'PENDING', confirmBy: { lte: now } },
        data: { status: 'CANCELLED', cancelledAt: now, cancellationReason: reason },
      });
      if (count === 0) return false;
      await tx.orderEvent.create({ data: { orderId: id, status: 'CANCELLED', note: reason } });
      const parties = await orderParties(tx, order);
      const notice = orderNoticeData(order, { reason });
      await notify(tx, parties.customer, 'ORDER_EXPIRED', notice);
      await notify(tx, parties.chef, 'CHEF_ORDER_EXPIRED', notice);
      return true;
    });
    if (cancelled) expired += 1;
  }
  return expired;
}

/** Reminds chefs about orders still waiting halfway to their deadline. Returns how many reminders were sent. */
export async function sendChefReminders(now: Date = new Date()): Promise<number> {
  const due = await prisma.order.findMany({
    where: { status: 'PENDING', chefReminderAt: { lte: now } },
    orderBy: { chefReminderAt: 'asc' },
    take: TIMED_TASK_BATCH,
    select: { id: true },
  });

  let sent = 0;
  for (const { id } of due) {
    const reminded = await prisma.$transaction(async (tx) => {
      // Only one helper can take the reminder.
      const { count } = await tx.order.updateMany({
        where: { id, status: 'PENDING', chefReminderAt: { lte: now } },
        data: { chefReminderAt: null },
      });
      if (count === 0) return false;
      const order = await tx.order.findUniqueOrThrow({ where: { id }, include: orderNoticeInclude });
      const { chef } = await orderParties(tx, order);
      await notify(tx, chef, 'CONFIRM_REMINDER', orderNoticeData(order));
      return true;
    });
    if (reminded) sent += 1;
  }
  return sent;
}
```

In `backend/src/jobs/backgroundJobs.ts`, add `import { expireOverdueOrders, sendChefReminders } from '../services/orderService.js';` and make the task list:

```ts
  const tasks: BackgroundTask[] = [
    // Cancel first, so an order that ran out of time gets no reminder in the same pass.
    { name: 'cancel unconfirmed orders', run: expireOverdueOrders },
    { name: 'chef reminders', run: sendChefReminders },
    { name: 'rate reminders', run: sendRateReminders },
    { name: 'send emails', run: (now) => deliverDueEmails(now, transport) },
  ];
```

- [ ] **Step 4: Run the tests to watch them pass**

Run: `cd backend && npx vitest run tests/confirmPromise.test.ts tests/orders.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/orderService.ts backend/src/jobs/backgroundJobs.ts backend/tests/confirmPromise.test.ts
git commit -F - <<'EOF'
feat(api): remind chefs halfway and cancel orders not confirmed in time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 21: Website: the promise and the deadlines

**Files:**
- Modify: `frontend/src/types/kitchen.types.ts`, `frontend/src/types/catalog.types.ts`, `frontend/src/types/order.types.ts`
- Modify: `frontend/src/utils/orders.ts`, `frontend/src/utils/orders.test.ts`
- Modify: `frontend/src/pages/chef/AvailabilityPage.tsx`, `frontend/src/pages/ChefProfilePage.tsx`, `frontend/src/pages/CheckoutPage.tsx`, `frontend/src/pages/OrderDetailPage.tsx`, `frontend/src/pages/Orders.css`, `frontend/src/components/order/KitchenOrderCard.tsx`, `frontend/src/pages/chef/ChefPages.css`
- Test: `frontend/src/utils/orders.test.ts`, `frontend/src/components/order/KitchenOrderCard.test.tsx` (and `frontend/src/components/feedback/RateMeals.test.tsx` gets the new field)

**Interfaces:**
- Produces: `formatConfirmWithin(hours: number): string` in `utils/orders.ts`; `OwnKitchen.confirmWithinHours`, `AvailabilityInput.confirmWithinHours`, `ChefDetail.confirmWithinHours` (numbers), `OrderBase.confirmBy: string | null`.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/utils/orders.test.ts`, add `formatConfirmWithin` to the import from `./orders` and add:

```ts
describe('formatConfirmWithin', () => {
  it('says how long the chef takes to confirm', () => {
    expect(formatConfirmWithin(1)).toBe('1 hour')
    expect(formatConfirmWithin(4)).toBe('4 hours')
    expect(formatConfirmWithin(24)).toBe('24 hours')
  })
})
```

In `frontend/src/components/order/KitchenOrderCard.test.tsx`, add `confirmBy: null,` to the object `kitchenOrder()` returns (after `createdAt`); do the same in `frontend/src/components/feedback/RateMeals.test.tsx` for the order `completedOrder()` builds (the new required field would otherwise fail the build's type check). Then add these tests inside the KitchenOrderCard `describe`:

```tsx
  it('shows when a waiting order must be confirmed by', () => {
    render(<KitchenOrderCard order={{ ...kitchenOrder('PENDING', 'CONFIRMED'), confirmBy: '2026-09-29T22:15:00.000Z' }} onChanged={vi.fn()} />)

    screen.getByText('Confirm by Tuesday, September 29 at 3:15 PM')
  })

  it('shows no deadline once the order is confirmed', () => {
    render(<KitchenOrderCard order={{ ...kitchenOrder('CONFIRMED', 'PREPARING'), confirmBy: '2026-09-29T22:15:00.000Z' }} onChanged={vi.fn()} />)

    expect(screen.queryByText(/Confirm by/)).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd frontend && npx vitest run src/utils/orders.test.ts src/components/order/KitchenOrderCard.test.tsx`
Expected: FAIL; `formatConfirmWithin` is not exported and no "Confirm by" text is shown.

- [ ] **Step 3: Add the types and the helper**

In `frontend/src/types/kitchen.types.ts`: add `confirmWithinHours: number` after `orderLeadTimeHours: number` in both `OwnKitchen` and `AvailabilityInput`.
In `frontend/src/types/catalog.types.ts`: add `confirmWithinHours: number` after `orderLeadTimeHours: number` in `ChefDetail`.
In `frontend/src/types/order.types.ts`, `OrderBase`: add after `scheduledFor: string`:

```ts
  /** The chef must confirm by this time, or the order is cancelled automatically. Null for older orders. */
  confirmBy: string | null
```

In `frontend/src/utils/orders.ts`, add:

```ts
/** How long a chef promises to take to confirm new orders, e.g. "4 hours". */
export function formatConfirmWithin(hours: number): string {
  return `${hours} hour${hours === 1 ? '' : 's'}`
}
```

- [ ] **Step 4: Show the deadline on the chef's order card**

In `frontend/src/components/order/KitchenOrderCard.tsx`, add directly after the `kitchen-order-header` `</div>`:

```tsx
      {isPending && order.confirmBy && (
        <p className="kitchen-order-deadline">Confirm by {formatOrderTime(order.confirmBy, order.timezone)}</p>
      )}
```

In `frontend/src/pages/chef/ChefPages.css`, after the `.kitchen-order-when` rule:

```css
.kitchen-order-deadline {
  margin: 0.5rem 0 0;
  font-weight: 600;
  color: var(--color-danger);
}
```

- [ ] **Step 5: Let chefs pick the promise, and show it to customers**

In `frontend/src/pages/chef/AvailabilityPage.tsx`:
1. Add `import { formatConfirmWithin } from '../../utils/orders'` and, after `LEAD_TIME_OPTIONS`, `const CONFIRM_OPTIONS = [1, 4, 12, 24]`.
2. Add state after `leadTimeHours`: `const [confirmWithinHours, setConfirmWithinHours] = useState(kitchen.confirmWithinHours)`.
3. Add `confirmWithinHours,` to the object passed to `updateAvailability` (after `orderLeadTimeHours: leadTimeHours,`).
4. In the "Ordering" card, after the lead-time `field` div:

```tsx
        <div className="field">
          <label className="field-label" htmlFor="confirmWithin">Confirm new orders within</label>
          <select
            id="confirmWithin"
            className="field-input field-input--auto"
            value={confirmWithinHours}
            onChange={(event) => {
              setConfirmWithinHours(Number(event.target.value))
              setStatus('idle')
            }}
          >
            {CONFIRM_OPTIONS.map((hours) => (
              <option key={hours} value={hours}>{formatConfirmWithin(hours)}</option>
            ))}
          </select>
          <p className="field-hint">
            Customers see this before they order. You get a reminder halfway, and orders you haven&apos;t confirmed by then are cancelled automatically.
          </p>
        </div>
```

In `frontend/src/pages/ChefProfilePage.tsx`, add `import { formatConfirmWithin } from '../utils/orders'` and, in the order facts list after the "Order ahead" item:

```tsx
            <div>
              <dt>Confirms orders</dt>
              <dd>Within {formatConfirmWithin(profile.confirmWithinHours)}</dd>
            </div>
```

In `frontend/src/pages/CheckoutPage.tsx`, add `formatConfirmWithin` to the import from `../utils/orders` and, in the summary aside just before the submit button:

```tsx
        <p className="card-note">
          If {chefName} hasn&apos;t confirmed your order within {formatConfirmWithin(chef.confirmWithinHours)} (or by the{' '}
          {handover === 'PICKUP' ? 'pickup' : 'delivery'} time, if that&apos;s sooner), it&apos;s cancelled automatically and you&apos;ll be told right away.
        </p>
```

In `frontend/src/pages/OrderDetailPage.tsx`, inside the progress card (the `<div className="card">` that holds `OrderProgress`), after `<OrderProgress … />`:

```tsx
          {current.status === 'PENDING' && current.confirmBy && (
            <p className="order-confirm-by">
              Waiting for {current.chef.kitchenName ?? current.chef.chefName} to confirm by {formatOrderTime(current.confirmBy, current.timezone)}.
              If it isn&apos;t confirmed by then, it will be cancelled automatically.
            </p>
          )}
```

and in `frontend/src/pages/Orders.css`:

```css
.order-confirm-by {
  margin: 1rem 0 0;
  color: var(--color-text-muted);
}
```

- [ ] **Step 6: Run the tests, lint and build**

Run: `cd frontend && npx vitest run src/utils/orders.test.ts src/components/order/KitchenOrderCard.test.tsx && npm test && npm run lint && npm run build`
Expected: all frontend tests pass; lint and build succeed (the build type-checks every page that uses the new fields).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types frontend/src/utils/orders.ts frontend/src/utils/orders.test.ts frontend/src/pages/chef/AvailabilityPage.tsx frontend/src/pages/ChefProfilePage.tsx frontend/src/pages/CheckoutPage.tsx frontend/src/pages/OrderDetailPage.tsx frontend/src/pages/Orders.css frontend/src/components/order/KitchenOrderCard.tsx frontend/src/components/order/KitchenOrderCard.test.tsx frontend/src/components/feedback/RateMeals.test.tsx frontend/src/pages/chef/ChefPages.css
git commit -F - <<'EOF'
feat(web): confirm-time promise setting, and deadlines for customers and chefs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 22: Sample promises and the Part 3 check-in

**Files:**
- Modify: `backend/prisma/seed.ts`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Give the sample chefs a mix of promises**

In `backend/prisma/seed.ts`, add `confirmWithinHours: number` to the `fulfillment` record's value type and a `confirmWithinHours` to each entry: maria 4, kenji 1, aisha 4, tony 12, grace 12, priya 4, linh 1, sofia 4. (`seedChef` spreads these into the profile, so nothing else changes.)

Run: `cd backend && npm run db:seed` and expect it to finish without errors.

- [ ] **Step 2: Update the README and CLAUDE.md**

In `README.md`:
1. Change the `/api/v1/chefs/me/availability` row description to `Weekly hours, order lead time, pickup/delivery, delivery fee, and how fast new orders are confirmed (\`confirmWithinHours\`: 1, 4, 12 or 24)`.
2. In the "How notifications work (Phase 7b)" paragraph, add after the first sentence: `Each chef promises to confirm new orders within 1, 4, 12 or 24 hours (set under Hours & delivery; 4 unless changed), and customers see the promise before ordering. A new order must be confirmed by then, or by its pickup or delivery time if that is sooner: the chef gets a reminder halfway, and an order still waiting at the deadline is cancelled automatically, with both sides told.`

In `CLAUDE.md`, append to the Notifications bullet: `New orders get confirm_by = min(placed + the chef's confirm_within_hours, scheduledFor) and chef_reminder_at halfway (confirmationTimes in orderService); sendChefReminders and expireOverdueOrders act on them with conditional updates, and orders with no confirm_by never expire.`

- [ ] **Step 3: Run the full verification**

Run, from the repo root:

```bash
npm test
cd backend && npx tsc --noEmit -p . && cd ../frontend && npm run lint && npm run build
```

Expected: every test passes (report the counts); tsc, lint and build are clean.

- [ ] **Step 4: Try it in the browser**

1. Restart the preview server. Log in as Maria: Hours & delivery shows "Confirm new orders within: 4 hours". Change it to 1 hour and save.
2. Log in as Chris: Abuela's Table shows "Confirms orders: Within 1 hour"; checkout shows the note about automatic cancellation. Place an order; its page says "Waiting for Abuela's Table to confirm by …".
3. Log in as Maria: the bell's new-order item says "Confirm by …" and the order card shows "Confirm by …".
4. To see the reminder without waiting half an hour, make it due now with a one-off local script (test data only):

```bash
cd backend && cat > .tmp-due.mjs <<'EOF'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const field = process.argv[2];
const order = await prisma.order.findFirstOrThrow({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
await prisma.order.update({ where: { id: order.id }, data: { [field]: new Date(Date.now() - 1000) } });
console.log(`${field} is now due for ${order.orderNumber}`);
await prisma.$disconnect();
EOF
node --env-file=.env .tmp-due.mjs chefReminderAt
```

Within about 5 seconds Maria's bell shows "Order NK-… still needs your confirmation". Then run `node --env-file=.env .tmp-due.mjs confirmBy`: within about 5 seconds the order is cancelled, Chris's bell shows "Your order was cancelled", Maria's shows "Order NK-… was cancelled", and both emails are in the practice mailbox. Screenshot Chris's order page. Then `rm .tmp-due.mjs`.
5. Check the browser console for errors, then `cd backend && npm run db:seed`.

- [ ] **Step 5: Commit and push**

```bash
git add backend/prisma/seed.ts README.md CLAUDE.md
git commit -F - <<'EOF'
docs: phase 7b part 3 - the confirm-time promise, reminders and automatic cancellation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push origin claude/neighbors-kitchen-chat-dk4r07
```

---

# Part 4: Forgot password

At the end of Part 4: "Forgot password?" on the login page sends a one-hour, one-use reset link; saving a new password logs out every session, unlocks the account and sends a "password changed" email.

### Task 23: Forgot and reset password API

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<stamp>_password_reset_hash/migration.sql` (generated)
- Modify: `backend/src/validators/authSchemas.ts`, `backend/src/services/authService.ts`, `backend/src/controllers/authController.ts`, `backend/src/routes/authRoutes.ts`
- Test: `backend/tests/passwordReset.test.ts`

**Interfaces:**
- Consumes: `notify`, `recipientSelect`.
- Produces: `POST /api/v1/auth/forgot-password` `{ email }` → 200 `{ success, data: null, message }` always; `POST /api/v1/auth/reset-password` `{ token, password }` → 200 `{ message: 'Your password was changed. Log in with your new password.' }` or 400 `INVALID_RESET_LINK`; 422 for invalid input. `requestPasswordReset(email, now?)` and `resetPassword(token, password, now?)` in `authService.ts`.

- [ ] **Step 1: Make the stored reset hash unique and create the migration**

In `backend/prisma/schema.prisma`, `model User`, replace the `passwordResetToken` line with:

```prisma
  // SHA-256 hash of the newest password reset link's token (never the token itself)
  passwordResetToken      String?   @unique @map("password_reset_token")
```

Create and apply the migration ("Creating a migration", `<name>` = `password_reset_hash`). The SQL must only be `CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");`.

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/passwordReset.test.ts`:

```ts
import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API } from './helpers.js';
import { emailsFor } from './notificationHelpers.js';

const app = createApp();
const MINUTE = 60 * 1000;
const ANSWER = "If there's an account for that email, we sent a link to reset the password.";

async function register() {
  const res = await request(app)
    .post(`${API}/auth/register`)
    .send({ email: 'jane@example.com', password: 'Tacos4ever', firstName: 'Jane', lastName: 'Doe' });
  expect(res.status).toBe(201);
  const refreshCookie = res.get('Set-Cookie')!.find((cookie) => cookie.startsWith('nk_refresh='))!.split(';')[0];
  return { userId: res.body.data.user.id as string, refreshCookie };
}

const forgot = (email: string) => request(app).post(`${API}/auth/forgot-password`).send({ email });
const reset = (token: string, password: string) => request(app).post(`${API}/auth/reset-password`).send({ token, password });
const login = (password: string) => request(app).post(`${API}/auth/login`).send({ email: 'jane@example.com', password });

/** The token in the newest reset email sent to the user. */
async function latestToken(userId: string) {
  const resets = (await emailsFor(userId)).filter((email) => email.kind === 'PASSWORD_RESET');
  return (resets.at(-1)!.data as { token: string }).token;
}

describe('POST /auth/forgot-password', () => {
  it('emails a one-hour reset link to an account that exists, and stores only its hash', async () => {
    const jane = await register();
    const before = Date.now();

    const res = await forgot('Jane@Example.com');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: ANSWER });
    const [email] = await emailsFor(jane.userId);
    expect(email).toMatchObject({ kind: 'PASSWORD_RESET', toAddress: 'jane@example.com', data: { firstName: 'Jane' } });
    const token = (email.data as { token: string }).token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: jane.userId } });
    expect(user.passwordResetToken).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(user.passwordResetExpires!.getTime()).toBeGreaterThanOrEqual(before + 60 * MINUTE);
    expect(user.passwordResetExpires!.getTime()).toBeLessThanOrEqual(Date.now() + 60 * MINUTE);
  });

  it('gives the same answer for an unknown email, and sends nothing', async () => {
    const res = await forgot('nobody@example.com');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(ANSWER);
    expect(await prisma.email.count()).toBe(0);
  });

  it('sends nothing to a deactivated account', async () => {
    const jane = await register();
    await prisma.user.update({ where: { id: jane.userId }, data: { isActive: false } });

    expect((await forgot('jane@example.com')).body.message).toBe(ANSWER);
    expect(await emailsFor(jane.userId)).toEqual([]);
  });

  it('sends at most one email every 2 minutes, and a newer link replaces the older one', async () => {
    const jane = await register();
    await forgot('jane@example.com');
    const first = await latestToken(jane.userId);

    await forgot('jane@example.com');
    expect((await emailsFor(jane.userId)).filter((email) => email.kind === 'PASSWORD_RESET')).toHaveLength(1);

    // As if the first link had been sent 3 minutes ago.
    await prisma.user.update({ where: { id: jane.userId }, data: { passwordResetExpires: new Date(Date.now() + 57 * MINUTE) } });
    await forgot('jane@example.com');
    const second = await latestToken(jane.userId);

    expect(second).not.toBe(first);
    expect((await reset(first, 'NewTacos5')).status).toBe(400);
    expect((await reset(second, 'NewTacos5')).status).toBe(200);
  });

  it('checks the email address', async () => {
    expect((await forgot('not-an-email')).status).toBe(422);
  });
});

describe('POST /auth/reset-password', () => {
  it('sets the new password, and the link works only once', async () => {
    const jane = await register();
    await forgot('jane@example.com');
    const token = await latestToken(jane.userId);

    const res = await reset(token, 'NewTacos5');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Your password was changed. Log in with your new password.');
    expect((await login('NewTacos5')).status).toBe(200);
    expect((await login('Tacos4ever')).status).toBe(401);
    const again = await reset(token, 'OtherTacos6');
    expect(again.status).toBe(400);
    expect(again.body.error).toEqual({ code: 'INVALID_RESET_LINK', message: 'This link has expired or was already used. Ask for a new one.' });
  });

  it('logs out every session, unlocks the account and sends a password-changed email', async () => {
    const jane = await register();
    await prisma.user.update({ where: { id: jane.userId }, data: { failedLoginAttempts: 3, lockedUntil: new Date(Date.now() + 10 * MINUTE) } });
    await forgot('jane@example.com');

    await reset(await latestToken(jane.userId), 'NewTacos5');

    const refreshed = await request(app).post(`${API}/auth/refresh-token`).set('Cookie', jane.refreshCookie);
    expect(refreshed.status).toBe(401);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: jane.userId } })).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordResetToken: null,
      passwordResetExpires: null,
    });
    expect((await emailsFor(jane.userId)).map((email) => email.kind)).toEqual(['PASSWORD_RESET', 'PASSWORD_CHANGED']);
  });

  it('refuses an expired link', async () => {
    const jane = await register();
    await forgot('jane@example.com');
    await prisma.user.update({ where: { id: jane.userId }, data: { passwordResetExpires: new Date(Date.now() - MINUTE) } });

    expect((await reset(await latestToken(jane.userId), 'NewTacos5')).status).toBe(400);
  });

  it('refuses a made-up link', async () => {
    expect((await reset('x'.repeat(43), 'NewTacos5')).status).toBe(400);
  });

  it('checks the new password like sign-up does', async () => {
    const jane = await register();
    await forgot('jane@example.com');

    const res = await reset(await latestToken(jane.userId), 'short');

    expect(res.status).toBe(422);
    expect(res.body.error.details.password).toBe('Password must be at least 8 characters');
  });
});
```

- [ ] **Step 3: Run the tests to watch them fail**

Run: `cd backend && npx vitest run tests/passwordReset.test.ts`
Expected: FAIL with 404s (the routes do not exist yet).

- [ ] **Step 4: Write the schemas**

In `backend/src/validators/authSchemas.ts`, pull the password rules out of `registerSchema` into a shared constant and add the two new schemas:

```ts
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or less')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');
```

(then `registerSchema` uses `password,` in place of the inline rules), and after `loginSchema`:

```ts
export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'This link is not complete. Open it from the email again.').max(200),
  password,
});
```

- [ ] **Step 5: Write the service functions**

In `backend/src/services/authService.ts`, add the import `import { notify, recipientSelect } from './notifications/notify.js';`, these constants after `DAY_MS`:

```ts
const MINUTE_MS = 60 * 1000;
const RESET_LINK_MINUTES = 60;
// At most one reset email per account in this many minutes, so nobody can flood an inbox.
const RESET_EMAIL_GAP_MINUTES = 2;
```

and at the end of the file:

```ts
function invalidResetLink() {
  return new AppError(400, 'INVALID_RESET_LINK', 'This link has expired or was already used. Ask for a new one.');
}

/**
 * Emails a reset link when an active account has this email. The caller always gives the same answer,
 * so nobody can use this to find out who has an account.
 */
export async function requestPasswordReset(email: string, now: Date = new Date()): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...recipientSelect, firstName: true, passwordResetExpires: true },
  });
  if (!user || !user.isActive) return;
  const lastSentAt = user.passwordResetExpires ? user.passwordResetExpires.getTime() - RESET_LINK_MINUTES * MINUTE_MS : null;
  if (lastSentAt !== null && now.getTime() - lastSentAt < RESET_EMAIL_GAP_MINUTES * MINUTE_MS) return;

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashToken(token), passwordResetExpires: new Date(now.getTime() + RESET_LINK_MINUTES * MINUTE_MS) },
    });
    await notify(tx, user, 'PASSWORD_RESET', { firstName: user.firstName, token });
  });
}

/** Sets a new password from a reset link. The link works once, and every session is logged out. */
export async function resetPassword(token: string, password: string, now: Date = new Date()): Promise<void> {
  const tokenHash = hashToken(token);
  const user = await prisma.user.findUnique({
    where: { passwordResetToken: tokenHash },
    select: { ...recipientSelect, firstName: true, passwordResetExpires: true },
  });
  if (!user || !user.isActive || !user.passwordResetExpires || user.passwordResetExpires <= now) throw invalidResetLink();

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    // Only the first use counts, even if the link is submitted twice at once.
    const { count } = await tx.user.updateMany({
      where: { id: user.id, passwordResetToken: tokenHash },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null, failedLoginAttempts: 0, lockedUntil: null },
    });
    if (count === 0) throw invalidResetLink();
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await notify(tx, user, 'PASSWORD_CHANGED', { firstName: user.firstName });
  });
}
```

- [ ] **Step 6: Add the controller functions and routes**

In `backend/src/controllers/authController.ts`, add:

```ts
// The same answer whether or not the account exists.
const RESET_LINK_SENT = "If there's an account for that email, we sent a link to reset the password.";

export async function forgotPassword(req: Request, res: Response) {
  await authService.requestPasswordReset(req.body.email);
  res.status(200).json({ success: true, data: null, message: RESET_LINK_SENT });
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json({ success: true, data: null, message: 'Your password was changed. Log in with your new password.' });
}
```

In `backend/src/routes/authRoutes.ts`, import `forgotPasswordSchema` and `resetPasswordSchema` with the other schemas and add after the login route:

```ts
authRoutes.post('/forgot-password', credentialLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
authRoutes.post('/reset-password', credentialLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
```

- [ ] **Step 7: Run the tests to watch them pass**

Run: `cd backend && npx vitest run tests/passwordReset.test.ts tests/auth.test.ts && npx tsc --noEmit -p .`
Expected: all pass; tsc prints nothing.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/validators/authSchemas.ts backend/src/services/authService.ts backend/src/controllers/authController.ts backend/src/routes/authRoutes.ts backend/tests/passwordReset.test.ts
git commit -F - <<'EOF'
feat(api): forgot password - one-hour, one-use reset links and a password-changed email

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 24: Website: forgot and reset password pages

**Files:**
- Modify: `frontend/src/services/accountService.ts`
- Create: `frontend/src/pages/ForgotPasswordPage.tsx`, `frontend/src/pages/ResetPasswordPage.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/AuthPages.css`
- Test: `frontend/src/services/accountService.test.ts`, `frontend/src/pages/ResetPasswordPage.test.tsx`

**Interfaces:**
- Produces: `requestPasswordReset(email): Promise<string>` (the server's answer) and `resetPassword(token, password): Promise<void>` in `services/accountService.ts`; routes `/forgot-password` and `/reset-password` (open to everyone); the login page shows a one-time message passed with `navigate('/login', { state: { message } })`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/pages/ResetPasswordPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetPassword } from '../services/accountService'
import ResetPasswordPage from './ResetPasswordPage'

vi.mock('../services/accountService', () => ({ resetPassword: vi.fn() }))
const reset = vi.mocked(resetPassword)

function LoginStub() {
  const location = useLocation()
  return <p>Login page: {(location.state as { message?: string } | null)?.message}</p>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

function submit(password: string, again: string) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('New password again'), { target: { value: again } })
  fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))
}

/** What the API client throws for an error answer. */
function apiError(code: string, message: string) {
  return Object.assign(new Error(message), { isAxiosError: true, response: { status: 400, data: { success: false, error: { code, message } } } })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ResetPasswordPage', () => {
  it('saves the new password and sends the person to log in', async () => {
    reset.mockResolvedValue(undefined)
    renderAt('/reset-password?token=abc123')

    submit('Tacos5ever', 'Tacos5ever')

    await screen.findByText('Login page: Your password was changed. Log in with your new password.')
    expect(reset).toHaveBeenCalledWith('abc123', 'Tacos5ever')
  })

  it('asks again when the two passwords differ', async () => {
    renderAt('/reset-password?token=abc123')

    submit('Tacos5ever', 'Tacos6ever')

    await screen.findByText('The passwords do not match')
    expect(reset).not.toHaveBeenCalled()
  })

  it('explains an expired link and offers a new one', async () => {
    reset.mockRejectedValue(apiError('INVALID_RESET_LINK', 'This link has expired or was already used. Ask for a new one.'))
    renderAt('/reset-password?token=abc123')

    submit('Tacos5ever', 'Tacos5ever')

    await screen.findByText('This link has expired or was already used. Ask for a new one.')
    expect(screen.getByRole('link', { name: 'Ask for a new link' }).getAttribute('href')).toBe('/forgot-password')
  })

  it('explains a link without its token', () => {
    renderAt('/reset-password')

    screen.getByText('This link is not complete. Open it from the email again, or ask for a new one.')
    screen.getByRole('link', { name: 'Ask for a new link' })
  })
})
```

In `frontend/src/services/accountService.test.ts`, change the import to `import { requestPasswordReset, resetPassword, updateEmailSettings } from './accountService'` and add:

```ts
describe('password recovery', () => {
  it('asks for a reset link and returns the answer to show', async () => {
    let body: unknown = null
    server.use(
      http.post(`${API}/auth/forgot-password`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: null, message: "If there's an account for that email, we sent a link to reset the password." })
      }),
    )

    expect(await requestPasswordReset('jane@example.com')).toBe("If there's an account for that email, we sent a link to reset the password.")
    expect(body).toEqual({ email: 'jane@example.com' })
  })

  it('sends the token and the new password', async () => {
    let body: unknown = null
    server.use(
      http.post(`${API}/auth/reset-password`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: null, message: 'Your password was changed. Log in with your new password.' })
      }),
    )

    await resetPassword('abc123', 'Tacos5ever')

    expect(body).toEqual({ token: 'abc123', password: 'Tacos5ever' })
  })
})
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd frontend && npx vitest run src/services/accountService.test.ts src/pages/ResetPasswordPage.test.tsx`
Expected: FAIL; `requestPasswordReset` and `resetPassword` are not exported and `./ResetPasswordPage` cannot be resolved.

- [ ] **Step 3: Add the service calls**

In `frontend/src/services/accountService.ts`, add:

```ts
/** Asks for a reset link. The answer is the same whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<string> {
  const { data } = await api.post<ApiSuccess<null>>('/auth/forgot-password', { email })
  return data.message ?? "If there's an account for that email, we sent a link to reset the password."
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password })
}
```

- [ ] **Step 4: Write the two pages**

Create `frontend/src/pages/ForgotPasswordPage.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { usePageTitle } from '../hooks/usePageTitle'
import { requestPasswordReset } from '../services/accountService'
import { getApiError } from '../utils/apiError'
import './AuthPages.css'

const forgotSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address')),
})

type ForgotValues = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  usePageTitle('Forgot password')
  const [answer, setAnswer] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = async ({ email }: ForgotValues) => {
    setFormError(null)
    try {
      setAnswer(await requestPasswordReset(email))
    } catch (error) {
      setFormError(getApiError(error).message)
    }
  }

  if (answer) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Check your email</h1>
          <div className="alert alert-success" role="status">{answer}</div>
          <p className="card-text">The link works once, for 1 hour. If it hasn&apos;t arrived in a few minutes, check your spam folder or try again.</p>
          {import.meta.env.DEV && (
            <p className="card-note">
              While we build the app, emails go to the <Link to="/dev/mailbox" className="text-link">practice mailbox</Link>.
            </p>
          )}
          <p className="auth-switch"><Link to="/login" className="text-link">Back to log in</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Forgot your password?</h1>
        <p className="auth-subtitle">Enter the email for your account and we&apos;ll send you a link to choose a new one.</p>

        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

        <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="field-input"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && <p id="email-error" className="field-error">{errors.email.message}</p>}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send the link'}
          </button>
        </form>

        <p className="auth-switch">
          Remembered it? <Link to="/login" className="text-link">Log in</Link>
        </p>
      </div>
    </div>
  )
}
```

Create `frontend/src/pages/ResetPasswordPage.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { usePageTitle } from '../hooks/usePageTitle'
import { resetPassword } from '../services/accountService'
import { useAuthStore } from '../store/authStore'
import { getApiError } from '../utils/apiError'
import './AuthPages.css'

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Use 72 characters or less')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Type the new password again'),
  })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'The passwords do not match' })

type ResetValues = z.infer<typeof resetSchema>

const INCOMPLETE_LINK = 'This link is not complete. Open it from the email again, or ask for a new one.'

export default function ResetPasswordPage() {
  usePageTitle('Choose a new password')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [linkProblem, setLinkProblem] = useState<string | null>(token ? null : INCOMPLETE_LINK)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) })

  const onSubmit = async ({ password }: ResetValues) => {
    setFormError(null)
    try {
      await resetPassword(token, password)
      // The server logged out every session; forget this one too.
      useAuthStore.getState().clearSession()
      navigate('/login', { replace: true, state: { message: 'Your password was changed. Log in with your new password.' } })
    } catch (error) {
      const apiError = getApiError(error)
      if (apiError.code === 'INVALID_RESET_LINK') setLinkProblem(apiError.message)
      else setFormError(apiError.message)
    }
  }

  if (linkProblem) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Choose a new password</h1>
          <div className="alert alert-error" role="alert">{linkProblem}</div>
          <Link to="/forgot-password" className="btn btn-primary btn-block">Ask for a new link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Choose a new password</h1>
        <p className="auth-subtitle">Saving it logs you out on every device.</p>

        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

        <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="field-input"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby="password-help"
              {...register('password')}
            />
            <p id="password-help" className={errors.password ? 'field-error' : 'field-hint'}>
              {errors.password?.message ?? 'At least 8 characters, including a letter and a number.'}
            </p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="confirmPassword">New password again</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="field-input"
              aria-invalid={errors.confirmPassword ? true : undefined}
              aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p id="confirm-error" className="field-error">{errors.confirmPassword.message}</p>}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add the routes and the login link**

In `frontend/src/App.tsx`, import both pages and add after the `/signup` route (no guard, so the link works whether or not someone is logged in):

```tsx
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
```

In `frontend/src/pages/LoginPage.tsx`:
1. Add `import { useFlashMessage } from '../hooks/useFlashMessage'` and `const flash = useFlashMessage()` after `usePageTitle('Log in')`.
2. Before the `formError` alert, add `{flash && <div className="alert alert-success" role="status">{flash}</div>}`.
3. After the password field's `</div>`, add:

```tsx
          <p className="auth-forgot">
            <Link to="/forgot-password" className="text-link">Forgot password?</Link>
          </p>
```

In `frontend/src/pages/AuthPages.css`, add:

```css
.auth-forgot {
  margin-top: -0.5rem;
  text-align: right;
  font-size: 0.9rem;
}
```

- [ ] **Step 6: Run the tests, lint and build**

Run: `cd frontend && npx vitest run src/services/accountService.test.ts src/pages/ResetPasswordPage.test.tsx && npm test && npm run lint && npm run build`
Expected: all frontend tests pass; lint and build succeed.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/accountService.ts frontend/src/services/accountService.test.ts frontend/src/pages/ForgotPasswordPage.tsx frontend/src/pages/ResetPasswordPage.tsx frontend/src/pages/ResetPasswordPage.test.tsx frontend/src/App.tsx frontend/src/pages/LoginPage.tsx frontend/src/pages/AuthPages.css
git commit -F - <<'EOF'
feat(web): forgot and reset password pages, with a link on the login page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 25: Part 4 check-in and the final review

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: Update the README and CLAUDE.md**

In `README.md`:
1. Project Status: the Phase 7 status cell becomes `✅ Done`.
2. "Available now": after the logout row add ``| POST | `/api/v1/auth/forgot-password` | Email a one-hour, one-use reset link (the same answer whether or not the account exists; at most one email every 2 minutes) |`` and ``| POST | `/api/v1/auth/reset-password` | Set a new password with the link's token; logs out every session and emails a "password changed" notice |``.
3. "Website pages": add `| Forgot / reset password | /forgot-password, /reset-password |` (addresses in backticks).
4. At the end of the "How notifications work (Phase 7b)" paragraph add: `"Forgot password?" on the login page emails a reset link that works once, for one hour; saving a new password logs out every device and sends a "your password was changed" email.`

In `CLAUDE.md`:
1. Repository Status: `Phases 1-4, 6 and 7 complete; Phase 5 waits for Stripe test keys (see "Build Plan" below)`; Build Plan item 7: `Map of nearby chefs, notifications: bell and email (done)`.
2. Append to the Notifications bullet: `Password reset: users.password_reset_token holds a unique SHA-256 hash; links last 1 hour, one reset email per account per 2 minutes; resetting clears the lock and every refresh token and sends PASSWORD_CHANGED.`

- [ ] **Step 2: Run the full verification**

Run, from the repo root:

```bash
npm test
cd backend && npx tsc --noEmit -p . && cd ../frontend && npm run lint && npm run build
```

Expected: every test passes (report the counts); tsc, lint and build are clean.

- [ ] **Step 3: Try it in the browser**

1. Restart the preview server. On `/login` (logged out), click **Forgot password?**, enter `customer@neighborskitchen.test`, send. The page says "Check your email".
2. Open `/dev/mailbox`: "Reset your Neighbors Kitchen password" (to Chris). Open the button's link from the preview (it opens a new tab; in the browser pane, copy the link from the plain-text view and open it). Choose a new password; the login page says "Your password was changed…". Log in with the new password. The mailbox now also has "Your Neighbors Kitchen password was changed".
3. Try the same link again: "This link has expired or was already used…" with "Ask for a new link".
4. Check the browser console for errors. Then `cd backend && npm run db:seed` (this also resets Chris's password to the demo password).

- [ ] **Step 4: Commit and push**

```bash
git add README.md CLAUDE.md
git commit -F - <<'EOF'
docs: phase 7b done - forgot password, and notifications in the README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push origin claude/neighbors-kitchen-chat-dk4r07
```

- [ ] **Step 5: Final review of the whole phase**

Ask a fresh reviewer (the most capable model) to review every commit of Phase 7b against the spec and this plan: correctness, security (reset links, the practice mailbox staying out of production, no addresses or phones in emails, escaping), races in the timed tasks and email claiming, and test quality. Fix each Important finding test-first (a failing test, then the fix), re-run the full verification, commit and push. Report the review's findings and what was done about each to the owner.

