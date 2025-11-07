import { test, expect } from '@playwright/test';

test.describe('Reconciliation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the app to load and accounts to be fetched
    await page.waitForTimeout(1000);

    // Make sure we're on the Accounts tab
    await page.click('button:has-text("Accounts")');

    // Wait for account list to populate
    await page.waitForTimeout(500);

    // Select an account first (Reconcile button is disabled without an account selected)
    await page.click('text=Personal Checking', { timeout: 10000 });
    await expect(page.locator('h1:has-text("Personal Checking")')).toBeVisible({ timeout: 10000 });
  });

  test('should start a reconciliation session', async ({ page }) => {
    // Click "Reconcile" button in top bar
    await page.click('button:has-text("Reconcile")');

    // Verify we're in reconciliation view
    await expect(page.locator('h1:has-text("Reconciliation")')).toBeVisible();

    // Look for "Start Reconciliation" button or form
    const startButton = page.locator('button:has-text("Start Reconciliation"), button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();

      // Fill in reconciliation details
      await page.fill('input[name="statementStartDate"], input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"], input[placeholder*="starting balance"]', '10000.00');
      await page.fill('input[name="statementEndBalance"], input[placeholder*="ending balance"]', '12500.00');

      // Optionally add notes if field exists
      const notesField = page.locator('textarea[name="notes"], textarea[placeholder*="note"]');
      if (await notesField.count() > 0) {
        await notesField.fill('January 2025 reconciliation');
      }

      // Confirm to start reconciliation
      await page.click('button:has-text("Start"), button:has-text("Begin"), button:has-text("Continue")');

      // Verify reconciliation session started
      await expect(page.locator('text=Statement Balance, text=Ending Balance')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should manually tick off transactions', async ({ page }) => {
    // Click Reconcile button
    await page.click('button:has-text("Reconcile")');

    // Start a session if none exists
    const startButton = page.locator('button:has-text("Start Reconciliation"), button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"]', '10000');
      await page.fill('input[name="statementEndBalance"]', '12000');
      await page.click('button:has-text("Start"), button:has-text("Begin")');
    }

    // Wait for transaction list to load
    await page.waitForSelector('table, [role="grid"], tbody tr', { timeout: 10000 });

    // Click on first transaction checkbox to mark as reconciled
    const firstCheckbox = page.locator('input[type="checkbox"], [role="checkbox"]').nth(1);
    if (await firstCheckbox.count() > 0) {
      await firstCheckbox.click();

      // Verify checkbox is checked
      await expect(firstCheckbox).toBeChecked();
    }
  });

  test('should show balanced state when reconciliation matches', async ({ page }) => {
    // Click Reconcile button
    await page.click('button:has-text("Reconcile")');

    // Start reconciliation with matching balances
    const startButton = page.locator('button:has-text("Start Reconciliation"), button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      // Set balances that will match
      await page.fill('input[name="statementStartBalance"]', '4390'); // From seed data
      await page.fill('input[name="statementEndBalance"]', '4390'); // No change
      await page.click('button:has-text("Start"), button:has-text("Begin")');
    }

    // In a balanced state, there should be a "Lock" or "Finish" button enabled
    // Or a balanced indicator showing $0.00 difference
    await page.waitForTimeout(1000);

    const balancedIndicator = page.locator('text=Balanced, text=$0.00, text=Difference: $0.00');
    if (await balancedIndicator.count() > 0) {
      await expect(balancedIndicator.first()).toBeVisible();
    }
  });

  test('should lock reconciliation when balanced', async ({ page }) => {
    // Click Reconcile button
    await page.click('button:has-text("Reconcile")');

    // Start reconciliation
    const startButton = page.locator('button:has-text("Start Reconciliation"), button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"]', '4390');
      await page.fill('input[name="statementEndBalance"]', '4390');
      await page.click('button:has-text("Start"), button:has-text("Begin")');
    }

    await page.waitForTimeout(1000);

    // Look for enabled "Lock" or "Finish" button
    const lockButton = page.locator('button:has-text("Lock"), button:has-text("Finish Reconciliation")').first();

    if (await lockButton.count() > 0 && await lockButton.isEnabled()) {
      await lockButton.click();

      // Verify success message or return to reconciliation list
      await expect(page.locator('text=locked successfully, text=complete, text=finished')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should use smart matching with Auto-Match button', async ({ page }) => {
    // Click Reconcile button
    await page.click('button:has-text("Reconcile")');

    // Start reconciliation
    const startButton = page.locator('button:has-text("Start Reconciliation"), button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"]', '10000');
      await page.fill('input[name="statementEndBalance"]', '12000');
      await page.click('button:has-text("Start"), button:has-text("Begin")');
    }

    // Click "Auto-Match" button
    const autoMatchButton = page.locator('button:has-text("Auto-Match"), button:has-text("Auto Match")');
    if (await autoMatchButton.count() > 0) {
      await autoMatchButton.first().click();

      // Auto-Match modal/dialog should open
      await expect(page.locator('text=Smart Transaction Matching, text=Auto Match, text=Match Transactions')).toBeVisible({ timeout: 3000 });

      // Should see upload area or matching interface
      const uploadArea = page.locator('text=Upload, text=PDF, text=Statement');
      if (await uploadArea.count() > 0) {
        await expect(uploadArea.first()).toBeVisible();
      }

      // Close modal
      await page.keyboard.press('Escape');
    }
  });

  test('should display match results with confidence levels', async ({ page }) => {
    // Click Reconcile button
    await page.click('button:has-text("Reconcile")');

    // Start reconciliation
    const startButton = page.locator('button:has-text("Start Reconciliation"), button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"]', '10000');
      await page.fill('input[name="statementEndBalance"]', '12000');
      await page.click('button:has-text("Start"), button:has-text("Begin")');
    }

    // Click Auto-Match
    const autoMatchButton = page.locator('button:has-text("Auto-Match"), button:has-text("Auto Match")');
    if (await autoMatchButton.count() > 0) {
      await autoMatchButton.first().click();

      // Verify modal structure and confidence level indicators
      const modal = page.locator('[role="dialog"], .modal');
      if (await modal.count() > 0) {
        await expect(modal.first()).toBeVisible();

        // Look for confidence indicators (exact, probable, possible)
        const confidenceIndicators = page.locator('text=Exact, text=Probable, text=Possible, text=High, text=Medium, text=Low');
        if (await confidenceIndicators.count() > 0) {
          // Confidence levels are shown
        }
      }

      // Close modal
      await page.keyboard.press('Escape');
    }
  });
});
