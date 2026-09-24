# Neighbors-Kitchen

A community marketplace platform connecting local chefs with neighbors who want delicious, home-cooked meals. Think of it as "Airbnb for local chefs."

## Project Status

The app is being built in eight phases. Each phase is tested and runnable before the next one starts.

| Phase | What it adds | Status |
|-------|--------------|--------|
| 1. Foundation | Database connected, sample chefs and meals, sign-up and login for customers and chefs | ✅ Done |
| 2. Customers | Browse and search chefs and meals, chef profile pages, meal pages, working landing page buttons | ✅ Done |
| 3. Chefs | Become a chef, chef dashboard, add and edit meals with photos, set availability | ✅ Done |
| 4. Ordering | Cart, pre-orders with pickup or delivery times, order tracking for customers and chefs | ✅ Done |
| 5. Payments | Stripe (test mode), platform fee, chef payouts | ⏸ Waiting for Stripe test keys |
| 6. Trust | Reviews, ratings and dish suggestions | ✅ Done |
| 7. Local | Find chefs near you on a map, email notifications | 🚧 Map done, emails next |
| 8. Launch | Put it live on the internet | ⏳ |

Phase 6 was built before Phase 5, which is waiting for a Stripe account.

**Phase 5 needs:** a free Stripe account in test mode. Paste the two test keys from dashboard.stripe.com > Developers > API keys into `backend/.env` (`STRIPE_PUBLISHABLE_KEY=pk_test_...` and `STRIPE_SECRET_KEY=sk_test_...`) and turn on Stripe Connect (Connect > Get started) so chefs can be paid out. Test mode never moves real money.

## Features

### Core Features
- **Chef Profiles:** Chefs create profiles showcasing their culinary background and specialties
- **Menu Management:** Dynamic menu creation with photos, descriptions, and pricing
- **Pre-Order System:** Customers can browse and pre-order meals with flexible pickup/delivery
- **Payment Processing:** Secure payment handling with chef payouts via Stripe
- **Review & Rating System:** Build trust through authentic customer reviews
- **Suggestion System:** Customers can request specific dishes or dietary accommodations
- **Local Discovery:** Location-based matching to connect neighbors
- **Scheduling:** Chefs set availability and meal preparation timelines

## Tech Stack

### Frontend
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router
- **State Management:** Zustand
- **Forms:** React Hook Form with Zod validation
- **API Client:** Axios
- **Tests:** Vitest + MSW

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express 5 with TypeScript
- **Database:** PostgreSQL with Prisma ORM (a private local server runs from npm for development)
- **Authentication:** JWT access tokens + httpOnly refresh-token cookie, bcrypt password hashing, account lockout
- **Security:** Helmet, CORS, rate limiting, Zod input validation
- **Tests:** Vitest + Supertest against a real test database

### Future Integrations
- Stripe (payment processing)
- Cloudinary or similar (image storage in production)
- Email service (notifications)
- A map tile provider for production traffic (OpenStreetMap's free tiles are meant for light use)

## Project Structure

```
Neighbors-Kitchen/
├── package.json          # One-command scripts: npm run setup, npm run dev, npm test
├── frontend/             # React app (http://localhost:3000)
│   └── src/
│       ├── components/   # layout/, auth/, common/, meal/, chef/, cart/, order/, feedback/, location/
│       ├── pages/        # customer pages; pages/chef/ holds the chef dashboard
│       ├── services/     # API client (api.ts) and one service file per area
│       ├── store/        # Zustand stores (authStore)
│       ├── hooks/, types/, utils/
│
├── backend/              # Express API (http://localhost:4000/api/v1)
│   ├── src/
│   │   ├── app.ts        # Express app (used by the server and the tests)
│   │   ├── index.ts      # Starts the server
│   │   ├── config/       # Validated environment settings
│   │   ├── controllers/, routes/, services/, middleware/, validators/
│   ├── prisma/           # schema.prisma, migrations/, seed.ts (sample data)
│   ├── data/             # zip-centroids.csv (ZIP code locations, US Census Bureau)
│   ├── scripts/          # db.mjs (local Postgres), ensure-env.mjs, build-zip-centroids.mjs
│   └── tests/            # API tests
│
└── CLAUDE.md             # AI assistant guide
```

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- Git

That's it. PostgreSQL does not need to be installed: the project runs its own private copy from npm.

### First-time setup

```bash
git clone https://github.com/joe-bera/Neighbors-Kitchen.git
cd Neighbors-Kitchen
npm run setup
```

`npm run setup` installs everything, creates `backend/.env`, starts the local database, creates the tables and loads the sample data.

### Run the app

```bash
npm run dev
```

Then open **http://localhost:3000**. This starts the database (if needed), the API on port 4000 and the website on port 3000. Press `Ctrl+C` to stop the website and API. The database keeps running in the background; stop it with `npm run db:stop`.

### Demo accounts

The sample data includes 8 chefs across the Inland Empire and Coachella Valley, 35 meals, 5 customers, 24 past orders with 23 reviews, and 6 dish requests. Every demo account uses the password `Password123`.

| Account | Email |
|---------|-------|
| Customer (Chris) | `customer@neighborskitchen.test` |
| More customers (the neighbors who wrote the sample reviews) | `dana@`, `luis@`, `hannah@`, `marcus@neighborskitchen.test` |
| Chefs | `maria@`, `kenji@`, `aisha@`, `tony@`, `grace@`, `priya@`, `linh@`, `sofia@neighborskitchen.test` |

Chris's past order NK-DEMO08 (Chicken Katsu Curry from Tanaka Home Kitchen) is left unreviewed so you can try "Rate your meals".

In development, the login page has "Customer demo" and "Chef demo" buttons that fill these in.

### Where the database lives

The local database is stored in `~/.neighbors-kitchen/pgdata` (outside the project folder) and listens on port 5433. It is kept out of the project on purpose, so folder-sync tools like iCloud Drive never touch a running database. Set `LOCAL_PG_DATA_DIR` to use a different folder.

## Available Scripts

### From the project root
```bash
npm run setup     # First-time install, database and sample data
npm run dev       # Run database + API + website together
npm test          # Run backend and frontend tests
npm run build     # Production builds of backend and frontend
npm run db:start  # Start the local database
npm run db:stop   # Stop the local database
npm run db:seed   # Reload the sample data (safe to repeat)
```

### Backend (`cd backend`)
```bash
npm run dev          # API with hot reload
npm test             # API tests (uses a separate test database)
npm run build        # Compile to dist/
npm run db:migrate   # Create and apply a new migration after changing schema.prisma
npm run db:reset     # Wipe the database, re-apply migrations and reload sample data
npm run db:studio    # Browse the data in Prisma Studio
```

### Frontend (`cd frontend`)
```bash
npm run dev      # Website with hot reload
npm test         # Frontend tests
npm run build    # Production build
npm run lint     # ESLint
```

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:

- **Users** - Customer and chef accounts with role-based access
- **RefreshTokens** - Login sessions (only hashed tokens are stored)
- **ChefProfiles** - Chef-specific information including kitchen name, location and ratings
- **ChefAvailability** - Each chef's weekly cooking hours
- **Menus** - Chef menu collections
- **Meals** - Individual dishes with pricing and dietary tags
- **Orders**, **OrderItems**, **OrderEvents** - Orders, the meals in them, and every status change
- **Reviews** - Customer reviews with ratings and the chef's reply
- **Suggestions**, **SuggestionVotes** - Dish requests to chefs and who wants them
- **Payments** - Payment and payout tracking (used from Phase 5)

See `backend/prisma/schema.prisma` for complete schema details.

## API Documentation

The API follows RESTful conventions and is versioned at `/api/v1/`. Responses look like `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message", "details" } }`.

### Available now
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create a customer or chef account |
| POST | `/api/v1/auth/login` | Log in (locks for 15 minutes after 5 wrong passwords) |
| POST | `/api/v1/auth/refresh-token` | Get a new access token using the refresh cookie |
| POST | `/api/v1/auth/logout` | Log out and revoke the refresh token |
| GET | `/api/v1/users/me` | The signed-in user, with a kitchen summary for chefs |
| GET | `/api/v1/chefs` | Browse chefs: `search`, `city`, `cuisine`, `page`, `limit`. Add `near=92373` (a ZIP code) or `lat` + `lng` (the browser's location) to list chefs nearest first, each with `distanceMiles`, and `maxDistance` to limit the miles |
| GET | `/api/v1/chefs/map` | Every matching chef's approximate area for the map (same filters, no pages), plus where the search starts |
| GET | `/api/v1/chefs/:id` | Chef profile with menus of meals that can be ordered, and the approximate `area` where they cook |
| GET | `/api/v1/meals` | Browse meals: `search`, `category`, `cuisine`, `dietary` (comma-separated, all must match), `maxPrice`, `chefId`, `sort` (`recommended`, `price_asc`, `price_desc`, `newest`), `page`, `limit` |
| GET | `/api/v1/meals/filters` | Cuisines, dietary tags and cities that currently have meals |
| GET | `/api/v1/meals/:id` | Meal details, its chef, and more meals from the same chef |
| POST | `/api/v1/chefs` | Become a chef: set up a kitchen (customers are upgraded to chefs) |
| GET / PUT | `/api/v1/chefs/me` | The signed-in chef's own kitchen, including private address; update it or pause orders |
| PUT | `/api/v1/chefs/me/availability` | Weekly hours, order lead time, pickup/delivery and delivery fee |
| GET / POST | `/api/v1/chefs/me/meals` | The chef's own meals (including hidden ones); add a meal |
| PUT / DELETE | `/api/v1/chefs/me/meals/:id` | Edit, hide/show or delete a meal (meals with orders cannot be deleted) |
| POST | `/api/v1/uploads/meal-photo` | Upload a meal photo (JPG/PNG/WebP, max 5 MB); saved as a resized WebP without location data |
| GET | `/api/v1/chefs/:id/order-slots` | Pre-order times: every 30 minutes inside the chef's hours, after their lead time, up to 2 weeks ahead |
| POST | `/api/v1/orders` | Place a pre-order (prices come from the menu; checks hours, lead time, daily limits, and that delivery addresses are within the chef's delivery distance) |
| GET | `/api/v1/orders`, `/api/v1/orders/:id` | The customer's orders; the chef's pickup address is shown once the chef confirms |
| POST | `/api/v1/orders/:id/cancel` | Customer cancels (allowed until the chef starts cooking) |
| GET | `/api/v1/chefs/me/orders?view=active\|past` | Orders received by the signed-in chef, with payout after the platform fee |
| POST | `/api/v1/chefs/me/orders/:id/status` | Chef moves an order one step: CONFIRMED → PREPARING → READY → COMPLETED |
| POST | `/api/v1/chefs/me/orders/:id/cancel` | Chef declines or cancels an order, with an optional reason |
| GET | `/api/v1/chefs/:id/reviews`, `/api/v1/meals/:id/reviews` | Reviews of a chef's meals or of one meal, newest first (`page`, `limit`) |
| POST | `/api/v1/reviews` | Rate a meal from your own completed order: 1 to 5 stars and an optional comment, once per meal per order |
| POST | `/api/v1/reviews/:id/report` | Report a review for a moderator to look at, with an optional reason |
| GET | `/api/v1/chefs/:id/suggestions` | Dish requests for a kitchen, most wanted first (declined ones are hidden); signed-in viewers see which ones they voted for |
| POST | `/api/v1/chefs/:id/suggestions` | Request a dish (up to 5 open requests per person per kitchen) |
| POST / DELETE | `/api/v1/suggestions/:id/vote` | "I want this too", or take the vote back |
| GET | `/api/v1/chefs/me/reviews` | Reviews of the signed-in chef's meals |
| POST | `/api/v1/chefs/me/reviews/:id/response` | Chef posts or edits a public reply to a review |
| GET | `/api/v1/chefs/me/suggestions` | Dish requests sent to the signed-in chef's kitchen |
| PUT | `/api/v1/chefs/me/suggestions/:id` | Chef answers a request: thinking about it, yes, or not for my kitchen, with an optional message |
| GET | `/health` | Health check |

List endpoints return `pagination: { page, limit, total, totalPages }`. Public responses never include a chef's street address, exact location or contact details.

### Coming in later phases
Payments (Phase 5) and email notifications (Phase 7).

## Website pages

| Page | Address |
|------|---------|
| Home, with search and featured dishes and chefs | `/` |
| Browse and filter meals | `/meals` |
| Meal details | `/meals/:id` |
| Browse chefs | `/chefs` |
| Chefs near a ZIP code, as a list or a map | `/chefs?near=92373`, `/chefs?near=92373&view=map` |
| Chef profile and menu | `/chefs/:id` |
| Sign up / Log in | `/signup`, `/login` |
| My account | `/account` |
| Set up a kitchen (become a chef) | `/chef/setup` |
| Chef dashboard: overview, meals, hours & delivery, kitchen profile | `/chef`, `/chef/meals`, `/chef/availability`, `/chef/kitchen` |
| Add / edit a meal | `/chef/meals/new`, `/chef/meals/:id/edit` |
| Cart and checkout | `/cart`, `/checkout` |
| Your orders and order tracking | `/orders`, `/orders/:id` |
| Chef's incoming orders | `/chef/orders` |
| Chef's reviews and dish requests | `/chef/feedback`, `/chef/feedback?view=requests` |

**How orders work (Phase 4):** customers fill a cart from one kitchen at a time, pick pickup or delivery and a time slot, and place a pre-order. The chef confirms (or declines), then marks it preparing, ready and picked up/delivered; the customer's order page follows along. Neighbors Kitchen keeps a 10% commission of the meal subtotal from the chef's payout (`PLATFORM_FEE_PERCENT`); customers pay the menu prices plus any delivery fee. Payment is collected in Phase 5.

**How reviews and dish requests work (Phase 6):** once an order is completed, the customer's order page shows "Rate your meals" (stars plus an optional comment, one review per meal). Only real orders can be reviewed, so every review is a verified purchase. Ratings on chef and meal pages update right away. Chefs reply publicly from the Feedback tab of their dashboard, and anyone signed in can report a review. On a chef's page, neighbors can request a dish and vote "I want this too"; the chef answers each request (thinking about it, yes, or not for my kitchen) with an optional message shown on their page.

**How location works (Phase 7):** a kitchen is placed on the map from its street address when the chef saves it (US Census Bureau geocoder, free). If only its ZIP code can be found, it is placed in the middle of the ZIP code, the chef's Kitchen profile says so and asks them to check the address, the next save tries again, and delivery distances are not checked until the street address is found. Neighbors only ever see an approximate area: a circle about a mile across that contains the kitchen but is not centered on it, and every distance is measured to that circle. The circle is only redrawn when the kitchen really moves, so editing the address text cannot be used to narrow down a home. Customers search from a ZIP code or their browser's location (rounded to about half a mile and never stored). Delivery orders from farther than the chef delivers are turned down at checkout; if an address cannot be found at all, the order goes through and the chef can decline it. Map tiles © OpenStreetMap contributors. ZIP code locations come from the US Census Bureau Gazetteer (public domain) in `backend/data/zip-centroids.csv`; rebuild it with `node scripts/build-zip-centroids.mjs` (see the script for the download link).

Uploaded photos are stored in `backend/uploads/` during development (not committed to git). Production photo storage is set up in Phase 8.

## Environment Variables

### Backend (`backend/.env`)
Created automatically by `npm run setup` from `.env.example`. Key settings:
- `DATABASE_URL` - PostgreSQL connection string (local default: port 5433)
- `JWT_SECRET` - Secret for signing access tokens (a random one is generated for you)
- `PORT` - API port (default 4000)
- `FRONTEND_URL` - Website URL allowed by CORS
- `GEOCODER` - `census` (default: the free US Census Bureau address lookup, no key needed) or `off`

### Frontend (`frontend/.env`, optional)
- `VITE_API_URL` - Leave empty in development; Vite forwards `/api` to the backend

## Security

- Passwords hashed with bcrypt (12 rounds)
- Short-lived JWT access tokens kept in memory; refresh tokens in httpOnly cookies, stored hashed
- Account lockout after repeated failed logins
- Rate limiting on the API and on login/sign-up
- CORS limited to the website's origin
- Helmet security headers
- Input validation with Zod
- Prepared statements via Prisma (SQL injection prevention)

## Troubleshooting

- **Port 5000 on macOS** is used by AirPlay Receiver, which is why the API uses port 4000.
- **Dev server reloads on its own:** if the project sits in an iCloud-synced folder (like Documents), iCloud can trigger file-change events while it syncs. It settles down once syncing finishes.

## License

ISC

## Documentation

- `CLAUDE.md` - Comprehensive guide for AI assistants and developers
- `DEPLOYMENT.md` - Deployment notes (updated in Phase 8)

---

**Built with ❤️ for the community**
