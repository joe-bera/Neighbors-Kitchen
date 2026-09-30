# Phase 7b: Notifications - bell, email and the confirm-time promise (design)

Date: 2026-09-27. Approved in chat by the project owner (Master Joseph) the same day.
Phase 7a (the map) is done; this is the second half of Phase 7. It started as "email notifications" and grew, at the owner's request, into one notification system (a bell in the app plus email) and a confirm-time promise for chefs.

## In plain words

- A **bell** in the menu bar shows what happened (an order was confirmed, a new review arrived) with a count of unread items. Opening it marks them read; a "See all" page keeps the history.
- The important updates also arrive **by email**. People can switch off the optional emails on their Account page; the bell always shows everything.
- Chefs choose how fast they **promise to confirm** new orders (1, 4, 12 or 24 hours; 4 by default). Customers see the promise before ordering. The chef gets a reminder halfway; an order still unconfirmed at the deadline is cancelled automatically and both sides are told.
- **Forgot password**: a link on the login page sends a reset email. The app had no way to recover an account before.
- While we build, every email lands in a **practice mailbox** page on the owner's computer. No email service, sign-up or cost until Phase 8.

## Decisions (owner, 2026-09-27)

| Question | Decision |
|---|---|
| Which emails | All four groups: order updates, rate-your-meal reminder, reviews and dish requests, forgot password |
| Can people turn emails off? | Only the extras: rate-your-meal reminders, dish-request news, and (chefs) new reviews and dish requests. Order and password emails always go out. Switches affect email only. |
| Email, in-app, or both? | Both, as one system: every update goes under the bell; the important ones also send an email |
| Who hears about a dish-request answer | The person who asked hears any answer; people who voted for the dish hear only a yes |
| Orders a chef has not confirmed | The chef picks a promise (1, 4, 12 or 24 hours, default 4), shown to customers; reminder halfway; automatic cancellation at the deadline, or at the pickup or delivery time if that is sooner |
| How it runs | Notices and emails are saved in the same database step as the change; a small helper inside the API server sends emails and runs timed tasks. No Redis or other service. |
| Real email service | Phase 8, after asking the owner (for example Resend: needs the owner's own account and a web domain) |
| Build order | Four steps, each tried in the browser and pushed (see "Build order") |

## Who hears about what

One list of notice kinds drives both channels (`NotificationKind` enum). "Switch" is the user setting that can turn that email off.

| Kind | Recipient | Bell | Email | Switch |
|---|---|---|---|---|
| `ORDER_PLACED` | customer | - | receipt | - |
| `ORDER_CONFIRMED` | customer | yes | yes | - |
| `ORDER_PREPARING` | customer | yes | - | - |
| `ORDER_READY` | customer | yes | yes | - |
| `ORDER_CANCELLED_BY_CHEF` | customer | yes | yes | - |
| `ORDER_EXPIRED` | customer | yes | yes | - |
| `RATE_REMINDER` | customer | yes | yes | `emailRateReminders` |
| `DISH_REQUEST_ANSWERED` | the person who asked | yes | yes | `emailDishRequestNews` |
| `DISH_REQUEST_ACCEPTED` | each voter except the asker | yes | yes | `emailDishRequestNews` |
| `NEW_ORDER` | chef | yes | yes | - |
| `CONFIRM_REMINDER` | chef | yes | yes | - |
| `CHEF_ORDER_EXPIRED` | chef | yes | yes | - |
| `ORDER_CANCELLED_BY_CUSTOMER` | chef | yes | yes | - |
| `NEW_REVIEW` | chef | yes | yes | `emailKitchenFeedback` |
| `NEW_DISH_REQUEST` | chef | yes | yes | `emailKitchenFeedback` |
| `PASSWORD_RESET` | account owner | - | yes | - |
| `PASSWORD_CHANGED` | account owner | - | yes | - |

When each is created:

- `ORDER_PLACED` and `NEW_ORDER`: when a customer places an order.
- `ORDER_CONFIRMED`, `ORDER_PREPARING`, `ORDER_READY`: when the chef moves the order to that step. Completing an order creates no notice; it schedules the rate reminder.
- `ORDER_CANCELLED_BY_CHEF`: the chef declines (before confirming) or cancels. The wording says "declined" or "cancelled" accordingly and includes the chef's reason if given.
- `ORDER_CANCELLED_BY_CUSTOMER`: the customer cancels (with their reason, if given). The customer gets no notice for their own action.
- `CONFIRM_REMINDER`: halfway to the confirm deadline, if the order is still waiting.
- `ORDER_EXPIRED` and `CHEF_ORDER_EXPIRED`: when the deadline passes with the order still waiting and the app cancels it.
- `RATE_REMINDER`: `RATE_REMINDER_DELAY_MINUTES` (120) after the chef marks the order completed, only if at least one meal in it has no review yet.
- `DISH_REQUEST_ANSWERED`: when the chef saves an answer that changes the request's status or reply text.
- `DISH_REQUEST_ACCEPTED`: when the status changes to `ACCEPTED` (not when an accepted request is saved again).
- `NEW_REVIEW`, `NEW_DISH_REQUEST`: when a customer submits one. Votes create no notice.
- `PASSWORD_RESET`, `PASSWORD_CHANGED`: see "Forgot password".

Bell links (in-app paths): customer order kinds and `RATE_REMINDER` go to `/orders/:orderId`; dish-request kinds to `/chefs/:chefId#requests-heading`; chef order kinds to `/chef/orders`; `NEW_REVIEW` and `NEW_DISH_REQUEST` to `/chef/feedback`.

Names and wording: customers appear to chefs as "Dana K." (`chefDisplayName`), as elsewhere; kitchens appear by kitchen name ("Abuela's Table"). Times use the chef's time zone, like the rest of the app ("Tue, Sep 29 at 6:00 PM"). Copy never guesses anyone's pronouns: it uses names, "the chef" or "the order".

Examples of the bell text (title / line under it):

- `ORDER_CONFIRMED`: "Abuela's Table confirmed your order" / "NK-7QX4PD · Tue, Sep 29 at 6:00 PM"
- `ORDER_READY`: "Your order is ready for pickup" (or "Your order is on its way") / "NK-7QX4PD from Abuela's Table"
- `ORDER_EXPIRED`: "Your order was cancelled" / "Abuela's Table didn't confirm NK-7QX4PD in time"
- `DISH_REQUEST_ACCEPTED`: "Good news: Kenji's Kitchen will make Chicken karaage bento" / "You voted for this dish"
- `NEW_ORDER`: "New order from Dana K." / "NK-7QX4PD · Confirm by 3:15 PM"
- `CONFIRM_REMINDER`: "Order NK-7QX4PD still needs your confirmation" / "Confirm by 3:15 PM or it will be cancelled automatically"

## Data changes

Step 1's migration creates both enums with every value; each build step then adds the tables and columns it first needs in its own migration.

- Enums: `NotificationKind` (the 17 kinds above) and `EmailStatus` (`PENDING`, `SENDING`, `SENT`, `FAILED`).
- New table `notifications` (the bell): `id`, `user_id` (cascade delete), `kind`, `title`, `body` (nullable), `link`, `read_at` (nullable), `created_at`. Index on `(user_id, created_at)`.
- New table `emails` (the to-do list, and the practice mailbox's record): `id`, `user_id` (cascade delete), `to_address` (copied when queued), `kind`, `data` (JSON: everything the template needs, captured when queued), `status` (default `PENDING`), `attempts` (default 0), `send_after` (default now), `last_error`, `subject`, `html`, `text_body` (the last three filled in when the email is written, just before sending), `sent_at`, `created_at`, `updated_at`. Index on `(status, send_after)`.
- `users`: `email_rate_reminders`, `email_dish_request_news`, `email_kitchen_feedback` (booleans, default true). The existing `password_reset_token` column gets a unique index and holds a SHA-256 hash (never the token itself); `password_reset_expires` is used as is.
- `chef_profiles.confirm_within_hours` (integer, default 4; the API accepts only 1, 4, 12 or 24).
- `orders.confirm_by` (nullable: orders placed before this feature have no deadline and are never reminded or cancelled), `orders.chef_reminder_at` (nullable; cleared once the reminder is handled), `orders.rate_reminder_at` (nullable; cleared once handled). Indexes on `(status, confirm_by)`, `(status, chef_reminder_at)`, `(status, rate_reminder_at)`.

## Backend

### Creating notices

`notify(tx, recipient, kind, data)` in `services/notifications/notify.ts` is the only way notices are created. It runs inside the caller's transaction, so a notice exists exactly when the change it describes was saved:

- The recipient is the user row (id, email, active flag, the three switches).
- If the kind has a bell entry, it inserts a `notifications` row with the title, line and link from `bellText(kind, data)` (plain text, pure function).
- If the kind has an email and the recipient's switch for it (if any) is on, it inserts an `emails` row (`PENDING`, `data` = the snapshot). The email is written later, when sent.
- Inactive users get nothing.

Kinds, their rules (bell, email, switch) and the TypeScript type of each kind's `data` live together in `services/notifications/kinds.ts`, so adding a kind means one entry there plus its bell text and email template. Order kinds share one data builder (order id and number, kitchen name, chef id, customer display name, meals and quantities, scheduled time and time zone, pickup or delivery, totals and the chef's payout, confirm deadline, reason).

### Writing emails

`renderEmail(kind, data)` in `services/notifications/emailTemplates.ts` returns `{ subject, html, text }` (pure). One shared layout: the "Neighbors Kitchen" name on the brand color (`#5a67d8` on white, gradient `#667eea` to `#764ba2` in the header), a heading, a few short lines, an optional details table (meals, time, total), one button, and a footer. Table-based HTML with inline styles so email apps show it correctly, plus a plain-text version. Every value from users (names, meal names, reasons, review text, dish names) is HTML-escaped. Links are `FRONTEND_URL` plus the path. The footer says why the person got the email; for switchable kinds it adds "Turn these emails off in your account settings" linking to `/account#email-settings`.

Emails show no more than the website does: they never include a chef's street address or a customer's phone number or delivery address. Pickup emails say the address is on the order page. Chef emails include the payout; customer emails never mention the platform fee.

Subjects:

| Kind | Subject |
|---|---|
| `ORDER_PLACED` | Your order NK-7QX4PD was sent to Abuela's Table |
| `ORDER_CONFIRMED` | Abuela's Table confirmed your order NK-7QX4PD |
| `ORDER_READY` | Your order NK-7QX4PD is ready for pickup / is on its way |
| `ORDER_CANCELLED_BY_CHEF` | Abuela's Table declined / cancelled your order NK-7QX4PD |
| `ORDER_EXPIRED` | Your order NK-7QX4PD was cancelled |
| `RATE_REMINDER` | How was your meal from Abuela's Table? |
| `DISH_REQUEST_ANSWERED` | Abuela's Table answered your dish request |
| `DISH_REQUEST_ACCEPTED` | Good news: Kenji's Kitchen will make Chicken karaage bento |
| `NEW_ORDER` | New order NK-7QX4PD: please confirm by Tue, Sep 29 at 3:15 PM |
| `CONFIRM_REMINDER` | Reminder: order NK-7QX4PD needs your confirmation by 3:15 PM |
| `CHEF_ORDER_EXPIRED` | Order NK-7QX4PD was cancelled because it wasn't confirmed in time |
| `ORDER_CANCELLED_BY_CUSTOMER` | Dana K. cancelled order NK-7QX4PD |
| `NEW_REVIEW` | New review: 5 stars for Chicken Enchilada Casserole |
| `NEW_DISH_REQUEST` | New dish request: Birria tacos with consommé |
| `PASSWORD_RESET` | Reset your Neighbors Kitchen password |
| `PASSWORD_CHANGED` | Your Neighbors Kitchen password was changed |

### Sending emails

`deliverDueEmails(now, transport)` in `services/notifications/emailDelivery.ts`:

1. Returns emails stuck in `SENDING` for over 10 minutes (a crash mid-send) to `PENDING`.
2. Claims up to 20 due emails (`PENDING`, `send_after <= now`, oldest first) by switching them to `SENDING` and adding 1 to `attempts`, using `FOR UPDATE SKIP LOCKED` so two servers never claim the same email.
3. For each: writes it with `renderEmail` and saves subject, HTML and text on the row; sends it; marks it `SENT` with `sent_at`.
4. A sending failure puts it back to `PENDING` with `send_after` pushed out by 1, 5, 30 and then 120 minutes; the fifth failure marks it `FAILED`. A writing failure (a template bug) marks it `FAILED` straight away. `last_error` keeps the message. Email addresses and contents are never written to the logs.

The transport is an interface: `{ keepsCopies: boolean; send(email): Promise<void> }`. This phase has one, the **mailbox** transport (`EMAIL_TRANSPORT=mailbox`, the default): it sends nothing and keeps the row as the practice mailbox's copy. Phase 8 adds a real one. For transports that do not keep copies, a sent `PASSWORD_RESET` email has its token removed from `data` and its HTML and text replaced with "(removed after sending)", so the database never holds working reset links.

### Timed tasks

Each takes `now` (so tests can control time), works in batches of 50, and changes each order with a conditional update inside a transaction, so repeating a run or running two servers at once never acts twice:

- `expireOverdueOrders(now)` (`orderService.ts`): `PENDING` orders with `confirm_by <= now` become `CANCELLED` (only if still `PENDING`), with the reason "Abuela's Table didn't confirm this order in time." and a matching order event; notifies `ORDER_EXPIRED` (customer) and `CHEF_ORDER_EXPIRED` (chef).
- `sendChefReminders(now)` (`orderService.ts`): `PENDING` orders with `chef_reminder_at <= now`: clears `chef_reminder_at` and notifies `CONFIRM_REMINDER`.
- `sendRateReminders(now)` (`reviewService.ts`): `COMPLETED` orders with `rate_reminder_at <= now`: clears `rate_reminder_at`; notifies `RATE_REMINDER` if any meal in the order has no review.

### The helper

`startBackgroundJobs()` (`jobs/backgroundJobs.ts`) is started by `index.ts` after the server starts listening (never by `createApp`, so tests do not run it). Every `JOBS_INTERVAL_MS` (5000) it runs, in order: `expireOverdueOrders`, `sendChefReminders`, `sendRateReminders`, `deliverDueEmails`. The next run is scheduled when the current one finishes (no overlapping runs). Each task is wrapped in its own try/catch; a failure is logged and the rest still run. It never stops the server.

### Order changes (`orderService.ts`)

- `placeOrder`: sets `confirm_by` = the earlier of (now + the chef's `confirm_within_hours`) and `scheduledFor`, and `chef_reminder_at` = halfway between now and `confirm_by`. Because pickup times are at least the chef's lead time (1 hour or more) away, the deadline is always in the future. Notifies `NEW_ORDER` (chef) and `ORDER_PLACED` (customer) in the same transaction as the order.
- `advanceOrderStatus`: notifies `ORDER_CONFIRMED`, `ORDER_PREPARING` or `ORDER_READY`; on `COMPLETED` sets `rate_reminder_at` = now + `RATE_REMINDER_DELAY_MINUTES`.
- Cancelling (the shared `cancelOrder`) learns who cancelled and notifies the other side.
- A chef's later change to their promise does not affect orders already placed.
- The customer and chef order views gain `confirmBy` (null when the order has no deadline).

### Reviews and dish requests

- `createReview` notifies `NEW_REVIEW` (the chef) inside its transaction.
- `createSuggestion` runs in a transaction and notifies `NEW_DISH_REQUEST`.
- `updateSuggestion` reads the request first (in a transaction), saves the answer, then notifies `DISH_REQUEST_ANSWERED` if the status or reply changed and, when the status just became `ACCEPTED`, `DISH_REQUEST_ACCEPTED` to every voter except the asker.

### Confirm-time promise (chef setting)

- `PUT /api/v1/chefs/me/availability` accepts an optional `confirmWithinHours` (1, 4, 12 or 24); left out, the current value stays (existing callers keep working). `GET /api/v1/chefs/me` and the public `GET /api/v1/chefs/:id` include it.

### Forgot password

- `POST /api/v1/auth/forgot-password` `{ email }`: always answers 200 with "If there's an account for that email, we sent a link to reset the password." When an active account exists, it stores the SHA-256 hash of a new random token (32 bytes, base64url) with a 1-hour expiry and queues `PASSWORD_RESET` (first name + token), in one transaction. Asking again replaces the token, so only the newest link works. At most one reset email per account every 2 minutes (a request within 2 minutes of the last one sends nothing but gives the same answer), so nobody can flood an inbox.
- `POST /api/v1/auth/reset-password` `{ token, password }`: the password follows the sign-up rules. An unknown, used or expired token gets 400 `INVALID_RESET_LINK` "This link has expired or was already used. Ask for a new one." Success, in one transaction: new password hash, token and expiry cleared, failed-login count and lock cleared, every refresh token deleted (logged out everywhere), `PASSWORD_CHANGED` queued. Answers 200; the person then logs in.
- Both routes use the existing tighter sign-up/login rate limit.
- The reset link is `FRONTEND_URL/reset-password?token=...`; the token stays out of the logs.

### Email settings

- `GET /api/v1/users/me` gains `emailSettings: { rateReminders, dishRequestNews, kitchenFeedback }`.
- `PUT /api/v1/users/me/email-settings` takes any of those three booleans and returns all three.

### Bell API (`routes/notificationRoutes.ts`, signed-in users, own notices only)

- `GET /api/v1/notifications?limit=20` (1 to 50): `{ notifications: [{ id, kind, title, body, link, createdAt, read }], unreadCount }`, newest first.
- `GET /api/v1/notifications/unread-count`: `{ unreadCount }` (the cheap call the bell repeats).
- `POST /api/v1/notifications/read-all`: marks all of the user's notices read; returns `{ unreadCount: 0 }`.

### Practice mailbox (`routes/devRoutes.ts`)

- Mounted at `/api/v1/dev` only when `EMAIL_TRANSPORT` is `mailbox` and `NODE_ENV` is not `production`. It needs no login (it only exists on a developer's computer) and is never available on the live site, because it shows everyone's emails.
- `GET /api/v1/dev/emails`: the latest 100 emails (to, kind, subject, status, attempts, last error, created and sent times). `GET /api/v1/dev/emails/:id`: one email with its HTML and text.

### Settings (`config/env.ts` and `.env.example`)

- `EMAIL_TRANSPORT` (`mailbox`, default `mailbox`), `EMAIL_FROM` (default `Neighbors Kitchen <no-reply@neighborskitchen.test>`), `JOBS_INTERVAL_MS` (default 5000), `RATE_REMINDER_DELAY_MINUTES` (default 120). `.env.example` and the owner's local `backend/.env` set `RATE_REMINDER_DELAY_MINUTES=2` so the reminder can be tried in minutes; the code default stays 120. The old commented `EMAIL_FROM_NAME` line goes.

## Frontend

- **Bell** (`components/layout/NotificationBell.tsx`): for signed-in users, always visible in the bar (outside the phone drop-down menu, next to its button). Shows the unread count on a badge; the button's label reads "Notifications, 3 unread". It asks for the count when a page changes and every 60 seconds. Opening it loads the latest 8, shows unread ones highlighted, then marks all read (the badge clears). Each item shows its title, line and how long ago ("5 min ago"), and opens its link. Escape or a click outside closes it. Empty state: "Nothing yet. We'll let you know when something happens." A "See all" link goes to the notifications page.
- **Notifications page** (`/notifications`, signed-in): the latest 50, same items; visiting marks all read.
- **Account page**: an "Email settings" card (`id="email-settings"`) with switches that save as they are flipped: "Rate-your-meal reminders", "Answers to my dish requests" (including a yes on a dish you voted for), and for chefs "New reviews and dish requests". A note: "Order updates and password emails always go out. The bell shows everything."
- **Forgot password**: "Forgot password?" on the login page opens `/forgot-password` (email box, then the same answer whether or not the account exists, with a pointer to the practice mailbox while in development). The email's link opens `/reset-password?token=...` (new password twice); success goes to the login page with "Your password was changed. Log in with your new password." An expired link shows the error with a link to ask again.
- **Hours & delivery page**: a "Confirm new orders within" choice (1 hour, 4 hours, 12 hours, 24 hours) with the help text "Customers see this before they order. You get a reminder halfway, and orders you haven't confirmed by then are cancelled automatically."
- **Kitchen page and checkout**: "Confirms orders within 4 hours." At checkout: "If Abuela's Table hasn't confirmed your order within 4 hours (or by the pickup or delivery time, if that's sooner), it's cancelled automatically and you'll be told right away."
- **Order page (customer), waiting orders with a deadline**: "Waiting for Abuela's Table to confirm by Tue, Sep 29 at 3:15 PM. If it isn't confirmed by then, it will be cancelled automatically."
- **Chef order list**: waiting orders with a deadline show "Confirm by 3:15 PM".
- **Practice mailbox** (`/dev/mailbox`): only in development builds (the route and its lazy-loaded page sit behind `import.meta.env.DEV`, so the live site's bundle leaves them out), with a "Practice mailbox" link in the footer in development only. A list of emails (newest first: subject, to, status, time) and the chosen email shown as it would look, in a sandboxed frame with scripts off whose links open in a new tab, plus a "Plain text" view. Failed emails show their error.

## Seed data

- Sample chefs get a mix of promises (1, 4 and 12 hours).
- The demo accounts start with a few unread bell items that match the sample data: for Chris (customer demo), Kenji's yes to "Chicken karaage bento", which Chris voted for; for Maria (chef demo), a recent review and the birria dish request. Re-seeding replaces them rather than adding more.
- No sample emails.

## Privacy and security

- Notices and emails go only to the people involved in the order, review or request. The bell API only returns the signed-in user's own notices.
- Emails carry no street addresses, phone numbers or platform fee (see "Writing emails"); user text is escaped.
- The account row stores only a hash of the reset token. The token itself sits in its email's to-do row until the email is sent; with a real email service it is then erased (the practice mailbox keeps it so the link can be clicked in development). Links work once, expire after 1 hour, are rate limited and never logged; resetting logs out every session. The forgot-password answer never reveals whether an account exists.
- The practice mailbox exists only outside production.

## Error handling

- A notice is part of the change's own transaction: if saving the change fails, no notice exists; if it succeeds, the notice is certain.
- Email writing and sending happen later in the helper, so a slow or failing email, or a template bug, never slows down or blocks an order, review or request. Failures retry on the schedule above and then show as failed in the practice mailbox.
- The timed tasks re-check the order's state in their conditional updates: an order confirmed, cancelled or already reminded is left alone.
- Sending is "at least once": if the server crashes after sending but before marking the email sent, that one email may go out twice. Everything else happens exactly once.

## Testing

Tests first for each rule (backend: Vitest + Supertest against the test database; frontend: Vitest with MSW):

- `notify`: bell rows and email rows per kind; switches turn off only their emails; inactive users get nothing.
- Order notices: placing, each status change, declining vs cancelling, customer cancellations; nothing for the customer's own cancellation.
- Confirm deadline: `confirm_by` and `chef_reminder_at` for a normal order and for one whose pickup comes before the promise; the reminder fires once and only while waiting; expiry cancels only overdue waiting orders, records the reason and event, and notifies both sides; orders without a deadline are ignored; running a task twice acts once.
- Rate reminder: sent after the delay only when some meal is unrated; cleared either way.
- Reviews and requests: new review, new request, answered (status or reply changed, not otherwise), accepted (voters except the asker, only on the change to accepted).
- Email delivery: claiming, sending, retry schedule, failure after five tries, template bug fails at once, stuck `SENDING` returns, a non-copy-keeping transport erases reset links.
- Templates: escaping, links built from `FRONTEND_URL`, footer switch link only on switchable kinds, no street address or phone in any email.
- Forgot/reset password: same answer for unknown emails, token stored hashed, 1-hour expiry, single use, 2-minute limit, new token replaces the old, sessions cleared, lock cleared, `PASSWORD_CHANGED` queued.
- Bell API: own notices only, limits, unread count, read-all. Email settings API. Practice mailbox routes.
- Frontend: notification, settings and password services; "5 min ago" formatting; confirm-deadline wording.
- After each build step: full test suites, type checks, lint and build, then a click-through in the browser with screenshots, then commit and push.

## Build order

1. **Order alerts**: notice kinds and tables, `notify`, templates, delivery helper, practice mailbox (API and page), the order notices (placed, confirmed, preparing, ready, declined/cancelled either way), bell API, the bell and the notifications page. Try it: Chris orders from Abuela's Table; Maria's bell lights up; both emails are in the practice mailbox; Maria confirms and Chris's bell lights up.
2. **Reviews, dish requests and reminders**: new review, new request, answered and accepted notices, the rate reminder, email settings (API and Account page), demo bell items in the seed.
3. **Confirm-time promise**: the chef setting, the kitchen page and checkout text, deadlines on new orders, the halfway reminder, automatic cancellation, the order page and chef list wording.
4. **Forgot password**: both routes, both emails, the login link and the two pages.

## Out of scope and later

- A real email service (Phase 8, ask first): an account (for example Resend's free tier), a web domain and its email records (SPF/DKIM). Until then emails only reach the practice mailbox.
- Confirming email addresses at sign-up, and a welcome email.
- Phone push notifications and text messages (they need a phone app or a paid texting service).
- Instant (live) bell updates; the bell checks every minute.
- Emails in Spanish (the app is English-only today).
- Deleting old notices and emails.
- Payments (Phase 5): when an order is cancelled automatically, the card hold will be released at the same time.
- Telling a customer when a chef replies to their review.
