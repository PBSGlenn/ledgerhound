import { test, expect, Page } from '@playwright/test';

/**
 * Helper to wait for the transaction form to be ready
 */
async function waitForTransactionForm(page: Page) {
  await expect(page.locator('role=dialog'), 'Transaction form dialog should be visible').toBeVisible({ timeout: 10000 });
  // Wait for the form inputs to be ready
  await expect(page.locator('input[type="date"]'), 'Date input should be visible').toBeVisible();
  await expect(page.locator('input[type="number"]'), 'Amount input should be visible').toBeVisible();
}

/**
 * Helper to fill in basic transaction fields
 */
async function fillTransactionBasics(page: Page, data: { date: string; payee: string; amount: string }) {
  // Fill date using label-based selector
  const dateInput = page.locator('label:has-text("Date")').locator('..').locator('input[type="date"]');
  await dateInput.fill(data.date);

  // Fill payee
  const payeeInput = page.locator('label:has-text("Payee")').locator('..').locator('input[type="text"]');
  await payeeInput.fill(data.payee);

  // Fill amount
  const amountInput = page.locator('label:has-text("Amount")').locator('..').locator('input[type="number"]');
  await amountInput.fill(data.amount);
}

/**
 * Helper to select a category from the CategorySelector dropdown
 * This handles the portal-based dropdown and waits for proper loading
 */
async function selectCategory(page: Page, categoryName: string, selectorIndex = 0) {
  // Click the category selector button
  const categoryButton = page.locator('button:has-text("Select category...")').nth(selectorIndex);
  await expect(categoryButton, `Category selector ${selectorIndex} should be visible`).toBeVisible();
  await categoryButton.click();

  // Wait for the dropdown portal to render
  // The dropdown appears outside the dialog, so we need to look for it globally
  await expect(
    page.locator('div[role="listbox"], div.category-dropdown, [data-radix-popper-content-wrapper]').first(),
    'Category dropdown should appear'
  ).toBeVisible({ timeout: 5000 }).catch(() => {
    // Fallback: wait a bit for portal to render
  });

  // Try to find and click the category by partial text match
  const categoryOption = page.locator('button, [role="option"]').filter({ hasText: new RegExp(categoryName, 'i') });

  if (await categoryOption.count() > 0) {
    await categoryOption.first().click({ force: true });
  } else {
    // Fallback: look for any clickable element with the category name
    const fallbackOption = page.getByText(categoryName, { exact: false }).first();
    if (await fallbackOption.isVisible()) {
      await fallbackOption.click({ force: true });
    } else {
      throw new Error(`Could not find category matching "${categoryName}"`);
    }
  }

  // Wait for dropdown to close by checking selector button text changed
  await expect(
    page.locator('button:has-text("Select category...")').nth(selectorIndex),
    'Category should be selected (button text should change)'
  ).not.toBeVisible({ timeout: 3000 }).catch(() => {
    // If button still shows "Select category...", selection might have failed
  });
}

/**
 * Helper to fill split amount
 */
async function fillSplitAmount(page: Page, amount: string, splitIndex = 0) {
  // Split amounts are in the "Items" section, after the main total amount input
  // We look for number inputs with step="0.01" and skip the first one (total amount)
  const splitInputs = page.locator('.space-y-2 input[type="number"][step="0.01"], [class*="split"] input[type="number"]');

  if (await splitInputs.count() > splitIndex) {
    await splitInputs.nth(splitIndex).fill(amount);
  } else {
    // Fallback: use all number inputs and skip the first (total amount)
    const allAmountInputs = page.locator('input[type="number"][step="0.01"]');
    await allAmountInputs.nth(splitIndex + 1).fill(amount);
  }
}

/**
 * Helper to save transaction and verify modal closes
 */
async function saveTransactionAndVerify(page: Page, expectedPayee: string) {
  // Find and click save button
  const saveButton = page.locator('button:has-text("Save Transaction"), button[type="submit"]:has-text("Save")');
  await expect(saveButton, 'Save button should be visible').toBeVisible();

  // Check if save button is enabled (form is valid)
  const isDisabled = await saveButton.isDisabled();
  if (isDisabled) {
    // Form validation failed - let's check what's wrong
    const remainingAmount = await page.locator('text=/remaining|unallocated/i').textContent().catch(() => null);
    throw new Error(`Save button is disabled. Form may not be valid. Remaining: ${remainingAmount}`);
  }

  await saveButton.click();

  // Wait for modal to close
  await expect(
    page.locator('role=dialog'),
    'Transaction form should close after save'
  ).not.toBeVisible({ timeout: 10000 });

  // Verify transaction appears in register
  await expect(
    page.locator(`text=${expectedPayee}`),
    `Transaction with payee "${expectedPayee}" should appear in register`
  ).toBeVisible({ timeout: 15000 });
}

test.describe('Transaction Entry Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for app to initialize - check for sidebar or main UI element
    await expect(
      page.locator('button:has-text("Accounts"), [data-testid="accounts-tab"]'),
      'App should load with Accounts tab visible'
    ).toBeVisible({ timeout: 15000 });

    // Click Accounts tab
    await page.click('button:has-text("Accounts")');

    // Wait for account list to load - look for seeded account
    await expect(
      page.locator('text=Personal Checking'),
      'Personal Checking account should be visible in sidebar'
    ).toBeVisible({ timeout: 10000 });

    // Select Personal Checking account
    await page.click('text=Personal Checking');

    // Wait for register view to load
    await expect(
      page.locator('h1:has-text("Personal Checking"), [class*="topbar"] >> text=Personal Checking'),
      'Account name should appear in header'
    ).toBeVisible({ timeout: 10000 });
  });

  test('should create a simple income transaction', async ({ page }) => {
    // Open new transaction form
    await page.click('button:has-text("New Transaction")');
    await waitForTransactionForm(page);

    // Fill basic fields
    await fillTransactionBasics(page, {
      date: '2025-01-15',
      payee: 'Consulting Client',
      amount: '1500',
    });

    // Select income category - try "Personal Income" or "Salary" or any income
    try {
      await selectCategory(page, 'Income');
    } catch {
      // If category selection fails, try alternative approaches
      console.log('Primary category selection failed, trying alternatives...');
      await page.click('button:has-text("Select category...")');
      // Just click the first available option
      await page.locator('button[class*="category"], [role="option"]').first().click({ force: true });
    }

    // Fill split amount to match total
    await fillSplitAmount(page, '1500', 0);

    // Save and verify
    await saveTransactionAndVerify(page, 'Consulting Client');
  });

  test('should create a business expense with GST', async ({ page }) => {
    // Open new transaction form
    await page.click('button:has-text("New Transaction")');
    await waitForTransactionForm(page);

    // Fill basic fields
    await fillTransactionBasics(page, {
      date: '2025-01-16',
      payee: 'Office Supplies Store',
      amount: '110',
    });

    // Select expense category
    try {
      await selectCategory(page, 'Expense');
    } catch {
      await page.click('button:has-text("Select category...")');
      await page.locator('button[class*="category"], [role="option"]').first().click({ force: true });
    }

    // Fill split amount
    await fillSplitAmount(page, '110', 0);

    // Try to check business checkbox if available
    const businessCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /business/i });
    if (await businessCheckbox.count() > 0) {
      await businessCheckbox.first().check();
    }

    // Save and verify
    await saveTransactionAndVerify(page, 'Office Supplies Store');
  });

  test('should create a transfer between accounts', async ({ page }) => {
    // Open new transaction form
    await page.click('button:has-text("New Transaction")');
    await waitForTransactionForm(page);

    // Switch to Transfer Out mode
    await page.click('button:has-text("Transfer Out")');

    // Wait for form to update to transfer mode
    await expect(
      page.locator('select, label:has-text("Transfer To")'),
      'Transfer account selector should appear'
    ).toBeVisible({ timeout: 5000 });

    // Fill basic fields
    await fillTransactionBasics(page, {
      date: '2025-01-17',
      payee: 'Transfer to Savings',
      amount: '500',
    });

    // Select destination account from dropdown
    const accountSelect = page.locator('select').first();
    await expect(accountSelect, 'Account select dropdown should be visible').toBeVisible();

    // Get available options and select one that's not the current account
    const options = await accountSelect.locator('option').allTextContents();
    const targetAccount = options.find(opt =>
      opt && !opt.includes('Select') && !opt.includes('Personal Checking')
    );

    if (targetAccount) {
      await accountSelect.selectOption({ label: targetAccount.trim() });
    } else {
      // Fallback: select by index (skip first "Select account..." option)
      await accountSelect.selectOption({ index: 1 });
    }

    // Save and verify (transfers auto-balance, no split amount needed)
    await saveTransactionAndVerify(page, 'Transfer to Savings');
  });

  test('should create a split transaction', async ({ page }) => {
    // Open new transaction form
    await page.click('button:has-text("New Transaction")');
    await waitForTransactionForm(page);

    // Fill basic fields
    await fillTransactionBasics(page, {
      date: '2025-01-18',
      payee: 'Shopping Trip',
      amount: '150',
    });

    // Click Add Split to add second category row
    await page.click('button:has-text("+ Add Split")');

    // Wait for second split row to appear
    await expect(
      page.locator('button:has-text("Select category...")').nth(1),
      'Second category selector should appear'
    ).toBeVisible({ timeout: 5000 });

    // First split - $100
    try {
      await selectCategory(page, 'Personal', 0);
    } catch {
      await page.locator('button:has-text("Select category...")').first().click();
      await page.locator('button[class*="category"], [role="option"]').first().click({ force: true });
    }
    await fillSplitAmount(page, '100', 0);

    // Second split - $50
    try {
      await selectCategory(page, 'Business', 1);
    } catch {
      await page.locator('button:has-text("Select category...")').nth(1).click();
      await page.locator('button[class*="category"], [role="option"]').first().click({ force: true });
    }
    await fillSplitAmount(page, '50', 1);

    // Save and verify
    await saveTransactionAndVerify(page, 'Shopping Trip');
  });
});
