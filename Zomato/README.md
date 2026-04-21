# Zomato Luxe

Zomato Luxe now uses MongoDB via Prisma. The backend contract and module structure stay the same, but schema sync now uses `prisma db push` instead of Prisma Migrate.

## Backend Quick Start

```bash
npm install
cp server/.env.example server/.env
npm run prisma:generate -w server
npm run prisma:push -w server
npm run prisma:seed -w server
npm run dev -w server
```

If you are using PowerShell on Windows, replace `cp` with `Copy-Item` and use `npm.cmd` / `npx.cmd` if your shell blocks `npm` execution.

`npm run dev -w server` now only regenerates Prisma Client when the current generated client is missing or stale. This avoids the common Windows `EPERM` rename failure when another local process still has the Prisma query engine DLL open.

When `DATABASE_URL` uses the checked-in repo-scoped MongoDB URI on `127.0.0.1:27018` with `replicaSet=rs0`, the backend scripts now auto-start that local MongoDB node and wait for it to become the replica-set PRIMARY before continuing.

## MongoDB Notes

- Prisma still powers the backend; the datasource provider changed from SQLite to MongoDB.
- Prisma Migrate does not support MongoDB, so use `prisma db push` for schema sync.
- Each collection now uses a real MongoDB `ObjectId` on `_id`, while the existing numeric `id` field is preserved as the app-facing identifier and relation target.
- `npm run prisma:push -w server` now runs `prisma db push` and then syncs MongoDB partial unique indexes for nullable fields such as phone, offer code, transaction ID, and review order linkage.
- Existing historical SQL migration files are kept only as reference for the prior SQLite schema history.
- `LEGACY_SQLITE_DATABASE_URL` is only needed for the one-time SQLite-to-Mongo import command.

## Local Replica Set

Prisma uses MongoDB transactions for nested writes in carts, checkout, owner/admin mutations, and delivery dispatch. For reliable local development, run a single-node replica set:

```bash
mongod --dbpath "<your-db-path>" --replSet rs0 --bind_ip 127.0.0.1
mongosh --eval "rs.initiate()"
```

Then update `DATABASE_URL` to:

```bash
mongodb://127.0.0.1:27017/zomato?replicaSet=rs0
```

If you already had MongoDB data created with the earlier numeric-`_id` workaround, clear and re-import or reseed so the collections are recreated with proper `ObjectId` primary keys.

For this repo, the safest local path is a repo-scoped replica set on port `27018`, which avoids modifying a protected machine-wide MongoDB service:

```bash
npm run mongo:ensure -w server
```

Use this connection string with the checked-in config:

```bash
mongodb://127.0.0.1:27018/zomato?replicaSet=rs0
```

MongoDB Compass can connect with the same URI.

If you ever need to start the local replica set manually instead of using the helper script:

```bash
mongod --dbpath "server/prisma/mongo-rs/data" --replSet rs0 --bind_ip 127.0.0.1 --port 27018 --logpath "server/prisma/mongo-rs/mongod.log" --logappend
mongosh --port 27018 --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27018' }] })"
```

## Existing Data Migration

If you need to carry over the current SQLite data instead of reseeding:

```bash
npm run prisma:generate -w server
npm run prisma:generate:legacy -w server
npm run prisma:analyze:sqlite -w server
npm run prisma:migrate:sqlite-to-mongo -w server
npm run prisma:validate:sqlite-to-mongo -w server
```

This reads from `LEGACY_SQLITE_DATABASE_URL` and writes into the MongoDB database in `DATABASE_URL`, preserving the current numeric IDs and relation references while MongoDB generates fresh `_id` ObjectIds for each document.

## Common Commands

```bash
npm run prisma:generate -w server
npm run prisma:generate:if-needed -w server
npm run prisma:cleanup:generated -w server
npm run prisma:push -w server
npm run prisma:generate:legacy -w server
npm run prisma:analyze:sqlite -w server
npm run prisma:seed -w server
npm run prisma:migrate:deploy -w server
npm run prisma:migrate:sqlite-to-mongo -w server
npm run prisma:validate:sqlite-to-mongo -w server
npm run dev -w server
```

Use `npm run prisma:push -w server` to push the Prisma schema to MongoDB during development.

If Windows ever leaves stale Prisma temp engine files behind after an interrupted generate, run:

```bash
npm run prisma:cleanup:generated -w server
```

If `npm run prisma:generate -w server` still reports a locked `query_engine-windows.dll.node`, stop any running Zomato Luxe server, `tsx watch` process, Prisma Studio session, or other Node process using this workspace before retrying.

`npm run prisma:migrate:deploy -w server` remains as a compatibility alias for `prisma db push` so older local scripts do not break after the MongoDB move.

## API Overview

- Auth: `/api/v1/auth`
- Restaurants: `/api/v1/restaurants`
- Cart: `/api/v1/cart`
- Orders: `/api/v1/orders`
- Reviews: `/api/v1/reviews`
- Reservations: `/api/v1/reservations`

## Assumptions

- The relational entity structure was preserved structurally, with Prisma relations kept intact on MongoDB.
- Existing API contracts and module boundaries were kept intact.
