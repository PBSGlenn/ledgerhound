# Ledgerhound Quick Start Guide

## What You Have

✅ **Production-ready MVP** - All core features working
✅ **Express API server** - 60+ REST endpoints (port 3001)
✅ **React frontend** - 34 components (port 5173)
✅ **14 business services** - Complete accounting engine
✅ **Sample data** - 13 accounts, hierarchical categories, example transactions

## Architecture Overview

Ledgerhound uses a **two-server architecture**:

1. **Express API Server** (`src-server/api.ts`) - Port 3001
   - Node.js + TypeScript
   - 60+ REST API endpoints
   - Connects to SQLite via Prisma
   - Auto-backup on startup

2. **Vite Dev Server** (`npm run dev`) - Port 5173
   - React 19 + TypeScript
   - Calls API server via HTTP
   - Hot module reloading

**Note:** Tauri desktop packaging is planned but not currently used. The app runs as a web application.

---

## Getting Started (5 minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

```bash
# Run migrations (creates the SQLite database)
npm run db:migrate

# Seed with sample data (13 accounts, categories, transactions)
npm run db:seed
```

### 3. Start the App

```bash
# Start both servers (recommended)
npm run dev:all
```

This starts:
- **API server** at `http://localhost:3001`
- **Frontend** at `http://localhost:5173`

The browser will open automatically to `http://localhost:5173`.

### Alternatively: Run Servers Separately

```bash
# Terminal 1: API server
npm run api

# Terminal 2: Frontend
npm run dev
```

---

## Exploring the App

### View the UI

Open `http://localhost:5173` in your browser.

**What you'll see:**
- ✅ **Left sidebar** with hierarchical account tree
  - Assets (Bank accounts, Stripe)
  - Liabilities (Credit cards, GST Collected)
  - Income (Sales, Service fees)
  - Expenses (Office supplies, Stripe fees, etc.)
- ✅ **Top bar** with selected account info and actions
- ✅ **Register view** showing transactions for selected account
- ✅ **Dashboard** with net worth, cash flow, GST summary

**Try these actions:**
1. Click accounts in the sidebar to view their transactions
2. Click "New Transaction" to add a transaction
3. Try adding a **split transaction** with multiple categories
4. Toggle "Business" checkbox to see GST calculation
5. Right-click accounts for context menu (rename, settings, archive)
6. Go to Reports to see P&L, GST Summary, BAS Draft

### View the Database (Prisma Studio)

```bash
npm run db:studio
```

Opens at `http://localhost:5555` - a GUI for your SQLite database.

**What to explore:**
- **Account** table - All accounts and categories (13 by default)
- **Transaction** table - Transaction headers with metadata
- **Posting** table - Double-entry lines (must sum to zero)
- **MemorizedRule** table - Auto-categorization rules
- **Settings** table - App configuration (JSON key-value)

**Key fields to notice:**
- `Account.parentId` - Category hierarchy (unlimited nesting)
- `Account.isBusinessDefault` - Auto-enables GST for this account
- `Account.defaultHasGst` - Controls GST splitting behavior
- `Posting.isBusiness` - Per-line business flag
- `Posting.gstCode`, `gstRate`, `gstAmount` - GST tracking
- `Transaction.metadata` - Stripe transaction details (JSON)

---

## Key Features to Try

### 1. Create a Personal Transaction

1. Select **Personal Checking** in the sidebar
2. Click **New Transaction**
3. Fill in:
   - Date: Today
   - Payee: "Woolworths"
   - Amount: 110
   - Category: Groceries
   - Business: ❌ Leave unchecked
   - Memo: "Weekly shopping"
4. Click **Save Transaction**

**Result:** Transaction appears in register. No GST calculated (personal).

### 2. Create a Business Transaction with GST

1. Select **Business Checking** in the sidebar
2. Click **New Transaction**
3. Fill in:
   - Date: Today
   - Payee: "Officeworks"
   - Amount: 110
   - Category: Office Supplies
   - Business: ✅ **Check this**
   - Memo: "Printer paper"

**Watch the GST calculator appear!**
- Total (inc. GST): $110.00
- GST amount: $10.00
- GST-exclusive: $100.00

4. Click **Save Transaction**

**Result:** Transaction with GST tracking. Check Prisma Studio to see the explicit GST postings.

### 3. Create a Split Transaction

1. Click **New Transaction**
2. Add basic info (date, payee, amount)
3. Click **Add Split**
4. Allocate the amount across multiple categories:
   - Office Supplies: $50 (Business ✅)
   - Marketing: $30 (Business ✅)
   - Personal Shopping: $20 (Business ❌)

**Result:** One transaction with multiple postings, mixed business/personal.

### 4. Import CSV Bank Statement

1. Go to **Settings** > **Import**
2. Select target account (e.g., Personal Checking)
3. Upload a CSV file
4. Map columns (Date, Payee, Amount, etc.)
5. Save the mapping as a template
6. Preview imported transactions
7. Click **Import**

**Features:**
- Deduplication (won't import duplicates)
- Memorized rule matching (auto-categorizes)
- Template saving (reuse column mappings)

### 5. View Reports

1. Click **Reports** in the sidebar
2. Select a date range
3. Choose a report:
   - **Profit & Loss** - Income vs Expenses
   - **GST Summary** - GST Collected vs GST Paid
   - **BAS Draft** - Quarterly BAS with whole-dollar rounding

**All reports filter to business transactions automatically.**

### 6. Stripe Integration

1. Go to **Settings** > **Stripe**
2. Enter your Stripe secret key
3. Select payout destination account
4. Click **Test Connection**
5. Click **Import Transactions**
6. Select date range
7. Click **Import**

**What happens:**
- Fetches transactions from Stripe Balance Transaction API
- Creates 5-way split accounting:
  - Net amount to Stripe account
  - Fee (ex-GST) to Stripe Fee expense
  - Fee GST to GST Paid asset
  - Income (ex-GST) to Service Fee income
  - GST Collected to GST Collected liability
- Auto-categorizes based on transaction type
- Deduplicates by Stripe transaction ID

### 7. Category Hierarchy

1. Right-click any category in the sidebar
2. Select **Add Subcategory**
3. Create nested categories:
   ```
   Office Expenses
   ├── Office Supplies
   ├── Software Subscriptions
   └── Equipment
   ```

**Features:**
- Unlimited nesting levels
- Inheritable business/GST settings
- Context menu actions (rename, settings, archive, delete)
- Virtual parent nodes (Income/Expense > Business/Personal)

---

## Understanding the Sample Data

### Accounts (13 created by seed)

**Personal (6):**
1. Personal Checking (Asset/Bank)
2. Personal Credit Card (Liability/Card)
3. Holiday Fund (Equity/Savings Goal)
4. Salary (Income)
5. Groceries (Expense)
6. Dining Out (Expense)

**Business (6):**
1. Business Checking (Asset/Bank) - `isBusinessDefault=true`
2. Business Credit Card (Liability/Card) - `isBusinessDefault=true`
3. GST Collected (Liability/Category) - `isBusinessDefault=true`
4. Sales Income (Income) - `isBusinessDefault=true`
5. Office Supplies (Expense) - `isBusinessDefault=true`
6. Business Meals (Expense) - `isBusinessDefault=true`

**Other (1):**
1. Uncategorized (Expense)

### Sample Transactions

**Transaction 1: Personal Grocery** (No GST)
```
Date: Recent
Payee: Woolworths
Postings:
  - Personal Checking: -$110
  - Groceries: +$110
```

**Transaction 2: Business Office Supplies** (With GST)
```
Date: Recent
Payee: Officeworks
Postings:
  - Business Card: -$110
  - Office Supplies: +$100 (ex-GST, isBusiness=true)
  - GST Paid: +$10 (asset, claimable)
```

**Transaction 3: Mixed Business Dinner** (Split)
```
Date: Recent
Payee: The Restaurant
Postings:
  - Credit Card: -$150
  - Business Meals: +$90.91 (isBusiness=true, GST=$9.09)
  - Dining Out: +$59.09 (isBusiness=false, no GST)
```

---

## Reset Database

To start fresh:

```bash
npm run db:seed
```

This will:
- Delete all existing data
- Recreate sample accounts
- Create hierarchical category structure
- Add example transactions
- Create memorized rules
- Set default settings

---

## Backup & Restore

### Automatic Backups

The API server creates a backup **every time it starts** at:
```
prisma/backups/ledgerhound-backup-[timestamp].db
```

### Manual Backup

1. Go to **Settings** > **Backup**
2. Click **Create Backup**

### Restore from Backup

1. Go to **Settings** > **Backup**
2. Select a backup file
3. Click **Restore**

**Warning:** This will replace your current database!

### Export to JSON

1. Go to **Settings** > **Backup**
2. Click **Export to JSON**
3. Downloads entire database as JSON (for data portability)

---

## Development Commands

```bash
# Start both servers
npm run dev:all

# Start API server only
npm run api

# Start frontend only
npm run dev

# View database
npm run db:studio

# Reset database
npm run db:seed

# Run migrations
npm run db:migrate

# Run tests
npm test

# Build for production
npm run build
```

---

## API Endpoints

The API server (`http://localhost:3001/api`) provides:

**Accounts:**
- `GET /api/accounts` - All accounts with balances
- `POST /api/accounts` - Create account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

**Categories:**
- `GET /api/categories/tree` - Hierarchical tree
- `GET /api/categories/leaf` - Leaf categories only
- `GET /api/categories/:id/path` - Category path
- And 6 more category endpoints

**Transactions:**
- `GET /api/transactions` - All transactions
- `GET /api/transactions/register` - Register view
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

**Reports:**
- `GET /api/reports/profit-loss` - P&L report
- `GET /api/reports/gst-summary` - GST summary
- `GET /api/reports/bas-draft` - BAS draft

**Import:**
- `POST /api/import/preview` - Preview CSV import
- `POST /api/import/execute` - Execute import

**Stripe:**
- `POST /api/stripe/test-connection` - Test API key
- `POST /api/stripe/import` - Import transactions

And 30+ more endpoints for rules, reconciliation, backups, settings, etc.

---

## Troubleshooting

### App won't start

**Problem:** `npm run dev:all` fails
**Solution:**
1. Check if port 3001 or 5173 is in use
2. Kill any Node processes: `npx kill-port 3001 5173`
3. Try again

### Database error

**Problem:** "Database not found" or migration errors
**Solution:**
```bash
npm run db:migrate
npm run db:seed
```

### API not connecting

**Problem:** Frontend says "Failed to fetch"
**Solution:**
1. Make sure API server is running (`npm run api`)
2. Check `http://localhost:3001/api/accounts` in browser
3. Check console for CORS errors

### Want to clear all data

```bash
npm run db:seed
```

---

## Next Steps

### Learn More

- [CLAUDE.md](CLAUDE.md) - Comprehensive project documentation
- [README.md](README.md) - Project overview
- [STRIPE_ACCOUNTING_EXPLAINED.md](STRIPE_ACCOUNTING_EXPLAINED.md) - How Stripe accounting works

### Extend the App

- Add custom categories (unlimited nesting)
- Create memorized rules for auto-categorization
- Import your bank statements
- Connect your Stripe account
- Generate BAS reports for tax time

### Development

- Explore the services layer (`src/lib/services/`)
- Add new API endpoints (`src-server/api.ts`)
- Create new UI components (`src/components/`)
- Write tests (`npm test`)

---

## Questions?

The app is **production-ready** with all core features working. The only remaining tasks are:
- ⏳ Reconciliation UI polish (backend complete)
- ⏳ Comprehensive testing (unit + E2E)
- ⏳ Tauri desktop packaging (currently web-based)

**You have a fully functional accounting system!** 🎉
