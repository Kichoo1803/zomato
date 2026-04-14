ALTER TABLE "users" ADD COLUMN "ops_state" TEXT;
ALTER TABLE "users" ADD COLUMN "ops_district" TEXT;
ALTER TABLE "users" ADD COLUMN "ops_notes" TEXT;

CREATE TABLE "operations_region_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "updated_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "operations_region_notes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "users_ops_state_ops_district_idx" ON "users"("ops_state", "ops_district");
CREATE INDEX "operations_region_notes_state_district_idx" ON "operations_region_notes"("state", "district");
CREATE INDEX "operations_region_notes_updated_by_id_idx" ON "operations_region_notes"("updated_by_id");
