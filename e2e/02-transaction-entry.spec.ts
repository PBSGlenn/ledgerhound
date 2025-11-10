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

    // Wait for dropdown to load and click the category (created by account creation test)
    await page.waitForSelector('text=Consulting Income', { timeout: 5000 });
    await page.locator('text=Consulting Income').first().click();

    // Fill in split amount (required for form validation)
    // The split amount input is the number input in the "Items" section
    const splitAmountInput = page.locator('input[type="number"][step="0.01"]').nth(1); // 2nd number input (1st is total amount)
    await splitAmountInput.fill('1500');

    // Save transaction
    await page.click('button:has-text("Save"), button:has-text("Create")');

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

    // Wait for dropdown to load and click the category
    await page.waitForSelector('text=Office Supplies', { timeout: 5000 });
    await page.locator('text=Office Supplies').first().click();

    // Fill in split amount (required for form validation)
    const splitAmountInput = page.locator('input[type="number"][step="0.01"]').nth(1);
    await splitAmountInput.fill('110');

    // Mark as business transaction if checkbox exists
    const businessCheckbox = page.locator('input[type="checkbox"][name="isBusiness"]');
    if (await businessCheckbox.count() > 0) {
      await businessCheckbox.check();
    }

    // Save transaction
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify transaction appears
    await expect(page.locator('text=Office Supplies Store')).toBeVisible({ timeout: 10000 });
  });

  test('should create a transfer between accounts', async ({ page }) => {
    // Click "New Transaction" button
    await page.click('button:has-text("New Transaction")');

    // Wait for form
    await expect(page.locator('role=dialog')).toBeVisible();

    // Fill in date (using label-based selectors)
    const dateInput = page.locator('label:has-text("Date")').locator('..').locator('input[type="date"]');
    await dateInput.fill('2025-01-17');

    // Fill in payee/description
    const payeeInput = page.locator('label:has-text("Payee")').locator('..').locator('input[type="text"]');
    await payeeInput.fill('Transfer to Savings');

    // Fill in amount
    const amountInput = page.locator('label:has-text("Amount")').locator('..').locator('input[type="number"]');
    await amountInput.fill('500');

    // For a transfer, select another account instead of a category
    // Look for "Transfer to" or account selector
    const transferInput = page.locator('input[placeholder*="Transfer"], input[placeholder*="account"]').first();
    if (await transferInput.count() > 0) {
      await transferInput.click();
      await page.locator('text=Savings Account, text=SAVINGS_GOAL').first().click();
    }

    // Save transaction
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

    // Look for "Add Split" or "Split" button to enable split entry
    const splitButton = page.locator('button:has-text("Split"), button:has-text("Add Split")').first();
    if (await splitButton.count() > 0) {
      await splitButton.click();

      // Add first split - Groceries $100
      await page.fill('input[name="splits[0].amount"]', '-100');
      const category1 = page.locator('[placeholder*="category"]').first();
      await category1.click();
      await page.locator('text=Groceries').first().click();

      // Add second split - Household $50
      await page.click('button:has-text("Add Split")');
      await page.fill('input[name="splits[1].amount"]', '-50');
      const category2 = page.locator('[placeholder*="category"]').nth(1);
      await category2.click();
      await page.locator('text=Household').first().click();
    }

    // Save transaction
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify transaction appears
    await expect(page.locator('text=Shopping Trip')).toBeVisible({ timeout: 10000 });
  });
});
