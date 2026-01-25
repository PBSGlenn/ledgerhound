import { test, expect } from '@playwright/test';

test.describe('Transaction Entry Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load (using 'load' instead of 'networkidle' due to continuous polling)
    await page.waitForLoadState('load');

    // Wait for the app to load and accounts to be fetched
    await page.waitForTimeout(1000);

    // Make sure we're on the Accounts tab
    await page.click('button:has-text("Accounts")');

    // Wait for account list to populate
    await page.waitForTimeout(500);

    // Select "Personal Checking" account from the seeded data
    await page.click('text=Personal Checking', { timeout: 10000 });

    // Wait for account to be selected (account name should appear in top bar)
    await expect(page.locator('h1:has-text("Personal Checking")')).toBeVisible({ timeout: 10000 });
  });

  test('should create a simple income transaction', async ({ page }) => {
    // Click "New Transaction" button in top bar
    await page.click('button:has-text("New Transaction")');

    // Wait for transaction form modal to appear
    await expect(page.locator('role=dialog')).toBeVisible();

    // Fill in date (using label-based selector since inputs don't have name attributes)
    const dateInput = page.locator('label:has-text("Date")').locator('..').locator('input[type="date"]');
    await dateInput.fill('2025-01-15');

    // Fill in payee
    const payeeInput = page.locator('label:has-text("Payee")').locator('..').locator('input[type="text"]');
    await payeeInput.fill('Consulting Client');

    // Fill in amount (income is positive)
    const amountInput = page.locator('label:has-text("Amount")').locator('..').locator('input[type="number"]');
    await amountInput.fill('1500');

    // Select category - CategorySelector is a button-based dropdown
    // Use search to find leaf category "Salary" (under Personal Income > Employment > Salary)
    await page.click('button:has-text("Select category...")');
    await page.waitForTimeout(500);

    // Search for the leaf category
    const searchInput = page.locator('input[placeholder="Search categories..."]');
    await searchInput.fill('Salary');
    await page.waitForTimeout(500);

    // Click on the Salary leaf category
    await page.locator('button').filter({ hasText: /^Salary$/ }).first().click();
    await page.waitForTimeout(500);

    // Fill in split amount (required for form validation)
    // The split amount input is the number input in the "Items" section
    const splitAmountInput = page.locator('input[type="number"][step="0.01"]').nth(1); // 2nd number input (1st is total amount)
    await splitAmountInput.fill('1500');

    // Save transaction
    await page.click('button:has-text("Save Transaction")');

    // Wait for modal to close
    await expect(page.locator('role=dialog')).not.toBeVisible({ timeout: 5000 });

    // Wait for register to reload/update (transactions are fetched after modal closes)
    await page.waitForTimeout(1000);

    // Verify transaction appears in register
    await expect(page.locator('text=Consulting Client')).toBeVisible({ timeout: 10000 });
  });

  test('should create a business expense with GST', async ({ page }) => {
    // Click "New Transaction" button
    await page.click('button:has-text("New Transaction")');

    // Wait for form
    await expect(page.locator('role=dialog')).toBeVisible();

    // Fill in transaction details (using label-based selectors)
    const dateInput = page.locator('label:has-text("Date")').locator('..').locator('input[type="date"]');
    await dateInput.fill('2025-01-16');

    const payeeInput = page.locator('label:has-text("Payee")').locator('..').locator('input[type="text"]');
    await payeeInput.fill('Office Supplies Store');

    const amountInput = page.locator('label:has-text("Amount")').locator('..').locator('input[type="number"]');
    await amountInput.fill('110'); // Enter as positive, form handles sign

    // Select business expense category using search
    // "Office Supplies" is under Business Expenses > Operating Expenses > Office Supplies
    await page.click('button:has-text("Select category...")');
    await page.waitForTimeout(500);

    // Search for the leaf category
    const searchInput = page.locator('input[placeholder="Search categories..."]');
    await searchInput.fill('Office Supplies');
    await page.waitForTimeout(500);

    // Click on the Office Supplies leaf category
    await page.locator('button').filter({ hasText: /^Office Supplies$/ }).first().click();
    await page.waitForTimeout(500);

    // Fill in split amount (required for form validation)
    const splitAmountInput = page.locator('input[type="number"][step="0.01"]').nth(1);
    await splitAmountInput.fill('110');

    // Business checkbox should be auto-checked when selecting a business category
    // (isBusinessDefault=true on Office Supplies)

    // Save transaction
    await page.click('button:has-text("Save Transaction")');

    // Wait for modal to close
    await expect(page.locator('role=dialog')).not.toBeVisible({ timeout: 5000 });

    // Wait for register to reload/update
    await page.waitForTimeout(1000);

    // Verify transaction appears
    await expect(page.locator('text=Office Supplies Store')).toBeVisible({ timeout: 10000 });
  });

  test('should create a transfer between accounts', async ({ page }) => {
    // Click "New Transaction" button
    await page.click('button:has-text("New Transaction")');

    // Wait for form
    await expect(page.locator('role=dialog')).toBeVisible();

    // Switch to "Transfer Out" tab
    await page.click('button:has-text("Transfer Out")');
    await page.waitForTimeout(300);

    // Fill in date (using label-based selectors)
    const dateInput = page.locator('label:has-text("Date")').locator('..').locator('input[type="date"]');
    await dateInput.fill('2025-01-17');

    // Fill in payee/description
    const payeeInput = page.locator('label:has-text("Payee")').locator('..').locator('input[type="text"]');
    await payeeInput.fill('Transfer to Savings');

    // Fill in amount
    const amountInput = page.locator('label:has-text("Amount")').locator('..').locator('input[type="number"]');
    await amountInput.fill('500');

    // Select destination account - it's a select dropdown (not a CategorySelector button)
    const accountSelect = page.locator('select').first(); // The "Select account..." dropdown
    await accountSelect.selectOption('Personal Credit Card'); // Select a specific account by name

    // Save transaction (form should be balanced automatically)
    await page.click('button:has-text("Save Transaction")');

    // Wait for modal to close
    await expect(page.locator('role=dialog')).not.toBeVisible({ timeout: 5000 });

    // Wait for register to reload/update
    await page.waitForTimeout(1000);

    // Verify transaction appears
    await expect(page.locator('text=Transfer to Savings')).toBeVisible({ timeout: 10000 });
  });

  test('should create a split transaction', async ({ page }) => {
    // Click "New Transaction" button
    await page.click('button:has-text("New Transaction")');

    // Wait for form
    await expect(page.locator('role=dialog')).toBeVisible();

    // Fill in basic details (using label-based selectors)
    const dateInput = page.locator('label:has-text("Date")').locator('..').locator('input[type="date"]');
    await dateInput.fill('2025-01-18');

    const payeeInput = page.locator('label:has-text("Payee")').locator('..').locator('input[type="text"]');
    await payeeInput.fill('Shopping Trip');

    const amountInput = page.locator('label:has-text("Amount")').locator('..').locator('input[type="number"]');
    await amountInput.fill('150');

    // Click "+ Add Split" button to add second split row
    await page.click('button:has-text("+ Add Split")');
    await page.waitForTimeout(300);

    // First split - Groceries $100 (under Personal Expenses > Food & Dining > Groceries)
    await page.locator('button:has-text("Select category...")').first().click();
    await page.waitForTimeout(500);

    // Search for Groceries
    let searchInput = page.locator('input[placeholder="Search categories..."]');
    await searchInput.fill('Groceries');
    await page.waitForTimeout(500);

    // Click on the Groceries leaf category
    await page.locator('button').filter({ hasText: /^Groceries$/ }).first().click();
    await page.waitForTimeout(500);

    // Fill first split amount - it's the 2nd number input (1st is total amount at top)
    await page.locator('input[type="number"][step="0.01"]').nth(1).fill('100');

    // Second split - Office Supplies $50 (under Business Expenses > Operating Expenses)
    await page.waitForTimeout(300);

    // Click second category dropdown
    await page.locator('button:has-text("Select category...")').first().click(); // Now first since Groceries is selected
    await page.waitForTimeout(500);

    // Search for Office Supplies
    searchInput = page.locator('input[placeholder="Search categories..."]');
    await searchInput.fill('Office Supplies');
    await page.waitForTimeout(500);

    // Click on the Office Supplies leaf category
    await page.locator('button').filter({ hasText: /^Office Supplies$/ }).first().click();
    await page.waitForTimeout(500);

    // Fill second split amount - it's the 3rd number input
    await page.locator('input[type="number"][step="0.01"]').nth(2).fill('50');

    // Save transaction
    await page.click('button:has-text("Save Transaction")');

    // Wait for modal to close
    await expect(page.locator('role=dialog')).not.toBeVisible({ timeout: 5000 });

    // Wait for register to reload/update
    await page.waitForTimeout(1000);

    // Verify transaction appears
    await expect(page.locator('text=Shopping Trip')).toBeVisible({ timeout: 10000 });
  });
});
