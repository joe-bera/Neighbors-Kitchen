# CLAUDE.md - AI Assistant Guide for Neighbors-Kitchen

> **Last Updated:** 2025-11-17
> **Repository Status:** Initial development phase

## Project Overview

**Neighbors-Kitchen** is a community marketplace platform that connects local chefs with neighbors who want delicious, home-cooked meals. Think of it as "Airbnb for local chefs" - chefs can showcase their culinary talents, offer meals for pre-order, and build a local customer base, while community members can discover and enjoy authentic, chef-prepared meals from their neighborhood.

### Core Features
- **Chef Profiles:** Chefs create profiles showcasing their culinary background and specialties
- **Menu Management:** Dynamic menu creation with photos, descriptions, and pricing
- **Pre-Order System:** Customers can browse and pre-order meals with flexible pickup/delivery
- **Payment Processing:** Secure payment handling with chef payouts
- **Review & Rating System:** Build trust through authentic customer reviews
- **Suggestion System:** Customers can request specific dishes or dietary accommodations
- **Local Discovery:** Location-based matching to connect neighbors
- **Scheduling:** Chefs set availability and meal preparation timelines

### Repository Information
- **Repository:** joe-bera/Neighbors-Kitchen
- **Main Branch:** TBD (will be set when established)
- **Current Status:** Initial development phase
- **License:** Not yet specified
- **Project Type:** Full-stack web/mobile marketplace application

## Codebase Structure

### Current State
The repository is in its initial state with minimal files:
```
Neighbors-Kitchen/
├── .git/
├── README.md
└── CLAUDE.md (this file)
```

### Recommended Structure
For a full-stack marketplace application, we recommend this structure:
```
Neighbors-Kitchen/
├── frontend/                    # Frontend application
│   ├── src/
│   │   ├── components/          # Reusable React components
│   │   │   ├── chef/           # Chef-specific components
│   │   │   ├── customer/       # Customer-specific components
│   │   │   ├── common/         # Shared components
│   │   │   └── layout/         # Layout components
│   │   ├── pages/              # Page components/routes
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API service layer
│   │   ├── store/              # State management (Redux/Context)
│   │   ├── utils/              # Utility functions
│   │   ├── types/              # TypeScript type definitions
│   │   └── assets/             # Images, styles, fonts
│   ├── public/                 # Static assets
│   └── package.json
│
├── backend/                     # Backend API server
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── models/             # Database models
│   │   │   ├── User.js        # Chef and Customer users
│   │   │   ├── Menu.js        # Menu model
│   │   │   ├── Meal.js        # Individual meals/dishes
│   │   │   ├── Order.js       # Order management
│   │   │   ├── Review.js      # Reviews and ratings
│   │   │   └── Suggestion.js  # Customer suggestions
│   │   ├── routes/             # API route definitions
│   │   ├── middleware/         # Express middleware
│   │   ├── services/           # Business logic layer
│   │   │   ├── payment.js     # Payment processing (Stripe)
│   │   │   ├── email.js       # Email notifications
│   │   │   └── location.js    # Geolocation services
│   │   ├── utils/              # Helper functions
│   │   ├── config/             # Configuration files
│   │   └── validators/         # Input validation schemas
│   ├── tests/                  # Backend tests
│   └── package.json
│
├── shared/                      # Shared code between front/backend
│   ├── types/                  # Shared TypeScript types
│   └── constants/              # Shared constants
│
├── docs/                        # Project documentation
│   ├── api/                    # API documentation
│   ├── architecture/           # System design docs
│   └── deployment/             # Deployment guides
│
├── .github/                     # GitHub workflows and templates
│   └── workflows/              # CI/CD pipelines
│
├── scripts/                     # Utility scripts
│   ├── seed-db.js             # Database seeding
│   └── migration.js           # Data migrations
│
├── .gitignore
├── README.md
├── CLAUDE.md                    # This file
└── docker-compose.yml          # Local development setup
```

## Development Workflow

### Git Branching Strategy

#### Branch Naming Conventions
- **Feature branches:** `feature/<descriptive-name>`
- **Bug fixes:** `fix/<issue-description>`
- **Claude AI branches:** `claude/claude-md-<session-id>`
- **Documentation:** `docs/<topic>`
- **Refactoring:** `refactor/<component>`

#### Branch Guidelines
1. Always create a new branch for work, never commit directly to main
2. Use descriptive branch names that indicate the purpose
3. Keep branches focused on a single feature or fix
4. Delete branches after merging

### Commit Message Conventions

Follow conventional commit format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, no logic change)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks
- `perf:` Performance improvements

**Examples:**
```
feat(auth): add user authentication system

Implement JWT-based authentication with login and registration endpoints.
Includes password hashing and token validation.

Closes #123
```

```
fix(api): resolve null pointer in user query

Add null check before accessing user data to prevent crashes.
```

### Git Operations Best Practices

#### Pushing Changes
```bash
# Always push with upstream tracking
git push -u origin <branch-name>

# Branch names for Claude sessions must follow pattern:
# claude/claude-md-<session-id>
```

#### Fetching and Pulling
```bash
# Fetch specific branch
git fetch origin <branch-name>

# Pull with rebase to maintain clean history
git pull --rebase origin <branch-name>
```

#### Before Committing
1. Review all changes: `git status` and `git diff`
2. Stage relevant files only: `git add <files>`
3. Ensure no secrets or credentials are included
4. Write clear, descriptive commit messages
5. Run tests if they exist

## Code Quality Standards

### General Principles
1. **Write Clean Code:** Self-documenting, readable, and maintainable
2. **DRY Principle:** Don't Repeat Yourself
3. **SOLID Principles:** Follow object-oriented design principles
4. **Test Coverage:** Aim for high test coverage
5. **Documentation:** Comment complex logic, not obvious code

### Security Best Practices

#### General Security
- ⚠️ **Never commit secrets, API keys, or credentials**
- Store sensitive data in environment variables
- Use `.gitignore` to exclude sensitive files (.env, credentials.json, etc.)
- Validate and sanitize all user inputs
- Implement rate limiting on all API endpoints
- Use HTTPS in production (enforce TLS 1.2+)
- Set appropriate CORS policies
- Implement proper error handling (don't leak sensitive info in errors)

#### Protect Against Common Vulnerabilities
- **SQL Injection:** Use parameterized queries and ORM
- **XSS (Cross-Site Scripting):** Sanitize user input, use Content Security Policy
- **CSRF (Cross-Site Request Forgery):** Use CSRF tokens
- **Command Injection:** Never execute user input as commands
- **Path Traversal:** Validate file paths, use allowlists
- **NoSQL Injection:** Validate and sanitize MongoDB queries if used

#### Authentication & Authorization
- Hash passwords with bcrypt (minimum 12 rounds)
- Implement JWT with short expiration times (15-30 minutes)
- Use refresh tokens for extended sessions
- Implement account lockout after failed login attempts
- Require email verification for new accounts
- Add two-factor authentication (2FA) for chef accounts
- Implement role-based access control (RBAC)
  - Customer role: Browse, order, review
  - Chef role: Menu management, order fulfillment
  - Admin role: Platform management
- Verify user ownership before modifications (e.g., only chef can edit their own menu)

#### Payment Security
- **PCI Compliance:** Never store credit card numbers directly
- Use Stripe.js to tokenize payment info on client-side
- Validate webhook signatures from Stripe
- Implement idempotency for payment operations
- Log all payment transactions securely
- Handle refunds and disputes properly
- Verify chef identity before enabling payouts (KYC via Stripe Connect)

#### File Upload Security
- Validate file types (only allow images: jpg, png, webp)
- Limit file sizes (e.g., 5MB max for meal photos)
- Scan uploaded files for malware
- Use signed URLs for S3 uploads
- Never execute uploaded files
- Store files outside web root
- Implement Content-Type validation

#### Data Privacy
- Comply with GDPR, CCPA if applicable
- Implement user data export functionality
- Implement account deletion (right to be forgotten)
- Anonymize deleted user data
- Don't expose full addresses publicly (show only neighborhood/area)
- Hash or encrypt sensitive personal information
- Implement privacy settings for chef profiles

#### Marketplace-Specific Security
- **Review Authenticity:** Only allow reviews from verified orders
- **Prevent Review Manipulation:** Rate limit review submissions
- **Order Verification:** Verify order ownership before allowing reviews
- **Chef Verification:** Implement chef verification process (optional food handler certification)
- **Dispute Resolution:** Maintain audit trails for disputes
- **Location Privacy:** Don't expose exact addresses until order is confirmed
- **Age Verification:** Ensure legal age for commercial food preparation

### Code Review Checklist
- [ ] Code follows project conventions
- [ ] No security vulnerabilities introduced
- [ ] Tests pass and new tests added for new features
- [ ] Documentation updated
- [ ] No debugging code or console.logs left in
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed

## Technology Stack

### Recommended Stack (Subject to Finalization)

#### Frontend
- **Framework:** React 18+ with TypeScript
- **Routing:** React Router v6
- **State Management:** Redux Toolkit or Zustand
- **UI Framework:** Material-UI (MUI) or Tailwind CSS + Headless UI
- **Forms:** React Hook Form with Zod validation
- **API Client:** Axios or TanStack Query (React Query)
- **Maps:** Google Maps API or Mapbox
- **Image Upload:** React Dropzone + preview functionality
- **Build Tool:** Vite or Create React App
- **Mobile (Future):** React Native or Progressive Web App (PWA)

#### Backend
- **Runtime:** Node.js 18+ LTS
- **Framework:** Express.js or Fastify
- **Language:** TypeScript (recommended) or JavaScript ES6+
- **API Design:** RESTful API (consider GraphQL for complex queries)
- **Authentication:** JWT (JSON Web Tokens) with refresh tokens
- **Password Hashing:** bcrypt
- **Session Management:** Redis (optional, for scalability)

#### Database
- **Primary Database:** PostgreSQL 14+
- **ORM:** Prisma or Sequelize
- **Migrations:** Managed via ORM
- **Schema Design:**
  - Users (chefs and customers with role differentiation)
  - Menus, Meals/Dishes
  - Orders, OrderItems
  - Reviews, Ratings
  - Suggestions
  - Payments/Transactions

#### File Storage
- **Image Storage:** AWS S3 or Cloudinary
- **Use Cases:** Chef profile photos, meal photos, menu images

#### Payment Processing
- **Provider:** Stripe
- **Features:**
  - Customer checkout
  - Chef payouts (Stripe Connect)
  - Fee handling (platform commission)
  - Payment history

#### Email Services
- **Provider:** SendGrid, AWS SES, or Resend
- **Use Cases:**
  - Order confirmations
  - Chef notifications
  - Review requests
  - Password resets

#### Testing
- **Unit Testing:** Jest or Vitest
- **Component Testing:** React Testing Library
- **E2E Testing:** Playwright or Cypress
- **API Testing:** Supertest
- **Coverage Tool:** Istanbul (nyc)

#### DevOps & Tools
- **Version Control:** Git + GitHub
- **CI/CD:** GitHub Actions
- **Code Quality:** ESLint + Prettier
- **Type Checking:** TypeScript
- **Environment Management:** dotenv
- **API Documentation:** Swagger/OpenAPI or Postman
- **Monitoring:** Sentry (error tracking), LogRocket (session replay)
- **Deployment:**
  - Frontend: Vercel, Netlify, or AWS Amplify
  - Backend: Railway, Render, AWS EC2/ECS, or DigitalOcean
  - Database: Hosted PostgreSQL (Supabase, Neon, or AWS RDS)

#### Development Tools
- **Package Manager:** npm or pnpm
- **API Testing:** Postman or Insomnia
- **Database GUI:** pgAdmin or TablePlus
- **Containerization:** Docker (for local development consistency)

## Environment Setup

### Prerequisites
- Node.js 18+ LTS
- PostgreSQL 14+
- npm or pnpm
- Git
- (Optional) Docker Desktop for containerized development

### Installation Steps
```bash
# Clone the repository
git clone https://github.com/joe-bera/Neighbors-Kitchen.git
cd Neighbors-Kitchen

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Set up environment variables (copy from .env.example)
cp .env.example .env

# Set up database
npm run db:migrate
npm run db:seed  # Optional: seed with test data

# Run development servers
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### Environment Variables

#### Backend (.env)
```bash
# Server Configuration
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/neighbors_kitchen
DB_HOST=localhost
DB_PORT=5432
DB_NAME=neighbors_kitchen
DB_USER=your_username
DB_PASSWORD=your_password

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# Stripe Payment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...
PLATFORM_FEE_PERCENTAGE=10

# Email Service (SendGrid example)
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG...
EMAIL_FROM=noreply@neighbors-kitchen.com
EMAIL_FROM_NAME=Neighbors Kitchen

# File Upload (AWS S3 example)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=neighbors-kitchen-images

# Or Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Maps API
GOOGLE_MAPS_API_KEY=AIza...

# Session (if using Redis)
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your-session-secret

# Monitoring & Error Tracking
SENTRY_DSN=https://...@sentry.io/...

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend (.env)
```bash
# API Configuration
VITE_API_URL=http://localhost:5000
VITE_API_TIMEOUT=10000

# Stripe (Public Key)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=AIza...

# Environment
VITE_ENV=development

# Feature Flags
VITE_ENABLE_SUGGESTIONS=true
VITE_ENABLE_REVIEWS=true

# Analytics (optional)
VITE_GA_TRACKING_ID=UA-...
```

#### Important Security Notes
- ⚠️ **NEVER commit actual API keys or secrets to version control**
- Use `.env.example` files with placeholder values
- Add `.env` to `.gitignore`
- Rotate keys regularly in production
- Use different keys for development, staging, and production

## Testing Strategy

### Test Organization
*To be established*

### Running Tests
```bash
# Add commands when test suite is set up
# Example: npm test, pytest, etc.
```

### Testing Guidelines
- Write tests for all new features
- Maintain existing tests when refactoring
- Aim for meaningful test coverage, not just high percentages
- Test edge cases and error conditions
- Use descriptive test names

## API Documentation

### API Design Principles
- Use RESTful conventions
- Version API (e.g., `/api/v1/`)
- Use plural nouns for resources
- Use HTTP methods correctly (GET, POST, PUT, PATCH, DELETE)
- Return appropriate status codes
- Include pagination for list endpoints
- Implement filtering, sorting, and searching where appropriate

### Core API Endpoints

#### Authentication
```
POST   /api/v1/auth/register          # Register new user
POST   /api/v1/auth/login             # Login user
POST   /api/v1/auth/logout            # Logout user
POST   /api/v1/auth/refresh-token     # Refresh JWT token
POST   /api/v1/auth/forgot-password   # Request password reset
POST   /api/v1/auth/reset-password    # Reset password
GET    /api/v1/auth/verify-email      # Verify email address
```

#### Users
```
GET    /api/v1/users/me               # Get current user profile
PUT    /api/v1/users/me               # Update current user profile
DELETE /api/v1/users/me               # Delete account
GET    /api/v1/users/:id              # Get public user profile
```

#### Chefs
```
GET    /api/v1/chefs                  # List all chefs (with filters)
GET    /api/v1/chefs/:id              # Get chef profile
POST   /api/v1/chefs                  # Become a chef (upgrade account)
PUT    /api/v1/chefs/:id              # Update chef profile
GET    /api/v1/chefs/nearby           # Get chefs near location
GET    /api/v1/chefs/:id/reviews      # Get chef reviews
GET    /api/v1/chefs/:id/stats        # Get chef statistics
```

#### Menus
```
GET    /api/v1/menus                  # List all active menus
GET    /api/v1/menus/:id              # Get menu details
POST   /api/v1/menus                  # Create menu (chef only)
PUT    /api/v1/menus/:id              # Update menu (chef only)
DELETE /api/v1/menus/:id              # Delete menu (chef only)
GET    /api/v1/chefs/:chefId/menus    # Get menus by chef
```

#### Meals
```
GET    /api/v1/meals                  # List all available meals
GET    /api/v1/meals/:id              # Get meal details
POST   /api/v1/meals                  # Create meal (chef only)
PUT    /api/v1/meals/:id              # Update meal (chef only)
DELETE /api/v1/meals/:id              # Delete meal (chef only)
GET    /api/v1/meals/search           # Search meals
GET    /api/v1/menus/:menuId/meals    # Get meals in menu
```

#### Orders
```
GET    /api/v1/orders                 # List user's orders
GET    /api/v1/orders/:id             # Get order details
POST   /api/v1/orders                 # Create new order
PUT    /api/v1/orders/:id             # Update order status (chef only)
DELETE /api/v1/orders/:id             # Cancel order
GET    /api/v1/orders/:id/status      # Track order status
POST   /api/v1/orders/:id/complete    # Mark order as completed (chef)
```

#### Reviews
```
GET    /api/v1/reviews                # List reviews (with filters)
GET    /api/v1/reviews/:id            # Get review details
POST   /api/v1/reviews                # Create review
PUT    /api/v1/reviews/:id            # Update review
DELETE /api/v1/reviews/:id            # Delete review
GET    /api/v1/meals/:mealId/reviews  # Get meal reviews
POST   /api/v1/reviews/:id/report     # Report inappropriate review
```

#### Suggestions
```
GET    /api/v1/suggestions            # List suggestions (chef view)
POST   /api/v1/suggestions            # Create suggestion
PUT    /api/v1/suggestions/:id        # Update suggestion status
DELETE /api/v1/suggestions/:id        # Delete suggestion
GET    /api/v1/chefs/:chefId/suggestions  # Get chef's suggestions
```

#### Payments
```
POST   /api/v1/payments/create-intent      # Create payment intent
POST   /api/v1/payments/webhook            # Stripe webhook handler
GET    /api/v1/payments/:orderId           # Get payment details
POST   /api/v1/payments/:orderId/refund    # Process refund (admin)
GET    /api/v1/payments/chef/balance       # Get chef balance
POST   /api/v1/payments/chef/payout        # Request payout (chef)
```

### Response Format
All API responses follow this structure:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "pagination": {  // Only for list endpoints
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }  // Optional additional error details
  }
}
```

### Status Codes
- `200 OK` - Successful GET, PUT, PATCH
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate)
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Database Schema

### Core Data Models

#### Users
```sql
users
- id (UUID, primary key)
- email (string, unique, required)
- password_hash (string, required)
- role (enum: 'customer', 'chef', 'admin')
- first_name (string, required)
- last_name (string, required)
- phone (string, optional)
- profile_photo_url (string, optional)
- email_verified (boolean, default false)
- email_verification_token (string, nullable)
- password_reset_token (string, nullable)
- password_reset_expires (timestamp, nullable)
- is_active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)
```

#### ChefProfiles
```sql
chef_profiles
- id (UUID, primary key)
- user_id (UUID, foreign key -> users.id, unique)
- bio (text, optional)
- specialties (array of strings, e.g., ['Italian', 'Vegan'])
- years_experience (integer, optional)
- certifications (array of strings, optional)
- stripe_connect_account_id (string, optional)
- stripe_onboarding_complete (boolean, default false)
- address_line1 (string, required)
- address_line2 (string, optional)
- city (string, required)
- state (string, required)
- zip_code (string, required)
- latitude (decimal, required)
- longitude (decimal, required)
- service_radius_miles (decimal, default 5.0)
- average_rating (decimal, calculated)
- total_reviews (integer, default 0)
- total_orders (integer, default 0)
- is_accepting_orders (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)
```

#### Menus
```sql
menus
- id (UUID, primary key)
- chef_id (UUID, foreign key -> chef_profiles.id)
- name (string, required)
- description (text, optional)
- is_active (boolean, default true)
- available_from (date, optional)
- available_until (date, optional)
- created_at (timestamp)
- updated_at (timestamp)
```

#### Meals
```sql
meals
- id (UUID, primary key)
- menu_id (UUID, foreign key -> menus.id)
- chef_id (UUID, foreign key -> chef_profiles.id)
- name (string, required)
- description (text, required)
- price (decimal, required)
- image_url (string, optional)
- category (enum: 'breakfast', 'lunch', 'dinner', 'dessert', 'snack')
- cuisine_type (string, e.g., 'Italian', 'Mexican')
- dietary_tags (array: 'vegetarian', 'vegan', 'gluten-free', 'dairy-free', etc.)
- servings (integer, default 1)
- prep_time_minutes (integer, required)
- is_available (boolean, default true)
- max_orders_per_day (integer, optional)
- average_rating (decimal, calculated)
- total_reviews (integer, default 0)
- total_orders (integer, default 0)
- created_at (timestamp)
- updated_at (timestamp)
```

#### Orders
```sql
orders
- id (UUID, primary key)
- order_number (string, unique, auto-generated)
- customer_id (UUID, foreign key -> users.id)
- chef_id (UUID, foreign key -> chef_profiles.id)
- status (enum: 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')
- subtotal (decimal, required)
- platform_fee (decimal, required)
- total (decimal, required)
- payment_status (enum: 'pending', 'paid', 'refunded', 'failed')
- payment_intent_id (string, Stripe payment intent ID)
- pickup_or_delivery (enum: 'pickup', 'delivery')
- scheduled_for (timestamp, required)
- delivery_address (text, if delivery)
- special_instructions (text, optional)
- customer_notes (text, optional)
- chef_notes (text, optional)
- cancellation_reason (text, optional)
- cancelled_at (timestamp, nullable)
- completed_at (timestamp, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

#### OrderItems
```sql
order_items
- id (UUID, primary key)
- order_id (UUID, foreign key -> orders.id)
- meal_id (UUID, foreign key -> meals.id)
- quantity (integer, required)
- price_at_purchase (decimal, required)
- special_requests (text, optional)
- created_at (timestamp)
```

#### Reviews
```sql
reviews
- id (UUID, primary key)
- order_id (UUID, foreign key -> orders.id, unique)
- meal_id (UUID, foreign key -> meals.id)
- chef_id (UUID, foreign key -> chef_profiles.id)
- customer_id (UUID, foreign key -> users.id)
- rating (integer, 1-5, required)
- title (string, optional)
- comment (text, optional)
- images (array of strings, URLs, optional)
- is_verified_purchase (boolean, default true)
- is_flagged (boolean, default false)
- flag_reason (text, optional)
- chef_response (text, optional)
- chef_responded_at (timestamp, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

#### Suggestions
```sql
suggestions
- id (UUID, primary key)
- chef_id (UUID, foreign key -> chef_profiles.id)
- customer_id (UUID, foreign key -> users.id)
- meal_name (string, required)
- description (text, required)
- dietary_requirements (array of strings, optional)
- status (enum: 'pending', 'considering', 'accepted', 'declined')
- chef_response (text, optional)
- priority (enum: 'low', 'medium', 'high', default 'medium')
- votes (integer, default 1) # Other customers can upvote
- created_at (timestamp)
- updated_at (timestamp)
```

#### Payments
```sql
payments
- id (UUID, primary key)
- order_id (UUID, foreign key -> orders.id)
- stripe_payment_intent_id (string, unique)
- amount (decimal, required)
- platform_fee (decimal, required)
- chef_payout (decimal, required)
- status (enum: 'pending', 'succeeded', 'failed', 'refunded')
- refund_amount (decimal, nullable)
- refund_reason (text, nullable)
- payout_id (string, Stripe payout ID, nullable)
- paid_out_at (timestamp, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

### Indexes
```sql
# Performance optimization indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_chef_profiles_user_id ON chef_profiles(user_id);
CREATE INDEX idx_chef_profiles_location ON chef_profiles(latitude, longitude);
CREATE INDEX idx_meals_chef_id ON meals(chef_id);
CREATE INDEX idx_meals_category ON meals(category);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_chef_id ON orders(chef_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_reviews_chef_id ON reviews(chef_id);
CREATE INDEX idx_reviews_meal_id ON reviews(meal_id);
```

### Migrations
```bash
# Using Prisma
npx prisma migrate dev --name init
npx prisma migrate dev --name add_suggestions_table
npx prisma migrate deploy  # For production

# Using Sequelize
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:undo  # Rollback last migration
npx sequelize-cli db:seed:all  # Seed database
```

## Common Tasks for AI Assistants

### Adding a New Feature
1. Review existing codebase to understand patterns
2. Create feature branch: `git checkout -b feature/<name>`
3. Implement feature following project conventions
4. Add tests for the new functionality
5. Update documentation
6. Commit with descriptive message
7. Push to remote branch
8. Create pull request

### Fixing a Bug
1. Reproduce the bug
2. Create fix branch: `git checkout -b fix/<description>`
3. Implement fix
4. Add regression test
5. Verify fix doesn't break existing functionality
6. Commit and push
7. Create pull request

### Refactoring Code
1. Ensure tests exist and pass before refactoring
2. Create refactor branch
3. Make incremental changes
4. Run tests after each change
5. Keep commits focused and atomic
6. Document reasoning for refactoring

### Updating Dependencies
1. Review changelog for breaking changes
2. Update one dependency at a time if possible
3. Run full test suite
4. Update code for breaking changes
5. Document any required changes

## Project-Specific Conventions

### Naming Conventions

#### JavaScript/TypeScript
- **Variables & Functions:** camelCase (`getUserOrders`, `totalPrice`)
- **React Components:** PascalCase (`ChefCard`, `OrderList`, `MealDetailPage`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `API_BASE_URL`)
- **Files:**
  - Components: PascalCase (`ChefCard.tsx`, `MealCard.tsx`)
  - Utilities: camelCase (`formatPrice.ts`, `validateEmail.ts`)
  - Hooks: camelCase with `use` prefix (`useAuth.ts`, `useChefProfile.ts`)
  - Pages/Routes: PascalCase (`HomePage.tsx`, `ChefDashboard.tsx`)
- **Database Models:** PascalCase singular (`User`, `Chef`, `Order`, `Meal`)
- **API Routes:** kebab-case (`/api/v1/chef-profiles`, `/api/v1/order-items`)

#### Domain-Specific Terminology
- **Chef:** User with chef role who creates and sells meals
- **Customer:** User who orders meals
- **Meal:** Individual dish/food item that can be ordered
- **Menu:** Collection of meals offered by a chef
- **Order:** Customer's purchase of one or more meals
- **Pre-order:** Advance order with scheduled pickup/delivery time
- **Suggestion:** Customer request for a specific dish
- **Service Radius:** Distance a chef is willing to serve
- **Payout:** Payment transfer from platform to chef

### File Organization

#### Component Structure
```
components/
├── chef/
│   ├── ChefCard.tsx           # Display chef in listings
│   ├── ChefProfile.tsx        # Full chef profile view
│   ├── ChefDashboard.tsx      # Chef management dashboard
│   └── ChefStats.tsx          # Chef statistics widget
├── meal/
│   ├── MealCard.tsx           # Display meal in listings
│   ├── MealDetail.tsx         # Full meal details
│   ├── MealForm.tsx           # Create/edit meal form
│   └── MealSearch.tsx         # Meal search interface
├── order/
│   ├── OrderCard.tsx          # Display order in lists
│   ├── OrderTracking.tsx      # Track order status
│   ├── OrderHistory.tsx       # Past orders list
│   └── CheckoutForm.tsx       # Order checkout process
├── common/
│   ├── Button.tsx             # Reusable button
│   ├── Input.tsx              # Form input
│   ├── Card.tsx               # Generic card
│   ├── Rating.tsx             # Star rating display
│   └── ImageUpload.tsx        # Image upload widget
└── layout/
    ├── Navbar.tsx             # Navigation bar
    ├── Footer.tsx             # Page footer
    └── Sidebar.tsx            # Sidebar navigation
```

#### Backend Structure
```
backend/src/
├── controllers/
│   ├── authController.js      # Authentication logic
│   ├── chefController.js      # Chef operations
│   ├── mealController.js      # Meal CRUD
│   └── orderController.js     # Order management
├── models/
│   ├── User.js
│   ├── ChefProfile.js
│   ├── Meal.js
│   └── Order.js
├── middleware/
│   ├── auth.js                # JWT validation
│   ├── roleCheck.js           # Role-based access
│   ├── validateRequest.js     # Input validation
│   └── errorHandler.js        # Global error handling
└── services/
    ├── paymentService.js      # Stripe integration
    ├── emailService.js        # Email sending
    └── geoService.js          # Location calculations
```

### Import/Export Patterns

#### Named Exports (Preferred for utilities)
```typescript
// utils/formatters.ts
export const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;
export const formatDate = (date: Date) => date.toLocaleDateString();

// usage
import { formatPrice, formatDate } from '@/utils/formatters';
```

#### Default Exports (For components)
```typescript
// components/ChefCard.tsx
export default function ChefCard({ chef }: Props) { ... }

// usage
import ChefCard from '@/components/chef/ChefCard';
```

#### Barrel Exports (For component folders)
```typescript
// components/chef/index.ts
export { default as ChefCard } from './ChefCard';
export { default as ChefProfile } from './ChefProfile';
export { default as ChefDashboard } from './ChefDashboard';

// usage
import { ChefCard, ChefProfile } from '@/components/chef';
```

### Code Style Guidelines

#### TypeScript Types
- Define types in separate `.types.ts` files or at top of component
- Use interfaces for object shapes, types for unions/primitives
- Always type component props

```typescript
// types/chef.types.ts
export interface Chef {
  id: string;
  userId: string;
  bio: string;
  specialties: string[];
  averageRating: number;
}

export type ChefStatus = 'active' | 'inactive' | 'pending';
```

#### API Response Handling
```typescript
// Always use try-catch for async operations
try {
  const response = await api.get('/chefs');
  const { data, success } = response.data;
  if (success) {
    setChefs(data);
  }
} catch (error) {
  handleError(error);
}
```

#### State Management Patterns
- Use local state for component-specific data
- Use global state (Redux/Zustand) for:
  - User authentication
  - Shopping cart/current order
  - App-wide settings
  - Cached API data

### Error Handling Conventions

#### Backend
```javascript
// Use custom error classes
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 422;
    this.name = 'ValidationError';
  }
}

// Consistent error responses
res.status(statusCode).json({
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'User-friendly message',
    details: validationErrors
  }
});
```

#### Frontend
```typescript
// Centralized error handler
const handleError = (error: ApiError) => {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 403) {
    // Show permission error
  } else {
    // Show generic error toast
  }
};
```

## Troubleshooting Common Issues

*This section will grow as common issues are encountered*

### Git Issues
- **Push fails with 403:** Ensure branch name follows `claude/<pattern>` format
- **Merge conflicts:** Carefully review conflicts, test after resolution
- **Detached HEAD:** `git checkout <branch-name>` to reattach

### Development Issues
*To be added as they arise*

## Resources and References

### External Documentation
*Add links to relevant documentation as project develops*

### Internal Documentation
- [README.md](./README.md) - Project overview and setup
- [CLAUDE.md](./CLAUDE.md) - This file (AI assistant guide)

## AI Assistant Guidelines

### When Working on This Project

1. **Understand Before Changing:**
   - Read existing code and documentation
   - Use exploration tools to understand structure
   - Ask clarifying questions when requirements are unclear

2. **Follow Established Patterns:**
   - Match existing code style and conventions
   - Use the same libraries and approaches as existing code
   - Don't introduce new patterns without discussion

3. **Be Thorough:**
   - Test changes thoroughly
   - Consider edge cases
   - Update documentation
   - Check for security implications

4. **Use Task Management:**
   - Use TodoWrite tool for complex multi-step tasks
   - Break down large tasks into smaller steps
   - Track progress and mark completed items

5. **Communicate Clearly:**
   - Explain your reasoning
   - Highlight important decisions
   - Point out potential issues or trade-offs
   - Use file:line_number format when referencing code

6. **Git Workflow:**
   - Always work on the specified branch
   - Write clear commit messages
   - Push changes when work is complete
   - Use retry logic for network failures

### What to Avoid

- ❌ Don't commit secrets or credentials
- ❌ Don't skip tests or break existing tests
- ❌ Don't make assumptions about requirements
- ❌ Don't push to main/master without permission
- ❌ Don't create files unnecessarily (prefer editing)
- ❌ Don't use bash for file operations (use proper tools)
- ❌ Don't add emojis unless explicitly requested
- ❌ Don't skip pre-commit hooks

## Updating This Document

This document should be kept up-to-date as the project evolves:

### When to Update
- New technologies or frameworks are added
- Project structure changes significantly
- New conventions are established
- Common issues and solutions are discovered
- API endpoints or database schema changes
- Build/deployment process changes

### How to Update
1. Make changes on a feature branch
2. Review for accuracy and completeness
3. Commit with descriptive message: `docs(claude): update AI assistant guide`
4. Keep the "Last Updated" date current

---

## Quick Reference

### Essential Commands
```bash
# Check repository status
git status

# Create and switch to new branch
git checkout -b <branch-name>

# Stage and commit changes
git add <files>
git commit -m "type(scope): description"

# Push changes
git push -u origin <branch-name>

# View recent commits
git log --oneline -10
```

### Important Files
- `README.md` - Project documentation
- `CLAUDE.md` - This AI assistant guide
- `.gitignore` - Files to exclude from version control
- *Configuration files to be added*

### Key Principles
✅ Test your changes
✅ Write clear commits
✅ Follow conventions
✅ Document as you go
✅ Security first
✅ Ask when uncertain

---

## Key Implementation Considerations

### Legal & Compliance
- **Food Safety:** Consider local health department regulations
- **Business Licenses:** Chefs may need food handler permits or cottage food licenses
- **Liability Insurance:** Platform and chef insurance considerations
- **Terms of Service:** Clear terms for both chefs and customers
- **Privacy Policy:** GDPR/CCPA compliance for user data
- **Age Restrictions:** Verify users are 18+ for legal liability

### Scalability Considerations
- **Database Indexing:** Index frequently queried fields (location, chef_id, status)
- **Image Optimization:** Use CDN and image optimization (WebP format)
- **Caching:** Implement Redis for frequently accessed data
- **Rate Limiting:** Protect against abuse and excessive API calls
- **Pagination:** Always paginate list endpoints
- **Background Jobs:** Use queue system (Bull, BullMQ) for:
  - Email sending
  - Payment processing
  - Image processing
  - Review notifications

### User Experience Priorities
1. **Mobile-First Design:** Most users will browse on mobile
2. **Fast Load Times:** Optimize images and code splitting
3. **Clear Call-to-Actions:** Make ordering process intuitive
4. **Trust Building:** Highlight reviews, ratings, verified chefs
5. **Search & Discovery:** Easy filtering by cuisine, dietary needs, location
6. **Real-Time Updates:** Order status updates and notifications

### Revenue Model Considerations
- **Platform Fee:** Percentage of each transaction (e.g., 10-15%)
- **Subscription Option:** Premium chef accounts with lower fees
- **Promotional Listings:** Featured chef placements
- **Analytics Dashboard:** Insights for chefs (premium feature)

### Future Feature Ideas
- **Chef Subscriptions:** Weekly meal plans from favorite chefs
- **Group Orders:** Split costs among friends/family
- **Meal Prep Services:** Bulk orders for the week
- **Cooking Classes:** Virtual or in-person classes by chefs
- **Gift Cards:** Purchasable gift cards for the platform
- **Loyalty Program:** Rewards for repeat customers
- **Chef Verification Badges:** Certified, highly-rated, etc.
- **Dietary Filters:** Advanced filtering for allergies and preferences
- **Social Features:** Follow favorite chefs, share meals

### Monitoring & Analytics
Track these key metrics:
- **User Metrics:** Registrations, active users, retention rate
- **Order Metrics:** Order volume, average order value, completion rate
- **Chef Metrics:** Active chefs, average earnings, churn rate
- **Platform Health:** Revenue, transaction volume, platform fees
- **Performance:** API response times, error rates, uptime
- **User Behavior:** Popular cuisines, peak ordering times, search terms

---

**Note:** This is a living document. As Neighbors-Kitchen develops, this guide should be updated to reflect the actual codebase, conventions, and workflows established by the team.

**Last Updated:** 2025-11-17
**Contributors:** AI Assistant (Initial comprehensive guide for chef marketplace platform)
