# Zomato Luxe

Zomato Luxe now uses SQLite for local development, so no PostgreSQL installation or external database setup is required.

## Backend Quick Start

```bash
npm install
cp server/.env.example server/.env
npm run prisma:sync -w server
npm run prisma:generate -w server
npm run prisma:seed -w server
npm run dev -w server
```

If you are using PowerShell on Windows, replace `cp` with `Copy-Item` and use `npm.cmd` / `npx.cmd` if your shell blocks `npm` execution.

## SQLite Notes

- SQLite requires no installation.
- The database file is created at `server/prisma/dev.db`.
- Prisma enums are stored as `String` columns because the SQLite connector in the current Prisma version does not support enums.
- PostgreSQL-specific `Decimal` fields were converted to `Float`.
- PostgreSQL-specific `Json` fields were converted to `String` and serialized where needed.
- Prisma CLI uses `prisma.config.ts` with the libSQL adapter so SQLite schema setup works reliably in this environment.
- The datasource `url` in `schema.prisma` is still required for Prisma schema tooling, but the libSQL adapter in `prisma.config.ts` provides the actual runtime connection URL.

## Common Commands

```bash
npm run prisma:sync -w server
npm run prisma:generate -w server
npm run prisma:seed -w server
npm run prisma:migrate:deploy -w server
npm run dev -w server
```

Use `npm run prisma:sync -w server` to rebuild or resync the local SQLite schema directly from `schema.prisma` during development.

Use `npm run prisma:migrate:deploy -w server` only for migrated deployment targets. It should not run automatically on every local dev start against an already-populated SQLite database.

## API Overview

- Auth: `/api/v1/auth`
- Restaurants: `/api/v1/restaurants`
- Cart: `/api/v1/cart`
- Orders: `/api/v1/orders`
- Reviews: `/api/v1/reviews`
- Reservations: `/api/v1/reservations`

## Assumptions

- The original PostgreSQL schema was preserved structurally, with only SQLite compatibility changes applied.
- Existing API contracts and module boundaries were kept intact.
