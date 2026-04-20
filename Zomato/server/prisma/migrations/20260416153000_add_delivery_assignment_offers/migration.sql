CREATE TABLE "delivery_assignment_offers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_id" INTEGER NOT NULL,
    "delivery_partner_id" INTEGER NOT NULL,
    "batch_number" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "radius_km" REAL NOT NULL,
    "distance_km" REAL,
    "offered_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    "responded_at" DATETIME,
    "accepted_at" DATETIME,
    "closed_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "delivery_assignment_offers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delivery_assignment_offers_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "delivery_assignment_offers_order_id_delivery_partner_id_batch_number_key"
ON "delivery_assignment_offers"("order_id", "delivery_partner_id", "batch_number");

CREATE INDEX "delivery_assignment_offers_order_id_status_expires_at_idx"
ON "delivery_assignment_offers"("order_id", "status", "expires_at");

CREATE INDEX "delivery_assignment_offers_delivery_partner_id_status_expires_at_idx"
ON "delivery_assignment_offers"("delivery_partner_id", "status", "expires_at");

CREATE INDEX "delivery_assignment_offers_status_expires_at_idx"
ON "delivery_assignment_offers"("status", "expires_at");

CREATE INDEX "delivery_partners_availability_status_is_verified_current_latitude_current_longitude_idx"
ON "delivery_partners"("availability_status", "is_verified", "current_latitude", "current_longitude");

CREATE INDEX "delivery_partners_last_location_updated_at_idx"
ON "delivery_partners"("last_location_updated_at");
