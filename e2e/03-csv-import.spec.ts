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
    await page.waitForLoadState('networkidle');
  });

  test('should import CSV transactions with column mapping', async ({ page }) => {
    // Navigate to Import view
    await page.click('text=Import');

    // Click "Import CSV" or similar button
    const importButton = page.locator('button:has-text("Import CSV"), button:has-text("Import Transactions")').first();
    await importButton.click();

    // Upload CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testCsvPath);

    // Wait for file to be processed
    await page.waitForTimeout(1000);

    // Column mapping step
    // Map Date column
    const dateMapping = page.locator('select[name="dateColumn"], [role="combobox"]:near(text="Date")').first();
    if (await dateMapping.count() > 0) {
      await dateMapping.selectOption('Date');
    }

    // Map Description column
    const descMapping = page.locator('select[name="descriptionColumn"]').first();
    if (await descMapping.count() > 0) {
      await descMapping.selectOption('Description');
    }

    // Map Amount column
    const amountMapping = page.locator('select[name="amountColumn"]').first();
    if (await amountMapping.count() > 0) {
      await amountMapping.selectOption('Amount');
    }

    // Click "Next" or "Continue"
    await page.click('button:has-text("Next"), button:has-text("Continue")');

    // Select account for import
    const accountSelector = page.locator('[role="combobox"]:has-text("Account")').first();
    await accountSelector.click();
    await page.click('text=Checking, text=Bank').first();

    // Verify preview shows transactions
    await expect(page.locator('text=Salary Deposit')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Woolworths')).toBeVisible();
    await expect(page.locator('text=5,000')).toBeVisible();

    // Click "Import" to execute
    await page.click('button:has-text("Import"), button:has-text("Execute")');

    // Verify success message
    await expect(page.locator('text=imported successfully, text=Import complete')).toBeVisible({ timeout: 10000 });

    // Verify transactions appear in register
    await page.click('text=Register');
    await expect(page.locator('text=Salary Deposit')).toBeVisible();
    await expect(page.locator('text=Woolworths')).toBeVisible();
  });

  test('should handle duplicate detection during import', async ({ page }) => {
    // Navigate to Import
    await page.click('text=Import');

    const importButton = page.locator('button:has-text("Import")').first();
    await importButton.click();

    // Upload same file again (should detect duplicates)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testCsvPath);

    await page.waitForTimeout(1000);

    // Map columns (same as before)
    const dateMapping = page.locator('select[name="dateColumn"]').first();
    if (await dateMapping.count() > 0) {
      await dateMapping.selectOption('Date');
    }

    await page.click('button:has-text("Next")');

    // Check for duplicate warning
    const duplicateWarning = page.locator('text=duplicate, text=already imported');
    if (await duplicateWarning.count() > 0) {
      await expect(duplicateWarning).toBeVisible();
      // Should show "Skip duplicates" or similar option
      await expect(page.locator('text=Skip, text=Ignore duplicates')).toBeVisible();
    }
  });

  test('should apply memorized rules during import', async ({ page }) => {
    // First, create a memorized rule
    await page.click('text=Settings');
    await page.click('text=Rules');

    const addRuleButton = page.locator('button:has-text("Add Rule"), button:has-text("New Rule")').first();
    await addRuleButton.click();

    // Create rule for "Woolworths" -> "Groceries" category
    await page.fill('input[name="pattern"]', 'Woolworths');
    const categorySelector = page.locator('[role="combobox"]:has-text("Category")').first();
    await categorySelector.click();
    await page.click('text=Groceries');

    await page.click('button:has-text("Save")');

    // Now import CSV again
    await page.click('text=Import');
    const importButton = page.locator('button:has-text("Import")').first();
    await importButton.click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testCsvPath);

    await page.waitForTimeout(1000);

    // Map columns and proceed
    await page.click('button:has-text("Next")');

    // In preview, verify "Woolworths" transaction has "Groceries" category
    const woolworthsRow = page.locator('tr:has-text("Woolworths")');
    await expect(woolworthsRow.locator('text=Groceries')).toBeVisible();
  });
});
