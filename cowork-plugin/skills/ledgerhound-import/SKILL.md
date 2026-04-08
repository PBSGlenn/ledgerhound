---
name: ledgerhound-import
description: >
  This skill should be used when the user wants to "import a CSV", "import bank
  statement", "add transactions", "create a transaction", "categorize transactions",
  "recategorize", "bulk categorize", "reconcile", "create an account", "create a
  category", "import from bank", "process a statement", "create a rule", or perform
  any write operation in Ledgerhound. Also trigger when the user uploads a CSV file
  and mentions it's for their accounting or bank account.
version: 0.2.0
---

# Ledgerhound Import & Write Operations

Write operations require the Ledgerhound Express API running at `http://localhost:3001`.
Use Claude in Chrome's `javascript_tool` to call the API endpoints. The user must have
Ledgerhound running in their browser (they usually do if they ran `start-ledgerhound.bat`).

## How to Make API Calls via Chrome

Use the `mcp__Claude_in_Chrome__javascript_tool` to execute fetch() calls against the
Ledgerhound API. The browser can reach localhost:3001.

```javascript
// Example: Get all accounts
const response = await fetch('http://localhost:3001/api/accounts');
const accounts = await response.json();
return JSON.stringify(accounts.slice(0, 10), null, 2);
```

**Important**: The javascript_tool returns a string, so always `JSON.stringify()` the result.
Keep responses concise — truncate large result sets.

## CSV Import Workflow

This is the most common write operation. Follow these steps:

### Step 1: Read and parse the CSV file
Use the Read tool or Bash to examine the CSV file the user provides (from uploads or mounted folder).

### Step 2: Identify columns
Common bank CSV columns: Date, Description/Narration, Debit, Credit, Amount, Balance.
Map them to Ledgerhound fields: date, payee, amount.

### Step 3: Identify the target account
Ask the user which bank account to import into, or infer from the filename/content.
Query the database to get the account ID:
```python
cur.execute("SELECT id, name FROM accounts WHERE kind='TRANSFER' AND archived=0")
```

### Step 4: Check for duplicates
Query existing transactions for the account in the CSV's date range:
```python
cur.execute("""
  SELECT t.date, t.payee, p.amount FROM postings p
  JOIN transactions t ON t.id = p.transaction_id
  WHERE p.account_id = ? AND t.date BETWEEN ? AND ?
  AND t.status = 'NORMAL'
""", (account_id, start_date, end_date))
```

### Step 5: Apply memorized rules
Query existing rules and match against CSV payees:
```python
cur.execute("SELECT * FROM memorized_rules WHERE apply_on_import = 1 ORDER BY priority DESC")
```

### Step 6: Preview and confirm
Present summary to user: total rows, date range, target account, auto-categorized count, duplicate count.

### Step 7: Execute via API
Use Chrome javascript_tool to POST transactions to `http://localhost:3001/api/transactions`.

### Step 8: Report results

## Creating Transactions Manually

```javascript
// Simple expense
const txn = {
  date: "2026-03-15",
  payee: "Office Supplies Co",
  memo: "Printer paper",
  postings: [
    { accountId: "BANK_ACCOUNT_ID", amount: -35.00 },
    { accountId: "CATEGORY_ID", amount: 35.00 }
  ]
};

// Business expense with GST
const businessTxn = {
  date: "2026-03-15",
  payee: "Vet Supplies Pty Ltd",
  postings: [
    { accountId: "BANK_ID", amount: -110.00 },
    { accountId: "CATEGORY_ID", amount: 110.00,
      isBusiness: true, gstCode: "GST", gstRate: 0.1, gstAmount: 10.00 }
  ]
};

// Transfer between accounts
const transfer = {
  date: "2026-03-15",
  payee: "Transfer",
  postings: [
    { accountId: "FROM_ID", amount: -500.00 },
    { accountId: "TO_ID", amount: 500.00 }
  ]
};
```

## Error Handling

- If Chrome javascript_tool fails, check that Ledgerhound is running at localhost:3001
- If transaction validation fails, check that postings sum to zero
- For duplicate detection, use ±1 day tolerance on dates (timezone buffer)
- Always confirm with user before bulk operations
