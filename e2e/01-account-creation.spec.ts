import { test, expect } from '@playwright/test';

test.describe('Account Creation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load (using 'load' instead of 'networkidle' due to continuous polling)
    await page.waitForLoadState('load');
    // Give the app a moment to initialize
    await page.waitForTimeout(1000);
  });

  test('should create a new bank account', async ({ page }) => {
    // Click on "Accounts" tab in sidebar (should be selected by default)
    await page.click('button:has-text("Accounts")');

    // Click "Add Account" button at the bottom of sidebar
    await page.click('button:has-text("Add Account")');

    // Wait for the Account Setup Wizard dialog to appear
    await expect(page.locator('text=Add Accounts')).toBeVisible();

    // Banking tab should be selected by default, but click it to be sure
    await page.click('button:has-text("Banking")');

    // Click on "Checking Account" template
    await page.click('text=Checking Account');

    // Click "Next: Customize" button
    await page.click('button:has-text("Next: Customize")');

    // Fill in account name (using label-based selector since input has no name attribute)
    const accountNameInput = page.locator('label:has-text("Account Name")').locator('..').locator('input');
    await accountNameInput.fill('Test Checking Account');

    // Fill in opening balance (using label-based selector)
    const openingBalanceInput = page.locator('label:has-text("Opening Balance")').locator('..').locator('input');
    await openingBalanceInput.fill('1000');

    // Click "Create 1 Account" button (button text is dynamic based on count)
    await page.click('button:has-text("Create 1 Account")');

    // Wait for wizard to close and account list to refresh
    await page.waitForTimeout(2000);

    // Make sure we're on the Accounts tab
    await page.click('button:has-text("Accounts")');

    // Wait a moment for the sidebar to update
    await page.waitForTimeout(1000);

    // Verify account was created - check for partial match since sidebar might truncate names
    await expect(page.locator(':text("Test Checking")')).toBeVisible({ timeout: 15000 });
  });

  test('should create a new income category', async ({ page }) => {
    // Navigate to Categories tab
    await page.click('button:has-text("Categories")');

    // Right-click on "Personal Income" parent node to add a subcategory
    await page.click('text=Personal Income', { button: 'right' });

    // Look for "Add Subcategory" in context menu
    await page.click('text=Add Subcategory');

    // Fill in category name (using label-based selector)
    const categoryNameInput = page.locator('label:has-text("Category Name"), label:has-text("Name")').locator('..').locator('input').first();
    await categoryNameInput.fill('Consulting Income');

    // Save the category
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify category was created
    await expect(page.locator('text=Consulting Income')).toBeVisible({ timeout: 10000 });
  });

  test('should create a new expense category', async ({ page }) => {
    // Navigate to Categories tab
    await page.click('button:has-text("Categories")');

    // Right-click on "Personal Expenses" parent node
    await page.click('text=Personal Expenses', { button: 'right' });

    // Click "Add Subcategory" in context menu
    await page.click('text=Add Subcategory');

    // Fill in category name (using label-based selector)
    const categoryNameInput = page.locator('label:has-text("Category Name"), label:has-text("Name")').locator('..').locator('input').first();
    await categoryNameInput.fill('Office Supplies');

    // Mark as business expense if checkbox exists
    const businessCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /business|Business|GST/ });
    if (await businessCheckbox.count() > 0) {
      await businessCheckbox.first().check();
    }

    // Save the category
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify category was created
    await expect(page.locator('text=Office Supplies')).toBeVisible({ timeout: 10000 });
  });
});
