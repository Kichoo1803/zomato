-- CreateTable
CREATE TABLE "saved_payment_methods" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "holder_name" TEXT,
    "masked_ending" TEXT,
    "expiry_month" TEXT,
    "expiry_year" TEXT,
    "upi_id" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "saved_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "saved_payment_methods_user_id_type_idx" ON "saved_payment_methods"("user_id", "type");

-- CreateIndex
CREATE INDEX "saved_payment_methods_user_id_is_primary_idx" ON "saved_payment_methods"("user_id", "is_primary");
