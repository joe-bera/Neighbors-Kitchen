# Neighbors-Kitchen

A community marketplace platform connecting local chefs with neighbors who want delicious, home-cooked meals. Think of it as "Airbnb for local chefs."

## Project Status

**Current Phase:** Initial Development Setup ✅

### Completed
- ✅ Project directory structure
- ✅ Backend API setup (Node.js + Express + TypeScript)
- ✅ Frontend setup (React + TypeScript + Vite)
- ✅ Database schema design (Prisma + PostgreSQL)
- ✅ Environment configuration
- ✅ Git repository initialized

### Next Steps
- ⏳ Database setup and migrations
- ⏳ Authentication system (JWT)
- ⏳ Core API endpoints
- ⏳ Frontend components and routing
- ⏳ Stripe payment integration

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
- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router v6
- **State Management:** Zustand
- **Forms:** React Hook Form with Zod validation
- **API Client:** Axios

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL 14+ with Prisma ORM
- **Authentication:** JWT (JSON Web Tokens)
- **Security:** Helmet, CORS, Rate Limiting

### Future Integrations
- Stripe (Payment processing)
- AWS S3 or Cloudinary (Image storage)
- SendGrid or AWS SES (Email service)
- Google Maps API (Location features)

## Project Structure

```
Neighbors-Kitchen/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom hooks
│   │   ├── services/   # API services
│   │   └── store/      # State management
│   └── package.json
│
├── backend/            # Express backend API
│   ├── src/
│   │   ├── controllers/# Request handlers
│   │   ├── models/     # Prisma client
│   │   ├── routes/     # API routes
│   │   ├── middleware/ # Express middleware
│   │   └── services/   # Business logic
│   ├── prisma/         # Database schema
│   └── package.json
│
├── shared/             # Shared TypeScript types
├── docs/               # Documentation
└── CLAUDE.md          # AI assistant guide
```

## Getting Started

### Prerequisites
- Node.js 18+ LTS
- PostgreSQL 14+
- npm or pnpm
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/joe-bera/Neighbors-Kitchen.git
   cd Neighbors-Kitchen
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials and other settings

   # Frontend
   cd ../frontend
   cp .env.example .env
   # Edit .env with your API URL and other settings
   ```

5. **Set up the database**
   ```bash
   cd backend

   # Generate Prisma client
   npm run db:generate

   # Run database migrations
   npm run db:migrate

   # (Optional) Seed database with test data
   npm run db:seed
   ```

6. **Run the development servers**

   In separate terminal windows:

   ```bash
   # Terminal 1 - Backend (http://localhost:5000)
   cd backend
   npm run dev
   ```

   ```bash
   # Terminal 2 - Frontend (http://localhost:3000)
   cd frontend
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api/v1
   - API Health Check: http://localhost:5000/health

## Available Scripts

### Backend
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run tests
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio (database GUI)
```

### Frontend
```bash
npm run dev     # Start development server
npm run build   # Build for production
npm run preview # Preview production build
npm run lint    # Run ESLint
```

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:

- **Users** - Customer and chef accounts with role-based access
- **ChefProfiles** - Chef-specific information including location and ratings
- **Menus** - Chef menu collections
- **Meals** - Individual dishes with pricing and dietary tags
- **Orders** - Order management with status tracking
- **Reviews** - Customer reviews with ratings
- **Suggestions** - Customer meal requests to chefs
- **Payments** - Payment and payout tracking

See `backend/prisma/schema.prisma` for complete schema details.

## API Documentation

The API follows RESTful conventions and is versioned at `/api/v1/`.

### Core Endpoints (Planned)
- Authentication: `/api/v1/auth/*`
- Users: `/api/v1/users/*`
- Chefs: `/api/v1/chefs/*`
- Meals: `/api/v1/meals/*`
- Orders: `/api/v1/orders/*`
- Reviews: `/api/v1/reviews/*`
- Payments: `/api/v1/payments/*`

Full API documentation will be available once endpoints are implemented.

## Environment Variables

### Backend (.env)
Key environment variables (see `.env.example` for full list):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `PORT` - API server port (default: 5000)
- `FRONTEND_URL` - Frontend URL for CORS

### Frontend (.env)
- `VITE_API_URL` - Backend API URL
- `VITE_ENV` - Environment (development/production)

## Security

- Passwords hashed with bcrypt
- JWT authentication with refresh tokens
- Rate limiting on API endpoints
- CORS configured for specific origins
- Helmet.js for security headers
- Input validation and sanitization
- Prepared statements via Prisma (SQL injection prevention)

## Contributing

This project is in initial development. For contribution guidelines, please see CLAUDE.md.

## License

ISC

## Documentation

- `CLAUDE.md` - Comprehensive guide for AI assistants and developers
- `docs/` - Additional documentation (to be created)

## Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for the community**
