# Ledgerhound SQL Query Reference

## Setup: Connect to Database

```python
import sqlite3
import glob
import os

# Find the active book database
db_files = glob.glob('/sessions/*/mnt/Ledgerhound/prisma/books/*/ledger.db')
if not db_files:
    print('ERROR: Ledgerhound folder not mounted. Ask user to mount it.')
else:
    db_path = max(db_files, key=os.path.getmtime)
    # CRITICAL: Read-only immutable mode to avoid locking the API server
    conn = sqlite3.connect(f'file://{db_path}?mode=ro&immutable=1', uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
```

## Account Queries

### List all real accounts with balances
```sql
SELECT
    a.id,
    a.name,
    a.type,
    a.subtype,
    a.opening_balance,
    COALESCE(SUM(p.amount), 0) AS postings_total,
    a.opening_balance + COALESCE(SUM(p.amount), 0) AS balance
FROM accounts a
LEFT JOIN postings p ON p.account_id = a.id
LEFT JOIN transactions t ON t.id = p.transaction_id AND t.status = 'NORMAL'
WHERE a.kind = 'TRANSFER' AND a.archived = 0
GROUP BY a.id
ORDER BY a.type, a.name;
```

### List all categories (hierarchical)
```sql
SELECT
    id,
    name,
    full_path,
    type,
    parent_id,
    level
FROM accounts
WHERE kind = 'CATEGORY' AND archived = 0
ORDER BY type, full_path;
```

### Find account by name (fuzzy search)
```sql
SELECT id, name, type, kind, subtype
FROM accounts
WHERE name LIKE ? AND archived = 0
LIMIT 10;
```

### Get account details with last transaction
```sql
SELECT
    a.id,
    a.name,
    a.full_path,
    a.type,
    a.kind,
    a.opening_balance,
    a.opening_balance + COALESCE(SUM(p.amount), 0) AS balance,
    MAX(t.date) AS last_transaction_date
FROM accounts a
LEFT JOIN postings p ON p.account_id = a.id
LEFT JOIN transactions t ON t.id = p.transaction_id AND t.status = 'NORMAL'
WHERE a.id = ? AND a.archived = 0
GROUP BY a.id;
```

## Transaction Queries

### Register view for account (recent transactions)
```sql
SELECT
    t.id,
    t.date,
    t.payee,
    t.memo,
    p.amount,
    p.cleared,
    p.reconciled,
    (SELECT name FROM accounts WHERE id IN
        (SELECT account_id FROM postings
         WHERE transaction_id = t.id AND account_id != p.account_id
         LIMIT 1)) AS category
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
WHERE p.account_id = ? AND t.status = 'NORMAL'
ORDER BY t.date DESC, t.created_at DESC
LIMIT 100;
```

### Search transactions by payee
```sql
SELECT
    t.id,
    t.date,
    t.payee,
    t.memo,
    SUM(p.amount) AS net_amount,
    COUNT(p.id) AS posting_count
FROM transactions t
LEFT JOIN postings p ON p.transaction_id = t.id
WHERE t.payee LIKE ? AND t.status = 'NORMAL'
GROUP BY t.id
ORDER BY t.date DESC
LIMIT 50;
```

### Recent transactions (all accounts)
```sql
SELECT
    t.id,
    t.date,
    t.payee,
    t.memo,
    p.amount,
    a.name AS account
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
JOIN accounts a ON a.id = p.account_id
WHERE t.status = 'NORMAL' AND a.kind = 'TRANSFER'
ORDER BY t.date DESC, t.created_at DESC
LIMIT 50;
```

### Transactions in date range for account
```sql
SELECT
    t.id,
    t.date,
    t.payee,
    t.memo,
    p.amount,
    p.cleared,
    p.reconciled
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
WHERE p.account_id = ?
  AND t.date BETWEEN ? AND ?
  AND t.status = 'NORMAL'
ORDER BY t.date DESC;
```

### Unreconciled transactions for account
```sql
SELECT
    t.id,
    t.date,
    t.payee,
    p.amount,
    p.cleared,
    (SELECT SUM(amount) FROM postings WHERE transaction_id = t.id) AS total
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
WHERE p.account_id = ?
  AND p.reconciled = 0
  AND t.status = 'NORMAL'
ORDER BY t.date ASC;
```

## Report Queries

### Net Worth (all real accounts)
```sql
SELECT
    a.type,
    SUM(a.opening_balance + COALESCE(postings_sum, 0)) AS type_total
FROM (
    SELECT
        a.id,
        a.type,
        a.opening_balance,
        COALESCE(SUM(p.amount), 0) AS postings_sum
    FROM accounts a
    LEFT JOIN postings p ON p.account_id = a.id
    LEFT JOIN transactions t ON t.id = p.transaction_id AND t.status = 'NORMAL'
    WHERE a.kind = 'TRANSFER' AND a.archived = 0
    GROUP BY a.id
) sub
GROUP BY a.type
ORDER BY a.type;
```

### Spending by category (date range)
```sql
SELECT
    a.id,
    a.name,
    a.full_path,
    SUM(ABS(p.amount)) AS total
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
JOIN accounts a ON a.id = p.account_id
WHERE a.kind = 'CATEGORY'
  AND a.type = 'EXPENSE'
  AND t.date BETWEEN ? AND ?
  AND t.status = 'NORMAL'
GROUP BY a.id
ORDER BY total DESC;
```

### Income by category (date range)
```sql
SELECT
    a.id,
    a.name,
    a.full_path,
    SUM(p.amount) AS total
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
JOIN accounts a ON a.id = p.account_id
WHERE a.kind = 'CATEGORY'
  AND a.type = 'INCOME'
  AND t.date BETWEEN ? AND ?
  AND t.status = 'NORMAL'
GROUP BY a.id
ORDER BY total DESC;
```

### Profit & Loss (date range)
```sql
SELECT
    a.type,
    SUM(p.amount) AS subtotal
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
JOIN accounts a ON a.id = p.account_id
WHERE a.kind = 'CATEGORY'
  AND a.type IN ('INCOME', 'EXPENSE')
  AND t.date BETWEEN ? AND ?
  AND t.status = 'NORMAL'
GROUP BY a.type;
```

### GST Summary (date range)
```sql
SELECT
    a.name,
    SUM(p.gst_amount) AS total_gst
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
JOIN accounts a ON a.id = p.account_id
WHERE p.is_business = 1
  AND p.gst_code = 'GST'
  AND t.date BETWEEN ? AND ?
  AND t.status = 'NORMAL'
GROUP BY p.gst_code
ORDER BY a.name;
```

### Monthly spending trend
```sql
SELECT
    strftime('%Y-%m', t.date) AS month,
    a.name AS category,
    SUM(ABS(p.amount)) AS total
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
JOIN accounts a ON a.id = p.account_id
WHERE a.kind = 'CATEGORY'
  AND a.type = 'EXPENSE'
  AND t.status = 'NORMAL'
GROUP BY month, a.id
ORDER BY month DESC, total DESC;
```

### Top payees (date range)
```sql
SELECT
    t.payee,
    COUNT(t.id) AS transaction_count,
    SUM(ABS(p.amount)) AS total_spend,
    AVG(ABS(p.amount)) AS avg_transaction
FROM transactions t
JOIN postings p ON p.transaction_id = t.id
WHERE t.status = 'NORMAL'
  AND t.date BETWEEN ? AND ?
GROUP BY t.payee
ORDER BY total_spend DESC
LIMIT 20;
```

## Uncategorized & Import Queries

### Find uncategorized transactions
```sql
SELECT
    t.id,
    t.date,
    t.payee,
    t.memo,
    p.amount,
    a.name AS account
FROM postings p
JOIN transactions t ON t.id = p.transaction_id
JOIN accounts a ON a.id = p.account_id
WHERE a.kind = 'TRANSFER'
  AND NOT EXISTS (
      SELECT 1 FROM postings p2
      WHERE p2.transaction_id = t.id
        AND p2.account_id != p.account_id
  )
ORDER BY t.date DESC;
```

### List all memorized rules (ordered by priority)
```sql
SELECT
    id,
    name,
    match_type,
    match_text,
    priority,
    apply_on_import
FROM memorized_rules
WHERE apply_on_import = 1
ORDER BY priority DESC, name;
```

### Check for duplicates in date range
```sql
SELECT
    t.date,
    t.payee,
    COUNT(*) AS count
FROM transactions t
WHERE t.status = 'NORMAL'
  AND t.date BETWEEN ? AND ?
GROUP BY t.date, t.payee
HAVING count > 1
ORDER BY count DESC;
```

## Reconciliation Queries

### Current open reconciliation for account
```sql
SELECT
    id,
    account_id,
    statement_date,
    statement_balance,
    opening_balance,
    status
FROM reconciliations
WHERE account_id = ?
  AND status IN ('DRAFT', 'LOCKED')
ORDER BY created_at DESC
LIMIT 1;
```

### Reconciliation history for account
```sql
SELECT
    id,
    statement_date,
    statement_balance,
    opening_balance,
    status,
    created_at,
    completed_at
FROM reconciliations
WHERE account_id = ?
  AND status = 'COMPLETE'
ORDER BY statement_date DESC;
```

### Unreconciled amount for account (balance sheet)
```sql
SELECT
    p.account_id,
    a.name,
    SUM(p.amount) AS unreconciled_amount
FROM postings p
JOIN accounts a ON a.id = p.account_id
WHERE p.reconciled = 0
  AND a.kind = 'TRANSFER'
GROUP BY p.account_id
ORDER BY a.name;
```
