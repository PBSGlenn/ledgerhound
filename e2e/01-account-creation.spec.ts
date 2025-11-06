import { test, expect } from '@playwright/test';

test.describe('Account Creation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should create a new bank account', async ({ page }) => {
    // Click on "Accounts" in sidebar to ensure we're in the right view
    await page.click('text=Accounts');

    // Look for "Add Account" or account creation button
    // Adjust selector based on actual UI
    const addButton = page.locator('button:has-text("Add Account"), button:has-text("New Account")').first();
    await addButton.click();

    // Fill in account details
    await page.fill('input[name="name"], input[placeholder*="Account name"]', 'Test Checking Account');

    // Select account type if dropdown exists
    const typeSelector = page.locator('select[name="type"], [role="combobox"]').first();
    if (await typeSelector.count() > 0) {
      await typeSelector.click();
      await page.click('text=ASSET');
    }

    // Select account kind
    const kindSelector = page.locator('select[name="kind"]').first();
    if (await kindSelector.count() > 0) {
      await kindSelector.selectOption('TRANSFER');
    }

    // Set opening balance
    const balanceInput = page.locator('input[name="openingBalance"], input[placeholder*="balance"]').first();
    if (await balanceInput.count() > 0) {
      await balanceInput.fill('1000');
    }

    // Save the account
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify account was created
    await expect(page.locator('text=Test Checking Account')).toBeVisible({ timeout: 10000 });
  });

  test('should create a new income category', async ({ page }) => {
    // Navigate to Categories tab
    await page.click('text=Categories');

    // Click add category button
    const addButton = page.locator('button:has-text("Add Category"), button:has-text("New Category")').first();
    await addButton.click();

    // Fill in category details
    await page.fill('input[name="name"], input[placeholder*="Category name"]', 'Consulting Income');

    // Select type (INCOME)
    const typeSelector = page.locator('select[name="type"]').first();
    if (await typeSelector.count() > 0) {
      await typeSelector.selectOption('INCOME');
    }

    // Save the category
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify category was created
    await expect(page.locator('text=Consulting Income')).toBeVisible({ timeout: 10000 });
  });

  test('should create a new expense category', async ({ page }) => {
    // Navigate to Categories tab
    await page.click('text=Categories');

    // Click add category button
    const addButton = page.locator('button:has-text("Add Category"), button:has-text("New Category")').first();
    await addButton.click();

    // Fill in category details
    await page.fill('input[name="name"], input[placeholder*="Category name"]', 'Office Supplies');

    // Select type (EXPENSE)
    const typeSelector = page.locator('select[name="type"]').first();
    if (await typeSelector.count() > 0) {
      await typeSelector.selectOption('EXPENSE');
    }

    // Mark as business expense
    const businessCheckbox = page.locator('input[type="checkbox"][name="isBusinessDefault"]').first();
    if (await businessCheckbox.count() > 0) {
      await businessCheckbox.check();
    }

    // Save the category
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify category was created
    await expect(page.locator('text=Office Supplies')).toBeVisible({ timeout: 10000 });
  });
});
