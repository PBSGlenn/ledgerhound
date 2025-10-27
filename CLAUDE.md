# Ledgerhound

## Project Overview
Personal & Small-Business Ledger for Australia with GST support. Desktop app built with Tauri, React, TypeScript, and SQLite.

## Project Structure
```
ledgerhound/
├── prisma/                    # Database schema and migrations
│   ├── schema.prisma          # Prisma schema (double-entry model)
│   ├── seed.ts                # Sample data (personal + business examples)
│   └── migrations/
├── src/
│   ├── components/            # React UI components (TODO)
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   └── services/          # Business logic layer
│   │       ├── accountService.ts        # CRUD + balance calculations
│   │       ├── transactionService.ts    # Double-entry + GST validation
│   │       ├── importService.ts         # CSV import (TODO)
│   │       ├── reconciliationService.ts # Reconciliation (TODO)
│   │       └── reportService.ts         # P&L, GST, BAS (TODO)
│   ├── types/                 # TypeScript type definitions
│   ├── App.tsx                # Main app
│   └── main.tsx
├── src-tauri/                 # Tauri Rust wrapper
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

### Run the app
```bash
npm run tauri:dev      # Desktop app
npm run dev            # Web dev server only
npm run db:studio      # Prisma Studio (DB GUI)
```

## Key Commands
```bash
npm run tauri:dev       # Run Tauri app in dev mode
npm run tauri:build     # Build production app
npm run dev             # Vite dev server (UI only)
npm run build           # Build frontend
npm run db:migrate      # Run Prisma migrations
npm run db:seed         # Seed database with sample data
npm run db:studio       # Open Prisma Studio
npm test                # Run Vitest tests
npm run test:e2e        # Run Playwright E2E tests
```

## Architecture Notes

### Double-Entry Accounting
- All transactions have 2+ postings that sum to zero
- Validation enforced in `transactionService.ts`
- Transfers auto-balance (bank-to-bank, no category needed)

**Why Categories Are Accounts:**
In double-entry accounting, everything is an account. The `Account` table stores both:
- **Real accounts** (`kind='TRANSFER'`): Banks, credit cards, Stripe (where money physically sits)
- **Category accounts** (`kind='CATEGORY'`): Income/expense classifications (how transactions are categorized)

See [STRIPE_ACCOUNTING_EXPLAINED.md](./STRIPE_ACCOUNTING_EXPLAINED.md) for detailed examples.

### Business vs Personal
- **Default**: All transactions are personal (no GST)
- **Business flag**: Set `isBusiness=true` on individual postings to enable GST tracking
- **Category defaults**: Accounts can have `isBusinessDefault=true` to auto-enable GST for postings to that account
- **GST validation**: Only enforced when `isBusiness=true`

### GST (Australian Tax)
- 10% standard rate
- **GST Collected** (LIABILITY, category): GST you owe to ATO
- **GST Paid** (ASSET, category): GST you can claim back from ATO
- Net GST position = GST Collected - GST Paid
- BAS payments are transfers from bank to ATO (not to/from GST accounts)

### Database
- SQLite via Prisma ORM
- Migrations in `prisma/migrations/`
- Seed data in `prisma/seed.ts` (run with `npm run db:seed`)

### Services Layer
All business logic is in TypeScript services (not Rust):
- **accountService**: CRUD, balances, archiving
- **transactionService**: Create/update/delete, double-entry validation, GST validation, register views, bulk operations
- **stripeImportService**: Stripe Balance Transaction API integration, auto-creates GST categories, 5-way split accounting
- **settingsService**: JSON-based settings storage in database
- **backupService**: Automatic database backups on startup
- **memorizedRuleService**: Transaction auto-categorization rules
- (TODO) **importService**: CSV parsing improvements, column mapping UI
- (TODO) **reconciliationService**: Manual tick-off, statement-based sessions
- (TODO) **reportService**: P&L, GST Summary, BAS Draft

## Testing
- **Unit tests**: Vitest (service layer)
- **E2E tests**: Playwright (UI flows)
- **Coverage**: Double-entry validation, GST calculations, import deduplication, reconciliation

### Key test scenarios
1. Personal transaction (no GST)
2. Business transaction (with GST)
3. Mixed split (personal + business)
4. Transfer (no category, auto-balances)
5. CSV import with deduplication
6. Reconciliation flow

## Current Status (2025-10-28)

### ✅ Completed
- Project setup (Tauri + React + TypeScript + Vite + Prisma)
- Database schema with all entities and migrations
- Account service (CRUD, balances, archiving, hierarchies)
- Transaction service (double-entry + GST validation + bulk operations)
- **UI Components**:
  - Hierarchical tree sidebar with tabs (Accounts vs Categories)
  - Dashboard with net worth, cash flow, and recent transactions
  - Register grid with bulk select/delete
  - Transaction form modal with splits
  - Account setup wizard
  - Settings view (Stripe, categories, memorized rules)
- **Stripe Integration**:
  - Balance Transaction API import
  - Auto-create GST categories (GST Collected, GST Paid)
  - 5-way split accounting for charges (net, fee ex-GST, fee GST, income ex-GST, GST collected)
  - Separate handling for stripe_fee transactions
- **CSV Import**: Bank statement import with column mapping
- **Backup System**: Auto-backup on API server startup
- **Memorized Rules**: Auto-categorization based on payee matching
- Desktop launcher (`start-ledgerhound.bat` + shortcut)

### 🔨 In Progress
- Fixing Stripe GST extraction bug (code ready, needs clean re-import)
- Virtual accounts system (GST Control, Savings Goals)

### 📋 TODO
- Reconciliation interface
- Reporting system (P&L, GST Summary, BAS Draft)
- PDF statement import
- Comprehensive tests
- User documentation

### 🐛 Known Issues
- Stripe import: GST extraction from fee_details not working (feeGst: 0 instead of 0.37)
  - Fix is in code but requires API server restart and re-import of transactions
  - 51 transactions need to be deleted and re-imported