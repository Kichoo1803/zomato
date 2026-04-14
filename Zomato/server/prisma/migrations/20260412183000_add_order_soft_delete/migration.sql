ALTER TABLE "orders" ADD COLUMN "deleted_at" DATETIME;

CREATE INDEX "orders_deleted_at_status_created_at_idx" ON "orders"("deleted_at", "status", "created_at");
