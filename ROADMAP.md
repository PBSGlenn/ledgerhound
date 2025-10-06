# Ledgerhound Development Roadmap

This document outlines the development plan for Ledgerhound, breaking down the work into prioritized phases and tasks.

---

## Phase 1: Solidify Core Transaction Management

**Goal:** Enable users to accurately and efficiently create, edit, and view all types of transactions.

### Task 1.1: Implement Full Split Transaction Support
*   **Location:** `src/components/Transaction/TransactionFormModal.tsx`
*   **Steps:**
    1.  Modify the form to allow adding/removing multiple posting lines (splits).
    2.  Each split line should have its own `Account` (category) selector and `amount` input.
    3.  Implement a "Remaining to allocate" indicator that updates in real-time.
    4.  For business transactions, add a `GSTCode` selector to each individual split.
    5.  Update the `transactionService.createTransaction` and `updateTransaction` methods to handle the array of splits from the form.

### Task 1.2: Implement Transfer Transactions
*   **Location:** `src/components/Transaction/TransactionFormModal.tsx`, `src/components/AccountCombo.tsx`
*   **Steps:**
    1.  Modify the category/account selector to include `AccountKind.TRANSFER` accounts (Assets, Liabilities, Equity).
    2.  When a transfer account is selected as the destination, the form should automatically create the correct double-entry postings (e.g., a credit from the source Asset and a debit to the destination Asset).
    3.  Ensure GST fields are hidden or disabled for transfer postings.

### Task 1.3: Enhance the Register Grid
*   **Location:** `src/components/Register/RegisterGrid.tsx`
*   **Steps:**
    1.  Add a filter bar with controls for:
        *   Date Range (From/To)
        *   Free-text search (Payee, Memo, Tags)
        *   Status (Cleared, Reconciled)
    2.  Wire these filter controls to the `transactionAPI.getRegisterEntries` call.
    3.  Implement virtualization (e.g., `@tanstack/react-virtual`) to ensure the grid remains performant with thousands of entries.

### Task 1.4: Activate Batch Actions
*   **Location:** `src/components/Register/RegisterGrid.tsx`
*   **Steps:**
    1.  Implement the logic for the "Mark Cleared" button to update selected transactions.
    2.  Implement a "Bulk Add Tag" feature.
    3.  Implement a "Bulk Change Category" feature.

---

## Phase 2: Streamline Data Entry & Automation

**Goal:** Reduce manual data entry through CSV imports and automated categorization.

### Task 2.1: Build the CSV Import Wizard
*   **Location:** A new `src/features/import` directory.
*   **Steps:**
    1.  Create a multi-step modal or view for the import process:
        *   Step 1: Select target account and upload CSV file.
        *   Step 2: Column Mapping UI (map CSV columns to `date`, `payee`, `amount`, etc.).
        *   Step 3: Preview imported data in a grid, showing potential duplicates.
        *   Step 4: Commit the import.
    2.  Save column mappings per account for future imports.

### Task 2.2: Implement Memorized Rules
*   **Location:** A new `src/features/rules` directory.
*   **Steps:**
    1.  Create a UI to manage memorized rules (Create, Read, Update, Delete).
    2.  Implement the backend logic in a `memorizedRuleService.ts` to match rules against transaction payees.
    3.  Integrate rule application into the `TransactionFormModal` (auto-fill fields when payee matches) and the CSV import preview.

---

## Phase 3: Implement Reconciliation

**Goal:** Allow users to reconcile their accounts against bank statements.

### Task 3.1: Build the Reconciliation UI
*   **Location:** A new `src/features/reconciliation` directory.
*   **Steps:**
    1.  Create a two-panel layout:
        *   Left Panel: List of uncleared transactions for the selected account.
        *   Right Panel: Embedded PDF viewer (`pdf.js`) for the bank statement.
    2.  Add inputs for statement start/end dates and balances.
    3.  Display a running summary: `Statement Balance`, `Cleared Balance`, `Difference`.

### Task 3.2: Implement Reconciliation Logic
*   **Location:** `reconciliationService.ts`
*   **Steps:**
    1.  Add checkboxes to the transaction list to mark items as reconciled.
    2.  Update the summary totals as items are checked.
    3.  When the difference is zero, allow the user to "lock" the reconciliation, which marks all selected postings as `reconciled = true` and creates a `Reconciliation` record.

---

## Phase 4: Generate Financial Reports

**Goal:** Provide users with insights into their financial data.

### Task 4.1: Build the Reporting Framework
*   **Location:** A new `src/features/reports` directory.
*   **Steps:**
    1.  Create a main reports view with a selector for different report types and date ranges.
    2.  Implement a component to display report data in a clean, readable format.
    3.  Add functionality to export reports to CSV or PDF.

### Task 4.2: Implement Key Reports
*   **Location:** `reportService.ts` and the new reports feature directory.
*   **Steps:**
    1.  **GST/BAS Report:** Aggregate GST from business-related postings to fill out a draft BAS.
    2.  **Profit & Loss Report:** Sum income and expense categories over a selected period.
    3.  **Cashbook and Tag Reports:** Implement the remaining reports as specified in the brief.

---

## Phase 5: Final Polish & Housekeeping

**Goal:** Complete the application with settings, backups, and robust testing.

### Task 5.1: Settings Management
*   **Steps:**
    1.  Create a settings screen to manage user preferences (e.g., date format, default GST codes).
    2.  Implement a `settingsService.ts` to persist these settings in the database.

### Task 5.2: Backup and Export
*   **Steps:**
    1.  Implement a function to automatically back up the SQLite database on a regular schedule or on exit.
    2.  Provide an option to manually export the entire database to a JSON or SQL file.

### Task 5.3: Comprehensive Testing
*   **Steps:**
    1.  Write unit tests (`vitest`) for all service-layer business logic (e.g., validation, calculations).
    2.  Write E2E tests (`playwright`) for critical user flows like creating a split transaction, importing a CSV, and completing a reconciliation.
