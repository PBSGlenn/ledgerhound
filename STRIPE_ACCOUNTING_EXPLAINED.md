# How Stripe Transactions Work in the Database

## Example: Customer pays $220 via Stripe

### What Happens in Real Life:
1. Customer pays you $220 (includes $20 GST)
2. Stripe charges fee of $4.04 (includes $0.37 GST)
3. You receive $215.96 in your Stripe account

### How It's Stored in the Database:

#### 1. **Transaction Table** (1 record)
```
id: abc-123-def
date: 2025-10-20
payee: "[Calendly] Behaviour Consultation with Michelle Duncan"
memo: "Stripe charge"
externalId: "txn_3SK73lGuQxawM1UC0kE5Grqq"
metadata: {
  "grossAmount": 220,
  "feeAmount": 4.04,
  "feeGst": 0.37,
  "netAmount": 215.96,
  "stripeType": "charge"
}
```

#### 2. **Account Table** (5 accounts referenced)
```
Account 1: Stripe                  (ASSET, TRANSFER, isReal=true)
Account 2: Client Service Fee      (INCOME, CATEGORY, isReal=false)
Account 3: GST Collected           (LIABILITY, CATEGORY, isReal=false)
Account 4: Stripe Fee              (EXPENSE, CATEGORY, isReal=false)
Account 5: GST Paid                (ASSET, CATEGORY, isReal=false)
```

#### 3. **Posting Table** (5 records - the "splits")

Each posting is a line in the double-entry journal:

```
Posting 1:
  transactionId: abc-123-def
  accountId: <Stripe account ID>
  amount: +215.96                    # DEBIT (increase asset)
  isBusiness: true

Posting 2:
  transactionId: abc-123-def
  accountId: <Stripe Fee account ID>
  amount: +3.67                      # DEBIT (increase expense)
  isBusiness: true

Posting 3:
  transactionId: abc-123-def
  accountId: <GST Paid account ID>
  amount: +0.37                      # DEBIT (increase asset - claimable GST)
  isBusiness: true

Posting 4:
  transactionId: abc-123-def
  accountId: <Client Service Fee account ID>
  amount: -200.00                    # CREDIT (increase income - shown as negative)
  isBusiness: true

Posting 5:
  transactionId: abc-123-def
  accountId: <GST Collected account ID>
  amount: -20.00                     # CREDIT (increase liability - GST owed to ATO)
  isBusiness: true
```

**CRITICAL RULE**: Sum of all postings MUST = 0 (double-entry balancing)
```
215.96 + 3.67 + 0.37 + (-200.00) + (-20.00) = 0 ✓
```

## Why Categories are in the Account Table

This is **standard double-entry accounting**. In accounting, everything is an account:

### Chart of Accounts Structure:
```
ASSETS                           (Account type)
  ├─ Bank Accounts              (Real accounts, isReal=true)
  │   ├─ CommBank
  │   └─ Stripe
  └─ GST Paid                   (Category, isReal=false) - claimable GST

LIABILITIES                      (Account type)
  ├─ Credit Cards               (Real accounts, isReal=true)
  │   └─ Amex
  └─ GST Collected              (Category, isReal=false) - GST owed to ATO

INCOME                           (Account type)
  └─ Client Service Fee         (Category, isReal=false)

EXPENSES                         (Account type)
  └─ Stripe Fee                 (Category, isReal=false)
```

## How to Query This

### Get all transactions for Stripe account:
```sql
SELECT t.*, p.amount
FROM transactions t
JOIN postings p ON t.id = p.transactionId
JOIN accounts a ON p.accountId = a.id
WHERE a.name = 'Stripe'
ORDER BY t.date DESC
```

### Get the full split for a transaction:
```sql
SELECT
  a.name as account_name,
  a.type as account_type,
  p.amount,
  p.isBusiness
FROM postings p
JOIN accounts a ON p.accountId = a.id
WHERE p.transactionId = 'abc-123-def'
```

### Get all category postings (not real account movements):
```sql
SELECT
  t.date,
  t.payee,
  a.name as category,
  a.type,
  p.amount
FROM postings p
JOIN transactions t ON p.transactionId = t.id
JOIN accounts a ON p.accountId = a.id
WHERE a.isReal = false  -- Categories only
ORDER BY t.date DESC
```

## Current Problem

The database shows:
```
Stripe Fee: 4.04     ← WRONG (should be 3.67)
GST Paid: 0          ← WRONG (should be 0.37)
```

This is because the import code isn't extracting the GST from Stripe's fee_details array.
The metadata has `feeGst: 0` when it should be `feeGst: 0.37`.

The code fix is in place but the API server isn't reloading with the changes.
