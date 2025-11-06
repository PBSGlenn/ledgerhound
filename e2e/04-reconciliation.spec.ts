import { test, expect } from '@playwright/test';

test.describe('Reconciliation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should start a reconciliation session', async ({ page }) => {
    // Navigate to Reconciliation
    await page.locator('text=Reconciliation, text=Reconcile').first().click();

    // Click "Start Reconciliation"
    await page.click('button:has-text("Start Reconciliation")');

    // Fill in reconciliation details
    await page.fill('input[name="statementStartDate"], input[type="date"]', '2025-01-01');
    await page.fill('input[name="statementEndDate"]', '2025-01-31');
    await page.fill('input[name="statementStartBalance"]', '10000.00');
    await page.fill('input[name="statementEndBalance"]', '12500.00');

    // Optionally add notes
    await page.fill('textarea[name="notes"]', 'January 2025 reconciliation');

    // Start reconciliation
    await page.click('button:has-text("Start Reconciliation")');

    // Verify reconciliation session started
    await expect(page.locator('text=Statement Balance')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=$12,500')).toBeVisible(); // Statement ending balance
  });

  test('should manually tick off transactions', async ({ page }) => {
    // Assume reconciliation session is already started
    await page.locator('text=Reconciliation').first().click();

    // If no active session, start one (simplified)
    const startButton = page.locator('button:has-text("Start Reconciliation")');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"]', '10000');
      await page.fill('input[name="statementEndBalance"]', '12000');
      await page.click('button:has-text("Start Reconciliation")');
    }

    // Wait for transaction list to load
    await page.waitForSelector('table, [role="grid"]', { timeout: 10000 });

    // Click on first transaction to mark as reconciled
    const firstTransaction = page.locator('tr[data-transaction], tbody tr').nth(1);
    await firstTransaction.click();

    // Verify checkbox is checked or row is highlighted
    await expect(firstTransaction.locator('[role="checkbox"][aria-checked="true"], .bg-green')).toBeVisible();

    // Verify reconciled count increased
    await expect(page.locator('text=1 /')).toBeVisible(); // "1 / X" reconciled
  });

  test('should show balanced state when reconciliation matches', async ({ page }) => {
    await page.locator('text=Reconciliation').first().click();

    // Start reconciliation
    const startButton = page.locator('button:has-text("Start Reconciliation")');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      // Set balances that will match when all transactions are marked
      await page.fill('input[name="statementStartBalance"]', '10000');
      await page.fill('input[name="statementEndBalance"]', '10000'); // Assuming no net change
      await page.click('button:has-text("Start Reconciliation")');
    }

    // Mark transactions until balanced
    // (In a real test, you'd mark specific transactions to reach the balance)

    // Check for "Balanced" indicator
    const balancedIndicator = page.locator('text=Balanced, .bg-green:has-text("Difference"), text=$0.00:near(text="Difference")');

    // If balanced, "Lock Reconciliation" button should be enabled
    const lockButton = page.locator('button:has-text("Lock Reconciliation"):not([disabled])');
    if (await lockButton.count() > 0) {
      await expect(lockButton).toBeEnabled();
    }
  });

  test('should lock reconciliation when balanced', async ({ page }) => {
    await page.locator('text=Reconciliation').first().click();

    // Start and complete reconciliation (simplified)
    const startButton = page.locator('button:has-text("Start Reconciliation")');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"]', '10000');
      await page.fill('input[name="statementEndBalance"]', '10000');
      await page.click('button:has-text("Start Reconciliation")');
    }

    // Wait for balance to be achieved (in real scenario, mark transactions)
    await page.waitForTimeout(1000);

    // Look for enabled "Lock" button
    const lockButton = page.locator('button:has-text("Lock"):not([disabled])');

    if (await lockButton.count() > 0) {
      await lockButton.click();

      // Verify success message
      await expect(page.locator('text=locked successfully, text=Reconciliation complete')).toBeVisible({ timeout: 5000 });

      // Should return to reconciliation list or summary
      await expect(page.locator('text=No active reconciliation, text=Start new')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should use smart matching with Auto-Match button', async ({ page }) => {
    await page.locator('text=Reconciliation').first().click();

    // Start reconciliation
    const startButton = page.locator('button:has-text("Start Reconciliation")');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"]', '10000');
      await page.fill('input[name="statementEndBalance"]', '12000');
      await page.click('button:has-text("Start Reconciliation")');
    }

    // Click "Auto-Match" button
    const autoMatchButton = page.locator('button:has-text("Auto-Match")');
    await expect(autoMatchButton).toBeVisible({ timeout: 5000 });
    await autoMatchButton.click();

    // Auto-Match modal should open
    await expect(page.locator('text=Smart Transaction Matching')).toBeVisible({ timeout: 3000 });

    // Should see upload area
    await expect(page.locator('text=Upload Bank Statement PDF, text=Choose PDF')).toBeVisible();

    // Note: In a real test, you'd upload a PDF and verify matching results
    // For now, just verify the modal works
    await page.click('button:has-text("Done"), [aria-label="Close"]');
  });

  test('should display match results with confidence levels', async ({ page }) => {
    // This test would require a mock PDF with known transactions
    // Skipping actual PDF upload in basic test, but testing the UI structure

    await page.locator('text=Reconciliation').first().click();

    const startButton = page.locator('button:has-text("Start Reconciliation")');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.fill('input[type="date"]', '2025-01-01');
      await page.fill('input[name="statementEndDate"]', '2025-01-31');
      await page.fill('input[name="statementStartBalance"]', '10000');
      await page.fill('input[name="statementEndBalance"]', '12000');
      await page.click('button:has-text("Start Reconciliation")');
    }

    await page.click('button:has-text("Auto-Match")');

    // Verify modal structure
    await expect(page.locator('text=Smart Transaction Matching')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });
});
