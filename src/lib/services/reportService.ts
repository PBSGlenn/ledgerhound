import { getPrismaClient } from '../db';
import type { GSTSummary, ProfitAndLoss, BASDraft, BalanceSheet, CashFlowStatement } from '../../types';
import { AccountType, type PrismaClient } from '@prisma/client';

export class ReportService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

  /**
   * Generate Profit & Loss report
   */
  async generateProfitAndLoss(
    startDate: Date,
    endDate: Date,
    options: {
      businessOnly?: boolean;
      personalOnly?: boolean;
      gstInclusive?: boolean; // For business: show GST-inclusive or exclusive
    } = {}
  ): Promise<ProfitAndLoss> {
    // Build where clause for business/personal filter
    const businessFilter = options.businessOnly
      ? { isBusiness: true }
      : options.personalOnly
      ? { isBusiness: false }
      : {};

    // Get all income postings (only select needed fields for efficiency)
    const incomePostings = await this.prisma.posting.findMany({
      where: {
        ...businessFilter,
        account: { type: AccountType.INCOME },
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
      select: {
        amount: true,
        isBusiness: true,
        gstAmount: true,
        account: {
          select: { name: true },
        },
      },
    });

    // Get all expense postings (only select needed fields for efficiency)
    const expensePostings = await this.prisma.posting.findMany({
      where: {
        ...businessFilter,
        account: { type: AccountType.EXPENSE },
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
      select: {
        amount: true,
        isBusiness: true,
        gstAmount: true,
        account: {
          select: { name: true },
        },
      },
    });

    // Group by category
    const incomeByCategory = new Map<string, {
      amount: number;
      gstExclusive: number;
      gst: number;
    }>();

    const expenseByCategory = new Map<string, {
      amount: number;
      gstExclusive: number;
      gst: number;
    }>();

    // Process income
    for (const posting of incomePostings) {
      const category = posting.account.name;
      const existing = incomeByCategory.get(category) || {
        amount: 0,
        gstExclusive: 0,
        gst: 0,
      };

      const amount = Math.abs(posting.amount); // Income is negative, make positive
      const gst = posting.isBusiness ? (posting.gstAmount ?? 0) : 0;
      const gstExclusive = posting.isBusiness ? amount - Math.abs(gst) : amount;

      existing.amount += amount;
      existing.gstExclusive += gstExclusive;
      existing.gst += Math.abs(gst);

      incomeByCategory.set(category, existing);
    }

    // Process expenses
    for (const posting of expensePostings) {
      const category = posting.account.name;
      const existing = expenseByCategory.get(category) || {
        amount: 0,
        gstExclusive: 0,
        gst: 0,
      };

      const amount = posting.amount; // Expenses are positive
      const gst = posting.isBusiness ? (posting.gstAmount ?? 0) : 0;
      const gstExclusive = posting.isBusiness ? amount - gst : amount;

      existing.amount += amount;
      existing.gstExclusive += gstExclusive;
      existing.gst += gst;

      expenseByCategory.set(category, existing);
    }

    // Build result
    const income = Array.from(incomeByCategory.entries()).map(([categoryName, data]) => ({
      categoryName,
      amount: options.gstInclusive ? data.amount : data.gstExclusive,
      gstExclusive: options.businessOnly ? data.gstExclusive : undefined,
      gst: options.businessOnly ? data.gst : undefined,
    }));

    const expenses = Array.from(expenseByCategory.entries()).map(([categoryName, data]) => ({
      categoryName,
      amount: options.gstInclusive ? data.amount : data.gstExclusive,
      gstExclusive: options.businessOnly ? data.gstExclusive : undefined,
      gst: options.businessOnly ? data.gst : undefined,
    }));

    const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    return {
      period: { start: startDate, end: endDate },
      businessOnly: options.businessOnly ?? false,
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netProfit,
    };
  }

  /**
   * Generate GST Summary (business transactions only)
   */
  async generateGSTSummary(
    startDate: Date,
    endDate: Date
  ): Promise<GSTSummary> {
    // Get all business postings with GST
    const businessPostings = await this.prisma.posting.findMany({
      where: {
        isBusiness: true,
        gstCode: { not: null },
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
      include: {
        account: true,
        transaction: true,
      },
    });

    let gstCollected = 0; // GST on sales (income)
    let gstPaid = 0; // GST on purchases (expenses)

    const byCategory = new Map<string, {
      sales: number;
      purchases: number;
      gstCollected: number;
      gstPaid: number;
    }>();

    const byPayee = new Map<string, {
      gstCollected: number;
      gstPaid: number;
    }>();

    for (const posting of businessPostings) {
      const isIncome = posting.account.type === AccountType.INCOME;
      const gstAmount = Math.abs(posting.gstAmount ?? 0);
      const amount = Math.abs(posting.amount);

            if (isIncome) {
        gstCollected += gstAmount;
      } else if (posting.account.type === AccountType.EXPENSE) {
        gstPaid += gstAmount;
      }

      // By category
      const categoryName = posting.account.name;
      const catData = byCategory.get(categoryName) || {
        sales: 0,
        purchases: 0,
        gstCollected: 0,
        gstPaid: 0,
      };

      if (isIncome) {
        catData.sales += amount;
        catData.gstCollected += gstAmount;
      } else {
        catData.purchases += amount;
        catData.gstPaid += gstAmount;
      }

      byCategory.set(categoryName, catData);

      // By payee
      const payee = posting.transaction.payee;
      const payeeData = byPayee.get(payee) || {
        gstCollected: 0,
        gstPaid: 0,
      };

      if (isIncome) {
        payeeData.gstCollected += gstAmount;
      } else {
        payeeData.gstPaid += gstAmount;
      }

      byPayee.set(payee, payeeData);
    }

    const netGST = gstCollected - gstPaid;

    return {
      period: { start: startDate, end: endDate },
      gstCollected,
      gstPaid,
      netGST,
      byCategory: Array.from(byCategory.entries()).map(([categoryName, data]) => ({
        categoryName,
        ...data,
      })),
      byPayee: Array.from(byPayee.entries()).map(([payee, data]) => ({
        payee,
        ...data,
      })),
    };
  }

  /**
   * Generate BAS Draft (Australian Business Activity Statement)
   * Cash basis, rounded to whole dollars
   * Uses GST Collected and GST Paid accounts for accurate 1A/1B reporting
   */
  async generateBASDraft(
    startDate: Date,
    endDate: Date
  ): Promise<BASDraft> {
    // Find the GST Collected and GST Paid accounts
    const gstCollectedAccount = await this.prisma.account.findFirst({
      where: {
        name: 'GST Collected',
        type: AccountType.LIABILITY,
        kind: 'CATEGORY',
      },
    });

    const gstPaidAccount = await this.prisma.account.findFirst({
      where: {
        name: 'GST Paid',
        type: AccountType.ASSET,
        kind: 'CATEGORY',
      },
    });

    if (!gstCollectedAccount || !gstPaidAccount) {
      throw new Error('GST Collected and GST Paid accounts must exist for BAS reporting');
    }

    // Get all postings to GST Collected account (1A: GST on Sales)
    const gstCollectedPostings = await this.prisma.posting.findMany({
      where: {
        accountId: gstCollectedAccount.id,
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
    });

    // Get all postings to GST Paid account (1B: GST on Purchases)
    const gstPaidPostings = await this.prisma.posting.findMany({
      where: {
        accountId: gstPaidAccount.id,
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
    });

    // Calculate 1A and 1B from account postings
    // GST Collected is a LIABILITY, so credits (negative amounts) increase the liability
    // We want the absolute value of GST collected
    const oneAGSTOnSales = Math.abs(
      gstCollectedPostings.reduce((sum, p) => sum + p.amount, 0)
    );

    // GST Paid is an ASSET, so debits (positive amounts) increase the asset
    // We want the absolute value of GST paid
    const oneBGSTOnPurchases = Math.abs(
      gstPaidPostings.reduce((sum, p) => sum + p.amount, 0)
    );

    // Get all business postings for sales and purchases calculations
    const businessPostings = await this.prisma.posting.findMany({
      where: {
        isBusiness: true,
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
      include: {
        account: true,
      },
    });

    let g1TotalSales = 0; // Total sales (GST-exclusive)
    let g2ExportSales = 0; // Export sales
    let g3OtherGSTFree = 0; // Other GST-free sales
    let g10CapitalPurchases = 0; // Capital purchases (GST-exclusive)
    let g11NonCapitalPurchases = 0; // Non-capital purchases (GST-exclusive)

    for (const posting of businessPostings) {
      const isIncome = posting.account.type === AccountType.INCOME;
      const isExpense = posting.account.type === AccountType.EXPENSE;
      const gstCode = posting.gstCode;
      const gstAmount = Math.abs(posting.gstAmount ?? 0);
      const amount = Math.abs(posting.amount);
      const gstExclusive = amount - gstAmount;

      if (isIncome) {
        // Sales
        if (gstCode === 'GST') {
          g1TotalSales += gstExclusive;
        } else if (gstCode === 'EXPORT') {
          g1TotalSales += amount;
          g2ExportSales += amount;
        } else if (gstCode === 'GST_FREE') {
          g1TotalSales += amount;
          g3OtherGSTFree += amount;
        }
      } else if (isExpense) {
        // Purchases
        const isCapital = posting.account.name.toLowerCase().includes('capital') ||
                          posting.account.name.toLowerCase().includes('asset');

        if (gstCode === 'GST') {
          if (isCapital) {
            g10CapitalPurchases += gstExclusive;
          } else {
            g11NonCapitalPurchases += gstExclusive;
          }
        } else if (gstCode === 'GST_FREE' || gstCode === 'INPUT_TAXED') {
          if (isCapital) {
            g10CapitalPurchases += amount;
          } else {
            g11NonCapitalPurchases += amount;
          }
        }
      }
    }

    // Round to whole dollars (ATO requirement)
    const round = (n: number) => Math.round(n);

    const netGST = oneAGSTOnSales - oneBGSTOnPurchases;

    return {
      period: { start: startDate, end: endDate },
      g1TotalSales: round(g1TotalSales),
      g2ExportSales: round(g2ExportSales),
      g3OtherGSTFree: round(g3OtherGSTFree),
      g10CapitalPurchases: round(g10CapitalPurchases),
      g11NonCapitalPurchases: round(g11NonCapitalPurchases),
      oneAGSTOnSales: round(oneAGSTOnSales),
      oneBGSTOnPurchases: round(oneBGSTOnPurchases),
      netGST: round(netGST),
      reconciliation: [
        {
          description: 'Total Sales (G1)',
          value: round(g1TotalSales),
        },
        {
          description: 'Export Sales (G2)',
          value: round(g2ExportSales),
        },
        {
          description: 'Other GST-free Sales (G3)',
          value: round(g3OtherGSTFree),
        },
        {
          description: 'Capital Purchases (G10)',
          value: round(g10CapitalPurchases),
        },
        {
          description: 'Non-capital Purchases (G11)',
          value: round(g11NonCapitalPurchases),
        },
        {
          description: 'GST on Sales (1A)',
          value: round(oneAGSTOnSales),
        },
        {
          description: 'GST on Purchases (1B)',
          value: round(oneBGSTOnPurchases),
        },
        {
          description: 'Net GST',
          value: round(netGST),
        },
      ],
    };
  }

  /**
   * Generate Balance Sheet (point-in-time)
   * Assets = Liabilities + Equity + Retained Earnings
   */
  async generateBalanceSheet(asOfDate: Date): Promise<BalanceSheet> {
    // Get all accounts
    const allAccounts = await this.prisma.account.findMany({
      where: { archived: false },
    });

    const assetAccounts = allAccounts.filter(a => a.type === AccountType.ASSET);
    const liabilityAccounts = allAccounts.filter(a => a.type === AccountType.LIABILITY);
    const equityAccounts = allAccounts.filter(a => a.type === AccountType.EQUITY);

    // Helper to calculate account balance up to a date
    const getBalance = async (accountId: string, openingBalance: number): Promise<number> => {
      const result = await this.prisma.posting.aggregate({
        where: {
          accountId,
          transaction: {
            date: { lte: asOfDate },
            status: 'NORMAL',
          },
        },
        _sum: { amount: true },
      });
      return openingBalance + (result._sum.amount ?? 0);
    };

    // Calculate asset balances
    const assets: Array<{ accountName: string; balance: number; isReal: boolean }> = [];
    for (const account of assetAccounts) {
      const balance = await getBalance(account.id, account.openingBalance);
      if (Math.abs(balance) >= 0.01) {
        assets.push({ accountName: account.name, balance, isReal: account.kind === 'TRANSFER' });
      }
    }

    // Calculate liability balances (liabilities are negative in double-entry, show as positive)
    const liabilities: Array<{ accountName: string; balance: number; isReal: boolean }> = [];
    for (const account of liabilityAccounts) {
      const balance = await getBalance(account.id, account.openingBalance);
      if (Math.abs(balance) >= 0.01) {
        liabilities.push({ accountName: account.name, balance: Math.abs(balance), isReal: account.kind === 'TRANSFER' });
      }
    }

    // Calculate equity balances
    const equity: Array<{ accountName: string; balance: number }> = [];
    for (const account of equityAccounts) {
      const balance = await getBalance(account.id, account.openingBalance);
      if (Math.abs(balance) >= 0.01) {
        equity.push({ accountName: account.name, balance: Math.abs(balance) });
      }
    }

    // Calculate retained earnings (Income - Expenses from inception to asOfDate)
    const incomeResult = await this.prisma.posting.aggregate({
      where: {
        account: { type: AccountType.INCOME },
        transaction: {
          date: { lte: asOfDate },
          status: 'NORMAL',
        },
      },
      _sum: { amount: true },
    });

    const expenseResult = await this.prisma.posting.aggregate({
      where: {
        account: { type: AccountType.EXPENSE },
        transaction: {
          date: { lte: asOfDate },
          status: 'NORMAL',
        },
      },
      _sum: { amount: true },
    });

    // Income postings are negative (credits), expenses are positive (debits)
    const totalIncomeAmount = Math.abs(incomeResult._sum.amount ?? 0);
    const totalExpenseAmount = expenseResult._sum.amount ?? 0;
    const retainedEarnings = totalIncomeAmount - totalExpenseAmount;

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const equityTotal = equity.reduce((sum, e) => sum + e.balance, 0);
    const totalEquity = equityTotal + retainedEarnings;

    // Check if balanced (within rounding tolerance)
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

    return {
      asOfDate,
      assets: assets.sort((a, b) => a.accountName.localeCompare(b.accountName)),
      liabilities: liabilities.sort((a, b) => a.accountName.localeCompare(b.accountName)),
      equity: equity.sort((a, b) => a.accountName.localeCompare(b.accountName)),
      retainedEarnings,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
    };
  }

  /**
   * Generate Cash Flow Statement (direct method)
   * Shows actual cash movements through real accounts
   */
  async generateCashFlow(startDate: Date, endDate: Date): Promise<CashFlowStatement> {
    // Get all real (bank/PSP) accounts
    const realAccounts = await this.prisma.account.findMany({
      where: { kind: 'TRANSFER', archived: false },
    });
    const realAccountIds = new Set(realAccounts.map(a => a.id));

    // Calculate opening cash (sum of all real account balances before start date)
    let openingCash = 0;
    for (const account of realAccounts) {
      const result = await this.prisma.posting.aggregate({
        where: {
          accountId: account.id,
          transaction: {
            date: { lt: startDate },
            status: 'NORMAL',
          },
        },
        _sum: { amount: true },
      });
      openingCash += account.openingBalance + (result._sum.amount ?? 0);
    }

    // Calculate closing cash
    let closingCash = 0;
    for (const account of realAccounts) {
      const result = await this.prisma.posting.aggregate({
        where: {
          accountId: account.id,
          transaction: {
            date: { lte: endDate },
            status: 'NORMAL',
          },
        },
        _sum: { amount: true },
      });
      closingCash += account.openingBalance + (result._sum.amount ?? 0);
    }

    // Get all transactions in period that touch real accounts
    const periodTransactions = await this.prisma.transaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: 'NORMAL',
        postings: {
          some: { accountId: { in: Array.from(realAccountIds) } },
        },
      },
      include: {
        postings: {
          include: { account: true },
        },
      },
    });

    // Categorize cash flows
    const operatingByCategory = new Map<string, number>();
    const financingItems: Array<{ description: string; amount: number }> = [];

    for (const txn of periodTransactions) {
      const realPostings = txn.postings.filter(p => realAccountIds.has(p.accountId));
      const categoryPostings = txn.postings.filter(p => !realAccountIds.has(p.accountId));

      if (categoryPostings.length > 0) {
        // Operating: transactions with income/expense categories
        for (const posting of categoryPostings) {
          if (posting.account.type === AccountType.INCOME || posting.account.type === AccountType.EXPENSE) {
            const categoryName = posting.account.name;
            const cashImpact = realPostings.reduce((sum, p) => sum + p.amount, 0);
            // Attribute proportionally if multiple categories, or use full amount
            const existing = operatingByCategory.get(categoryName) ?? 0;
            operatingByCategory.set(categoryName, existing + Math.abs(posting.amount) * Math.sign(cashImpact || posting.amount));
          }
        }
      } else if (realPostings.length >= 2) {
        // Financing: transfers between real accounts only
        // Show as a single net movement description
        const fromAccounts = realPostings.filter(p => p.amount < 0);
        const toAccounts = realPostings.filter(p => p.amount > 0);
        if (fromAccounts.length > 0 && toAccounts.length > 0) {
          financingItems.push({
            description: `${fromAccounts[0].account.name} → ${toAccounts[0].account.name}`,
            amount: toAccounts[0].amount,
          });
        }
      }
    }

    // Build operating items from the category map
    // Income categories produce cash inflows (positive), expense categories produce outflows (negative)
    const operatingItems = Array.from(operatingByCategory.entries())
      .map(([categoryName, amount]) => ({ categoryName, amount }))
      .filter(item => Math.abs(item.amount) >= 0.01)
      .sort((a, b) => b.amount - a.amount);

    const operatingTotal = operatingItems.reduce((sum, i) => sum + i.amount, 0);
    const financingTotal = 0; // Transfers between own accounts net to zero in cash flow

    return {
      period: { start: startDate, end: endDate },
      operating: {
        items: operatingItems,
        total: operatingTotal,
      },
      investing: {
        items: [], // Placeholder for future capital asset tracking
        total: 0,
      },
      financing: {
        items: financingItems,
        total: financingTotal,
      },
      netCashChange: closingCash - openingCash,
      openingCash,
      closingCash,
    };
  }

  /**
   * Export report to CSV
   */
  exportToCSV(data: any[], headers: string[]): string {
    const rows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header] ?? '';
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      rows.push(values.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Get tag summary (spending/income by tag)
   */
  async getTagSummary(
    startDate: Date,
    endDate: Date,
    options: { businessOnly?: boolean; personalOnly?: boolean } = {}
  ): Promise<Array<{
    tag: string;
    income: number;
    expenses: number;
    net: number;
    businessAmount?: number;
    personalAmount?: number;
  }>> {
    // Get all transactions in period with tags
    const transactions = await this.prisma.transaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: 'NORMAL',
        tags: { not: null },
      },
      include: {
        postings: {
          include: {
            account: true,
          },
        },
      },
    });

    const tagData = new Map<string, {
      income: number;
      expenses: number;
      businessAmount: number;
      personalAmount: number;
    }>();

    for (const transaction of transactions) {
      const tags: string[] = transaction.tags ? JSON.parse(transaction.tags) : [];

      for (const tag of tags) {
        const data = tagData.get(tag) || {
          income: 0,
          expenses: 0,
          businessAmount: 0,
          personalAmount: 0,
        };

        for (const posting of transaction.postings) {
          // Apply business/personal filter
          if (options.businessOnly && !posting.isBusiness) continue;
          if (options.personalOnly && posting.isBusiness) continue;

          const amount = Math.abs(posting.amount);

          if (posting.account.type === AccountType.INCOME) {
            data.income += amount;
          } else if (posting.account.type === AccountType.EXPENSE) {
            data.expenses += amount;
          }

          if (posting.isBusiness) {
            data.businessAmount += amount;
          } else {
            data.personalAmount += amount;
          }
        }

        tagData.set(tag, data);
      }
    }

    return Array.from(tagData.entries()).map(([tag, data]) => ({
      tag,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
      businessAmount: options.businessOnly === undefined ? data.businessAmount : undefined,
      personalAmount: options.personalOnly === undefined ? data.personalAmount : undefined,
    }));
  }
}

export const reportService = new ReportService();
