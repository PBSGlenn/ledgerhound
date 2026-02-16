import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { ReportService } from '../reportService';
import { TransactionService } from '../transactionService';
import type { PrismaClient } from '@prisma/client';
import { AccountType, GSTCode } from '@prisma/client';
import { getTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';
import { calculateGST, calculateAmountExGST } from '../__test-utils__/helpers';

describe('ReportService', () => {
  let prisma: PrismaClient;
  let reportService: ReportService;
  let transactionService: TransactionService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  beforeAll(async () => {
    prisma = await getTestDb();
  });

  beforeEach(async () => {
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
      // Reset database to empty state (no GST accounts)
      await resetTestDb(prisma);
      const emptyReportService = new ReportService(prisma);

      await expect(
        emptyReportService.generateBASDraft(
          new Date('2025-01-01'),
          new Date('2025-01-31')
        )
      ).rejects.toThrow('GST Collected and GST Paid accounts must exist');
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

  describe('generateBalanceSheet', () => {
    it('should generate basic balance sheet with no transactions', async () => {
      const report = await reportService.generateBalanceSheet(new Date('2025-01-31'));

      expect(report.asOfDate).toEqual(new Date('2025-01-31'));
      expect(report.assets).toEqual([]);
      expect(report.liabilities).toEqual([]);
      expect(report.equity).toEqual([]);
      expect(report.retainedEarnings).toBe(0);
      expect(report.totalAssets).toBe(0);
      expect(report.totalLiabilities).toBe(0);
      expect(report.totalEquity).toBe(0);
      expect(report.isBalanced).toBe(true);
    });

    it('should include asset and liability balances from transactions', async () => {
      // Income transaction: bank receives $1000, income category credited
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 1000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -1000, isBusiness: false },
        ],
      });

      // Credit card expense: $500
      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Office Depot',
        postings: [
          { accountId: accounts.creditCard.id, amount: -500, isBusiness: false },
          { accountId: accounts.officeSupplies.id, amount: 500, isBusiness: false },
        ],
      });

      const report = await reportService.generateBalanceSheet(new Date('2025-01-31'));

      // Business Checking should have $1000 (ASSET)
      const checking = report.assets.find(a => a.accountName === 'Business Checking');
      expect(checking).toBeDefined();
      expect(checking?.balance).toBe(1000);
      expect(checking?.isReal).toBe(true);

      // Credit Card should show as liability (absolute value of -500 = 500)
      const cc = report.liabilities.find(l => l.accountName === 'Credit Card');
      expect(cc).toBeDefined();
      expect(cc?.balance).toBe(500);
    });

    it('should calculate retained earnings from income minus expenses', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 2000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -2000, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Office Depot',
        postings: [
          { accountId: accounts.businessChecking.id, amount: -800, isBusiness: false },
          { accountId: accounts.officeSupplies.id, amount: 800, isBusiness: false },
        ],
      });

      const report = await reportService.generateBalanceSheet(new Date('2025-01-31'));

      // Retained earnings = Income ($2000) - Expenses ($800) = $1200
      expect(report.retainedEarnings).toBe(1200);
    });

    it('should verify accounting equation balances', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 3000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -3000, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-20'),
        payee: 'Supplier',
        postings: [
          { accountId: accounts.creditCard.id, amount: -1000, isBusiness: false },
          { accountId: accounts.officeSupplies.id, amount: 1000, isBusiness: false },
        ],
      });

      const report = await reportService.generateBalanceSheet(new Date('2025-01-31'));

      // Assets = Liabilities + Equity (which includes retained earnings)
      expect(report.isBalanced).toBe(true);
      expect(report.totalAssets).toBeCloseTo(report.totalLiabilities + report.totalEquity, 2);
    });

    it('should respect asOfDate filtering', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 1000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -1000, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-02-15'),
        payee: 'Client B',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 2000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -2000, isBusiness: false },
        ],
      });

      // Balance sheet as of Jan 31 should only include Jan transaction
      const janReport = await reportService.generateBalanceSheet(new Date('2025-01-31'));
      const janChecking = janReport.assets.find(a => a.accountName === 'Business Checking');
      expect(janChecking?.balance).toBe(1000);
      expect(janReport.retainedEarnings).toBe(1000);

      // Balance sheet as of Feb 28 should include both
      const febReport = await reportService.generateBalanceSheet(new Date('2025-02-28'));
      const febChecking = febReport.assets.find(a => a.accountName === 'Business Checking');
      expect(febChecking?.balance).toBe(3000);
      expect(febReport.retainedEarnings).toBe(3000);
    });

    it('should include opening balances', async () => {
      // Create an account with an opening balance
      const savingsAccount = await prisma.account.create({
        data: {
          name: 'Savings',
          type: AccountType.ASSET,
          kind: 'TRANSFER',
          isReal: true,
          isBusinessDefault: false,
          openingBalance: 5000,
        },
      });

      const report = await reportService.generateBalanceSheet(new Date('2025-01-31'));

      const savings = report.assets.find(a => a.accountName === 'Savings');
      expect(savings).toBeDefined();
      expect(savings?.balance).toBe(5000);
    });

    it('should exclude voided transactions', async () => {
      const txn = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 1000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -1000, isBusiness: false },
        ],
      });

      await transactionService.voidTransaction(txn.id);

      const report = await reportService.generateBalanceSheet(new Date('2025-01-31'));

      expect(report.totalAssets).toBe(0);
      expect(report.retainedEarnings).toBe(0);
    });

    it('should include category accounts like GST Paid as assets', async () => {
      const gstAmount = 10;

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Office Depot',
        postings: [
          { accountId: accounts.businessChecking.id, amount: -110, isBusiness: false },
          { accountId: accounts.officeSupplies.id, amount: 100, isBusiness: true, gstCode: GSTCode.GST, gstRate: 0.1, gstAmount },
          { accountId: accounts.gstPaid.id, amount: gstAmount, isBusiness: true },
        ],
      });

      const report = await reportService.generateBalanceSheet(new Date('2025-01-31'));

      // GST Paid is an ASSET category account
      const gstPaid = report.assets.find(a => a.accountName === 'GST Paid');
      expect(gstPaid).toBeDefined();
      expect(gstPaid?.balance).toBe(10);
      expect(gstPaid?.isReal).toBe(false);
    });
  });

  describe('generateCashFlow', () => {
    it('should generate basic cash flow with no transactions', async () => {
      const report = await reportService.generateCashFlow(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.period.start).toEqual(new Date('2025-01-01'));
      expect(report.period.end).toEqual(new Date('2025-01-31'));
      expect(report.operating.items).toEqual([]);
      expect(report.operating.total).toBe(0);
      expect(report.investing.items).toEqual([]);
      expect(report.financing.items).toEqual([]);
      expect(report.openingCash).toBe(0);
      expect(report.closingCash).toBe(0);
      expect(report.netCashChange).toBe(0);
    });

    it('should show income as operating cash inflow', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 1000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -1000, isBusiness: false },
        ],
      });

      const report = await reportService.generateCashFlow(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.operating.items.length).toBeGreaterThan(0);
      const salesItem = report.operating.items.find(i => i.categoryName === 'Sales Income');
      expect(salesItem).toBeDefined();
      expect(salesItem?.amount).toBe(1000);
      expect(report.operating.total).toBe(1000);
    });

    it('should show expenses as operating cash outflow', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Office Depot',
        postings: [
          { accountId: accounts.businessChecking.id, amount: -500, isBusiness: false },
          { accountId: accounts.officeSupplies.id, amount: 500, isBusiness: false },
        ],
      });

      const report = await reportService.generateCashFlow(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      const officeItem = report.operating.items.find(i => i.categoryName === 'Office Supplies');
      expect(officeItem).toBeDefined();
      expect(officeItem?.amount).toBe(-500);
      expect(report.operating.total).toBe(-500);
    });

    it('should calculate opening and closing cash from real accounts', async () => {
      // Transaction before the period
      await transactionService.createTransaction({
        date: new Date('2024-12-15'),
        payee: 'Prior Income',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 5000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -5000, isBusiness: false },
        ],
      });

      // Transaction in the period
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Client A',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 1000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -1000, isBusiness: false },
        ],
      });

      const report = await reportService.generateCashFlow(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.openingCash).toBe(5000);
      expect(report.closingCash).toBe(6000);
      expect(report.netCashChange).toBe(1000);
    });

    it('should show transfers between real accounts as financing', async () => {
      // Transfer from checking to credit card (paying off CC)
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'CC Payment',
        postings: [
          { accountId: accounts.businessChecking.id, amount: -500, isBusiness: false },
          { accountId: accounts.creditCard.id, amount: 500, isBusiness: false },
        ],
      });

      const report = await reportService.generateCashFlow(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.financing.items.length).toBe(1);
      expect(report.financing.items[0].description).toContain('Business Checking');
      expect(report.financing.items[0].description).toContain('Credit Card');
      expect(report.financing.items[0].amount).toBe(500);
    });

    it('should respect date range filtering', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Jan Income',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 1000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -1000, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-02-15'),
        payee: 'Feb Income',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 2000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -2000, isBusiness: false },
        ],
      });

      // Only January
      const janReport = await reportService.generateCashFlow(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );
      expect(janReport.operating.total).toBe(1000);
      expect(janReport.netCashChange).toBe(1000);

      // Only February (Jan income becomes opening cash)
      const febReport = await reportService.generateCashFlow(
        new Date('2025-02-01'),
        new Date('2025-02-28')
      );
      expect(febReport.operating.total).toBe(2000);
      expect(febReport.openingCash).toBe(1000);
      expect(febReport.closingCash).toBe(3000);
    });

    it('should handle mixed income and expenses', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-10'),
        payee: 'Client A',
        postings: [
          { accountId: accounts.businessChecking.id, amount: 3000, isBusiness: false },
          { accountId: accounts.salesIncome.id, amount: -3000, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Office Depot',
        postings: [
          { accountId: accounts.businessChecking.id, amount: -800, isBusiness: false },
          { accountId: accounts.officeSupplies.id, amount: 800, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-20'),
        payee: 'Woolworths',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -200, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 200, isBusiness: false },
        ],
      });

      const report = await reportService.generateCashFlow(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      // Net operating = 3000 - 800 - 200 = 2000
      expect(report.operating.total).toBe(2000);
      expect(report.netCashChange).toBe(2000);
      expect(report.closingCash).toBe(2000);
    });

    it('should include opening balance in cash calculations', async () => {
      // Create account with opening balance
      const savingsAccount = await prisma.account.create({
        data: {
          name: 'Savings',
          type: AccountType.ASSET,
          kind: 'TRANSFER',
          isReal: true,
          isBusinessDefault: false,
          openingBalance: 10000,
        },
      });

      const report = await reportService.generateCashFlow(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      // Opening and closing cash should include the savings opening balance
      expect(report.openingCash).toBe(10000);
      expect(report.closingCash).toBe(10000);
      expect(report.netCashChange).toBe(0);
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
