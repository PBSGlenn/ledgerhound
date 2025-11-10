# Ledgerhound Testing Plan

## Current Status

- **Unit Tests**: 2 test files (domain logic only)
- **E2E Tests**: 0 test files
- **Services Tested**: 0 out of 14
- **Coverage**: Unknown (no coverage reporting configured)

---

## Testing Strategy

### Phase 1: Test Infrastructure Setup (30 minutes)
- [x] Review existing test files
- [ ] Create vitest.config.ts with coverage reporting
- [ ] Create playwright.config.ts for E2E tests
- [ ] Set up test database (separate from dev.db)
- [ ] Create test utilities and helpers

### Phase 2: Service Unit Tests (Priority Order)

#### Critical Services (High Priority)
1. **accountService.ts** (270 lines)
   - [ ] CRUD operations
   - [ ] Balance calculations (key feature!)
   - [ ] Archive/unarchive
   - [ ] Hierarchy operations

2. **transactionService.ts** (385 lines)
   - [ ] Create transaction (simple & split)
   - [ ] Double-entry validation (sum to zero)
   - [ ] GST validation
   - [ ] Transfer detection
   - [ ] Update/delete operations
   - [ ] Register views

3. **categoryService.ts** (616 lines)
   - [ ] CRUD operations
   - [ ] Hierarchical operations (parent/child)
   - [ ] Tree traversal
   - [ ] Path operations
   - [ ] Inheritable settings

4. **reportService.ts** (524 lines)
   - [ ] P&L report generation
   - [ ] GST Summary calculations
   - [ ] BAS Draft with rounding
   - [ ] Date range filtering
   - [ ] Business transaction filtering

#### Important Services (Medium Priority)
5. **importService.ts** (541 lines)
   - [ ] CSV parsing
   - [ ] Column mapping
   - [ ] Deduplication logic
   - [ ] Template save/load
   - [ ] Preview generation

6. **stripeImportService.ts** (749 lines)
   - [ ] 5-way split accounting
   - [ ] Fee GST extraction
   - [ ] Transaction type handling
   - [ ] Deduplication by Stripe ID
   - [ ] Metadata parsing

7. **reconciliationService.ts** (402 lines)
   - [ ] Session creation
   - [ ] Posting reconciliation
   - [ ] Balance calculations
   - [ ] Lock/unlock operations

8. **memorizedRuleService.ts** (312 lines)
   - [ ] Rule creation/CRUD
   - [ ] Pattern matching (exact, contains, regex)
   - [ ] Priority ordering
   - [ ] Rule application

#### Utility Services (Lower Priority)
9. **backupService.ts** (225 lines)
   - [ ] Auto-backup on startup
   - [ ] Manual backup creation
   - [ ] Restore functionality
   - [ ] Cleanup old backups
   - [ ] JSON export

10. **settingsService.ts** (154 lines)
    - [ ] Get/set settings
    - [ ] JSON serialization
    - [ ] Default values

11. **reconciliationMatchingService.ts** (263 lines)
    - [ ] Statement parsing
    - [ ] Transaction matching algorithms
    - [ ] Similarity scoring

12. **pdfStatementService.ts** (234 lines)
    - [ ] PDF parsing
    - [ ] Text extraction
    - [ ] Statement identification

13. **bookManager.ts** (231 lines)
    - [ ] Multi-book operations
    - [ ] Book switching
    - [ ] LocalStorage integration

14. **index.ts** (6 lines)
    - [ ] Export verification (simple)

### Phase 3: E2E Tests (Critical User Flows)

#### Core Accounting Flows
1. **Transaction Management**
   - [ ] Create simple personal transaction
   - [ ] Create business transaction with GST
   - [ ] Create split transaction
   - [ ] Create transfer between accounts
   - [ ] Edit existing transaction
   - [ ] Delete transaction
   - [ ] View register

2. **CSV Import Flow**
   - [ ] Upload CSV file
   - [ ] Map columns
   - [ ] Save template
   - [ ] Preview import
   - [ ] Execute import
   - [ ] Verify deduplication

3. **Reporting Flow**
   - [ ] Generate P&L report
   - [ ] Generate GST Summary
   - [ ] Generate BAS Draft
   - [ ] Change date range
   - [ ] Verify calculations

4. **Account Management**
   - [ ] Create new account
   - [ ] Edit account settings
   - [ ] Archive account
   - [ ] View account register

5. **Category Hierarchy**
   - [ ] Create category
   - [ ] Create subcategory
   - [ ] Edit category
   - [ ] Archive category
   - [ ] Verify inheritance

#### Secondary Flows
6. **Stripe Integration**
   - [ ] Configure Stripe settings
   - [ ] Test connection
   - [ ] Import transactions
   - [ ] Verify 5-way splits

7. **Memorized Rules**
   - [ ] Create rule
   - [ ] Test rule matching
   - [ ] Apply rules on import
   - [ ] Edit/delete rule

8. **Settings Management**
   - [ ] Change settings
   - [ ] Verify persistence
   - [ ] Restore defaults

---

## Test File Structure

```
src/
├── lib/
│   └── services/
│       ├── __tests__/
│       │   ├── accountService.test.ts
│       │   ├── transactionService.test.ts
│       │   ├── categoryService.test.ts
│       │   ├── reportService.test.ts
│       │   ├── importService.test.ts
│       │   ├── stripeImportService.test.ts
│       │   ├── reconciliationService.test.ts
│       │   ├── memorizedRuleService.test.ts
│       │   ├── backupService.test.ts
│       │   ├── settingsService.test.ts
│       │   ├── reconciliationMatchingService.test.ts
│       │   ├── pdfStatementService.test.ts
│       │   └── bookManager.test.ts
│       └── __test-utils__/
│           ├── testDb.ts          # Test database setup
│           ├── fixtures.ts        # Test data fixtures
│           └── helpers.ts         # Test helper functions
├── domain/
│   └── __tests__/                 # Existing domain tests
└── ...

e2e/
├── transaction.spec.ts            # Transaction flows
├── import.spec.ts                 # CSV import flows
├── reports.spec.ts                # Reporting flows
├── accounts.spec.ts               # Account management
├── categories.spec.ts             # Category hierarchy
├── stripe.spec.ts                 # Stripe integration
└── rules.spec.ts                  # Memorized rules
```

---

## Test Coverage Goals

- **Overall Coverage**: 80%+
- **Critical Services**: 90%+
  - accountService, transactionService, categoryService, reportService
- **Important Services**: 75%+
  - importService, stripeImportService, reconciliationService, memorizedRuleService
- **Utility Services**: 60%+
  - All others

---

## Test Database Strategy

1. **Unit Tests**: Use in-memory SQLite (`:memory:`)
   - Fast, isolated, no cleanup needed
   - Fresh database for each test suite

2. **E2E Tests**: Use test database file (`prisma/test.db`)
   - Reset before each test run
   - Seed with known test data
   - Clean up after tests

---

## Testing Utilities

### Test Database Helper
```typescript
// src/lib/services/__test-utils__/testDb.ts
import { PrismaClient } from '@prisma/client';

export async function createTestDb() {
  const prisma = new PrismaClient({
    datasources: { db: { url: 'file::memory:?cache=shared' } }
  });
  await prisma.$connect();
  // Run migrations
  return prisma;
}

export async function cleanupTestDb(prisma: PrismaClient) {
  await prisma.$disconnect();
}
```

### Test Fixtures
```typescript
// src/lib/services/__test-utils__/fixtures.ts
export const testAccounts = {
  personalChecking: {
    name: 'Personal Checking',
    type: 'ASSET',
    kind: 'TRANSFER',
    // ...
  },
  // ... more fixtures
};
```

---

## Implementation Timeline

### Week 1: Foundation (10 hours)
- [ ] Test infrastructure setup (2 hours)
- [ ] accountService tests (2 hours)
- [ ] transactionService tests (3 hours)
- [ ] categoryService tests (3 hours)

### Week 2: Services (10 hours)
- [ ] reportService tests (2 hours)
- [ ] importService tests (2 hours)
- [ ] stripeImportService tests (3 hours)
- [ ] reconciliationService tests (2 hours)
- [ ] memorizedRuleService tests (1 hour)

### Week 3: Remaining Services (6 hours)
- [ ] backupService tests (1 hour)
- [ ] settingsService tests (1 hour)
- [ ] Other service tests (4 hours)

### Week 4: E2E Tests (8 hours)
- [ ] Core flows (4 hours)
- [ ] Secondary flows (3 hours)
- [ ] Coverage review and gaps (1 hour)

**Total Estimate**: ~34 hours

---

## Success Criteria

- ✅ All 14 services have unit tests
- ✅ 80%+ code coverage overall
- ✅ 7+ E2E test suites covering critical user flows
- ✅ All tests pass in CI
- ✅ Test documentation complete
- ✅ Coverage reports generated

---

## Current Priority

**Start with**:
1. Test infrastructure setup (vitest config, test database)
2. accountService tests (balance calculations are critical)
3. transactionService tests (double-entry validation is critical)
