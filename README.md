# Ledgerhound

Personal & Small-Business Ledger for Australia with GST support

## Project Status

✅ **Production-Ready MVP** (~85% complete) - All core features functional, minor polish needed

### Completed ✅

- **Project Setup**
  - Express API server (Node.js + TypeScript)
  - React 19 + TypeScript + Vite frontend
  - SQLite database with Prisma ORM
  - Development environment fully configured
  - Automatic backup system

- **Database Schema** (5 migrations)
  - Double-entry accounting model
  - Account types: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  - Transaction and Posting entities with splits
  - Hierarchical category system (unlimited nesting)
  - GST tracking with explicit postings
  - Memorized rules for auto-categorization
  - Import batches with deduplication
  - Reconciliation sessions
  - Settings management (JSON key-value store)

- **Business Logic** (14 services, 4,900+ lines)
  - Account service: CRUD, balances, archiving, hierarchies
  - Category service: Hierarchical management, tree operations
  - Transaction service: Double-entry + GST validation, register views
  - Stripe import service: Balance Transaction API, 5-way split accounting
  - Import service: CSV parsing, column mapping, deduplication
  - Report service: P&L, GST Summary, BAS Draft (all complete)
  - Reconciliation service: Session management, balance calculations
  - Memorized rule service: Pattern matching, auto-categorization
  - Backup service: Auto-backup on startup, restore, cleanup, JSON export
  - And 5 more specialized services

- **UI Components** (34 components)
  - Main layout with hierarchical tree sidebar
  - Transaction form with splits, GST calculation, transfers
  - Register grid with filtering, bulk operations
  - CSV import wizard with column mapping
  - Reports dashboard (P&L, GST, BAS)
  - Category management with context menus
  - Settings interface with tabs
  - Stripe integration UI
  - Dashboard with summary cards
  - Onboarding wizard

- **Key Features**
  - ✅ Double-entry accounting with validation
  - ✅ GST tracking with explicit postings (GST-free business support)
  - ✅ Hierarchical categories (unlimited nesting)
  - ✅ Split transactions with per-posting business flag
  - ✅ Transfer mode with auto-balancing
  - ✅ CSV import with templates and deduplication
  - ✅ Stripe Balance Transaction API integration
  - ✅ Memorized rules with pattern matching
  - ✅ Comprehensive reporting (P&L, GST, BAS)
  - ✅ Automatic backups on startup
  - ✅ Register with bulk select/delete
  - ✅ Business vs personal transaction support

### In Progress 🔨

- Reconciliation UI polish (backend complete, needs PDF viewer integration)
- Comprehensive testing (unit tests for services + E2E for critical flows)

### Planned 📋

- Tauri desktop packaging (currently web-based)
- Multi-book support (backend stub exists)
- User documentation and tutorials

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express API server (Node.js + TypeScript) on port 3001
- **Database**: SQLite via Prisma ORM
- **UI Components**: Radix UI (headless, accessible) + Tailwind CSS
- **PDF**: PDF.js
- **Date handling**: date-fns
- **Testing**: Vitest + Playwright
- **Desktop**: Tauri 2.x scaffolding (web-based currently, desktop packaging planned)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
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
# Run both API server and frontend (recommended)
npm run dev:all

# Or run separately in two terminals:
npm run api      # Start Express API server (port 3001)
npm run dev      # Start Vite dev server (port 5173)

# Open Prisma Studio to inspect the database
npm run db:studio
```

The app will open at `http://localhost:5173` and connect to the API at `http://localhost:3001`.

### Build

```bash
# Build frontend for production
npm run build

# Preview production build
npm run preview
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
# Development
npm run dev:all          # Start both API server and frontend (recommended)
npm run api              # Start Express API server only (port 3001)
npm run dev              # Start Vite dev server only (port 5173)

# Build
npm run build            # Build frontend for production
npm run preview          # Preview production build

# Database
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed database with sample data
npm run db:studio        # Open Prisma Studio (database GUI)

# Testing
npm test                 # Run unit tests (Vitest)
npm run test:e2e         # Run E2E tests (Playwright)

# Tauri (not currently used, planned for future)
npm run tauri:dev        # Run Tauri desktop app in dev mode
npm run tauri:build      # Build Tauri desktop app for production
```

## Project Structure

```
ledgerhound/
├── prisma/
│   ├── schema.prisma          # Database schema (8 entities)
│   ├── seed.ts                # Seed data with sample transactions
│   ├── migrations/            # 5 migration files
│   └── backups/               # Automatic database backups
├── src/
│   ├── components/            # 34 React UI components
│   │   ├── Account/           # Account management UI
│   │   ├── Category/          # Category hierarchy UI
│   │   ├── Transaction/       # Transaction forms
│   │   ├── Layout/            # Sidebar, topbar, context menus
│   │   ├── Register/          # Register grid and views
│   │   ├── Reports/           # P&L, GST, BAS reports
│   │   ├── Import/            # CSV import wizard
│   │   ├── Settings/          # Settings interface
│   │   └── ...                # And more
│   ├── features/              # Feature-specific components
│   │   ├── import/            # Enhanced import wizard
│   │   └── register/          # Register-specific features
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── api.ts             # API client (HTTP wrapper)
│   │   └── services/          # Business logic (14 services)
│   │       ├── accountService.ts
│   │       ├── categoryService.ts
│   │       ├── transactionService.ts
│   │       ├── stripeImportService.ts
│   │       ├── importService.ts
│   │       ├── reportService.ts
│   │       ├── reconciliationService.ts
│   │       ├── memorizedRuleService.ts
│   │       ├── backupService.ts
│   │       └── ...and 5 more
│   ├── types/                 # TypeScript type definitions
│   ├── App.tsx                # Main app component
│   └── main.tsx               # App entry point
├── src-server/                # Express API server
│   └── api.ts                 # REST API (60+ endpoints, port 3001)
├── src-tauri/                 # Tauri scaffolding (not currently used)
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── scripts/                   # 21 utility scripts
│   ├── migrate-gst-postings.ts
│   ├── create-comprehensive-categories.ts
│   └── ...
├── package.json
├── tsconfig.json
├── vite.config.ts
└── CLAUDE.md                  # Comprehensive project documentation
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
