# Ledgerhound API Endpoints

**Base URL:** `http://localhost:3001`

## Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List all accounts |
| GET | `/api/accounts-with-balances` | List all accounts with calculated balances |
| GET | `/api/accounts/:id` | Get account details |
| POST | `/api/accounts` | Create new account |
| PUT | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account (archive) |
| GET | `/api/accounts/:id/balance` | Get account balance |

## Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create category |
| GET | `/api/categories/tree` | Get hierarchical category tree |
| GET | `/api/categories/leaf` | Get leaf (no children) categories only |
| GET | `/api/categories/:id/path` | Get full path for category |
| GET | `/api/categories/:id/children` | Get direct children of category |
| GET | `/api/categories/level/:level` | Get categories at specific nesting level |
| GET | `/api/categories/search` | Search categories by name |
| POST | `/api/categories/create` | Create category with parent hierarchy |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |
| POST | `/api/categories/:id/archive` | Archive category and descendants |

## Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions/register/:accountId` | Get register (transaction list) for account |
| GET | `/api/transactions/uncategorized-summary` | Get summary of uncategorized transactions grouped by payee |
| GET | `/api/transactions/:id` | Get transaction details |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| POST | `/api/transactions/search` | Search transactions (advanced filters) |
| POST | `/api/transactions/bulk-update` | Bulk update transactions (tags, memo, etc.) |
| POST | `/api/transactions/bulk-add-tags` | Bulk add tags to transactions |
| POST | `/api/transactions/mark-cleared` | Mark postings as cleared |
| POST | `/api/transactions/mark-reconciled` | Mark postings as reconciled |
| POST | `/api/transactions/bulk-recategorize` | Bulk categorize uncategorized transactions |
| POST | `/api/transactions/:id/recategorize` | Recategorize single transaction |
| POST | `/api/transactions/:id/move-to-account` | Move transaction to different account |

## Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/profit-loss` | P&L report (date range, business/personal) |
| GET | `/api/reports/gst-summary` | GST summary (collected vs. paid) |
| GET | `/api/reports/bas-draft` | BAS draft (quarterly GST obligations) |
| GET | `/api/reports/balance-sheet` | Balance sheet (assets, liabilities, equity) |
| GET | `/api/reports/cash-flow` | Cash flow report |
| POST | `/api/reports/spending-analysis` | Spending analysis (by category, payee, time period) |

## Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/preview` | Preview CSV import with deduplication |
| POST | `/api/import/execute` | Execute CSV import |
| GET | `/api/import/mappings` | List saved CSV column mappings |
| POST | `/api/import/mappings` | Save CSV column mapping |

## Reconciliation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reconciliation/start` | Start reconciliation session |
| GET | `/api/reconciliation/in-progress/:accountId` | Get current open reconciliation for account |
| POST | `/api/reconciliation/:id/reconcile-postings` | Mark postings as reconciled in session |
| POST | `/api/reconciliation/:id/lock` | Lock reconciliation session (finalize) |
| GET | `/api/reconciliation/:id` | Get reconciliation session details |

## Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | List memorized rules |
| POST | `/api/rules` | Create memorized rule |
| POST | `/api/rules/match` | Test rule matching against payee text |
| PUT | `/api/rules/:id` | Update rule |
| DELETE | `/api/rules/:id` | Delete rule |
| GET | `/api/rules/:id/preview` | Preview rule matching on existing transactions |
| POST | `/api/rules/:id/apply-to-existing` | Apply rule to existing uncategorized transactions |

---

## Request/Response Examples

### Create Transaction

```javascript
const txn = {
  date: "2026-03-15",
  payee: "Office Supplies Co",
  memo: "Printer paper and ink",
  reference: "INV-12345",
  tags: ["office", "supplies"],
  postings: [
    {
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      amount: -35.00,
      cleared: true
    },
    {
      accountId: "660e8400-e29b-41d4-a716-446655440000",
      amount: 35.00,
      isBusiness: true,
      gstCode: "GST",
      gstRate: 0.1,
      gstAmount: 3.50
    }
  ]
};

await fetch('http://localhost:3001/api/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(txn)
});
```

### Search Transactions

```javascript
const search = {
  accountId: "550e8400-e29b-41d4-a716-446655440000",
  search: "office",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
  clearedOnly: false,
  reconciledOnly: false,
  businessOnly: false,
  personalOnly: false
};

const response = await fetch('http://localhost:3001/api/transactions/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(search)
});
```

### Spending Analysis Report

```javascript
const analysis = {
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
  groupBy: "category", // or "payee" or "both"
  granularity: "monthly", // or "weekly"
  categoryIds: ["660e8400-e29b-41d4-a716-446655440001"],
  businessOnly: false,
  includeIncome: false
};

const response = await fetch('http://localhost:3001/api/reports/spending-analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(analysis)
});
```

### CSV Import

```javascript
const preview = {
  accountId: "550e8400-e29b-41d4-a716-446655440000",
  csvContent: "Date,Description,Amount\n2026-03-01,Test,100",
  columnMapping: {
    dateColumn: "Date",
    payeeColumn: "Description",
    amountColumn: "Amount"
  }
};

// Step 1: Preview
const previewResponse = await fetch('http://localhost:3001/api/import/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(preview)
});

// Step 2: Execute (after user confirmation)
const executeResponse = await fetch('http://localhost:3001/api/import/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(preview)
});
```

### List Accounts with Balances

```javascript
const response = await fetch('http://localhost:3001/api/accounts-with-balances');
const accounts = await response.json();
// Returns: [{ id, name, type, kind, balance }, ...]
```

### Bulk Categorize

```javascript
const bulk = {
  transactionIds: ["id1", "id2", "id3"],
  categoryId: "660e8400-e29b-41d4-a716-446655440000",
  createRule: true, // Auto-create memorized rule from payee
  ruleName: "Office Supplies"
};

const response = await fetch('http://localhost:3001/api/transactions/bulk-recategorize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(bulk)
});
```
