# E2E Tests

End-to-end tests for Ledgerhound using Playwright.

## Test Coverage

### 01-account-creation.spec.ts
- Create new bank account
- Create income category
- Create expense category with business flag

### 02-transaction-entry.spec.ts
- Create simple income transaction
- Create business expense with GST
- Create transfer between accounts
- Create split transaction

### 03-csv-import.spec.ts
- Import CSV with column mapping
- Detect and handle duplicates
- Apply memorized rules during import

### 04-reconciliation.spec.ts
- Start reconciliation session
- Manually tick off transactions
- Balance reconciliation
- Lock reconciliation
- Smart matching with Auto-Match button

## Running Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with UI mode (visual debugging)
npm run test:e2e:ui

# Run with browser visible
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug
```

## Test Structure

- Tests run sequentially (workers: 1) to avoid database conflicts
- Each test file focuses on a specific user workflow
- Fixtures directory contains test data (CSV files, PDFs, etc.)

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e` directory
2. Use descriptive test names that explain the user workflow
3. Follow the existing pattern of `test.describe` and `test` blocks
4. Use `test.beforeEach` to navigate to the starting page
5. Use locators that are resilient to UI changes (prefer text content over class names)

## Debugging

- Use `await page.pause()` to pause test execution
- Use `await page.screenshot({ path: 'screenshot.png' })` to capture screenshots
- Check the HTML report after test run: `npx playwright show-report`
