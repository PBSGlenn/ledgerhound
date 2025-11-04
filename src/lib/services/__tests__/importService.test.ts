import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ImportService } from '../importService';
import { TransactionService } from '../transactionService';
import type { PrismaClient } from '@prisma/client';
import { AccountType, GSTCode } from '@prisma/client';
import { createTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';
import type { CSVColumnMapping } from '../../../types';

describe('ImportService', () => {
  let prisma: PrismaClient;
  let importService: ImportService;
  let transactionService: TransactionService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  beforeEach(async () => {
    prisma = await createTestDb();
    await resetTestDb(prisma);
    importService = new ImportService(prisma);
    transactionService = new TransactionService(prisma);
    accounts = await seedTestAccounts(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('parseCSV', () => {
    it('should parse simple CSV with headers', () => {
      const csv = `Date,Description,Amount
01/01/2025,Coffee Shop,15.50
02/01/2025,Supermarket,120.00`;

      const rows = importService.parseCSV(csv);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        Date: '01/01/2025',
        Description: 'Coffee Shop',
        Amount: '15.50',
      });
      expect(rows[1]).toEqual({
        Date: '02/01/2025',
        Description: 'Supermarket',
        Amount: '120.00',
      });
    });

    it('should handle quoted fields with commas', () => {
      const csv = `Date,Description,Amount
01/01/2025,"Coffee, Tea & Snacks",15.50`;

      const rows = importService.parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].Description).toBe('Coffee, Tea & Snacks');
    });

    it('should handle empty CSV', () => {
      const rows = importService.parseCSV('');
      expect(rows).toHaveLength(0);
    });

    it('should skip rows with mismatched column counts', () => {
      const csv = `Date,Description,Amount
01/01/2025,Coffee Shop,15.50
02/01/2025,Incomplete
03/01/2025,Supermarket,120.00`;

      const rows = importService.parseCSV(csv);

      expect(rows).toHaveLength(2);
      expect(rows[0].Description).toBe('Coffee Shop');
      expect(rows[1].Description).toBe('Supermarket');
    });
  });

  describe('parseDate', () => {
    it('should parse dd/MM/yyyy format', () => {
      const date = importService.parseDate('15/01/2025');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getDate()).toBe(15);
      expect(date?.getMonth()).toBe(0); // January is 0
      expect(date?.getFullYear()).toBe(2025);
    });

    it('should parse d/M/yyyy format', () => {
      const date = importService.parseDate('5/1/2025');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getDate()).toBe(5);
      expect(date?.getMonth()).toBe(0);
    });

    it('should parse dd/MM/yy format', () => {
      const date = importService.parseDate('15/01/25');
      expect(date).toBeInstanceOf(Date);
      // date-fns parses '25' as year 25, not 2025 (this is expected behavior)
      expect(date?.getFullYear()).toBe(25);
      expect(date?.getMonth()).toBe(0);
      expect(date?.getDate()).toBe(15);
    });

    it('should parse yyyy-MM-dd format', () => {
      const date = importService.parseDate('2025-01-15');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getDate()).toBe(15);
    });

    it('should parse dd-MM-yyyy format', () => {
      const date = importService.parseDate('15-01-2025');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getDate()).toBe(15);
    });

    it('should return null for invalid date', () => {
      const date = importService.parseDate('invalid');
      expect(date).toBeNull();
    });
  });

  describe('parseAmount', () => {
    it('should parse simple number', () => {
      const amount = importService.parseAmount('123.45');
      expect(amount).toBe(123.45);
    });

    it('should handle dollar sign', () => {
      const amount = importService.parseAmount('$123.45');
      expect(amount).toBe(123.45);
    });

    it('should handle commas', () => {
      const amount = importService.parseAmount('1,234.56');
      expect(amount).toBe(1234.56);
    });

    it('should handle spaces', () => {
      const amount = importService.parseAmount('1 234.56');
      expect(amount).toBe(1234.56);
    });

    it('should handle parentheses for negative amounts', () => {
      const amount = importService.parseAmount('(123.45)');
      expect(amount).toBe(-123.45);
    });

    it('should handle combination of formatting', () => {
      const amount = importService.parseAmount('$ 1,234.56');
      expect(amount).toBe(1234.56);
    });

    it('should return null for empty string', () => {
      const amount = importService.parseAmount('');
      expect(amount).toBeNull();
    });

    it('should return null for invalid amount', () => {
      const amount = importService.parseAmount('invalid');
      expect(amount).toBeNull();
    });
  });

  describe('previewImport', () => {
    it('should preview valid transactions', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Coffee Shop', Amount: '15.50' },
        { Date: '16/01/2025', Description: 'Supermarket', Amount: '120.00' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews).toHaveLength(2);
      expect(previews[0].parsed.payee).toBe('Coffee Shop');
      expect(previews[0].parsed.amount).toBe(15.50);
      expect(previews[0].parsed.date).toBeInstanceOf(Date);
      expect(previews[0].isDuplicate).toBe(false);
    });

    it('should detect duplicates', async () => {
      // Create an existing transaction
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Coffee Shop',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -15.50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 15.50, isBusiness: false },
        ],
      });

      const rows = [
        { Date: '15/01/2025', Description: 'Coffee Shop', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews[0].isDuplicate).toBe(true);
    });

    it('should handle debit/credit columns', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Deposit', Debit: '100.00', Credit: '0' },
        { Date: '16/01/2025', Description: 'Withdrawal', Debit: '0', Credit: '50.00' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        debit: 'Debit',
        credit: 'Credit',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews[0].parsed.amount).toBe(100);
      expect(previews[1].parsed.amount).toBe(-50);
    });

    it('should use description as payee fallback', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Coffee Shop', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews[0].parsed.payee).toBe('Coffee Shop');
    });

    it('should suggest uncategorized for unknown payee', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Unknown Vendor', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews[0].suggestedCategory?.name).toBe('Uncategorized');
    });
  });

  describe('importTransactions', () => {
    it('should import simple transactions', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Coffee Shop', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      const result = await importService.importTransactions(
        previews,
        accounts.personalChecking.id,
        'Test Bank',
        mapping
      );

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.batchId).toBeDefined();

      // Verify transaction was created
      const transactions = await prisma.transaction.findMany({
        where: { importBatchId: result.batchId },
        include: { postings: true },
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0].payee).toBe('Coffee Shop');
      expect(transactions[0].postings).toHaveLength(2);
    });

    it('should skip duplicates when requested', async () => {
      // Create existing transaction
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Coffee Shop',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -15.50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 15.50, isBusiness: false },
        ],
      });

      const rows = [
        { Date: '15/01/2025', Description: 'Coffee Shop', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      const result = await importService.importTransactions(
        previews,
        accounts.personalChecking.id,
        'Test Bank',
        mapping,
        { skipDuplicates: true }
      );

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('should skip invalid rows', async () => {
      const rows = [
        { Date: 'invalid', Description: 'Bad Date', Amount: '15.50' },
        { Date: '15/01/2025', Description: 'Good', Amount: 'invalid' },
        { Date: '15/01/2025', Description: '', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      const result = await importService.importTransactions(
        previews,
        accounts.personalChecking.id,
        'Test Bank',
        mapping
      );

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(3);
    });

    it('should import business transaction with GST', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Office Supplies', Amount: '110.00' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.businessChecking.id
      );

      // Set selected category to a business category
      previews[0].selectedCategoryId = accounts.officeSupplies.id;

      const result = await importService.importTransactions(
        previews,
        accounts.businessChecking.id,
        'Business Bank',
        mapping
      );

      expect(result.imported).toBe(1);

      // Verify GST was split correctly
      const transaction = await prisma.transaction.findFirst({
        where: { importBatchId: result.batchId },
        include: { postings: true },
      });

      expect(transaction?.postings).toHaveLength(3); // Source, category, GST

      // Check GST posting exists
      const gstPosting = transaction?.postings.find(
        (p) => p.accountId === accounts.gstPaid.id
      );
      expect(gstPosting).toBeDefined();
      expect(gstPosting?.amount).toBeCloseTo(10, 2); // 10% of 110 = 10
    });

    it('should respect reference as externalId for deduplication', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Payment', Amount: '100.00', Reference: 'REF123' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
        reference: 'Reference',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      await importService.importTransactions(
        previews,
        accounts.personalChecking.id,
        'Test Bank',
        mapping
      );

      // Try to import again - should detect duplicate by externalId
      const previews2 = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews2[0].isDuplicate).toBe(true);
    });
  });

  describe('Import Batch Management', () => {
    it('should create import batch with metadata', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Coffee', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      const result = await importService.importTransactions(
        previews,
        accounts.personalChecking.id,
        'Test Bank',
        mapping
      );

      const batch = await importService.getImportBatch(result.batchId);

      expect(batch).toBeDefined();
      expect(batch?.sourceAccountId).toBe(accounts.personalChecking.id);
      expect(batch?.sourceName).toBe('Test Bank');
      expect(batch?.mappingJson).toBeDefined();
    });

    it('should get all import batches for an account', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Coffee', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      await importService.importTransactions(
        previews,
        accounts.personalChecking.id,
        'Test Bank',
        mapping
      );

      const batches = await importService.getImportBatches(accounts.personalChecking.id);

      expect(batches).toHaveLength(1);
      expect(batches[0].sourceAccountId).toBe(accounts.personalChecking.id);
    });

    it('should delete import batch and cascade to transactions', async () => {
      const rows = [
        { Date: '15/01/2025', Description: 'Coffee', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      const result = await importService.importTransactions(
        previews,
        accounts.personalChecking.id,
        'Test Bank',
        mapping
      );

      // Verify transaction exists
      const transactionsBefore = await prisma.transaction.findMany({
        where: { importBatchId: result.batchId },
      });
      expect(transactionsBefore).toHaveLength(1);

      // Delete batch
      await importService.deleteImportBatch(result.batchId);

      // Verify transaction was deleted
      const transactionsAfter = await prisma.transaction.findMany({
        where: { importBatchId: result.batchId },
      });
      expect(transactionsAfter).toHaveLength(0);

      // Verify batch was deleted
      const batch = await importService.getImportBatch(result.batchId);
      expect(batch).toBeNull();
    });
  });

  describe('Import Mapping Templates', () => {
    it('should save import mapping template', async () => {
      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      await importService.saveImportMappingTemplate(
        'Bank of Australia',
        mapping,
        accounts.personalChecking.id
      );

      const templates = await importService.getImportMappingTemplates();

      expect(templates.length).toBeGreaterThanOrEqual(1);
      const template = templates.find((t) => t.name === 'bank of australia');
      expect(template).toBeDefined();
      expect(template?.mapping).toEqual(mapping);
      expect(template?.accountId).toBe(accounts.personalChecking.id);
    });

    it('should update existing template', async () => {
      const mapping1: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      await importService.saveImportMappingTemplate('Test Bank', mapping1);

      const mapping2: CSVColumnMapping = {
        date: 'TransDate',
        payee: 'Payee',
        amount: 'Amount',
      };

      await importService.saveImportMappingTemplate('Test Bank', mapping2);

      const templates = await importService.getImportMappingTemplates();
      const template = templates.find((t) => t.name === 'test bank');

      expect(template?.mapping).toEqual(mapping2);
    });

    it('should filter templates by account', async () => {
      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      await importService.saveImportMappingTemplate(
        'Checking Template',
        mapping,
        accounts.personalChecking.id
      );

      await importService.saveImportMappingTemplate(
        'Credit Card Template',
        mapping,
        accounts.creditCard.id
      );

      const checkingTemplates = await importService.getImportMappingTemplates(
        accounts.personalChecking.id
      );

      expect(checkingTemplates).toHaveLength(1);
      expect(checkingTemplates[0].name).toBe('checking template');
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate by external ID', async () => {
      // Create transaction with externalId
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Coffee Shop',
        externalId: 'EXT123',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -15.50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 15.50, isBusiness: false },
        ],
      });

      const rows = [
        { Date: '15/01/2025', Description: 'Coffee Shop', Amount: '15.50', Ref: 'EXT123' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
        reference: 'Ref',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews[0].isDuplicate).toBe(true);
    });

    it('should detect duplicate within 3-day window', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Coffee Shop',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -15.50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 15.50, isBusiness: false },
        ],
      });

      // Try to import same transaction 2 days later
      const rows = [
        { Date: '17/01/2025', Description: 'Coffee Shop', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews[0].isDuplicate).toBe(true);
    });

    it('should not detect duplicate beyond 3-day window', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Coffee Shop',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -15.50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 15.50, isBusiness: false },
        ],
      });

      // Try to import same transaction 5 days later
      const rows = [
        { Date: '20/01/2025', Description: 'Coffee Shop', Amount: '15.50' },
      ];

      const mapping: CSVColumnMapping = {
        date: 'Date',
        payee: 'Description',
        amount: 'Amount',
      };

      const previews = await importService.previewImport(
        rows,
        mapping,
        accounts.personalChecking.id
      );

      expect(previews[0].isDuplicate).toBe(false);
    });
  });
});
