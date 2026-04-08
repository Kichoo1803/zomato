-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "profile_image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "wallet_balance" REAL NOT NULL DEFAULT 0,
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "address_type" TEXT NOT NULL DEFAULT 'HOME',
    "title" TEXT,
    "recipient_name" TEXT,
    "contact_phone" TEXT,
    "house_no" TEXT,
    "street" TEXT,
    "landmark" TEXT,
    "area" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_serviceable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "restaurants" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "owner_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "image" TEXT,
    "logo_image" TEXT,
    "license_number" TEXT,
    "opening_time" TEXT,
    "closing_time" TEXT,
    "address_line" TEXT,
    "area" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "avg_rating" REAL NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "cost_for_two" REAL NOT NULL DEFAULT 0,
    "avg_delivery_time" INTEGER NOT NULL DEFAULT 30,
    "is_veg_only" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "restaurants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "restaurant_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "restaurant_category_map" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurant_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    CONSTRAINT "restaurant_category_map_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "restaurant_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "restaurant_category_map_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cuisines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "restaurant_cuisines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurant_id" INTEGER NOT NULL,
    "cuisine_id" INTEGER NOT NULL,
    CONSTRAINT "restaurant_cuisines_cuisine_id_fkey" FOREIGN KEY ("cuisine_id") REFERENCES "cuisines" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "restaurant_cuisines_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "restaurant_hours" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurant_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_time" TEXT,
    "close_time" TEXT,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "restaurant_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "menu_categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurant_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "price" REAL NOT NULL,
    "discount_price" REAL,
    "food_type" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "preparation_time" INTEGER NOT NULL DEFAULT 20,
    "calories" INTEGER,
    "spice_level" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "item_addons" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "menu_item_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "item_addons_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "offers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" TEXT NOT NULL,
    "discount_value" REAL NOT NULL,
    "min_order_amount" REAL NOT NULL DEFAULT 0,
    "max_discount" REAL,
    "scope" TEXT NOT NULL DEFAULT 'PLATFORM',
    "usage_limit" INTEGER,
    "per_user_limit" INTEGER,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "restaurant_offers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurant_id" INTEGER NOT NULL,
    "offer_id" INTEGER NOT NULL,
    CONSTRAINT "restaurant_offers_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "restaurant_offers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "carts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "offer_id" INTEGER,
    "total_amount" REAL NOT NULL DEFAULT 0,
    "discount_amount" REAL NOT NULL DEFAULT 0,
    "delivery_fee" REAL NOT NULL DEFAULT 0,
    "tax_amount" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "carts_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "carts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cart_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "item_price" REAL NOT NULL,
    "total_price" REAL NOT NULL,
    "special_instructions" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cart_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cart_item_addons" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cart_item_id" INTEGER NOT NULL,
    "addon_id" INTEGER NOT NULL,
    "addon_price" REAL NOT NULL,
    CONSTRAINT "cart_item_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "item_addons" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cart_item_addons_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "address_id" INTEGER NOT NULL,
    "delivery_partner_id" INTEGER,
    "offer_id" INTEGER,
    "order_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT NOT NULL DEFAULT 'COD',
    "subtotal" REAL NOT NULL,
    "delivery_fee" REAL NOT NULL DEFAULT 0,
    "tax_amount" REAL NOT NULL DEFAULT 0,
    "discount_amount" REAL NOT NULL DEFAULT 0,
    "total_amount" REAL NOT NULL,
    "special_instructions" TEXT,
    "ordered_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" DATETIME,
    "preparing_at" DATETIME,
    "out_for_delivery_at" DATETIME,
    "delivered_at" DATETIME,
    "cancelled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_id" INTEGER NOT NULL,
    "actor_id" INTEGER,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_price" REAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price" REAL NOT NULL,
    "food_type" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_item_addons" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_item_id" INTEGER NOT NULL,
    "addon_name" TEXT NOT NULL,
    "addon_price" REAL NOT NULL,
    CONSTRAINT "order_item_addons_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_id" INTEGER NOT NULL,
    "transaction_id" TEXT,
    "payment_gateway" TEXT,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "delivery_partners" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "vehicle_type" TEXT NOT NULL,
    "vehicle_number" TEXT,
    "license_number" TEXT,
    "availability_status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "current_latitude" REAL,
    "current_longitude" REAL,
    "avg_rating" REAL NOT NULL DEFAULT 0,
    "total_deliveries" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "delivery_partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "delivery_documents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "delivery_partner_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" DATETIME,
    CONSTRAINT "delivery_documents_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reviews_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "favorite_restaurants" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorite_restaurants_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "favorite_restaurants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "meta" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "reservation_date" DATETIME NOT NULL,
    "guests" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "special_request" TEXT,
    "contact_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reservations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "addresses_city_pincode_idx" ON "addresses"("city", "pincode");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_license_number_key" ON "restaurants"("license_number");

-- CreateIndex
CREATE INDEX "restaurants_owner_id_idx" ON "restaurants"("owner_id");

-- CreateIndex
CREATE INDEX "restaurants_city_is_active_idx" ON "restaurants"("city", "is_active");

-- CreateIndex
CREATE INDEX "restaurants_is_veg_only_avg_rating_idx" ON "restaurants"("is_veg_only", "avg_rating");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_categories_name_key" ON "restaurant_categories"("name");

-- CreateIndex
CREATE INDEX "restaurant_category_map_category_id_idx" ON "restaurant_category_map"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_category_map_restaurant_id_category_id_key" ON "restaurant_category_map"("restaurant_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuisines_name_key" ON "cuisines"("name");

-- CreateIndex
CREATE INDEX "restaurant_cuisines_cuisine_id_idx" ON "restaurant_cuisines"("cuisine_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_cuisines_restaurant_id_cuisine_id_key" ON "restaurant_cuisines"("restaurant_id", "cuisine_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_hours_restaurant_id_day_of_week_key" ON "restaurant_hours"("restaurant_id", "day_of_week");

-- CreateIndex
CREATE INDEX "menu_categories_restaurant_id_sort_order_idx" ON "menu_categories"("restaurant_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_restaurant_id_name_key" ON "menu_categories"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "menu_items_restaurant_id_category_id_idx" ON "menu_items"("restaurant_id", "category_id");

-- CreateIndex
CREATE INDEX "menu_items_food_type_is_available_idx" ON "menu_items"("food_type", "is_available");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_restaurant_id_name_key" ON "menu_items"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "item_addons_menu_item_id_idx" ON "item_addons"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_addons_menu_item_id_name_key" ON "item_addons"("menu_item_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "offers_code_key" ON "offers"("code");

-- CreateIndex
CREATE INDEX "offers_is_active_start_date_end_date_idx" ON "offers"("is_active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "restaurant_offers_offer_id_idx" ON "restaurant_offers"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_offers_restaurant_id_offer_id_key" ON "restaurant_offers"("restaurant_id", "offer_id");

-- CreateIndex
CREATE INDEX "carts_restaurant_id_idx" ON "carts"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_restaurant_id_key" ON "carts"("user_id", "restaurant_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_menu_item_id_idx" ON "cart_items"("menu_item_id");

-- CreateIndex
CREATE INDEX "cart_item_addons_addon_id_idx" ON "cart_item_addons"("addon_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_addons_cart_item_id_addon_id_key" ON "cart_item_addons"("cart_item_id", "addon_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_status_idx" ON "orders"("user_id", "status");

-- CreateIndex
CREATE INDEX "orders_restaurant_id_status_idx" ON "orders"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "orders_delivery_partner_id_status_idx" ON "orders"("delivery_partner_id", "status");

-- CreateIndex
CREATE INDEX "orders_ordered_at_idx" ON "orders"("ordered_at");

-- CreateIndex
CREATE INDEX "order_status_events_order_id_created_at_idx" ON "order_status_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_menu_item_id_idx" ON "order_items"("menu_item_id");

-- CreateIndex
CREATE INDEX "order_item_addons_order_item_id_idx" ON "order_item_addons"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partners_user_id_key" ON "delivery_partners"("user_id");

-- CreateIndex
CREATE INDEX "delivery_partners_availability_status_idx" ON "delivery_partners"("availability_status");

-- CreateIndex
CREATE INDEX "delivery_documents_delivery_partner_id_idx" ON "delivery_documents"("delivery_partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_key" ON "reviews"("order_id");

-- CreateIndex
CREATE INDEX "reviews_restaurant_id_rating_idx" ON "reviews"("restaurant_id", "rating");

-- CreateIndex
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");

-- CreateIndex
CREATE INDEX "favorite_restaurants_restaurant_id_idx" ON "favorite_restaurants"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_restaurants_user_id_restaurant_id_key" ON "favorite_restaurants"("user_id", "restaurant_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "reservations_restaurant_id_reservation_date_idx" ON "reservations"("restaurant_id", "reservation_date");

-- CreateIndex
CREATE INDEX "reservations_user_id_status_idx" ON "reservations"("user_id", "status");

