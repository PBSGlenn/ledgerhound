import { getPrismaClient } from '../db';
import type { GSTSummary, ProfitAndLoss, BASDraft } from '../../types';
import { Prisma, AccountType } from '@prisma/client';

export class ReportService {
  private prisma = getPrismaClient();

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

    // Get all income postings
    const incomePostings = await this.prisma.posting.findMany({
      where: {
        ...businessFilter,
        account: { type: AccountType.INCOME },
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
      include: {
        account: true,
      },
    });

    // Get all expense postings
    const expensePostings = await this.prisma.posting.findMany({
      where: {
        ...businessFilter,
        account: { type: AccountType.EXPENSE },
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
      include: {
        account: true,
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
