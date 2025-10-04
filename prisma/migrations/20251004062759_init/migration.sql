-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "payee" TEXT NOT NULL,
    "memo" TEXT,
    "reference" TEXT,
    "tags" TEXT,
    "import_batch_id" TEXT,
    "external_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NORMAL',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "postings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transaction_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "is_business" BOOLEAN NOT NULL DEFAULT false,
    "gst_code" TEXT,
    "gst_rate" REAL,
    "gst_amount" REAL,
    "category_split_label" TEXT,
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconcile_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "postings_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "postings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "postings_reconcile_id_fkey" FOREIGN KEY ("reconcile_id") REFERENCES "reconciliations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "memorized_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "match_type" TEXT NOT NULL DEFAULT 'CONTAINS',
    "match_value" TEXT NOT NULL,
    "default_payee" TEXT,
    "default_account_id" TEXT,
    "default_splits" TEXT,
    "apply_on_import" BOOLEAN NOT NULL DEFAULT true,
    "apply_on_manual_entry" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "memorized_rules_default_account_id_fkey" FOREIGN KEY ("default_account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_account_id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "mapping_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_batches_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reconciliations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "statement_start_date" DATETIME NOT NULL,
    "statement_end_date" DATETIME NOT NULL,
    "statement_start_balance" REAL NOT NULL,
    "statement_end_balance" REAL NOT NULL,
    "notes" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reconciliations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "accounts_type_idx" ON "accounts"("type");

-- CreateIndex
CREATE INDEX "accounts_is_real_idx" ON "accounts"("is_real");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_name_type_key" ON "accounts"("name", "type");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_payee_idx" ON "transactions"("payee");

-- CreateIndex
CREATE INDEX "transactions_import_batch_id_idx" ON "transactions"("import_batch_id");

-- CreateIndex
CREATE INDEX "transactions_external_id_idx" ON "transactions"("external_id");

-- CreateIndex
CREATE INDEX "postings_transaction_id_idx" ON "postings"("transaction_id");

-- CreateIndex
CREATE INDEX "postings_account_id_idx" ON "postings"("account_id");

-- CreateIndex
CREATE INDEX "postings_cleared_idx" ON "postings"("cleared");

-- CreateIndex
CREATE INDEX "postings_reconciled_idx" ON "postings"("reconciled");

-- CreateIndex
CREATE INDEX "postings_is_business_idx" ON "postings"("is_business");

-- CreateIndex
CREATE INDEX "memorized_rules_priority_idx" ON "memorized_rules"("priority");

-- CreateIndex
CREATE INDEX "reconciliations_account_id_idx" ON "reconciliations"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");
