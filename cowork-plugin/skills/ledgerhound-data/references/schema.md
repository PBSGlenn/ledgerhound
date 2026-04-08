# Ledgerhound Database Schema

## Enums

### AccountType
- ASSET
- LIABILITY
- EQUITY
- INCOME
- EXPENSE

### AccountKind
- TRANSFER (real accounts: banks, cards, payment processors)
- CATEGORY (category accounts: income/expense classifications)

### AccountSubtype
- BANK
- CARD
- PSP
- CASH
- GST_CONTROL
- SAVINGS_GOAL
- LOAN
- INVESTMENT
- OTHER

### GSTCode
- GST (standard 10%)
- GST_FREE
- INPUT_TAXED
- EXPORT
- OTHER

### TransactionStatus
- NORMAL
- VOID

### MatchType
- EXACT
- CONTAINS
- REGEX

### BillFrequency
- WEEKLY
- FORTNIGHTLY
- MONTHLY
- QUARTERLY
- YEARLY

### BillStatus
- ACTIVE
- PAUSED

## Tables

### accounts
Real accounts (banks, cards, PSP) and category accounts (income/expense).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String | Account display name |
| full_path | String | Hierarchical path (e.g., "Personal > Expenses > Groceries") |
| type | AccountType | ASSET, LIABILITY, EQUITY, INCOME, EXPENSE |
| kind | AccountKind | TRANSFER (real) or CATEGORY |
| parent_id | UUID (FK) | Parent category (NULL if root) |
| level | Int | Nesting depth (0 = root) |
| subtype | AccountSubtype | BANK, CARD, PSP, CASH, GST_CONTROL, SAVINGS_GOAL, LOAN, INVESTMENT, OTHER |
| is_real | Boolean | True if kind=TRANSFER (account with a bank/card) |
| is_business_default | Boolean | True if transactions default to business postings |
| default_has_gst | Boolean | True if GST should be tracked by default (when is_business_default=true) |
| opening_balance | Decimal | Initial balance (for reconciliation) |
| opening_date | Date | Date opening balance applies from |
| currency | String | ISO 4217 code (default: AUD) |
| ato_label | String | ATO label for tax reporting (e.g., BAS codes, income type) |
| archived | Boolean | True if account is inactive |
| sort_order | Int | Display order within parent |
| created_at | Timestamp | Record creation time |
| updated_at | Timestamp | Last update time |

**Constraints**: Unique(name, type, parent_id) — category names must be unique within their parent and type.

### transactions
Transaction header: date, payee, memo, postings follow in the postings table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| date | Date | Transaction date |
| payee | String | Payee name or merchant |
| memo | String | User memo/notes |
| reference | String | Bank reference or check number |
| tags | JSON Array[String] | User-defined tags (e.g., ["business", "travel"]) |
| metadata | JSON Object | Custom fields (e.g., invoice number, project code) |
| import_batch_id | UUID (FK) | Link to import batch if imported |
| external_id | String | External system ID (e.g., Stripe transaction ID) |
| status | TransactionStatus | NORMAL or VOID |
| created_at | Timestamp | Record creation time |
| updated_at | Timestamp | Last update time |

### postings
Double-entry lines. Each transaction has 2+ postings summing to zero.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| transaction_id | UUID (FK) | Link to transaction |
| account_id | UUID (FK) | Link to account (TRANSFER or CATEGORY) |
| amount | Decimal (signed) | Amount. Positive for ASSET/EXPENSE; negative for LIABILITY/INCOME/EQUITY. Must sum to zero per transaction. |
| is_business | Boolean | True if this posting is for a business transaction |
| gst_code | GSTCode | GST classification (GST, GST_FREE, INPUT_TAXED, EXPORT, OTHER) |
| gst_rate | Decimal | GST rate (0.1 for standard, 0.0 for GST-free) |
| gst_amount | Decimal | Calculated GST amount (amount * gst_rate) |
| category_split_label | String | Label for splits within a multi-posting transaction (e.g., "Principal", "Interest") |
| cleared | Boolean | True if cleared by bank statement |
| reconciled | Boolean | True if manually reconciled |
| reconcile_id | UUID (FK) | Link to reconciliation session if reconciled |
| created_at | Timestamp | Record creation time |
| updated_at | Timestamp | Last update time |

**Constraints**: Composite index on (transaction_id, account_id) for fast lookups. Postings on a transaction must sum to zero.

### memorized_rules
Auto-categorization rules for CSV imports.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String | Rule name (e.g., "Salary") |
| match_type | MatchType | EXACT, CONTAINS, or REGEX |
| match_text | String | Text to match against payee |
| default_account_id | UUID (FK) | Category account to apply on match |
| default_memo | String | Memo to auto-fill |
| is_business_default | Boolean | True if matching transactions default to business |
| priority | Int | Order of evaluation (higher = first) |
| apply_on_import | Boolean | True if this rule applies during CSV import |
| created_at | Timestamp | Record creation time |
| updated_at | Timestamp | Last update time |

### import_batches
Track CSV imports for deduplication and history.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_id | UUID (FK) | Account imported into |
| source_filename | String | Original CSV filename |
| source_hash | String | Hash of CSV content (deduplication) |
| row_count | Int | Rows processed |
| imported_count | Int | Rows successfully imported |
| duplicate_count | Int | Rows skipped as duplicates |
| error_count | Int | Rows with errors |
| date_range_start | Date | Earliest transaction in batch |
| date_range_end | Date | Latest transaction in batch |
| created_at | Timestamp | Import time |

### reconciliations
Bank reconciliation sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_id | UUID (FK) | Account being reconciled |
| statement_date | Date | Bank statement date |
| statement_balance | Decimal | Ending balance from statement |
| opening_balance | Decimal | Opening balance for session |
| status | String | DRAFT, LOCKED, COMPLETE |
| notes | String | Reconciliation notes |
| created_at | Timestamp | Session start time |
| completed_at | Timestamp | Session completion time |

### recurring_bills
Scheduled bill payments.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| payee | String | Payee name |
| account_id | UUID (FK) | Account to post to |
| amount | Decimal | Transaction amount |
| frequency | BillFrequency | WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, YEARLY |
| next_due_date | Date | Next payment date |
| last_paid_date | Date | Last payment date (NULL if never paid) |
| status | BillStatus | ACTIVE or PAUSED |
| notes | String | Notes about the bill |
| created_at | Timestamp | Record creation time |
| updated_at | Timestamp | Last update time |

### settings
Application settings stored as JSON key-value pairs.

| Column | Type | Description |
|--------|------|-------------|
| key | String | Setting key (e.g., 'general.currency', 'tax.abn') |
| value | JSON | Setting value (string, number, object, array, boolean) |
| created_at | Timestamp | Record creation time |
| updated_at | Timestamp | Last update time |

**Constraints**: Primary key on (key).

**Common settings keys**:
- `general.currency` — ISO code (default: AUD)
- `general.financialYearStart` — Month (1-12, default: 7 for July in Australia)
- `business.abn` — Australian Business Number
- `business.gstRegistered` — Boolean
- `stripe.apiKey` — Stripe API key for imports
- `backup.autoBackupEnabled` — Boolean
- `backup.autoBackupFrequency` — "daily", "weekly", "monthly"
