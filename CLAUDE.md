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

### Business vs Personal
- **Default**: All transactions are personal (no GST)
- **Business flag**: Set `isBusiness=true` on individual postings to enable GST tracking
- **Category defaults**: Accounts can have `isBusinessDefault=true` to auto-enable GST for postings to that account
- **GST validation**: Only enforced when `isBusiness=true`

### GST (Australian Tax)
- 10% standard rate
- Codes: GST, GST_FREE, INPUT_TAXED, EXPORT, OTHER
- Stored on each business posting (not as separate account postings)
- Reports filter to business transactions only

### Database
- SQLite via Prisma ORM
- Migrations in `prisma/migrations/`
- Seed data in `prisma/seed.ts` (run with `npm run db:seed`)

### Services Layer
All business logic is in TypeScript services (not Rust):
- **accountService**: CRUD, balances, archiving
- **transactionService**: Create/update/delete, double-entry validation, GST validation, register views
- (TODO) **importService**: CSV parsing, column mapping, deduplication, rule matching
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

## Current Status (2025-10-04)

### ✅ Completed
- Project setup (Tauri + React + TypeScript + Vite + Prisma)
- Database schema with all entities
- Seed data (personal, business, mixed examples)
- Account service (CRUD + balances)
- Transaction service (double-entry + GST validation)
- TypeScript types

### 🔨 In Progress
- UI components (register, transaction forms)
- CSV import system
- Reconciliation interface
- Reporting system

### 📋 TODO
- PDF viewer integration
- Settings UI
- Backup/export
- Comprehensive tests
- User documentation