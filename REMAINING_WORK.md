# Ledgerhound - Remaining Work

**Current Status:** Backend Complete (100%), Frontend Foundation Built (70%)

---

## 🎯 Critical Path to MVP (Must Have)

### 1. Transaction Form Modal ⏱️ ~2-3 hours
**Priority: HIGH** - Can't add/edit transactions without this

**What to build:**
- [ ] Modal component using Radix Dialog
- [ ] Form with two modes:
  - [ ] **Simple mode** - One category, one memo, one amount
  - [ ] **Split mode** - Multiple category splits
- [ ] Per-split business toggle
- [ ] Conditional GST fields (only show when `isBusiness=true`)
- [ ] Validation:
  - [ ] All fields required
  - [ ] Splits must sum to transaction amount
  - [ ] GST calculation validation
- [ ] Memorized rule preview/application
- [ ] Transfer mode (account-to-account)

**Files to create:**
- `src/components/Transaction/TransactionFormModal.tsx`
- `src/components/Transaction/SplitEditor.tsx`
- `src/components/Transaction/GSTFields.tsx`

**API calls needed:**
- `transactionAPI.createTransaction()`
- `transactionAPI.updateTransaction()`
- `accountAPI.getAllAccounts()` (for category picker)
- `memorizedRuleAPI.matchPayee()` (for rule preview)

---

### 2. Tauri Backend Commands ⏱️ ~3-4 hours
**Priority: CRITICAL** - Required for app to work at all

**Option A: Use tauri-plugin-sql (Recommended)**

```bash
# Install plugin
npm install @tauri-apps/plugin-sql
cd src-tauri
cargo add tauri-plugin-sql --features sqlite
```

Then expose database operations as Tauri commands.

**Commands to implement:**
- [ ] `get_all_accounts_with_balances()`
- [ ] `get_account_by_id(account_id: String)`
- [ ] `create_account(data: CreateAccountDTO)`
- [ ] `update_account(id: String, data: UpdateAccountDTO)`
- [ ] `delete_account(id: String)`
- [ ] `get_register_entries(account_id: String, filter: RegisterFilter)`
- [ ] `create_transaction(data: CreateTransactionDTO)`
- [ ] `update_transaction(data: UpdateTransactionDTO)`
- [ ] `delete_transaction(id: String)`
- [ ] `mark_cleared(posting_ids: Vec<String>, cleared: bool)`
- [ ] `import_csv(preview: Vec<ImportPreview>, ...)`
- [ ] `generate_report_pl(start: Date, end: Date, options: ReportOptions)`
- [ ] `generate_report_gst(start: Date, end: Date)`
- [ ] `generate_report_bas(start: Date, end: Date)`

**Files to modify:**
- `src-tauri/src/lib.rs` - Add Tauri commands
- `src-tauri/Cargo.toml` - Add dependencies
- `src/lib/api.ts` - Replace mock functions with `invoke()` calls

**Option B: Call Node.js from Tauri**

Use `tauri-plugin-shell` to call Node.js scripts that use the existing Prisma services.

**Pros:** Reuse existing TypeScript services
**Cons:** Requires Node.js on user's machine

---

### 3. Make Register Grid Functional ⏱️ ~1-2 hours
**Priority: HIGH** - Users need to see and edit transactions

**What to add:**
- [ ] Click transaction to open edit modal
- [ ] Double-click to quick-edit memo
- [ ] Keyboard shortcuts:
  - [ ] `Enter` - New transaction
  - [ ] `E` - Edit selected
  - [ ] `D` - Delete selected (with confirm)
  - [ ] `C` - Toggle cleared
  - [ ] `R` - Reconcile
- [ ] Context menu (right-click):
  - [ ] Edit
  - [ ] Delete
  - [ ] Mark cleared/uncleared
  - [ ] Add tag
  - [ ] Change category
- [ ] Loading states (skeleton loaders)
- [ ] Error handling (toast notifications)
- [ ] Pagination (if >1000 transactions)

**Files to modify:**
- `src/components/Register/RegisterGrid.tsx`

**New components:**
- `src/components/Register/ContextMenu.tsx`
- `src/components/common/Toast.tsx`
- `src/components/common/ConfirmDialog.tsx`

---

## 📊 Important Features (Should Have)

### 4. CSV Import Wizard ⏱️ ~3-4 hours

**What to build:**
- [ ] File upload with drag-and-drop
- [ ] CSV parsing preview
- [ ] Column mapping UI:
  - [ ] Auto-detect common column names
  - [ ] Dropdown to map each CSV column to field
  - [ ] Date format selector
- [ ] Preview table showing:
  - [ ] Parsed data
  - [ ] Duplicate warnings (icon/badge)
  - [ ] Matched rules (badge)
  - [ ] Suggested categories
- [ ] Options:
  - [ ] Skip duplicates (checkbox)
  - [ ] Apply memorized rules (checkbox)
- [ ] Import progress bar
- [ ] Success summary (X imported, Y skipped)

**Files to create:**
- `src/components/Import/ImportWizard.tsx`
- `src/components/Import/ColumnMapper.tsx`
- `src/components/Import/ImportPreview.tsx`

**API calls:**
- `importAPI.parseCSV(content: string)`
- `importAPI.previewImport(rows, mapping, accountId)`
- `importAPI.importTransactions(previews, accountId, options)`

---

### 5. Reconciliation Interface ⏱️ ~4-5 hours

**What to build:**
- [ ] Reconciliation wizard:
  - [ ] Step 1: Enter statement dates and balances
  - [ ] Step 2: Tick off transactions
  - [ ] Step 3: Review difference
  - [ ] Step 4: Lock when balanced
- [ ] Side-by-side layout:
  - [ ] Left: PDF viewer (PDF.js)
  - [ ] Right: Transaction list with checkboxes
- [ ] PDF controls:
  - [ ] Zoom in/out
  - [ ] Page navigation
  - [ ] Search
- [ ] Transaction list:
  - [ ] Show only unreconciled in date range
  - [ ] Check to mark cleared
  - [ ] Running cleared balance
- [ ] Difference indicator:
  - [ ] Green when balanced
  - [ ] Red with amount when not balanced
- [ ] Lock button (disabled until balanced)

**Files to create:**
- `src/components/Reconcile/ReconciliationWizard.tsx`
- `src/components/Reconcile/PDFViewer.tsx`
- `src/components/Reconcile/TransactionTickList.tsx`

**Dependencies:**
- `pdfjs-dist` (already installed)

**API calls:**
- `reconciliationAPI.createReconciliation(data)`
- `reconciliationAPI.getUnreconciledPostings(accountId, startDate, endDate)`
- `reconciliationAPI.reconcilePostings(reconciliationId, postingIds)`
- `reconciliationAPI.getReconciliationStatus(reconciliationId)`
- `reconciliationAPI.lockReconciliation(reconciliationId)`

---

### 6. Reports Dashboard ⏱️ ~3-4 hours

**What to build:**
- [ ] Reports menu/navigation
- [ ] Date range selector (common component)
- [ ] Business/Personal filter toggle

**Report: Profit & Loss**
- [ ] Income section (grouped by category)
- [ ] Expenses section (grouped by category)
- [ ] Net profit calculation
- [ ] GST inclusive/exclusive toggle (for business)
- [ ] Export to CSV/PDF

**Report: GST Summary**
- [ ] GST collected (from sales)
- [ ] GST paid (from purchases)
- [ ] Net GST payable/receivable
- [ ] Breakdown by category
- [ ] Breakdown by payee
- [ ] Export to CSV

**Report: BAS Draft**
- [ ] All BAS fields (G1, G10, G11, 1A, 1B)
- [ ] Whole dollar rounding
- [ ] Reconciliation table
- [ ] Export to PDF (formatted for ATO)
- [ ] Warning: "This is a draft, consult accountant"

**Report: Tag Summary**
- [ ] List of tags with spend/income
- [ ] Business/personal breakdown
- [ ] Date range filtering

**Files to create:**
- `src/components/Reports/ReportsDashboard.tsx`
- `src/components/Reports/ProfitAndLossReport.tsx`
- `src/components/Reports/GSTSummaryReport.tsx`
- `src/components/Reports/BASDraftReport.tsx`
- `src/components/Reports/TagSummaryReport.tsx`
- `src/components/Reports/DateRangePicker.tsx`

**API calls:**
- `reportAPI.generateProfitAndLoss(start, end, options)`
- `reportAPI.generateGSTSummary(start, end)`
- `reportAPI.generateBASDraft(start, end)`
- `reportAPI.getTagSummary(start, end, options)`

---

## 🔧 Nice to Have (Polish)

### 7. Settings UI ⏱️ ~2 hours

**What to build:**
- [ ] Settings modal/page
- [ ] Tabs:
  - [ ] Organization (name, ABN, address)
  - [ ] GST Settings (enable/disable, default rate)
  - [ ] Locale (date format, timezone, currency)
  - [ ] Accounts (mark as business default)
  - [ ] Backup (auto-backup settings, folder)
- [ ] Save/Cancel buttons
- [ ] Validation

**Files to create:**
- `src/components/Settings/SettingsModal.tsx`
- `src/components/Settings/OrganizationSettings.tsx`
- `src/components/Settings/GSTSettings.tsx`
- `src/components/Settings/LocaleSettings.tsx`

**API calls:**
- `settingsAPI.getSettings()`
- `settingsAPI.updateSettings(key, value)`

---

### 8. Backup & Export ⏱️ ~1-2 hours

**What to build:**
- [ ] Manual backup button
- [ ] Auto-backup on close (hook into Tauri close event)
- [ ] Backup location selector
- [ ] Backup to:
  - [ ] SQLite file (copy `dev.db`)
  - [ ] JSON export (full data dump)
- [ ] Restore from backup
- [ ] Export specific register to CSV
- [ ] Export reports to PDF

**Files to create:**
- `src/components/Settings/BackupSettings.tsx`
- `src/lib/backup.ts`

**Tauri commands:**
- `backup_database(path: String)`
- `restore_database(path: String)`
- `export_to_json(path: String)`

---

## 🧪 Testing ⏱️ ~4-6 hours

### Unit Tests (Vitest)

**Services to test:**
- [ ] `accountService` - CRUD, balances, validation
- [ ] `transactionService` - Double-entry, GST validation
- [ ] `importService` - CSV parsing, deduplication
- [ ] `reconciliationService` - Balance calculations
- [ ] `reportService` - P&L, GST, BAS calculations

**Files to create:**
- `src/lib/services/__tests__/accountService.test.ts`
- `src/lib/services/__tests__/transactionService.test.ts`
- `src/lib/services/__tests__/importService.test.ts`
- `src/lib/services/__tests__/reconciliationService.test.ts`
- `src/lib/services/__tests__/reportService.test.ts`

### E2E Tests (Playwright)

**Flows to test:**
- [ ] Create account → Add transaction → View in register
- [ ] Import CSV → Review → Confirm
- [ ] Add transaction with GST → Check BAS report
- [ ] Reconcile account → Lock session
- [ ] Create memorized rule → Import CSV → Check auto-categorization
- [ ] Mixed personal/business transaction → Check P&L split

**Files to create:**
- `tests/e2e/transactions.spec.ts`
- `tests/e2e/import.spec.ts`
- `tests/e2e/reconciliation.spec.ts`
- `tests/e2e/reports.spec.ts`

---

## 📚 Documentation ⏱️ ~2-3 hours

### User Guide

**Sections to write:**
- [ ] Getting started
- [ ] Creating accounts
- [ ] Adding transactions (simple, split, transfer)
- [ ] Business vs personal transactions
- [ ] GST tracking
- [ ] Importing bank statements
- [ ] Reconciling accounts
- [ ] Running reports
- [ ] BAS preparation (for Australian businesses)
- [ ] Keyboard shortcuts
- [ ] Tips & tricks

**File to create:**
- `docs/USER_GUIDE.md`

### Developer Documentation

**Sections to write:**
- [ ] Architecture overview
- [ ] Database schema explanation
- [ ] Adding new reports
- [ ] Adding new import formats
- [ ] Extending the GST system
- [ ] Tauri command patterns

**File to create:**
- `docs/DEVELOPER_GUIDE.md`

---

## 📅 Estimated Timeline

### Sprint 1: Core Functionality (Week 1)
- **Day 1-2:** Tauri commands + API bridge (CRITICAL)
- **Day 3:** Transaction form modal
- **Day 4:** Make register grid functional
- **Day 5:** Bug fixes, polish

**Deliverable:** Working ledger app - can add/edit/view transactions

### Sprint 2: Import & Reconciliation (Week 2)
- **Day 1-2:** CSV import wizard
- **Day 3-4:** Reconciliation UI
- **Day 5:** Testing & bug fixes

**Deliverable:** Can import bank statements and reconcile

### Sprint 3: Reports & Polish (Week 3)
- **Day 1-2:** Reports dashboard (P&L, GST, BAS)
- **Day 3:** Settings UI
- **Day 4:** Backup/export
- **Day 5:** Documentation

**Deliverable:** Complete MVP ready for use

### Sprint 4: Testing & Release (Week 4)
- **Day 1-2:** Unit tests
- **Day 3-4:** E2E tests
- **Day 5:** Final bug fixes, release prep

**Deliverable:** Production-ready v1.0

---

## 🎯 MVP Definition

**Minimum Viable Product includes:**
- ✅ Create/edit/delete accounts
- ✅ Add/edit/delete transactions (simple & split)
- ✅ Business/personal transaction support
- ✅ GST tracking (when business flag enabled)
- ✅ Register view with running balances
- ✅ CSV import with deduplication
- ✅ Basic reconciliation
- ✅ P&L report
- ✅ GST Summary report
- ✅ BAS Draft report
- ✅ Data persistence (SQLite)
- ✅ Offline/local only (no cloud)

**MVP does NOT include:**
- ❌ Multi-user support
- ❌ Cloud sync
- ❌ Bank API integration
- ❌ Mobile app
- ❌ OFX/QIF import (CSV only)
- ❌ Attachments (receipts/images)
- ❌ Budgeting features
- ❌ Multi-currency

---

## 🚀 Ready to Start?

**Recommended order:**
1. **Start with Tauri commands** - This unblocks everything else
2. **Build transaction form** - Core user interaction
3. **Make register interactive** - Users need to see their data
4. **Add CSV import** - Most common workflow
5. **Build reports** - Users need insights
6. **Add reconciliation** - Important but not daily use
7. **Polish & test** - Make it production-ready

**Next command to run:**
```bash
# If you want to implement Tauri commands with tauri-plugin-sql:
cd src-tauri
cargo add tauri-plugin-sql --features sqlite
```

Or dive straight into building the transaction form modal!

---

**Current Status:** Backend is DONE. UI foundation is BUILT. Just need to connect them and build the remaining UI components. You're ~20% away from a working MVP! 🎉
