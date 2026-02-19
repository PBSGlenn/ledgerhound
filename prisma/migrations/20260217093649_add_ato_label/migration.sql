-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "ato_label" TEXT;

-- CreateIndex
CREATE INDEX "postings_reconcile_id_idx" ON "postings"("reconcile_id");

-- CreateIndex
CREATE INDEX "postings_account_id_cleared_reconciled_idx" ON "postings"("account_id", "cleared", "reconciled");

-- CreateIndex
CREATE INDEX "postings_account_id_is_business_idx" ON "postings"("account_id", "is_business");

-- CreateIndex
CREATE INDEX "postings_is_business_gst_code_idx" ON "postings"("is_business", "gst_code");

-- CreateIndex
CREATE INDEX "transactions_date_status_idx" ON "transactions"("date", "status");
