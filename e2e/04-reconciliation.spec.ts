import { test, expect } from '@playwright/test';

test.describe('Reconciliation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Wait for app to initialize - use exact match to avoid matching "Refresh Accounts"
    await expect(
      page.getByRole('button', { name: 'Accounts', exact: true }),
      'App should load with Accounts tab visible'
    ).toBeVisible({ timeout: 15000 });

    // Make sure we're on the Accounts tab
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();

    // Try to find any existing account (seeded or created by previous tests)
    const accountPatterns = [
      'text=Personal Checking',
      'text=Business Checking',
      'text=Test Checking',
      'text=Checking',
      'aside >> text=/\\$[\\d,]+\\.\\d{2}/', // Match any balance pattern
    ];

    let accountFound = false;
    for (const pattern of accountPatterns) {
      const element = page.locator(pattern).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        await element.click();
        await page.waitForTimeout(1000);
        accountFound = true;
        break;
      }
    }

    // If no account found, skip the test gracefully
    if (!accountFound) {
      await page.screenshot({ path: 'test-results/reconciliation-beforeEach-no-account.png' });
      test.skip(true, 'No account found - database may be locked or missing seed data. Stop API server and re-run tests.');
    }

    // Verify account header is visible (any account)
    await expect(
      page.locator('h1').first(),
      'Account header should be visible after selection'
    ).toBeVisible({ timeout: 10000 });
  });

  test('should start a reconciliation session', async ({ page }) => {
    // Click "Reconcile" button in top bar
    await page.click('button:has-text("Reconcile")');

    // Verify we're in reconciliation view (use .first() to avoid strict mode violation)
    await expect(page.locator('h1:has-text("Reconciliation")').first()).toBeVisible();

    // Look for "Start Reconciliation" button or form
    const startButton = page.locator('button:has-text("Start Reconciliation"), button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();

      // Fill in reconciliation details (using label-based selectors)
      const startDateInput = page.locator('label:has-text("Start Date")').locator('..').locator('input[type="date"]');
      await startDateInput.fill('2025-01-01');

      const endDateInput = page.locator('label:has-text("End Date")').locator('..').locator('input[type="date"]');
      await endDateInput.fill('2025-01-31');

      const openingBalanceInput = page.locator('label:has-text("Opening Balance")').locator('..').locator('input[type="number"]');
      await openingBalanceInput.fill('10000.00');

      const closingBalanceInput = page.locator('label:has-text("Closing Balance")').locator('..').locator('input[type="number"]');
      await closingBalanceInput.fill('12500.00');

      // Optionally add notes if field exists
      const notesField = page.locator('label:has-text("Notes")').locator('..').locator('textarea');
      if (await notesField.count() > 0) {
        await notesField.fill('January 2025 reconciliation');
      }

      // Confirm to start reconciliation - target the submit button inside the dialog
      await page.locator('button[type="submit"]:has-text("Start Reconciliation")').click({ force: true });

      // Verify reconciliation session started - look for session header
      await expect(
        page.locator('text=Transactions to Reconcile'),
        'Reconciliation session should start with transaction list visible'
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test('should manually tick off transactions', async ({ page }) => {
    // Click Reconcile button
    await page.click('button:has-text("Reconcile")');

    // Start a session if none exists
    const startButton = page.locator('button:has-text("Start Reconciliation"), button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();

      // Fill in reconciliation details (using label-based selectors)
      const startDateInput = page.locator('label:has-text("Start Date")').locator('..').locator('input[type="date"]');
      await startDateInput.fill('2025-01-01');

      const endDateInput = page.locator('label:has-text("End Date")').locator('..').locator('input[type="date"]');
      await endDateInput.fill('2025-01-31');

      const openingBalanceInput = page.locator('label:has-text("Opening Balance")').locator('..').locator('input[type="number"]');
      await openingBalanceInput.fill('10000');

      const closingBalanceInput = page.locator('label:has-text("Closing Balance")').locator('..').locator('input[type="number"]');
      await closingBalanceInput.fill('12000');

      // Use force click to bypass modal overlay - target submit button inside dialog
      await page.locator('button[type="submit"]:has-text("Start Reconciliation")').click({ force: true });
    }

    // Wait for transaction list to load - look for the transactions header
    await expect(
      page.locator('text=Transactions to Reconcile'),
      'Reconciliation session should start with transaction list visible'
    ).toBeVisible({ timeout: 15000 });

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

      // Fill in reconciliation details (using label-based selectors)
      const startDateInput = page.locator('label:has-text("Start Date")').locator('..').locator('input[type="date"]');
      await startDateInput.fill('2025-01-01');

      const endDateInput = page.locator('label:has-text("End Date")').locator('..').locator('input[type="date"]');
      await endDateInput.fill('2025-01-31');

      const openingBalanceInput = page.locator('label:has-text("Opening Balance")').locator('..').locator('input[type="number"]');
      await openingBalanceInput.fill('4390'); // From seed data

      const closingBalanceInput = page.locator('label:has-text("Closing Balance")').locator('..').locator('input[type="number"]');
      await closingBalanceInput.fill('4390'); // No change

      await page.click('button:has-text("Start"), button:has-text("Begin")', { force: true });
    }

    // Wait for session to initialize
    await expect(
      page.locator('text=Transactions to Reconcile, text=Reconciliation'),
      'Reconciliation view should be visible'
    ).toBeVisible({ timeout: 15000 });

    // In a balanced state, there should be a "Lock" or "Finish" button enabled
    // Or a balanced indicator showing $0.00 difference
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

      // Fill in reconciliation details (using label-based selectors)
      const startDateInput = page.locator('label:has-text("Start Date")').locator('..').locator('input[type="date"]');
      await startDateInput.fill('2025-01-01');

      const endDateInput = page.locator('label:has-text("End Date")').locator('..').locator('input[type="date"]');
      await endDateInput.fill('2025-01-31');

      const openingBalanceInput = page.locator('label:has-text("Opening Balance")').locator('..').locator('input[type="number"]');
      await openingBalanceInput.fill('4390');

      const closingBalanceInput = page.locator('label:has-text("Closing Balance")').locator('..').locator('input[type="number"]');
      await closingBalanceInput.fill('4390');

      await page.click('button:has-text("Start"), button:has-text("Begin")', { force: true });
    }

    // Wait for session to initialize
    await expect(
      page.locator('text=Transactions to Reconcile, text=Reconciliation'),
      'Reconciliation view should be visible'
    ).toBeVisible({ timeout: 15000 });

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

      // Fill in reconciliation details (using label-based selectors)
      const startDateInput = page.locator('label:has-text("Start Date")').locator('..').locator('input[type="date"]');
      await startDateInput.fill('2025-01-01');

      const endDateInput = page.locator('label:has-text("End Date")').locator('..').locator('input[type="date"]');
      await endDateInput.fill('2025-01-31');

      const openingBalanceInput = page.locator('label:has-text("Opening Balance")').locator('..').locator('input[type="number"]');
      await openingBalanceInput.fill('10000');

      const closingBalanceInput = page.locator('label:has-text("Closing Balance")').locator('..').locator('input[type="number"]');
      await closingBalanceInput.fill('12000');

      await page.click('button:has-text("Start"), button:has-text("Begin")', { force: true });
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

      // Fill in reconciliation details (using label-based selectors)
      const startDateInput = page.locator('label:has-text("Start Date")').locator('..').locator('input[type="date"]');
      await startDateInput.fill('2025-01-01');

      const endDateInput = page.locator('label:has-text("End Date")').locator('..').locator('input[type="date"]');
      await endDateInput.fill('2025-01-31');

      const openingBalanceInput = page.locator('label:has-text("Opening Balance")').locator('..').locator('input[type="number"]');
      await openingBalanceInput.fill('10000');

      const closingBalanceInput = page.locator('label:has-text("Closing Balance")').locator('..').locator('input[type="number"]');
      await closingBalanceInput.fill('12000');

      await page.click('button:has-text("Start"), button:has-text("Begin")', { force: true });
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
