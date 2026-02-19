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
│   ├── components/            # 30+ React UI components
│   │   ├── Account/           # Account management UI
│   │   ├── Category/          # Category hierarchy UI
│   │   ├── Layout/            # Sidebar, topbar, context menus
│   │   ├── Transaction/       # Transaction forms and register
│   │   ├── Transfer/          # Transfer matching wizard
│   │   ├── Dashboard/         # Dashboard view
│   │   ├── Reports/           # P&L, GST, BAS, Spending Analysis reports
│   │   ├── Settings/          # Settings and configuration
│   │   ├── Import/            # CSV import wizard
│   │   └── Search/            # Global transaction search
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── api.ts             # API client (HTTP wrapper)
│   │   └── services/          # Business logic layer (15 services)
│   ├── types/                 # TypeScript type definitions
│   ├── App.tsx
│   └── main.tsx
├── src-server/
│   ├── api.ts                 # 100+ REST endpoints
│   └── validation.ts          # Centralized Zod validation schemas
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
- **bookManager**: Multi-book support (stub/planned)

### API Server (`src-server/api.ts`)
100+ REST endpoints. Validation via `src-server/validation.ts` (25+ Zod schemas). Security: Helmet.js, rate limiting (1000 req/15 min), optional API key auth.

Key endpoint groups:
- Accounts, Categories (9 tree endpoints), Transactions (register, CRUD, search, bulk)
- Reports: P&L, GST, BAS, Spending Analysis (`POST /api/reports/spending-analysis`)
- Import, Reconciliation, Memorized Rules, Backups, Stripe
- Transfer matching: `POST /api/transfers/match-preview`, `POST /api/transfers/commit`
- Transaction search/bulk: `POST /api/transactions/search`, `POST /api/transactions/bulk-update`

### Database
- SQLite via Prisma ORM; composite indexes on Posting and Transaction tables for performance
- Migrations in `prisma/migrations/` (latest: `add_ato_label`)

## Testing

### Unit Tests (Vitest) - 402 tests, all passing
```
accountService (45)      categoryService (36)     transactionService (68)
importService (31)       reconciliationService (29) reportService (22)
memorizedRuleService (20) backupService (15)       settingsService (7)
stripeImportService (28) pdfStatementService (32) reconciliationMatchingService (29)
bookManager (43)
```
Run: `npm test`

### E2E Tests (Playwright) - 16 tests across 4 suites
- Account creation (3), Transaction entry (4), CSV import (3), Reconciliation (6)
- All skip gracefully when DB is locked (API running); pass when API is stopped
- Run: `npm run test:e2e` (stop API server first with `Ctrl+C`)
- Debug modes: `npm run test:e2e:ui`, `npm run test:e2e:headed`, `npm run test:e2e:debug`

## Current Status (2026-02-19)

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
- Automatic backup/restore system
- Settings with general, categories, rules, Stripe, backups, and tax tables tabs
- Desktop launcher (`start-ledgerhound.bat`)
- 402 unit tests, 16 E2E tests all passing

### Recent Changes (February 2026)
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

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + Radix UI + recharts
- **Backend**: Express + TypeScript (port 3001)
- **Database**: SQLite via Prisma ORM
- **Validation**: Zod schemas in `src-server/validation.ts`
- **Testing**: Vitest (unit), Playwright (E2E)
