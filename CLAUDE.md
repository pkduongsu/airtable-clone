# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbo (Next.js)
- `npm run build` - Build the production application
- `npm start` - Start production server
- `npm run check` - Run linting and type checking together
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript compiler checks
- `npm run format:check` - Check code formatting with Prettier
- `npm run format:write` - Format code with Prettier

## Database Commands

- `npm run db:generate` - Generate Prisma client and run migrations for development
- `npm run db:migrate` - Deploy migrations to production database
- `npm run db:push` - Push schema changes to database (dev)
- `npm run db:studio` - Open Prisma Studio for database management
- `./start-database.sh` - Start local PostgreSQL container (requires Docker/Podman and WSL on Windows)

## Architecture Overview

This is a T3 Stack application combining:
- **Next.js 15** with App Router
- **tRPC** for type-safe API routes
- **Prisma** with PostgreSQL for database
- **NextAuth.js** with Google OAuth
- **Tailwind CSS** for styling
- **TypeScript** throughout

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/server/` - tRPC routers, auth config, and database setup  
- `src/trpc/` - Client-side tRPC configuration
- `prisma/` - Database schema and migrations

### Authentication

- Uses NextAuth.js v5 beta with Google provider
- Configured in `src/server/auth/config.ts`
- Session management through Prisma adapter
- Required environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`

### Database Setup

- PostgreSQL database with Prisma ORM
- Includes NextAuth.js required tables (User, Account, Session, VerificationToken)
- Custom Post model with user relations
- Use `start-database.sh` script to run local PostgreSQL container

### Environment Configuration

Environment variables are validated using `@t3-oss/env-nextjs` in `src/env.js`:
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret  
- `AUTH_SECRET` - NextAuth.js secret (production only)

### Type Safety

- Full TypeScript coverage with strict configuration
- tRPC provides end-to-end type safety
- Zod schemas for runtime validation
- Prisma generates type-safe database client