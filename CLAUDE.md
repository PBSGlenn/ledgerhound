# Ledgerhound

## Project Overview
Personal & Small-Business Ledger for Australia with GST support. Web-based application with Express API server, React frontend, TypeScript, and SQLite. Tauri desktop packaging planned for future.

## Project Structure
```
ledgerhound/
├── prisma/                    # Database schema and migrations
│   ├── schema.prisma          # Prisma schema (double-entry model)
│   ├── seed.ts                # Sample data
│   └── migrations/            # Latest: add_ato_label
├── src/
│   ├── components/            # ~50 React UI components
│   │   ├── Account/           # Account management UI
│   │   ├── Book/              # Multi-book switching UI
│   │   ├── Category/          # Category hierarchy UI
│   │   ├── Common/            # Shared UI (ConfirmDialog)
│   │   ├── Dashboard/         # Dashboard view
│   │   ├── Import/            # CSV import wizard
│   │   ├── Layout/            # Sidebar, topbar, context menus
│   │   ├── Onboarding/        # First-run onboarding wizard
│   │   ├── Reconciliation/    # Bank reconciliation sessions
│   │   ├── Register/          # Account register grid
│   │   ├── Reports/           # P&L, GST, BAS, Spending Analysis reports
│   │   ├── Search/            # Global transaction search
│   │   ├── Settings/          # Settings and configuration
│   │   ├── Stripe/            # Stripe import modal
│   │   ├── Transaction/       # Transaction forms and register
│   │   ├── Transfer/          # Transfer matching wizard
│   │   └── UI/                # Toast notifications
│   ├── domain/                # Domain logic (account filters, transaction helpers)
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── api.ts             # API client (HTTP wrapper)
│   │   └── services/          # Business logic layer (15 services)
│   ├── types/                 # TypeScript type definitions
│   ├── App.tsx
│   └── main.tsx
├── src-server/
│   ├── api.ts                 # ~90 REST endpoints
│   └── validation.ts          # Centralized Zod validation schemas (45 schemas)
├── src-mcp/                   # MCP server for Claude Cowork integration
│   ├── index.ts               # MCP server entry point
│   └── api-client.ts          # API client for MCP tools
├── e2e/                       # Playwright E2E tests (4 suites, 16 tests)
├── scripts/                   # Utility and diagnostic scripts
├── playwright.config.ts
└── package.json
```

## Development Setup

### Prerequisites
- Node.js 18+
- Rust toolchain (for Tauri desktop builds)

### Installation
```bash
npm install
npm run db:migrate
npm run db:seed
```

### Key Commands
```bash
npm run api             # Start Express API server (port 3001)
npm run dev             # Start Vite dev server (port 5173)
npm run dev:all         # Start both servers concurrently
npm run build           # Build frontend for production
npm run db:migrate      # Run Prisma migrations
npm run db:seed         # Seed database with sample data
npm run db:studio       # Open Prisma Studio
npm test                # Run Vitest unit tests
npm run test:e2e        # Run Playwright E2E tests (stop API first)
npm run tauri:dev       # Run Tauri app (planned/future)
npm run tauri:build     # Build Tauri desktop app (planned/future)
```

## Architecture Notes

### Double-Entry Accounting
- All transactions have 2+ postings that sum to zero
- Validation enforced in `transactionService.ts`
- Transfers auto-balance (bank-to-bank, no category needed)
- The `Account` table stores both real accounts (`kind='TRANSFER'`: banks, cards, Stripe) and category accounts (`kind='CATEGORY'`: income/expense classifications)

See [STRIPE_ACCOUNTING_EXPLAINED.md](./STRIPE_ACCOUNTING_EXPLAINED.md) for detailed examples.

### Business vs Personal
- **Default**: All transactions are personal (no GST)
- **Business flag**: Set `isBusiness=true` on individual postings to enable GST tracking
- Accounts can have `isBusinessDefault=true` and `defaultHasGst=true/false` as defaults
- Example: "Bank Fees" can be business but GST-free (`defaultHasGst=false`)
- **GST validation**: Only enforced when `isBusiness=true` AND `defaultHasGst=true` (or not set)

### GST (Australian Tax)
- 10% standard rate; explicit postings to GST Collected (LIABILITY) and GST Paid (ASSET) categories
- Net GST position = GST Collected - GST Paid
- BAS payments are bank-to-ATO transfers (not to/from GST accounts)
- **Two GST recording patterns** (both must be handled in reports):
  - Pattern 1: `gstCode`/`gstAmount` fields on business postings (manual entry, CSV imports)
  - Pattern 2: Separate postings to GST Collected/Paid accounts (Stripe imports)
  - Reports use `processedTransactionIds` set to avoid double-counting between patterns

### Services Layer
- **accountService**: CRUD, balances, archiving, hierarchies
- **categoryService**: Hierarchical management, unlimited nesting, tree operations, path traversal
- **transactionService**: Double-entry + GST validation, register views, search, bulk operations
- **reportService**: P&L, GST Summary, BAS Draft, Spending Analysis (category descendant resolution, time bucketing, gap filling)
- **importService**: CSV parsing, column mapping, deduplication, memorized rule application
- **reconciliationService**: Session management, balance calculations, lock/unlock, ±1 day timezone buffer
- **stripeImportService**: Balance Transaction API, auto-creates GST categories, 5-way split accounting
- **memorizedRuleService**: Pattern matching (exact, contains, regex), priority-based, preview and apply
- **backupService**: Auto-backup on startup, manual backups, restore, cleanup, JSON export
- **settingsService**: JSON-based key-value storage in database
- **pdfStatementService**: PDF parsing and statement extraction
- **reconciliationMatchingService**: Statement parsing and transaction matching algorithms
- **transferMatchingService**: Hungarian algorithm (munkres-js), optimal 1:1 matching, atomic merge operations
- **taxService**: PAYG withholding calculations, tax tables configuration, financial year helpers
- **bookManager**: Multi-book support (stub/planned)

### API Server (`src-server/api.ts`)
~90 REST endpoints. Validation via `src-server/validation.ts` (45 Zod schemas). Security: Helmet.js, rate limiting (1000 req/15 min), optional API key auth.

Key endpoint groups:
- Accounts, Categories (13 endpoints incl. tree/hierarchy), Transactions (register, CRUD, search, bulk)
- Reports: P&L, GST, BAS, Spending Analysis (`POST /api/reports/spending-analysis`)
- Import, Reconciliation, Memorized Rules, Backups, Stripe
- Transfer matching: `POST /api/transfers/match-preview`, `POST /api/transfers/commit`
- Transaction search/bulk: `POST /api/transactions/search`, `POST /api/transactions/bulk-update`
- Bulk categorize: `GET /api/transactions/uncategorized-summary`, `POST /api/transactions/bulk-recategorize`
- Single recategorize: `POST /api/transactions/:id/recategorize`
- Move to account: `POST /api/transactions/:id/move-to-account`

**IMPORTANT: Express route ordering** — Named routes like `/api/transactions/uncategorized-summary` MUST be registered BEFORE wildcard routes like `/api/transactions/:id`, otherwise Express matches the wildcard first. Always place specific GET routes above `/:id` catch-all routes.

**IMPORTANT: Register filter naming convention** — The canonical field names used by `transactionService.getRegisterEntries()` are `dateFrom`/`dateTo`/`search`/`clearedOnly`/`reconciledOnly`/`businessOnly`/`personalOnly`. The API client (`src/lib/api.ts`) and server endpoint (`src-server/api.ts`) must map to these exact names. Do NOT use `startDate`/`endDate`/`searchText` — those were a naming mismatch bug that silently broke all register filtering.

### Database
- SQLite via Prisma ORM; composite indexes on Posting and Transaction tables for performance
- Migrations in `prisma/migrations/` (latest: `add_ato_label`)
- **Prisma relation pitfall**: When a model has a relation (e.g. `MemorizedRule.defaultAccount`), use `defaultAccount: { connect: { id: ... } }` in `create()`, NOT `defaultAccountId: ...` directly

## Testing

### Unit Tests (Vitest) - 419 passing, 1 pre-existing failure
```
bookManager (43)         importService (37)       memorizedRuleService (36)
categoryService (29)     accountService (32)      pdfStatementService (32)
reportService (32)       backupService (31)       settingsService (30)
reconciliationMatchingService (29) reconciliationService (27) stripeImportService (28)
transactionService (22)  transactions (7)         accountFilters (5)
```
Note: 1 failing test in `categoryService` (`getCategoryTree > should build tree with virtual parent nodes`) is pre-existing.
Run: `npm test`

### E2E Tests (Playwright) - 16 tests across 4 suites
- Account creation (3), Transaction entry (4), CSV import (3), Reconciliation (6)
- All skip gracefully when DB is locked (API running); pass when API is stopped
- Run: `npm run test:e2e` (stop API server first with `Ctrl+C`)
- Debug modes: `npm run test:e2e:ui`, `npm run test:e2e:headed`, `npm run test:e2e:debug`

## Current Status (2026-04-18)

### What's Working
- Complete double-entry accounting engine with GST validation
- Hierarchical category system with unlimited nesting
- Full transaction CRUD with splits, transfers, and bulk operations
- CSV import with column mapping, templates, deduplication, and memorized rules
- Stripe Balance Transaction integration with 5-way split accounting
- Comprehensive reporting: P&L, GST Summary, BAS Draft, Spending Analysis
- PDF reconciliation with smart transaction matching (saves 70-80% reconciliation time)
- Global transaction search (Ctrl+F) with filters and batch operations
- Transfer matching wizard using Hungarian algorithm for duplicate detection
- Bulk categorize: group uncategorized transactions by payee, assign categories, create rules
- Right-click context menu: recategorize, move to account, manual cleared/reconciled toggle
- PSP account pattern: intermediary accounts (Stripe, Optus) for bundled billing reconciliation
- Recurring bills with payment reminders: dashboard widget (14-day lookahead), overdue badge in topbar, pay/skip/pause flows that create real double-entry transactions
- Business/personal split ratios: mixed-use expenses (e.g. utilities 25% business) expand into paired postings with optional GST credit on the business portion, usable via manual entry, import rules, and memorized rules
- Automatic backup/restore system
- Settings with general, categories, rules, Stripe, backups, and tax tables tabs
- Desktop launcher (`start-ledgerhound.bat`)
- 419 unit tests (1 pre-existing failure), 16 E2E tests all passing

### Recent Changes (April 2026)
- **Business/personal split ratios** (2026-04-18): New `SplitRatio` type and `SplitBusinessPersonalDialog` for mixed-use expenses. `generateSplitPostings()` in `transactionService` expands a total into paired personal/business postings with a separate GST Paid/Collected posting when `gstOnBusiness` is true. Memorized rules can store a SplitRatio in `defaultSplits` (JSON); import flow detects and expands it via `memorizedRuleService.getSplitRatio()`. Also fixed reconciliation ±1 day timezone buffer to apply in `getUnreconciledPostings` and `ReconciliationSession` loader so AEST-stored-as-UTC boundary dates aren't dropped. Files: `src/types/index.ts`, `src/lib/services/transactionService.ts`, `src/lib/services/memorizedRuleService.ts`, `src/lib/services/reconciliationService.ts`, `src/lib/services/importService.ts`, `src/components/Transaction/SplitBusinessPersonalDialog.tsx`, `src/components/Transaction/TransactionFormModal.tsx`, `src/components/Settings/MemorizedRulesManager.tsx`, `src/components/Reconciliation/ReconciliationSession.tsx`, `src-server/validation.ts`.

### Recent Changes (March 2026)
- **AI categorization + MCP enhancements + PDF reconciliation improvements** (2026-03-29): Batch commit adding AI-assisted categorization, expanded MCP toolset (balance sheet, BAS draft, GST summary, tax estimation, spending analysis, reconciliation workflows), and PDF reconciliation polish.
- **Recurring bills & payment reminders** (2026-03-29): New `RecurringBill` model with CRUD, pay (creates real double-entry transaction), skip, pause/resume, upcoming/overdue tracking. Dashboard `UpcomingBillsWidget` shows bills due in next 14 days with quick-pay; topbar badge shows overdue count. Endpoints under `/api/recurring-bills`. 33 new tests. Files: `prisma/schema.prisma`, `src/lib/services/recurringBillService.ts`, `src/components/RecurringBills/`, `src/components/Dashboard/UpcomingBillsWidget.tsx`.
- **MCP server for Claude Cowork** (2026-03-29): Added `src-mcp/` with MCP server exposing PDF reconciliation tools and CSV import tools for AI-assisted bank statement processing.
- **Move to Account** (2026-03-01): Right-click context menu in the register now includes "Move to Account", which reassigns a transaction to any other real (TRANSFER) account via a dialog with account dropdown. Clears reconciliation state on move. New endpoint: `POST /api/transactions/:id/move-to-account`. Files changed: `src-server/api.ts`, `src/lib/api.ts`, `src/components/Register/RegisterGrid.tsx`.
- **Optus PSP account pattern** (2026-03-01): Created Optus Payment Processor account to handle bundled billing (mobile + Netflix + YouTube on one statement charge). Same PSP intermediary pattern as Stripe — bank reconciliation sees a single transfer while individual expenses get their own payees.
- **Manual cleared/reconciled toggle** (2026-02-28): Right-click context menu lets users manually set cleared/reconciled status on any transaction posting.

### Recent Changes (February 2026)
- **Reconciliation: locked items & register filter fix** (2026-02-24): Fixed two bugs where (1) date filters on the register endpoint were silently ignored due to naming mismatches across three layers (`dateFrom`/`dateTo` vs `startDate`/`endDate`) and (2) previously reconciled (locked) transactions appeared in new reconciliation sessions. Standardized `RegisterFilter` on canonical field names (`dateFrom`/`dateTo`/`search`), fixed server-to-service mapping (`clearedOnly`/`reconciledOnly`), and added client-side `reconcileId` filtering in `ReconciliationSession.tsx`. Files changed: `src/lib/api.ts`, `src-server/api.ts`, `src/types/index.ts`, `src/components/Register/RegisterGrid.tsx`, `src/components/Reconciliation/ReconciliationSession.tsx`.
- **Bulk Categorize & Recategorize** (2026-02-23): Bulk Categorize modal groups uncategorized transactions by payee with category selectors and optional memorized rule creation. Right-click context menu "Recategorize" option for quick single-transaction category changes. New endpoints: `GET /api/transactions/uncategorized-summary`, `POST /api/transactions/bulk-recategorize`, `POST /api/transactions/:id/recategorize`. New component: `BulkCategorizeModal.tsx`.
- **GST Report Fixes** (2026-02-23): Fixed GST Summary and BAS Draft to handle two GST recording patterns — (1) gstCode/gstAmount on business postings (CSV imports) and (2) separate postings to GST Collected/Paid accounts (Stripe imports). Both reports now use dual-pattern detection with deduplication via processedTransactionIds set.
- **Spending Analysis Report** (2026-02-19): New Reports tab for analyzing spending by category, payee, or both. Filters: date range, category multi-select with hierarchy expansion, payee tags, weekly/monthly granularity, business-only, include income. Summary cards: Grand Total, Transaction Count, Avg/Period, Highest Period. Time-series bar chart (recharts). Sub-views: By Category (horizontal bar + donut + sortable table), By Payee (same), Combined (stacked bars + breakdown table). CSV export per sub-view. New files: `SpendingAnalysisReport.tsx`, `CategoryMultiSelect.tsx`. New endpoint: `POST /api/reports/spending-analysis`. New dependency: recharts.
- **Validation bug fix** (2026-02-19): Fixed `sendValidationError` in `validation.ts` using `error.errors` (undefined) instead of `error.issues` - was silently breaking all Zod validation error responses.
- **Global Transaction Search** (2026-02-17): Search across all accounts, filters, batch operations, Ctrl+F shortcut, navigate-to-transaction with pulse highlight.
- **Duplicate Category Name Bug** (2026-02-17): Fixed `accountService` uniqueness check to scope duplicates within the same parent only.
- **Transfer Matching** (2026-02-16): Hungarian algorithm wizard for merging duplicate transfer transactions after CSV import.

### TODO
- User documentation (setup guide, workflow docs, screenshots)
- Multi-book UI (bookManager service complete with 43 tests)
- Tauri desktop packaging
- E2E coverage for reports, settings, advanced workflows
- Vehicle logbook tracking (ATO logbook and cents-per-km methods)
- Email delivery for bill reminders (in-app reminders shipped; SMTP/email notifications still TODO)
- AI-assisted budgeting (scope: distinct from Cowork MCP categorization — intended for forward-looking budget suggestions)

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + Radix UI + recharts
- **Backend**: Express + TypeScript (port 3001)
- **Database**: SQLite via Prisma ORM
- **Validation**: Zod schemas in `src-server/validation.ts`
- **Testing**: Vitest (unit), Playwright (E2E)
