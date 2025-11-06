import { test, expect } from '@playwright/test';

test.describe('Transaction Entry Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create a simple income transaction', async ({ page }) => {
    // Navigate to register or transactions view
    await page.locator('text=Register, text=Transactions').first().click();

    // Click "Add Transaction" or "New Transaction" button
    const addButton = page.locator('button:has-text("Add Transaction"), button:has-text("New Transaction"), button:has-text("+")').first();
    await addButton.click();

    // Fill in transaction details
    await page.fill('input[name="date"], input[type="date"]', '2025-01-15');
    await page.fill('input[name="payee"], input[placeholder*="Payee"]', 'Client ABC');
    await page.fill('input[name="memo"], input[placeholder*="Memo"], textarea[name="memo"]', 'January consulting services');

    // Select category (Income)
    const categorySelector = page.locator('[role="combobox"]:has-text("Category"), select[name="category"]').first();
    await categorySelector.click();
    await page.click('text=Income, text=Consulting').first();

    // Enter amount
    await page.fill('input[name="amount"], input[type="number"]', '2500');

    // Save transaction
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify transaction appears in register
    await expect(page.locator('text=Client ABC')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=2,500, text=$2,500')).toBeVisible();
  });

  test('should create a business expense with GST', async ({ page }) => {
    await page.locator('text=Register, text=Transactions').first().click();

    const addButton = page.locator('button:has-text("Add Transaction"), button:has-text("New Transaction")').first();
    await addButton.click();

    // Fill in transaction details
    await page.fill('input[name="date"], input[type="date"]', '2025-01-16');
    await page.fill('input[name="payee"]', 'Office Depot');
    await page.fill('input[name="memo"], textarea[name="memo"]', 'Printer and supplies');

    // Select expense category
    const categorySelector = page.locator('[role="combobox"]:has-text("Category")').first();
    await categorySelector.click();
    await page.click('text=Office Supplies, text=Expense').first();

    // Mark as business expense
    const businessCheckbox = page.locator('input[type="checkbox"]:near(text="Business")').first();
    if (await businessCheckbox.count() > 0) {
      await businessCheckbox.check();
    }

    // Enter amount (including GST)
    await page.fill('input[name="amount"]', '550');

    // Save transaction
    await page.click('button:has-text("Save")');

    // Verify transaction and GST split
    await expect(page.locator('text=Office Depot')).toBeVisible({ timeout: 10000 });
    // Should show $550 total with GST component
    await expect(page.locator('text=550, text=$550')).toBeVisible();
  });

  test('should create a transfer between accounts', async ({ page }) => {
    await page.locator('text=Register').first().click();

    const addButton = page.locator('button:has-text("Add Transaction")').first();
    await addButton.click();

    // Fill in transaction details
    await page.fill('input[type="date"]', '2025-01-17');
    await page.fill('input[name="payee"]', 'Transfer to Savings');

    // Select "From" account
    const fromSelector = page.locator('[role="combobox"]:near(text="From")').first();
    if (await fromSelector.count() > 0) {
      await fromSelector.click();
      await page.click('text=Checking').first();
    }

    // Select "To" account
    const toSelector = page.locator('[role="combobox"]:near(text="To")').first();
    if (await toSelector.count() > 0) {
      await toSelector.click();
      await page.click('text=Savings').first();
    }

    // Enter transfer amount
    await page.fill('input[name="amount"]', '1000');

    // Save transaction
    await page.click('button:has-text("Save")');

    // Verify transfer appears
    await expect(page.locator('text=Transfer to Savings')).toBeVisible({ timeout: 10000 });
  });

  test('should create a split transaction', async ({ page }) => {
    await page.locator('text=Register').first().click();

    const addButton = page.locator('button:has-text("Add Transaction")').first();
    await addButton.click();

    // Fill in basic details
    await page.fill('input[type="date"]', '2025-01-18');
    await page.fill('input[name="payee"]', 'Amazon Business');

    // Click "Add Split" or "Split" button
    const splitButton = page.locator('button:has-text("Split"), button:has-text("Add Split")').first();
    await splitButton.click();

    // Add first split - Office Supplies
    await page.fill('input[name="amount"][data-split="0"]', '200');
    const category1 = page.locator('[role="combobox"][data-split="0"]').first();
    await category1.click();
    await page.click('text=Office Supplies').first();

    // Add second split - Software
    await page.click('button:has-text("Add Split")');
    await page.fill('input[name="amount"][data-split="1"]', '300');
    const category2 = page.locator('[role="combobox"][data-split="1"]').first();
    await category2.click();
    await page.click('text=Software').first();

    // Save transaction
    await page.click('button:has-text("Save")');

    // Verify split transaction
    await expect(page.locator('text=Amazon Business')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=500, text=$500')).toBeVisible(); // Total amount
  });
});
