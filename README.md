# Ledgerhound

Personal & Small-Business Ledger for Australia with GST support

## Project Status

🚧 **In Development** - Core foundation complete, UI implementation in progress

### Completed ✅

- **Project Setup**
  - Tauri desktop wrapper
  - React + TypeScript + Vite
  - SQLite database with Prisma ORM
  - Development environment configured

- **Database Schema**
  - Double-entry accounting model
  - Account types: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  - Transaction and Posting entities
  - GST tracking (optional, business-only)
  - Memorized rules for auto-categorization
  - Import batches and reconciliation support
  - Settings management

- **Business Logic**
  - Account service with balance calculations
  - Transaction service with double-entry validation
  - GST validation (only for business-flagged postings)
  - Register entry generation
  - Bulk operations support

- **Sample Data**
  - Personal accounts (checking, credit card, savings goals)
  - Business accounts (with GST control)
  - Mixed personal/business transactions
  - Memorized rules examples

### In Progress 🔨

- UI Components (register grid, transaction forms)
- CSV Import system
- Reconciliation interface
- Reporting (P&L, GST Summary, BAS Draft)

### TODO 📋

- PDF viewer integration for reconciliation
- Settings management UI
- Backup and export functionality
- Comprehensive testing (unit + E2E)
- User documentation

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Desktop**: Tauri 2.x (Rust wrapper)
- **Database**: SQLite via Prisma
- **UI Components**: Radix UI (headless, accessible)
- **PDF**: PDF.js
- **Date handling**: date-fns
- **Testing**: Vitest + Playwright

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Rust toolchain (for Tauri)
- Git

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ledgerhound

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

### Development

```bash
# Run the app in development mode
npm run tauri:dev

# Run Vite dev server only (for UI development)
npm run dev

# Open Prisma Studio to inspect the database
npm run db:studio
```

### Build

```bash
# Build for production
npm run tauri:build
```

## Database Schema

### Key Entities

**Account**
- Supports real accounts (bank, card, PSP) and virtual accounts (GST control, savings goals)
- `isBusinessDefault` flag: when true, transactions to this account auto-enable GST fields
- Double-entry compliant

**Transaction & Posting**
- Transaction header: date, payee, memo, reference, tags
- Postings (splits): the actual debits/credits
- `isBusiness` flag on each posting (default: false)
- GST fields (code, rate, amount) only relevant when `isBusiness=true`

**MemorizedRule**
- Auto-categorization based on payee patterns
- Can set business flag and GST defaults
- Applied during CSV import and manual entry

**Reconciliation**
- Manual tick-off or statement-based sessions
- Locks postings when balanced

## Key Features

### Business vs Personal Transactions

- **Personal transactions**: No GST fields visible by default
- **Business transactions**: GST fields shown when `isBusiness=true`
- **Mixed transactions**: Can mark individual splits as business/personal
- **Category defaults**: Mark categories as "business default" to auto-enable GST

### GST (Australian Tax)

- 10% standard GST rate
- GST codes: GST, GST_FREE, INPUT_TAXED, EXPORT, OTHER
- Only tracked on business-flagged postings
- Reports filter to business transactions only
- BAS draft with whole-dollar rounding

### Double-Entry Accounting

- All transactions must have postings that sum to zero
- Transfers between accounts auto-balance
- Validation enforced at service level

## Scripts

```bash
npm run dev              # Vite dev server
npm run build            # Build frontend
npm run tauri:dev        # Run Tauri app in dev mode
npm run tauri:build      # Build Tauri app for production
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio
npm test                 # Run unit tests
npm run test:e2e         # Run E2E tests
```

## Project Structure

```
ledgerhound/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Seed data
│   └── migrations/            # Migration files
├── src/
│   ├── components/            # React components
│   ├── lib/
│   │   ├── db.ts              # Prisma client
│   │   └── services/          # Business logic
│   │       ├── accountService.ts
│   │       ├── transactionService.ts
│   │       ├── importService.ts (TODO)
│   │       ├── reconciliationService.ts (TODO)
│   │       └── reportService.ts (TODO)
│   ├── types/                 # TypeScript types
│   ├── App.tsx                # Main app component
│   └── main.tsx               # App entry point
├── src-tauri/                 # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Double-Entry Example

**Personal grocery purchase (no GST):**
```
Debit:  Groceries (Expense)         +110.00
Credit: Personal Checking (Asset)   -110.00
```

**Business office supplies (with GST):**
```
Debit:  Office Supplies (Expense)     +100.00  [GST: $10]
Credit: Business Card (Liability)     -110.00
```

**Mixed dinner (business + personal):**
```
Debit:  Business Meals (Expense)      +90.91   [GST: $9.09, isBusiness=true]
Debit:  Dining Out (Expense)          +59.09   [No GST, isBusiness=false]
Credit: Credit Card (Liability)       -150.00
```

## Locale Settings

- **Currency**: AUD
- **Date format**: dd/MM/yyyy
- **Timezone**: Australia/Melbourne
- **GST rate**: 10%

## License

ISC

## Contributing

This is a personal project, but contributions are welcome! Please open an issue first to discuss proposed changes.
