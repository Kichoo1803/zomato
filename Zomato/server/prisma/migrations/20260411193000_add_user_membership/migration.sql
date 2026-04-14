ALTER TABLE "users" ADD COLUMN "membership_tier" TEXT NOT NULL DEFAULT 'CLASSIC';
ALTER TABLE "users" ADD COLUMN "membership_status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "membership_started_at" DATETIME;
ALTER TABLE "users" ADD COLUMN "membership_expires_at" DATETIME;
