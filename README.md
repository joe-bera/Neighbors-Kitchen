# Neighbors-Kitchen

A community marketplace platform connecting local chefs with neighbors who want delicious, home-cooked meals. Think of it as "Airbnb for local chefs."

## Project Status

The app is being built in eight phases. Each phase is tested and runnable before the next one starts.

| Phase | What it adds | Status |
|-------|--------------|--------|
| 1. Foundation | Database connected, sample chefs and meals, sign-up and login for customers and chefs | ✅ Done |
| 2. Customers | Browse and search chefs and meals, chef profile pages, meal pages, working landing page buttons | ⏳ Next |
| 3. Chefs | Become a chef, chef dashboard, add and edit meals with photos, set availability | ⏳ |
| 4. Ordering | Cart, pre-orders with pickup or delivery times, order tracking for customers and chefs | ⏳ |
| 5. Payments | Stripe (test mode), platform fee, chef payouts | ⏳ |
| 6. Trust | Reviews, ratings and dish suggestions | ⏳ |
| 7. Local | Find chefs near you on a map, email notifications | ⏳ |
| 8. Launch | Put it live on the internet | ⏳ |

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
- Maps (location features)

## Project Structure

```
Neighbors-Kitchen/
├── package.json          # One-command scripts: npm run setup, npm run dev, npm test
├── frontend/             # React app (http://localhost:3000)
│   └── src/
│       ├── components/   # layout/, auth/, common/
│       ├── pages/        # HomePage, LoginPage, SignupPage, AccountPage, ...
│       ├── services/     # API client (api.ts) and authService
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
│   ├── scripts/          # db.mjs (local Postgres), ensure-env.mjs
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

The sample data includes 8 chefs across the Inland Empire and Coachella Valley, 35 meals, and one customer. Every demo account uses the password `Password123`.

| Account | Email |
|---------|-------|
| Customer | `customer@neighborskitchen.test` |
| Chefs | `maria@`, `kenji@`, `aisha@`, `tony@`, `grace@`, `priya@`, `linh@`, `sofia@neighborskitchen.test` |

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
- **Menus** - Chef menu collections
- **Meals** - Individual dishes with pricing and dietary tags
- **Orders** - Order management with status tracking
- **Reviews** - Customer reviews with ratings
- **Suggestions** - Customer meal requests to chefs
- **Payments** - Payment and payout tracking

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
| GET | `/health` | Health check |

### Coming in later phases
Chefs, meals, orders, reviews, suggestions and payments endpoints (see CLAUDE.md for the planned design).

## Environment Variables

### Backend (`backend/.env`)
Created automatically by `npm run setup` from `.env.example`. Key settings:
- `DATABASE_URL` - PostgreSQL connection string (local default: port 5433)
- `JWT_SECRET` - Secret for signing access tokens (a random one is generated for you)
- `PORT` - API port (default 4000)
- `FRONTEND_URL` - Website URL allowed by CORS

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
