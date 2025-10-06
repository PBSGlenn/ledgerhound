-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TRANSFER',
    "subtype" TEXT,
    "is_real" BOOLEAN NOT NULL DEFAULT true,
    "is_business_default" BOOLEAN NOT NULL DEFAULT false,
    "opening_balance" REAL NOT NULL DEFAULT 0,
    "opening_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_accounts" ("archived", "created_at", "currency", "id", "is_business_default", "is_real", "name", "opening_balance", "opening_date", "sort_order", "subtype", "type", "updated_at") SELECT "archived", "created_at", "currency", "id", "is_business_default", "is_real", "name", "opening_balance", "opening_date", "sort_order", "subtype", "type", "updated_at" FROM "accounts";
DROP TABLE "accounts";
ALTER TABLE "new_accounts" RENAME TO "accounts";
UPDATE "accounts"
SET "kind" = CASE WHEN "type" IN ('INCOME', 'EXPENSE') THEN 'CATEGORY' ELSE 'TRANSFER' END;
CREATE INDEX "accounts_type_idx" ON "accounts"("type");
CREATE INDEX "accounts_is_real_idx" ON "accounts"("is_real");
CREATE UNIQUE INDEX "accounts_name_type_key" ON "accounts"("name", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
