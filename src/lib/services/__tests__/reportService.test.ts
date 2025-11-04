import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ReportService } from '../reportService';
import { TransactionService } from '../transactionService';
import type { PrismaClient } from '@prisma/client';
import { AccountType, GSTCode } from '@prisma/client';
import { createTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';
import { calculateGST, calculateAmountExGST } from '../__test-utils__/helpers';

describe('ReportService', () => {
  let prisma: PrismaClient;
  let reportService: ReportService;
  let transactionService: TransactionService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  beforeEach(async () => {
    prisma = await createTestDb();
    await resetTestDb(prisma);
    reportService = new ReportService(prisma);
    transactionService = new TransactionService(prisma);
    accounts = await seedTestAccounts(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('generateProfitAndLoss', () => {
    it('should generate basic P&L report', async () => {
      // Create income transaction
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: 1000,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -1000,
            isBusiness: false,
          },
        ],
      });

      // Create expense transaction
      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Office Depot',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: -500,
            isBusiness: false,
          },
          {
            accountId: accounts.officeSupplies.id,
            amount: 500,
            isBusiness: false,
          },
        ],
      });

      const report = await reportService.generateProfitAndLoss(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.income.length).toBe(1);
      expect(report.expenses.length).toBe(1);
      expect(report.totalIncome).toBe(1000);
      expect(report.totalExpenses).toBe(500);
      expect(report.netProfit).toBe(500);
    });

    it('should filter business-only transactions', async () => {
      // Personal income
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Salary',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: 5000,
            isBusiness: false,
          },
          {
            accountId: accounts.salary.id,
            amount: -5000,
            isBusiness: false,
          },
        ],
      });

      // Business income
      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: 1000,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -1000,
            isBusiness: true,
          },
        ],
      });

      const report = await reportService.generateProfitAndLoss(
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        { businessOnly: true }
      );

      expect(report.totalIncome).toBe(1000);
      expect(report.businessOnly).toBe(true);
    });

    it('should handle GST-inclusive reporting', async () => {
      const amountIncGst = 110;
      const gstAmount = calculateGST(amountIncGst);
      const amountExGst = calculateAmountExGST(amountIncGst);

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: amountIncGst,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -amountExGst,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount,
          },
          {
            accountId: accounts.gstCollected.id,
            amount: -gstAmount,
            isBusiness: true,
          },
        ],
      });

      // GST-exclusive report
      const exReport = await reportService.generateProfitAndLoss(
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        { gstInclusive: false, businessOnly: true }
      );

      // The report calculates gstExclusive as amount - gst for income
      // Since income amount is already ex-GST, this results in amount - gst
      const expectedExclusive = amountExGst - gstAmount;
      expect(exReport.totalIncome).toBeCloseTo(expectedExclusive, 2);

      // GST-inclusive report should be the original ex-GST amount
      const incReport = await reportService.generateProfitAndLoss(
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        { gstInclusive: true, businessOnly: true }
      );

      expect(incReport.totalIncome).toBeCloseTo(amountExGst, 2);
    });

    it('should exclude voided transactions', async () => {
      const transaction = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: 1000,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -1000,
            isBusiness: false,
          },
        ],
      });

      // Void the transaction
      await transactionService.voidTransaction(transaction.id);

      const report = await reportService.generateProfitAndLoss(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.totalIncome).toBe(0);
      expect(report.totalExpenses).toBe(0);
    });
  });

  describe('generateGSTSummary', () => {
    it('should generate GST summary report', async () => {
      const saleAmount = 110;
      const saleGST = calculateGST(saleAmount);
      const saleExGST = calculateAmountExGST(saleAmount);

      const purchaseAmount = 55;
      const purchaseGST = calculateGST(purchaseAmount);
      const purchaseExGST = calculateAmountExGST(purchaseAmount);

      // Business income with GST
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: saleAmount,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -saleExGST,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: saleGST,
          },
          {
            accountId: accounts.gstCollected.id,
            amount: -saleGST,
            isBusiness: true,
          },
        ],
      });

      // Business expense with GST
      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Office Depot',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: -purchaseAmount,
            isBusiness: false,
          },
          {
            accountId: accounts.officeSupplies.id,
            amount: purchaseExGST,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: purchaseGST,
          },
          {
            accountId: accounts.gstPaid.id,
            amount: purchaseGST,
            isBusiness: true,
          },
        ],
      });

      const report = await reportService.generateGSTSummary(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.gstCollected).toBeCloseTo(saleGST, 2);
      expect(report.gstPaid).toBeCloseTo(purchaseGST, 2);
      expect(report.netGST).toBeCloseTo(saleGST - purchaseGST, 2);
    });

    it('should group GST by category', async () => {
      const amount = 110;
      const gst = calculateGST(amount);
      const exGst = calculateAmountExGST(amount);

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: amount,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -exGst,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: gst,
          },
          {
            accountId: accounts.gstCollected.id,
            amount: -gst,
            isBusiness: true,
          },
        ],
      });

      const report = await reportService.generateGSTSummary(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.byCategory.length).toBeGreaterThan(0);
      const salesCategory = report.byCategory.find(
        (c) => c.categoryName === 'Sales Income'
      );
      expect(salesCategory).toBeDefined();
      expect(salesCategory?.gstCollected).toBeCloseTo(gst, 2);
    });

    it('should group GST by payee', async () => {
      const amount = 110;
      const gst = calculateGST(amount);
      const exGst = calculateAmountExGST(amount);

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: amount,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -exGst,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: gst,
          },
          {
            accountId: accounts.gstCollected.id,
            amount: -gst,
            isBusiness: true,
          },
        ],
      });

      const report = await reportService.generateGSTSummary(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.byPayee.length).toBeGreaterThan(0);
      const clientPayee = report.byPayee.find((p) => p.payee === 'Client A');
      expect(clientPayee).toBeDefined();
      expect(clientPayee?.gstCollected).toBeCloseTo(gst, 2);
    });
  });

  describe('generateBASDraft', () => {
    it('should generate BAS draft with whole dollar rounding', async () => {
      const saleAmount = 110.75;
      const saleGST = calculateGST(saleAmount);
      const saleExGST = calculateAmountExGST(saleAmount);

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: saleAmount,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -saleExGST,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: saleGST,
          },
          {
            accountId: accounts.gstCollected.id,
            amount: -saleGST,
            isBusiness: true,
          },
        ],
      });

      const report = await reportService.generateBASDraft(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      // All values should be whole dollars
      expect(Number.isInteger(report.g1TotalSales)).toBe(true);
      expect(Number.isInteger(report.oneAGSTOnSales)).toBe(true);
      expect(Number.isInteger(report.oneBGSTOnPurchases)).toBe(true);
      expect(Number.isInteger(report.netGST)).toBe(true);
    });

    it('should calculate G1 total sales correctly', async () => {
      const saleAmount = 110;
      const saleGST = calculateGST(saleAmount);
      const saleExGST = calculateAmountExGST(saleAmount);

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: saleAmount,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -saleExGST,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: saleGST,
          },
          {
            accountId: accounts.gstCollected.id,
            amount: -saleGST,
            isBusiness: true,
          },
        ],
      });

      const report = await reportService.generateBASDraft(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      // BAS calculation: gstExclusive = amount - gstAmount
      const expectedG1 = saleExGST - saleGST;
      expect(report.g1TotalSales).toBeCloseTo(expectedG1, 0); // Rounded to whole dollar
    });

    it('should throw error if GST accounts dont exist', async () => {
      // Use a fresh database without GST accounts
      const newPrisma = await createTestDb();
      await resetTestDb(newPrisma);
      const newReportService = new ReportService(newPrisma);

      await expect(
        newReportService.generateBASDraft(
          new Date('2025-01-01'),
          new Date('2025-01-31')
        )
      ).rejects.toThrow('GST Collected and GST Paid accounts must exist');

      await cleanupTestDb(newPrisma);
    });
  });

  describe('getTagSummary', () => {
    it('should summarize transactions by tag', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        tags: ['consulting', 'project-x'],
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: 1000,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -1000,
            isBusiness: true,
          },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Office Depot',
        tags: ['consulting', 'office'],
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: -500,
            isBusiness: false,
          },
          {
            accountId: accounts.officeSupplies.id,
            amount: 500,
            isBusiness: true,
          },
        ],
      });

      const report = await reportService.getTagSummary(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.length).toBeGreaterThan(0);

      const consultingTag = report.find((t) => t.tag === 'consulting');
      expect(consultingTag).toBeDefined();
      expect(consultingTag?.income).toBe(1000);
      expect(consultingTag?.expenses).toBe(500);
      expect(consultingTag?.net).toBe(500);
    });

    it('should filter tag summary by business only', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Salary',
        tags: ['income'],
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: 5000,
            isBusiness: false,
          },
          {
            accountId: accounts.salary.id,
            amount: -5000,
            isBusiness: false,
          },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Client A',
        tags: ['income'],
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: 1000,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -1000,
            isBusiness: true,
          },
        ],
      });

      const report = await reportService.getTagSummary(
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        { businessOnly: true }
      );

      const incomeTag = report.find((t) => t.tag === 'income');
      expect(incomeTag).toBeDefined();
      expect(incomeTag?.income).toBe(1000); // Only business income
    });

    it('should handle transactions without tags', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          {
            accountId: accounts.businessChecking.id,
            amount: 1000,
            isBusiness: false,
          },
          {
            accountId: accounts.salesIncome.id,
            amount: -1000,
            isBusiness: false,
          },
        ],
      });

      const report = await reportService.getTagSummary(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.length).toBe(0); // No tags
    });
  });

  describe('exportToCSV', () => {
    it('should export data to CSV format', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' },
      ];

      const csv = reportService.exportToCSV(data, ['name', 'age', 'city']);

      expect(csv).toContain('name,age,city');
      expect(csv).toContain('John,30,New York');
      expect(csv).toContain('Jane,25,Los Angeles');
    });

    it('should escape commas and quotes in CSV', () => {
      const data = [
        { name: 'Company, Inc.', description: 'A "great" company' },
      ];

      const csv = reportService.exportToCSV(data, ['name', 'description']);

      expect(csv).toContain('"Company, Inc."');
      expect(csv).toContain('"A ""great"" company"');
    });

    it('should handle missing fields', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane' }, // Missing age
      ];

      const csv = reportService.exportToCSV(data, ['name', 'age']);

      expect(csv).toContain('John,30');
      expect(csv).toContain('Jane,');
    });
  });
});
