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
    await page.click('button:has-text("Select category...")');

    // Wait for dropdown to load
    await page.waitForTimeout(800);

    // Use "Business Income" which is already expanded and visible in the tree
    // It's the leaf node under Business Income > Business Income
    await page.locator('text=Business Income').nth(1).click({ force: true });

    // Fill in split amount (required for form validation)
    // The split amount input is the number input in the "Items" section
    const splitAmountInput = page.locator('input[type="number"][step="0.01"]').nth(1); // 2nd number input (1st is total amount)
    await splitAmountInput.fill('1500');

    // Save transaction (use force to bypass CategorySelector dropdown overlay)
    await page.click('button:has-text("Save"), button:has-text("Create")', { force: true });

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

    // Select business expense category - CategorySelector is a button-based dropdown
    await page.click('button:has-text("Select category...")');

    // Wait for dropdown to load
    await page.waitForTimeout(800);

    // Expand Business Expenses parent node first
    await page.locator('text=Business Expenses').first().click();
    await page.waitForTimeout(300);

    // Now click the leaf "Business Expenses" category
    await page.locator('text=Business Expenses').nth(1).click({ force: true });

    // Fill in split amount (required for form validation)
    const splitAmountInput = page.locator('input[type="number"][step="0.01"]').nth(1);
    await splitAmountInput.fill('110');

    // Mark as business transaction if checkbox exists
    const businessCheckbox = page.locator('input[type="checkbox"][name="isBusiness"]');
    if (await businessCheckbox.count() > 0) {
      await businessCheckbox.check();
    }

    // Save transaction (use force to bypass CategorySelector dropdown overlay)
    await page.click('button:has-text("Save"), button:has-text("Create")', { force: true });

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
    await accountSelect.selectOption({ index: 1 }); // Select first real option (index 0 is placeholder)

    // Save transaction (form should be balanced automatically)
    await page.click('button:has-text("Save"), button:has-text("Create")');

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

    // First split - Business Income $100 (already visible in tree)
    // Click first category dropdown (in ITEMS section)
    await page.locator('button:has-text("Select category...")').first().click();
    await page.waitForTimeout(800);

    // Click Business Income leaf (nth(1) = second occurrence)
    await page.locator('text=Business Income').nth(1).click({ force: true });

    // Fill first split amount - it's the 2nd number input (1st is total amount at top)
    await page.locator('input[type="number"][step="0.01"]').nth(1).fill('100');

    // Second split - Business Expenses $50 (also already visible)
    // Click second category dropdown
    await page.locator('button:has-text("Select category...")').nth(1).click();
    await page.waitForTimeout(800);

    // Click Business Expenses leaf (nth(1) = second occurrence)
    await page.locator('text=Business Expenses').nth(1).click({ force: true });

    // Fill second split amount - it's the 3rd number input
    await page.locator('input[type="number"][step="0.01"]').nth(2).fill('50');

    // Save transaction (use force to bypass dropdown overlay)
    await page.click('button:has-text("Save"), button:has-text("Create")', { force: true });

    // Verify transaction appears
    await expect(page.locator('text=Shopping Trip')).toBeVisible({ timeout: 10000 });
  });
});
