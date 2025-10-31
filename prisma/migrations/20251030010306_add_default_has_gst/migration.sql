-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "full_path" TEXT,
    "type" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TRANSFER',
    "parent_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "subtype" TEXT,
    "is_real" BOOLEAN NOT NULL DEFAULT true,
    "is_business_default" BOOLEAN NOT NULL DEFAULT false,
    "default_has_gst" BOOLEAN NOT NULL DEFAULT true,
    "opening_balance" REAL NOT NULL DEFAULT 0,
    "opening_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_accounts" ("archived", "created_at", "currency", "full_path", "id", "is_business_default", "is_real", "kind", "level", "name", "opening_balance", "opening_date", "parent_id", "sort_order", "subtype", "type", "updated_at") SELECT "archived", "created_at", "currency", "full_path", "id", "is_business_default", "is_real", "kind", "level", "name", "opening_balance", "opening_date", "parent_id", "sort_order", "subtype", "type", "updated_at" FROM "accounts";
DROP TABLE "accounts";
ALTER TABLE "new_accounts" RENAME TO "accounts";
CREATE INDEX "accounts_type_idx" ON "accounts"("type");
CREATE INDEX "accounts_parent_id_idx" ON "accounts"("parent_id");
CREATE INDEX "accounts_level_idx" ON "accounts"("level");
CREATE INDEX "accounts_full_path_idx" ON "accounts"("full_path");
CREATE INDEX "accounts_is_real_idx" ON "accounts"("is_real");
CREATE UNIQUE INDEX "accounts_name_type_parent_id_key" ON "accounts"("name", "type", "parent_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
