-- CreateTable
CREATE TABLE "recurring_bills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "expected_amount" REAL NOT NULL,
    "frequency" TEXT NOT NULL,
    "due_day" INTEGER NOT NULL,
    "start_date" DATETIME NOT NULL,
    "category_account_id" TEXT NOT NULL,
    "pay_from_account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_paid_date" DATETIME,
    "next_due_date" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "recurring_bills_category_account_id_fkey" FOREIGN KEY ("category_account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recurring_bills_pay_from_account_id_fkey" FOREIGN KEY ("pay_from_account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "recurring_bills_status_idx" ON "recurring_bills"("status");

-- CreateIndex
CREATE INDEX "recurring_bills_next_due_date_idx" ON "recurring_bills"("next_due_date");
