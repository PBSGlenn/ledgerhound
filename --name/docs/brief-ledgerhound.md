
---

# Build Brief / Prompt for Claude Code

**Project:** Personal & Small-Business Ledger (AU)
**Platform:** Desktop app (preferred) or local web app
**Currency/Locale:** AUD, Australia (GST/BAS), `dd/MM/yyyy`, timezone `Australia/Melbourne`
**Scope:** Personal use only; local data storage; no bank API connections (CSV import supported)

## High-Level Goals

Create an offline ledger app with “register” views (interactive tables) for each account. Support real accounts (bank, card, PSP) and virtual accounts (GST, savings goals, etc.). Double-entry under the hood for correctness; simple, two-line transaction UI for speed. Include CSV import, split transactions, memorized payees, categories, and reconciliation (manual + against PDF statements). Provide reports for personal finances and small-business GST/BAS.

## Tech Stack (preferred, but adjust if you like)

* **Frontend:** React + TypeScript (Vite), component lib minimal (headless preferred).
* **Desktop wrapper:** Tauri (Rust) or Electron (choose one).
* **Backend:** Node (Express) or Rust (Tauri command handlers).
* **DB:** SQLite (via Prisma or Drizzle).
* **PDF viewing:** PDF.js embedded viewer.
* **Packaging:** Single binary/app with embedded SQLite.
* **Testing:** Vitest + Playwright (UI smoke), minimal API tests.

> If you prefer a pure local web app: FastAPI (Python) or Express + SQLite; serve on `localhost`, no cloud.

## Data & Accounting Model (double-entry)

Use a true double-entry ledger to guarantee that transfers and splits remain consistent. UI stays simple.

### Entities

**Account**

* `id`, `name`, `type` (ASSET | LIABILITY | EQUITY | INCOME | EXPENSE)
* `subtype` (optional: BANK, CARD, PSP, GST_CONTROL, SAVINGS_GOAL, CASH, etc.)
* `is_real` (boolean) – real (bank/card/psp/cash) vs virtual (e.g., GST control, savings goals)
* `opening_balance` (decimal), `opening_date`
* `currency` (default `AUD`)
* `archived` (bool)

**Transaction (header)**

* `id`, `date`, `payee` (payer/payee or counter-account name)
* `memo` (free text), `reference` (invoice/receipt no)
* `tags` (array of strings; used for “Hash/Grouping” e.g., `trip-japan-2025`)
* `import_batch_id` (nullable), `external_id` (nullable, for de-dupe)
* `status` (NORMAL | VOID)
* `created_at`, `updated_at`

**Posting (line items of a transaction)**

* `id`, `transaction_id`, `account_id`, `amount` (signed; sum of all postings = 0)
* `gst_code` (GST | GST_FREE | INPUT_TAXED | EXPORT | OTHER), `gst_rate` (e.g., 0.10)
* `category_split_label` (optional label when splitting across multiple categories)
* `cleared` (bool), `reconciled` (bool), `reconcile_id` (nullable)

> Categories are just **INCOME**/**EXPENSE** accounts. “Transfer categories” are simply postings to non-income/expense accounts (e.g., ASSET ↔ LIABILITY). “Virtual accounts” (GST control, savings goals) are normal ledger accounts (LIABILITY/EQUITY/ASSET) that don’t map to a bank.

**Memorized Rule (payee templates)**

* `id`, `match_type` (EXACT | CONTAINS | REGEX)
* `match_value` (string/regex), `default_payee` (optional override)
* `default_account_id` (optional), `default_splits` (array of { account_id, percent_or_amount, gst_code, memo template })
* `apply_on_import` (bool), `apply_on_manual_entry` (bool), priority integer

**Import Batch**

* `id`, `source_account_id`, `source_name`, `created_at`, `mapping_json`

**Reconciliation**

* `id`, `account_id`, `statement_start_date`, `statement_end_date`
* `statement_start_balance`, `statement_end_balance`
* `notes`, `created_at`

> Running balances are computed per register (account) by summing cleared (or all) postings up to each row.

## Required Features

### A. Registers (interactive tables)

* Left sidebar: tree of accounts grouped by type; show current balance & “cleared” balance.
* Main grid per account (“register”):

  * **Line 1:** `Date | Payee | Debit | Credit | Running Balance`
  * **Line 2:** `Category (account picker for Income/Expense/Transfers) | Memo/Reference | Tags (hash/grouping)`
* Inline edit cells, keyboard friendly (`Enter` to add row, `Tab` to move).
* Split transactions: add multiple category rows (postings) under one header; must sum to the transaction’s amount; each split has its own GST code.
* Transfers: choosing a non-category account (e.g., another ASSET/LIABILITY) creates linked postings; no category needed.
* Quick filters: date ranges, text search, tags, status (cleared/reconciled), amount ranges.
* Batch actions: clear/unclear, set category, set tag, delete (with confirm).

### B. Add/Edit/Delete transactions

* New transaction modal:

  * Mode: **Simple** (one category) or **Split** (n categories).
  * Choose payee; apply memorized rule preview (editable before save).
  * When **transfer**, selecting another account auto-adds the opposing posting.
* Editing a transaction updates all linked postings atomically.
* Deleting a transaction removes all its postings; soft-delete or `status=VOID` option.

### C. CSV Import (from banking sites)

* Import wizard:

  1. Select **target real account** the CSV belongs to.
  2. Upload CSV.
  3. Column mapping UI: map columns to `date`, `description/payee`, `debit`, `credit`, `amount`, `reference`, `balance` (optional). Support custom date formats.
  4. Preview & rule application: show dedupe warning (date+abs(amount)+payee within ±3 days or external_id match).
  5. Apply memorized rules (opt-in) + bulk assign provisional categories.
  6. Confirm import → create transactions with one posting to the target account and the balancing posting to a temporary **“Uncategorized”** expense or income account.
* Save mapping per source for next time.

### D. Memorized Payees/Payers

* Rule manager: list, add, edit, reorder priority.
* Each rule defines default splits, GST treatment, memo template, and optional destination account (for common transfers like “Transfer to Savings”).
* On manual entry or import preview, show a “rule matched” banner with the pre-filled fields.

### E. Categories (Chart of Accounts) manager

* Create/edit/archive accounts; enforce unique names within a type.
* Mark default GST code per Income/Expense account.
* Allow “virtual” accounts such as GST Control (LIABILITY), Savings Goals (EQUITY/ASSET), etc.

### F. Reconciliation

* **Manual tick-off:** Check “cleared” on postings that appear on the bank statement; view difference vs statement balance.
* **Statement-based reconciliation session:**

  * Input statement start/end balance & dates.
  * Show only uncleared postings in that date range; tick to reconcile; show difference live.
  * Lock session when balanced; mark postings `reconciled=true` with `reconcile_id`.
* **PDF Assist:** Side-by-side embedded PDF viewer; user scrolls statement and checks items; (optional later) simple OCR to suggest matches, but MVP is manual tick-off with keyboard.

### G. GST/BAS (AU)

* Per split/posting, support GST code & rate:

  * **GST (10%)** standard
  * **GST-Free**
  * **Input Taxed**
  * (Keep codes extensible for exports/etc.)
* Default GST code per category & via memorized rules; allow override per split.
* **Reports** (select period: month/quarter/custom):

  * **GST Summary:** GST collected (on income), GST paid (on expenses), net payable/receivable; list by category and by payee.
  * **BAS Draft:** derive key boxes (e.g., G1 total sales, G10/G11 purchases, 1A/1B GST), rounded to whole dollars (note this in UI); show a reconciliation table and export CSV/PDF.
  * **Profit & Loss** (cash basis): Income vs Expense by category, with GST-exclusive and GST-inclusive options.
  * **Cashbook**: all cash movements filtered by tags/categories/accounts.
* **Settings:** Tax basis = Cash; single currency AUD.

### H. Tags / Hash / Grouping

* Free-text tags (e.g., `trip-japan-2025`); autocomplete on entry.
* Filters and a tag summary report (spend/income by tag).

### I. Backups & Export

* Auto-backup on close to a timestamped `.db` and `.json` in a configurable local folder.
* Exports: CSV (register), CSV (all transactions with splits flattened), JSON (full), PDF (reports).

### J. Non-Functional

* Fully offline/local; no telemetry.
* Snappy UI on 10k–100k transactions.
* Safe writes (DB transactions).
* Keyboard-first UX; accessible form fields.
* Basic theming; dark mode.

## UI Details (what to build)

* **Main layout:**

  * Sidebar: Accounts list with balances (All, Real, Virtual; quick add).
  * Top bar: Date filter, search, New Transaction, Import, Reconcile, Reports.
* **Register grid columns:**

  * Line 1: Date | Payee | Debit | Credit | Running Balance (derived)
  * Line 2 (expand/collapsible): Category/Account | GST | Memo/Reference | Tags
* **Split editor:** add/remove rows; show “Remaining to allocate” indicator; per-split GST selector; validate to exact sum.
* **Transfer toggle:** switching category to an asset/liability account converts to transfer (and hides GST for that leg).
* **Reconcile view:** sticky totals (Statement vs Cleared vs Difference); filters; “Mark all on date” helper.

## Validation Rules

* Sum of postings per transaction must equal zero.
* If using Debit/Credit entry UI, convert to signed postings consistently:

  * Asset increase = positive; Expense increase = positive; Income increase = negative; Liability/Equity increase = negative (or choose a consistent internal convention and stick to it).
* Split totals must equal transaction amount.
* Transfers cannot have GST on the bank-to-bank legs; GST only applies to income/expense postings.
* Prevent date outside account lifespan unless confirmed.

## Example Records

**Example: Grocery purchase $110 with $10 GST (Woolworths) from Debit Card**

* Transaction:

  * date: `12/08/2025`, payee: `Woolworths`, memo: `Receipt 12345`
  * Postings:

    * Asset (Bank—Debit Card): **−110.00**
    * Expense (Groceries): **+100.00**, `gst_code=GST`, `gst_rate=0.10`
    * Liability (GST Control): **+10.00** (GST collected negative on income; here we claim input credit → use a single posting pattern you choose; alternatively model GST via split fields and compute GST control automatically. Pick ONE approach and keep it consistent.)

> Simpler implementation: store GST on the split, but **do not** add a separate GST posting; then **derive** GST Control via reports. This avoids extra postings and keeps UI simple. Choose this for MVP.

**Example: Transfer $500 to Savings Goal (virtual)**

* Postings:

  * Asset (Bank—Main): −500.00
  * Equity (Savings Goal—Holiday): +500.00
  * No GST.

## CSV Import Mapping (typical columns to support)

* Date (supports `dd/MM/yyyy`, `d/M/yy`, `yyyy-MM-dd`)
* Description/Payee
* Amount **or** Debit/Credit (if both present, Debit = negative, Credit = positive internally)
* Reference / Transaction ID (optional)
* Balance (ignored for posting; used for reconciliation hints only)

De-dupe heuristic: same absolute amount, same date (±3 days), and similar payee (case-insensitive contains) or identical external ID.

## Reports (minimum)

* Profit & Loss by period (cash basis), totals and per category.
* GST Summary & BAS draft (periodic, rounded to whole dollars).
* Tag Report (spend/income by tag).
* Account Balances & register export.

## Settings

* Organisation profile: Name, ABN (optional), address.
* Defaults: Date format, timezone, rounding (BAS: whole dollars), GST default per new category.
* Backup folder; import mappings; rules priorities.

## Deliverables (ask Claude to generate)

1. **Complete codebase** with build scripts.
2. **SQLite schema & migrations.**
3. **Seed data** (a few sample accounts, categories, and transactions).
4. **Tests**:

   * Unit: split validation, zero-sum enforcement, import mapping + de-dupe.
   * E2E: add transaction, split, transfer, import CSV, reconcile flow, GST report.
5. **Docs**:

   * README with run/build steps.
   * User guide (with keyboard shortcuts).
   * Notes on GST calculation choices and BAS mapping.

## Acceptance Criteria (MVP)

* Create real & virtual accounts; see balances; archive works.
* Add/edit/delete transactions; split with validation; transfer auto-balances.
* Register shows two-line UI and running balance updates live.
* CSV import maps columns, de-dupes, applies memorized rules, and imports ≥1k rows in <5s on typical hardware.
* Memorized rules auto-fill fields on manual entry & import preview.
* Manual reconciliation: can reach zero difference with statement start/end balances; lock session marks postings reconciled.
* GST: selectable per split; GST Summary and BAS draft for a given quarter; export to CSV/PDF.
* All data stays local; backups produce versioned files.

## Nice-to-Have (post-MVP)

* Quick “Rule from this transaction” button.
* Attachments (drop receipt PDFs/images onto a transaction).
* Basic OCR suggestion from statement PDF.
* OFX/QIF import.
* Multi-entity books (separate files).

## Implementation Notes for Claude

* Keep business logic in shared modules (posting math, GST, reconciliation) so it’s testable.
* Derive running balances via SQL window functions (ROW_NUMBER/PARTITION BY) or computed on the fly; cache for large registers.
* For GST: MVP approach = store GST on each **Expense/Income split** (amount is GST-exclusive or inclusive; store both and compute the other); **do not** create a separate posting to a GST account. Reports then aggregate GST.
* For reconciliation: don’t mutate original amounts; only toggle `cleared/reconciled` flags on postings and tie them to a `reconcile_id`.
* Use optimistic UI for inline edits with rollback on failure.


Nice brief. I reviewed the current canvas code (the single-file React UI you’re running) against it. Here’s a clear read on what already matches, what’s partial, and what’s missing—with concrete next steps.

# What the current code already does (✅)

* **Register layout**: Two-line rows, sticky **heading row**, and a far-right **Running Balance** column.

  * Line 1: `Date | Payee | Debit | Credit | Balance`
  * Line 2: `→ Category • Memo • #tags`
* **AU locale defaults**: AUD currency formatting and `en-AU` date rendering in the register.
* **New transaction UI**: Right-side drawer with **Simple / (proto) Split** capability; split lines must sum to the amount (`isBalanced` check).
* **Basic filters**: Toggle pills for **All / Business / Personal** (prototype-level).
* **Tags**: Extracts `#hashtags` from memo for display.

# What’s only partial (🟡)

* **Running balance derivation**: Shown per row but **not computed** from postings—it just uses a `balance` field in seed data. Needs to derive from real transactions.
* **Split editor**: Good UX start, but no **GST per split**, no category/account picker, and no **“remaining to allocate”** indicator.
* **Transfers**: Not implemented as account↔account postings; UI doesn’t switch to transfer semantics when choosing a non-category account.
* **Filtering**: No date range, text, tags, status (cleared/reconciled), or amount filters yet.
* **Batch actions**: Buttons exist, but no clear/unclear, bulk set category/tags, or delete implementation.
* **Reports**: Buttons only—no GST Summary, BAS draft, P&L, or Tag report views yet.

# What’s missing (❌)

* **Desktop wrapper + backend**: No Tauri commands, no Node/Rust backend.
* **DB & schema**: No SQLite/Prisma or migrations; no entities (`Account`, `Transaction`, `Posting`, `Rule`, `ImportBatch`, `ReconcileSession`).
* **Double-entry accounting**: No postings model; no zero-sum enforcement in storage.
* **CSV import wizard**: No file upload, column mapping, preview, dedupe, rule application, or commit.
* **Memorized rules engine**: No rule store, matching, or auto-fill.
* **Reconciliation**: No manual tick-off, no statement session, no PDF viewer.
* **GST/BAS**: No per-split GST codes, no computation or period reports.
* **Settings & backups**: No app settings, backups/exports.
* **Testing**: Only tiny console asserts—no Vitest/Playwright, no API tests.
* **Performance**: No virtualization for long registers.

---

# Implementation plan (pragmatic + brief-aligned)

## 1) Data & accounting core (Prisma + SQLite)

**Prisma schema (MVP extract):**

```prisma
model Account {
  id               String   @id @default(cuid())
  name             String   @unique
  type             String   // ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
  subtype          String?  // BANK, CARD, GST_CONTROL, SAVINGS_GOAL...
  isReal           Boolean  @default(false)
  openingBalance   Decimal  @default(0)
  openingDate      DateTime?
  currency         String   @default("AUD")
  archived         Boolean  @default(false)
  postings         Posting[]
}

model Transaction {
  id          String    @id @default(cuid())
  date        DateTime
  payee       String
  memo        String? 
  reference   String?
  tags        String[]  // ["trip-japan-2025"]
  importBatchId String?
  externalId  String?
  status      String    @default("NORMAL") // NORMAL | VOID
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  postings    Posting[]
}

model Posting {
  id            String   @id @default(cuid())
  transactionId String
  accountId     String
  // Positive/negative follows a consistent convention (see Validation)
  amount        Decimal
  gstCode       String?  // GST | GST_FREE | INPUT_TAXED | EXPORT...
  gstRate       Decimal? // e.g. 0.10
  categorySplitLabel String?
  cleared       Boolean  @default(false)
  reconciled    Boolean  @default(false)
  reconcileId   String?
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  account       Account     @relation(fields: [accountId], references: [id])
}
```

* Enforce **zero-sum** per transaction in service layer.
* **Migrations + seed** with a few AU-centric accounts.

## 2) Tauri commands (Rust) or Node API

* `listAccounts`, `getRegister(accountId, filters)`, `createTransaction(header, splits)`, `importCsv(...)`, `applyRules(...)`, `startReconcile(...)`, `finalizeReconcile(...)`, `reportGst(...)`, `reportPnL(...)`.
* Keep business logic (posting math, GST, reconciliation) in shared modules.

## 3) Register derivations

* Compute **running balance** in SQL or in-memory:

  * SQL (fast for large sets): windowed sum per account with ordering by date, then id.
  * Cleared/current toggle: filter postings by `cleared` when needed.
* Inline edits: save via command; optimistic UI with rollback.

## 4) Splits, Transfers, GST

* Split editor: add **per-split GST code & rate** selectors; “Remaining to allocate” badge.
* Transfer UX: category picker becomes an **account picker** when non-INCOME/EXPENSE chosen; hide GST for transfer legs.
* For MVP per brief: store GST on splits (no extra GST Control posting); reports derive GST totals.

## 5) CSV Import wizard

* Stepper: Account → Upload → Map columns → Preview & rules → Dedupe → Commit.
* **Dedupe**: date ±3 days + abs(amount) + fuzzy payee OR exact externalId.
* Save mapping per source.

## 6) Memorized rules

* Rule list with priority. Match types: EXACT/CONTAINS/REGEX.
* On import/manual entry: show **“Rule matched”** chip and apply prefill (editable).

## 7) Reconciliation

* Manual tick-off of `cleared`.
* Statement session: enter start/end balances/dates; show diff live; lock marks `reconciled`.
* **PDF viewer** (PDF.js) side-by-side.

## 8) Reports

* **GST Summary** and **BAS draft** (cash basis) for a period, rounded to whole dollars.
* **P&L** (cash basis) with GST-exclusive / inclusive toggle.
* Tag and Cashbook reports.

## 9) Settings, Backups, Exports

* App settings (date format, TZ `Australia/Melbourne`, GST defaults).
* Auto-backup `.db` and `.json` on close.
* Exports: CSV (register & flattened transactions), JSON, PDF (reports).

## 10) Tests

* **Vitest** unit tests:

  * zero-sum enforcement
  * split validation & “remaining to allocate”
  * transfer postings correctness
  * GST calc from splits (summary + BAS mapping)
  * CSV mapping + dedupe
* **Playwright**:

  * add simple txn
  * add split w/ GST
  * transfer
  * import CSV -> preview -> commit
  * manual reconcile to zero diff
  * GST report & BAS export

---

# Quick wins inside your current UI

1. **Running balance:** replace the seeded `balance` with a derived running tally from the fetched register rows; add a **Cleared/All** toggle.
2. **Category/Account picker:** change the second line to a real combo that filters between category accounts (INCOME/EXPENSE) and transfer accounts (ASSET/LIABILITY/EQUITY).
3. **Split editor:** add a small “Remaining: $X.XX” badge and a **GST code** dropdown per line.
4. **Filters bar:** date range, text search, tags, `Cleared`, `Reconciled`, min/max amount.
5. **Virtualization:** for the register list (e.g., `@tanstack/react-virtual`) to keep it snappy at 100k rows.

---

# Open questions (please confirm)

1. **Balance semantics**: Should the rightmost **Balance** column be *current* (all postings) by default, with a toggle to *cleared-only*?
2. **Debit/Credit convention**: For UI entry, do you want **Asset/Expense increases as Debit (+)** and **Income/Liability/Equity increases as Credit (−)** internally? (I’ll lock this convention end-to-end.)
3. **GST on transfers**: Confirm **no GST** on bank-to-bank (or other non-Income/Expense) transfer legs.
4. **MVP storage of GST**: Proceed with **GST stored on splits** (no separate GST control posting) and **derive** GST in reports, as your brief suggests?
5. **Desktop vs Web**: Are we committing to **Tauri + Prisma** (embedded SQLite) for MVP, or do you prefer a pure local web app for the first cut?

If you’re good with the above, I can turn the current component into a proper **Tauri + Prisma** scaffold with schema, migrations, a minimal API, and stubbed pages for Import, Rules, Reconcile, and Reports—keeping your two-line register UI intact and wiring it to real data.


