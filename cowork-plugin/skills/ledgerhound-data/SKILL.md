---
name: ledgerhound-data
description: >
  This skill should be used when the user asks about their "finances", "accounts",
  "transactions", "balances", "spending", "income", "GST", "BAS", "bank account",
  "credit card", "categories", "reports", "profit and loss", "P&L", "reconciliation",
  "net worth", "cash flow", or any Ledgerhound accounting data. Also trigger when
  the user mentions specific account names like "CBA", "MQB", "Stripe", "PayPal",
  or asks "how much did I spend on", "what's my balance", "show me transactions for",
  or any query about their financial data.
version: 0.2.0
---

# Ledgerhound Data Access

Access the Ledgerhound accounting database directly via SQLite for fast, read-only queries.
For write operations (creating transactions, importing CSVs, categorizing), use the
`ledgerhound-import` skill instead.

## How to Connect

The Ledgerhound SQLite database is in the mounted project folder. Find the active database:

```python
python3 -c "
import sqlite3, glob, os

# Find the active book database
db_files = glob.glob('/sessions/*/mnt/Ledgerhound/prisma/books/*/ledger.db')
if not db_files:
    print('ERROR: Ledgerhound folder not mounted. Ask user to mount it.')
else:
    db_path = max(db_files, key=os.path.getmtime)
    print(f'DB: {db_path}')
"
```

**CRITICAL**: Always connect in read-only immutable mode to avoid locking conflicts with the running Express API:

```python
conn = sqlite3.connect(f'file://{db_path}?mode=ro&immutable=1', uri=True)
```

## Database Schema Summary

Read `references/schema.md` for the full schema. Key tables:

- **accounts** — Both real accounts (banks, cards: `kind='TRANSFER'`) and categories (income/expense: `kind='CATEGORY'`)
- **transactions** — Header: date, payee, memo, reference, tags
- **postings** — Double-entry lines linking transactions to accounts with amounts. All postings on a transaction sum to zero.
- **memorized_rules** — Auto-categorization rules for CSV imports
- **reconciliations** — Bank reconciliation sessions
- **recurring_bills** — Scheduled bill payments
- **settings** — JSON key-value app settings

## Common Query Patterns

Read `references/queries.md` for a full library. Quick examples:

### Account balances
```sql
SELECT a.name, a.type, a.kind, a.subtype,
       a.opening_balance + COALESCE(SUM(p.amount), 0) AS balance
FROM accounts a
LEFT JOIN postings p ON p.account_id = a.id
LEFT JOIN transactions t ON t.id = p.transaction_id AND t.status = 'NORMAL'
WHERE a.kind = 'TRANSFER' AND a.archived = 0
GROUP BY a.id
ORDER BY a.type, a.name
```

### Transaction register for an account
```sql
SELECT t.date, t.payee, t.memo, p.amount, p.cleared, p.reconciled,
       cat.name AS category
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
LEFT JOIN postings p2 ON p2.transaction_id = t.id AND p2.id != p.id
LEFT JOIN accounts cat ON cat.id = p2.account_id
WHERE p.account_id = ? AND t.status = 'NORMAL'
ORDER BY t.date DESC, t.created_at DESC
```

### Spending by category (date range)
```sql
SELECT a.name AS category, a.full_path, SUM(ABS(p.amount)) AS total
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
JOIN accounts a ON a.id = p.account_id
WHERE a.kind = 'CATEGORY' AND a.type = 'EXPENSE'
  AND t.date BETWEEN ? AND ? AND t.status = 'NORMAL'
GROUP BY a.id
ORDER BY total DESC
```

## Double-Entry Rules

- Every transaction has 2+ postings that **sum to zero**
- Debits are positive for ASSET/EXPENSE, negative for LIABILITY/INCOME/EQUITY
- A "real" account posting (bank/card) is paired with a category posting (or another real account for transfers)
- GST is tracked via `gst_code`, `gst_rate`, `gst_amount` fields on postings where `is_business = 1`
- Two GST patterns exist: (1) gstCode fields on postings, (2) separate postings to GST Collected/Paid accounts (Stripe)

## Formatting Output

When presenting financial data to the user:
- Use Australian dollar format: `$1,234.56` (negative as `-$1,234.56`)
- Format dates as `DD/MM/YYYY` (Australian convention)
- Round to 2 decimal places
- Group accounts by type (Personal vs Business, then by subtype)
- For reports, create an HTML artifact or table for readability

## Write Operations

For any operation that modifies data (creating transactions, importing CSVs, categorizing, reconciling), use Claude in Chrome to call the Ledgerhound Express API at `http://localhost:3001`. See the `ledgerhound-import` skill for details.
