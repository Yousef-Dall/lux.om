# lux.om

Premium Oman real estate, short-stay, development, and curated activities marketplace.

lux.om is a full-stack marketplace built with React + Vite, Express, Prisma, PostgreSQL, JWT authentication, and role-based workflows for users, owners, activity providers, developers, and admins.

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 14+
- Docker Desktop, optional for local PostgreSQL

## Project structure

- backend: Express API, Prisma schema, migrations, tests
- frontend: React/Vite application

## Local setup

Install dependencies:

    npm install

Create local environment files:

    cp .env.example .env
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env

Start local PostgreSQL:

    docker compose up -d

Generate Prisma Client, run migrations, and seed local data:

    npm run db:generate
    npm run db:migrate
    npm run db:seed

Run the backend:

    npm run dev:backend

Run the frontend in another terminal:

    npm run dev:frontend

Default local URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Database: localhost:5433

## Environment files

Root .env is used by docker-compose.yml:

    POSTGRES_PASSWORD=replace-with-a-strong-local-password

Backend backend/.env:

    NODE_ENV=development
    PORT=4000
    DATABASE_URL="postgresql://postgres:replace-with-your-postgres-password@localhost:5433/lux_om?schema=public"
    JWT_SECRET="replace-this-with-a-long-random-secret-value"
    CORS_ORIGIN="http://localhost:5173"
    STORAGE_DRIVER="local"
    UPLOAD_DIR="uploads"
    MAX_UPLOAD_MB=5
    CLOUDINARY_CLOUD_NAME=""
    CLOUDINARY_API_KEY=""
    CLOUDINARY_API_SECRET=""
    CLOUDINARY_FOLDER="lux-om"

Frontend frontend/.env:

    VITE_API_URL=""
    VITE_API_PROXY_TARGET="http://localhost:4000"

For production, set VITE_API_URL to the public backend API origin, for example:

    VITE_API_URL="https://api.your-domain.com"

Leave VITE_API_URL empty only when frontend and backend share the same origin.

## Quality checks

Run all production readiness checks:

    npm run verify:production

Or run each step separately:

    npm run typecheck
    npm run test:integration
    npm run build

## Database commands

Generate Prisma Client:

    npm run db:generate

Create and apply a local migration:

    npm run db:migrate -- --name migration_name

Apply existing migrations in production:

    npm run db:migrate:deploy

Seed local data:

    npm run db:seed

Open Prisma Studio locally:

    npm run db:studio

## Production deployment checklist

Before deployment:

- Use Node.js 20+.
- Use a managed PostgreSQL database.
- Set NODE_ENV=production.
- Set a strong JWT_SECRET.
- Set CORS_ORIGIN to the exact production frontend URL.
- Do not use localhost values in production.
- Use persistent image storage in production. Cloudinary is recommended with STORAGE_DRIVER=cloudinary.
- Run npm run db:migrate:deploy before starting the backend.
- Confirm /api/ready returns database connected.
- Build the frontend with the correct VITE_API_URL.
- Keep .env, backend/.env, and frontend/.env out of Git.

## Backend deployment

Recommended backend build command:

    npm install
    npm run build -w backend

Recommended pre-start command:

    npm run db:migrate:deploy -w backend

Recommended backend start command:

    npm run start -w backend

Health checks:

- GET /health
- GET /api/health
- GET /api/ready

Use /api/ready for deployment readiness because it verifies the database connection.

## Frontend deployment

Recommended frontend build command:

    npm install
    npm run build -w frontend

Deploy this folder:

    frontend/dist

Set the production API URL before building:

    VITE_API_URL="https://api.your-domain.com"

## Admin setup notes

Admin users must not be created through public registration.

Use one controlled method only:

- a private production seed script,
- a direct database insert handled by the owner/developer,
- or a protected internal admin creation workflow.

After creating the first admin account, verify:

- admin dashboard access works,
- non-admin users cannot access admin routes,
- booking finance/export routes return 403 for non-admin users,
- provider/owner booking operations only show their own assets.

## Security notes

The backend includes Helmet security headers, CORS allowlisting, JSON body size limits, global API rate limiting, stricter auth/upload rate limiting, JWT verification, database-backed user validation, stale-role token rejection, role-based admin route protection, and image MIME/extension/signature validation.

## Git hygiene

The repository ignores dependencies, production builds, local env files, runtime uploads, logs, coverage, and editor files.

Never commit real production secrets.
