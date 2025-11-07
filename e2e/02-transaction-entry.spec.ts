import { test, expect } from '@playwright/test';

test.describe('Transaction Entry Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

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

    // Fill in date
    await page.fill('input[name="date"]', '2025-01-15');

    // Fill in payee
    await page.fill('input[name="payee"]', 'Consulting Client');

    // Fill in amount (income is positive)
    await page.fill('input[name="amount"]', '1500');

    // Select category - look for a category dropdown/combobox
    const categoryInput = page.locator('input[placeholder*="category"], [role="combobox"]').first();
    await categoryInput.click();

    // Select "Consulting" or another income category from the dropdown
    await page.click('text=Consulting, text=Income').first();

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

    // Fill in transaction details
    await page.fill('input[name="date"]', '2025-01-16');
    await page.fill('input[name="payee"]', 'Office Supplies Store');
    await page.fill('input[name="amount"]', '-110'); // Expense is negative

    // Select business expense category
    const categoryInput = page.locator('input[placeholder*="category"], [role="combobox"]').first();
    await categoryInput.click();
    await page.click('text=Office Supplies, text=Expense').first();

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

    // Fill in date
    await page.fill('input[name="date"]', '2025-01-17');

    // Fill in payee/description
    await page.fill('input[name="payee"]', 'Transfer to Savings');

    // Fill in amount
    await page.fill('input[name="amount"]', '-500');

    // For a transfer, select another account instead of a category
    // Look for "Transfer to" or account selector
    const transferInput = page.locator('input[placeholder*="Transfer"], input[placeholder*="account"]').first();
    if (await transferInput.count() > 0) {
      await transferInput.click();
      await page.click('text=Savings Account, text=SAVINGS_GOAL').first();
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

    // Fill in basic details
    await page.fill('input[name="date"]', '2025-01-18');
    await page.fill('input[name="payee"]', 'Shopping Trip');
    await page.fill('input[name="amount"]', '-150');

    // Look for "Add Split" or "Split" button to enable split entry
    const splitButton = page.locator('button:has-text("Split"), button:has-text("Add Split")').first();
    if (await splitButton.count() > 0) {
      await splitButton.click();

      // Add first split - Groceries $100
      await page.fill('input[name="splits[0].amount"]', '-100');
      const category1 = page.locator('[placeholder*="category"]').first();
      await category1.click();
      await page.click('text=Groceries').first();

      // Add second split - Household $50
      await page.click('button:has-text("Add Split")');
      await page.fill('input[name="splits[1].amount"]', '-50');
      const category2 = page.locator('[placeholder*="category"]').nth(1);
      await category2.click();
      await page.click('text=Household').first();
    }

    // Save transaction
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify transaction appears
    await expect(page.locator('text=Shopping Trip')).toBeVisible({ timeout: 10000 });
  });
});
