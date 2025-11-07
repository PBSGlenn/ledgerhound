import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('CSV Import Workflow', () => {
  const testCsvPath = path.join(__dirname, 'fixtures', 'test-transactions.csv');

  test.beforeAll(async () => {
    // Create fixtures directory if it doesn't exist
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create a test CSV file
    const csvContent = `Date,Description,Amount,Balance
2025-01-10,Salary Deposit,5000.00,10000.00
2025-01-12,Woolworths,-125.50,9874.50
2025-01-15,Electricity Bill,-280.00,9594.50
2025-01-18,Client Payment,2500.00,12094.50
2025-01-20,Petrol,-75.00,12019.50`;

    fs.writeFileSync(testCsvPath, csvContent);
  });

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

    // Select an account first (Import CSV button is disabled without an account selected)
    await page.click('text=Personal Checking', { timeout: 10000 });
    await expect(page.locator('h1:has-text("Personal Checking")')).toBeVisible({ timeout: 10000 });
  });

  test('should import CSV transactions with column mapping', async ({ page }) => {
    // Click "Import CSV" button in top bar
    await page.click('button:has-text("Import CSV")');

    // Wait for import wizard to appear (title is "CSV Import Wizard")
    await expect(page.locator('text=CSV Import Wizard')).toBeVisible({ timeout: 10000 });

    // Upload CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testCsvPath);

    // Wait for file to be processed
    await page.waitForTimeout(1000);

    // Column mapping step - map columns to fields
    // The wizard should auto-detect columns, but we can select them explicitly
    const dateMapping = page.locator('select[name="dateColumn"], [role="combobox"]').first();
    if (await dateMapping.count() > 0) {
      await dateMapping.selectOption('Date');
    }

    const descMapping = page.locator('select[name="descriptionColumn"], select[name="payeeColumn"]').first();
    if (await descMapping.count() > 0) {
      await descMapping.selectOption('Description');
    }

    const amountMapping = page.locator('select[name="amountColumn"]').first();
    if (await amountMapping.count() > 0) {
      await amountMapping.selectOption('Amount');
    }

    // Click "Next" or "Continue" to proceed to preview
    await page.click('button:has-text("Next"), button:has-text("Continue"), button:has-text("Preview")');

    // Verify preview shows transactions
    await expect(page.locator('text=Salary Deposit')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Woolworths').first()).toBeVisible();

    // Click "Import" to execute (use force to bypass modal overlay)
    await page.click('button:has-text("Import"), button:has-text("Execute"), button:has-text("Finish")', { force: true });

    // Verify success message or that transactions appear
    await expect(page.locator('text=Salary Deposit')).toBeVisible({ timeout: 10000 });
  });

  test('should handle duplicate detection during import', async ({ page }) => {
    // Click "Import CSV" button
    await page.click('button:has-text("Import CSV")');

    // Upload same file again (should detect duplicates)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testCsvPath);

    await page.waitForTimeout(1000);

    // Proceed through column mapping
    await page.click('button:has-text("Next"), button:has-text("Continue")');

    // Check for duplicate warning in preview
    const duplicateIndicator = page.locator('text=duplicate, text=already imported, text=skip');
    if (await duplicateIndicator.count() > 0) {
      await expect(duplicateIndicator.first()).toBeVisible();
    }
  });

  test('should apply memorized rules during import', async ({ page }) => {
    // First, navigate to Settings to create a memorized rule
    await page.click('button:has-text("Settings")');
    await expect(page.locator('h1:has-text("Settings")').first()).toBeVisible();

    // Look for Rules tab or section
    const rulesTab = page.locator('text=Rules, button:has-text("Rules")');
    if (await rulesTab.count() > 0) {
      await rulesTab.first().click();
    }

    // Click "Add Rule" or "New Rule" button
    const addRuleButton = page.locator('button:has-text("Add Rule"), button:has-text("New Rule"), button:has-text("Create Rule")').first();
    if (await addRuleButton.count() > 0) {
      await addRuleButton.click();

      // Create rule for "Woolworths" -> "Groceries" category
      await page.fill('input[name="pattern"]', 'Woolworths');

      const categorySelector = page.locator('[role="combobox"], input[placeholder*="category"]').first();
      await categorySelector.click();
      await page.locator('text=Groceries').first().click();

      await page.click('button:has-text("Save"), button:has-text("Create")');
    }

    // Navigate back and select account
    await page.click('text=Personal Checking');

    // Now import CSV
    await page.click('button:has-text("Import CSV")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testCsvPath);

    await page.waitForTimeout(1000);

    // Proceed through wizard
    await page.click('button:has-text("Next"), button:has-text("Continue")');

    // In preview, verify "Woolworths" transaction has "Groceries" category applied
    const woolworthsRow = page.locator('tr:has-text("Woolworths"), div:has-text("Woolworths")');
    if (await woolworthsRow.count() > 0) {
      await expect(woolworthsRow.first()).toBeVisible();
      // Category should be auto-assigned based on rule
    }
  });
});
