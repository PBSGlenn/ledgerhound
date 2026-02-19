import { getPrismaClient } from '../db';
import { AccountType, type PrismaClient } from '@prisma/client';
import { SettingsService } from './settingsService';
import type {
  TaxBracket,
  MedicareLevyConfig,
  LITOConfig,
  SmallBusinessOffsetConfig,
  TaxTablesConfig,
  ATOLabel,
  TaxEstimation,
  TaxSummaryItem,
  TaxSummary,
  PAYGInstallment,
  PAYGConfig,
} from '../../types';
import { ATO_LABEL_DESCRIPTIONS as atoDescriptions } from '../../types';

// Default tax tables for 2025-26 FY
const DEFAULT_TAX_TABLES_2025_26: TaxTablesConfig = {
  financialYear: '2025-26',
  brackets: [
    { min: 0, max: 18200, rate: 0, baseTax: 0 },
    { min: 18201, max: 45000, rate: 0.16, baseTax: 0 },
    { min: 45001, max: 135000, rate: 0.30, baseTax: 4288 },
    { min: 135001, max: 190000, rate: 0.37, baseTax: 31288 },
    { min: 190001, max: null, rate: 0.45, baseTax: 51638 },
  ],
  medicareLevyConfig: {
    rate: 0.02,
    lowIncomeThreshold: 27222,
    shadeInThreshold: 34027,
    shadeInRate: 0.10,
    familyThreshold: 45907,
    familyChildExtra: 3760,
  },
  litoConfig: {
    maxOffset: 700,
    fullThreshold: 37500,
    phaseOut1Rate: 0.05,
    phaseOut1Threshold: 45000,
    phaseOut1Amount: 325,
    phaseOut2Rate: 0.015,
    zeroThreshold: 66667,
  },
  smallBusinessOffset: {
    rate: 0.16,
    cap: 1000,
    turnoverThreshold: 5000000,
  },
  superGuaranteeRate: 0.12,
};

// Default PAYG quarter dates for a given FY
function getDefaultPAYGInstallments(financialYear: string): PAYGInstallment[] {
  const [startYearStr] = financialYear.split('-');
  const startYear = parseInt(startYearStr, 10);
  const endYear = startYear + 1;

  return [
    {
      id: `${financialYear}-Q1`,
      quarter: 'Q1',
      financialYear,
      periodStart: `${startYear}-07-01`,
      periodEnd: `${startYear}-09-30`,
      dueDate: `${startYear}-10-28`,
      method: 'amount',
      status: 'upcoming',
    },
    {
      id: `${financialYear}-Q2`,
      quarter: 'Q2',
      financialYear,
      periodStart: `${startYear}-10-01`,
      periodEnd: `${startYear}-12-31`,
      dueDate: `${endYear}-02-28`,
      method: 'amount',
      status: 'upcoming',
    },
    {
      id: `${financialYear}-Q3`,
      quarter: 'Q3',
      financialYear,
      periodStart: `${endYear}-01-01`,
      periodEnd: `${endYear}-03-31`,
      dueDate: `${endYear}-04-28`,
      method: 'amount',
      status: 'upcoming',
    },
    {
      id: `${financialYear}-Q4`,
      quarter: 'Q4',
      financialYear,
      periodStart: `${endYear}-04-01`,
      periodEnd: `${endYear}-06-30`,
      dueDate: `${endYear}-07-28`,
      method: 'amount',
      status: 'upcoming',
    },
  ];
}

export class TaxService {
  private prisma: PrismaClient;
  private settings: SettingsService;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
    this.settings = new SettingsService(this.prisma);
  }

  // --- Tax Table Management ---

  async getTaxTables(financialYear: string): Promise<TaxTablesConfig> {
    const stored = await this.settings.getJSON<TaxTablesConfig>(`taxTables_${financialYear}`);
    if (stored) return stored;
    return this.getDefaultTaxTables(financialYear);
  }

  async saveTaxTables(config: TaxTablesConfig): Promise<void> {
    await this.settings.setJSON(`taxTables_${config.financialYear}`, config);
  }

  async getAvailableFinancialYears(): Promise<string[]> {
    // Look for any saved tax tables, plus always include 2025-26
    const allSettings = await this.prisma.settings.findMany({
      where: { key: { startsWith: 'taxTables_' } },
      select: { key: true },
    });
    const years = new Set(allSettings.map(s => s.key.replace('taxTables_', '')));
    years.add('2025-26');
    return Array.from(years).sort();
  }

  getDefaultTaxTables(financialYear: string): TaxTablesConfig {
    // For now, return 2025-26 defaults for any year
    return { ...DEFAULT_TAX_TABLES_2025_26, financialYear };
  }

  // --- Pure Calculation Methods ---

  calculateIncomeTax(taxableIncome: number, brackets: TaxBracket[]): number {
    if (taxableIncome <= 0) return 0;

    for (let i = brackets.length - 1; i >= 0; i--) {
      const bracket = brackets[i];
      if (taxableIncome >= bracket.min) {
        return bracket.baseTax + (taxableIncome - bracket.min + 1) * bracket.rate;
      }
    }
    return 0;
  }

  calculateMedicareLevy(taxableIncome: number, config: MedicareLevyConfig): number {
    if (taxableIncome <= config.lowIncomeThreshold) return 0;

    if (taxableIncome <= config.shadeInThreshold) {
      // Shade-in: 10c per $1 over low-income threshold
      return (taxableIncome - config.lowIncomeThreshold) * config.shadeInRate;
    }

    // Full Medicare levy
    return taxableIncome * config.rate;
  }

  calculateLITO(taxableIncome: number, config: LITOConfig): number {
    if (taxableIncome <= config.fullThreshold) {
      return config.maxOffset;
    }

    if (taxableIncome <= config.phaseOut1Threshold) {
      // Phase out at phaseOut1Rate per $1 over fullThreshold
      return config.maxOffset - (taxableIncome - config.fullThreshold) * config.phaseOut1Rate;
    }

    if (taxableIncome <= config.zeroThreshold) {
      // Phase out at phaseOut2Rate per $1 over phaseOut1Threshold
      return config.phaseOut1Amount - (taxableIncome - config.phaseOut1Threshold) * config.phaseOut2Rate;
    }

    return 0;
  }

  calculateSmallBusinessOffset(
    netBusinessIncome: number,
    totalTax: number,
    config: SmallBusinessOffsetConfig
  ): number {
    if (netBusinessIncome <= 0) return 0;
    const offset = netBusinessIncome * config.rate;
    // Capped at config.cap AND cannot exceed total tax payable
    return Math.min(offset, config.cap, totalTax);
  }

  // --- Report Generation ---

  async generateTaxEstimation(startDate: Date, endDate: Date): Promise<TaxEstimation> {
    // Determine FY from dates
    const financialYear = this.getFinancialYear(startDate);
    const taxTables = await this.getTaxTables(financialYear);

    // 1. Get business income and expenses (GST-exclusive)
    const businessIncome = await this.getPostingTotals(startDate, endDate, {
      accountType: AccountType.INCOME,
      isBusiness: true,
    });
    const businessExpenses = await this.getPostingTotals(startDate, endDate, {
      accountType: AccountType.EXPENSE,
      isBusiness: true,
    });

    const grossBusinessIncome = Math.abs(businessIncome.total); // Income postings are negative
    const businessExpenseTotal = businessExpenses.total; // Expense postings are positive
    const netBusinessIncome = grossBusinessIncome - businessExpenseTotal;

    // 2. Get other income (non-business, with ATO labels)
    const otherIncomeItems = await this.getATOLabelledTotals(startDate, endDate, [
      'INCOME_INTEREST', 'INCOME_DIVIDENDS', 'INCOME_RENT',
      'INCOME_FOREIGN', 'INCOME_OTHER',
    ]);
    const totalOtherIncome = otherIncomeItems.reduce((sum, item) => sum + item.amount, 0);

    // 3. Get personal deductions (non-business, with ATO labels)
    const personalDeductionItems = await this.getATOLabelledTotals(startDate, endDate, [
      'D1_CAR', 'D2_TRAVEL', 'D3_CLOTHING', 'D4_SELF_ED', 'D5_OTHER_WORK',
      'D7_INTEREST', 'D9_GIFTS', 'D10_TAX_AFFAIRS', 'D12_SUPER', 'D15_OTHER',
    ]);
    const totalPersonalDeductions = personalDeductionItems.reduce((sum, item) => sum + item.amount, 0);

    // 4. Calculate taxable income
    const taxableIncome = Math.max(0, netBusinessIncome + totalOtherIncome - totalPersonalDeductions);

    // 5. Calculate tax components
    const incomeTax = this.calculateIncomeTax(taxableIncome, taxTables.brackets);
    const medicareLevy = this.calculateMedicareLevy(taxableIncome, taxTables.medicareLevyConfig);
    const lito = this.calculateLITO(taxableIncome, taxTables.litoConfig);
    const smallBusinessOffset = this.calculateSmallBusinessOffset(
      netBusinessIncome,
      incomeTax, // SB offset is limited by total income tax
      taxTables.smallBusinessOffset
    );

    const totalTaxPayable = Math.max(0, incomeTax + medicareLevy - lito - smallBusinessOffset);
    const effectiveRate = taxableIncome > 0 ? (totalTaxPayable / taxableIncome) * 100 : 0;

    // 6. Get PAYG payments
    const paygConfig = await this.getPAYGConfig(financialYear);
    const paygPaid = paygConfig
      ? paygConfig.installments.reduce((sum, inst) => sum + (inst.paidAmount ?? 0), 0)
      : 0;

    return {
      financialYear,
      period: { start: startDate, end: endDate },
      grossBusinessIncome,
      businessExpenses: businessExpenseTotal,
      netBusinessIncome,
      otherIncome: otherIncomeItems,
      totalOtherIncome,
      personalDeductions: personalDeductionItems,
      totalPersonalDeductions,
      taxableIncome,
      incomeTax: Math.round(incomeTax * 100) / 100,
      medicareLevy: Math.round(medicareLevy * 100) / 100,
      lito: Math.round(lito * 100) / 100,
      smallBusinessOffset: Math.round(smallBusinessOffset * 100) / 100,
      totalTaxPayable: Math.round(totalTaxPayable * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      paygPaid,
      estimatedBalance: Math.round((totalTaxPayable - paygPaid) * 100) / 100,
    };
  }

  async generateTaxSummary(startDate: Date, endDate: Date): Promise<TaxSummary> {
    const financialYear = this.getFinancialYear(startDate);

    // Get all postings in period with account atoLabel
    const postings = await this.prisma.posting.findMany({
      where: {
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
        account: {
          atoLabel: { not: null },
          kind: 'CATEGORY',
        },
      },
      select: {
        amount: true,
        isBusiness: true,
        gstAmount: true,
        account: {
          select: { name: true, atoLabel: true, type: true },
        },
      },
    });

    // Also get business postings without explicit atoLabel (default to BUS_INCOME/BUS_EXPENSE)
    const unlabelledBusinessPostings = await this.prisma.posting.findMany({
      where: {
        isBusiness: true,
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
        account: {
          atoLabel: null,
          kind: 'CATEGORY',
          type: { in: [AccountType.INCOME, AccountType.EXPENSE] },
        },
      },
      select: {
        amount: true,
        gstAmount: true,
        account: {
          select: { name: true, type: true },
        },
      },
    });

    // Group by ATO label
    const labelGroups = new Map<ATOLabel, Map<string, number>>();

    // Process explicitly labelled postings
    for (const posting of postings) {
      const label = posting.account.atoLabel as ATOLabel;
      const categoryName = posting.account.name;
      const amount = this.getGSTExclusiveAmount(posting);

      if (!labelGroups.has(label)) labelGroups.set(label, new Map());
      const categoryMap = labelGroups.get(label)!;
      categoryMap.set(categoryName, (categoryMap.get(categoryName) ?? 0) + amount);
    }

    // Process unlabelled business postings with default labels
    for (const posting of unlabelledBusinessPostings) {
      const label: ATOLabel = posting.account.type === AccountType.INCOME ? 'BUS_INCOME' : 'BUS_EXPENSE';
      const categoryName = posting.account.name;
      const amount = this.getGSTExclusiveAmount(posting);

      if (!labelGroups.has(label)) labelGroups.set(label, new Map());
      const categoryMap = labelGroups.get(label)!;
      categoryMap.set(categoryName, (categoryMap.get(categoryName) ?? 0) + amount);
    }

    // Build summary items
    const buildItems = (labels: ATOLabel[]): TaxSummaryItem[] => {
      const items: TaxSummaryItem[] = [];
      for (const label of labels) {
        const categoryMap = labelGroups.get(label);
        if (!categoryMap || categoryMap.size === 0) continue;
        const categories = Array.from(categoryMap.entries())
          .map(([name, amount]) => ({ name, amount: Math.abs(amount) }))
          .sort((a, b) => b.amount - a.amount);
        items.push({
          atoLabel: label,
          atoLabelDescription: atoDescriptions[label],
          categories,
          total: categories.reduce((sum, c) => sum + c.amount, 0),
        });
      }
      return items;
    };

    const businessSchedule = buildItems(['BUS_INCOME', 'BUS_COGS', 'BUS_EXPENSE']);
    const otherIncome = buildItems([
      'INCOME_INTEREST', 'INCOME_DIVIDENDS', 'INCOME_RENT',
      'INCOME_FOREIGN', 'INCOME_OTHER',
    ]);
    const personalDeductions = buildItems([
      'D1_CAR', 'D2_TRAVEL', 'D3_CLOTHING', 'D4_SELF_ED', 'D5_OTHER_WORK',
      'D7_INTEREST', 'D9_GIFTS', 'D10_TAX_AFFAIRS', 'D12_SUPER', 'D15_OTHER',
    ]);

    const totalBusinessIncome = businessSchedule
      .filter(i => i.atoLabel === 'BUS_INCOME')
      .reduce((sum, i) => sum + i.total, 0);
    const totalBusinessExpenses = businessSchedule
      .filter(i => i.atoLabel === 'BUS_EXPENSE' || i.atoLabel === 'BUS_COGS')
      .reduce((sum, i) => sum + i.total, 0);
    const netBusinessIncome = totalBusinessIncome - totalBusinessExpenses;
    const totalOtherIncomeAmount = otherIncome.reduce((sum, i) => sum + i.total, 0);
    const totalPersonalDeductionsAmount = personalDeductions.reduce((sum, i) => sum + i.total, 0);
    const taxableIncome = Math.max(0, netBusinessIncome + totalOtherIncomeAmount - totalPersonalDeductionsAmount);

    return {
      financialYear,
      period: { start: startDate, end: endDate },
      businessSchedule,
      otherIncome,
      personalDeductions,
      totalBusinessIncome,
      totalBusinessExpenses,
      netBusinessIncome,
      totalOtherIncome: totalOtherIncomeAmount,
      totalPersonalDeductions: totalPersonalDeductionsAmount,
      taxableIncome,
    };
  }

  // --- PAYG Installment Tracking ---

  async getPAYGConfig(financialYear: string): Promise<PAYGConfig | null> {
    const stored = await this.settings.getJSON<PAYGConfig>(`payg_${financialYear}`);
    if (stored) {
      // Update statuses based on current date
      this.updatePAYGStatuses(stored);
      return stored;
    }
    return null;
  }

  async savePAYGConfig(config: PAYGConfig): Promise<void> {
    this.updatePAYGStatuses(config);
    await this.settings.setJSON(`payg_${config.financialYear}`, config);
  }

  async initializePAYG(financialYear: string, method: 'amount' | 'rate', annualAmount?: number, annualRate?: number): Promise<PAYGConfig> {
    const installments = getDefaultPAYGInstallments(financialYear);
    const quarterlyAmount = annualAmount ? annualAmount / 4 : undefined;

    for (const inst of installments) {
      inst.method = method;
      inst.rate = annualRate;
      inst.assessedAmount = quarterlyAmount;
    }

    const config: PAYGConfig = {
      financialYear,
      method,
      annualRate,
      annualAmount,
      installments,
    };

    this.updatePAYGStatuses(config);
    await this.settings.setJSON(`payg_${financialYear}`, config);
    return config;
  }

  async recordPAYGPayment(
    financialYear: string,
    quarter: string,
    amount: number,
    date: string
  ): Promise<PAYGConfig> {
    let config = await this.getPAYGConfig(financialYear);
    if (!config) {
      config = await this.initializePAYG(financialYear, 'amount');
    }

    const installment = config.installments.find(i => i.quarter === quarter);
    if (!installment) throw new Error(`Quarter ${quarter} not found`);

    installment.paidAmount = amount;
    installment.paidDate = date;
    installment.status = 'paid';

    await this.settings.setJSON(`payg_${financialYear}`, config);
    return config;
  }

  // --- Helper Methods ---

  private getFinancialYear(date: Date): string {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    if (month >= 7) {
      return `${year}-${(year + 1).toString().slice(2)}`;
    }
    return `${year - 1}-${year.toString().slice(2)}`;
  }

  private updatePAYGStatuses(config: PAYGConfig): void {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const inst of config.installments) {
      if (inst.paidAmount != null && inst.paidAmount > 0) {
        inst.status = 'paid';
      } else if (today > inst.dueDate) {
        inst.status = 'overdue';
      } else if (today >= inst.periodStart) {
        inst.status = 'due';
      } else {
        inst.status = 'upcoming';
      }
    }
  }

  private async getPostingTotals(
    startDate: Date,
    endDate: Date,
    filter: { accountType: AccountType; isBusiness?: boolean }
  ): Promise<{ total: number; byCategory: Map<string, number> }> {
    const postings = await this.prisma.posting.findMany({
      where: {
        isBusiness: filter.isBusiness,
        account: { type: filter.accountType, kind: 'CATEGORY' },
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
      select: {
        amount: true,
        gstAmount: true,
        account: { select: { name: true } },
      },
    });

    const byCategory = new Map<string, number>();
    let total = 0;

    for (const posting of postings) {
      // Use GST-exclusive amount for business postings
      const amount = filter.isBusiness
        ? posting.amount - (posting.gstAmount ?? 0)
        : posting.amount;
      total += amount;
      const name = posting.account.name;
      byCategory.set(name, (byCategory.get(name) ?? 0) + amount);
    }

    return { total, byCategory };
  }

  private async getATOLabelledTotals(
    startDate: Date,
    endDate: Date,
    labels: ATOLabel[]
  ): Promise<{ label: string; atoLabel: string; amount: number }[]> {
    const postings = await this.prisma.posting.findMany({
      where: {
        account: {
          atoLabel: { in: labels },
          kind: 'CATEGORY',
        },
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL',
        },
      },
      select: {
        amount: true,
        gstAmount: true,
        isBusiness: true,
        account: { select: { atoLabel: true } },
      },
    });

    // Group by ATO label
    const totals = new Map<string, number>();
    for (const posting of postings) {
      const label = posting.account.atoLabel!;
      const amount = Math.abs(this.getGSTExclusiveAmount(posting));
      totals.set(label, (totals.get(label) ?? 0) + amount);
    }

    return Array.from(totals.entries())
      .filter(([, amount]) => amount > 0)
      .map(([atoLabel, amount]) => ({
        label: atoDescriptions[atoLabel as ATOLabel],
        atoLabel,
        amount,
      }));
  }

  private getGSTExclusiveAmount(posting: { amount: number; gstAmount?: number | null; isBusiness?: boolean }): number {
    if (posting.isBusiness && posting.gstAmount) {
      return posting.amount - posting.gstAmount;
    }
    return posting.amount;
  }
}

export const taxService = new TaxService();
