import type {
  Account as PrismaAccount,
  Transaction as PrismaTransaction,
  Posting as PrismaPosting,
  MemorizedRule as PrismaMemorizedRule,
  ImportBatch,
  Reconciliation,
  Settings,
} from '@prisma/client';

import {
  AccountType,
  AccountSubtype,
  GSTCode,
  TransactionStatus,
  MatchType,
  AccountKind,
} from '@prisma/client';

export {
  AccountType,
  AccountSubtype,
  GSTCode,
  TransactionStatus,
  MatchType,
  AccountKind,
};

export type Account = PrismaAccount;
export type Transaction = PrismaTransaction;
export type Posting = PrismaPosting;
export type MemorizedRule = PrismaMemorizedRule;
export type { ImportBatch, Reconciliation, Settings };

// Extended types for UI
export interface AccountWithBalance extends PrismaAccount {
  currentBalance: number;
  clearedBalance: number;
}

export interface TransactionWithPostings extends PrismaTransaction {
  postings: PostingWithAccount[];
}

export interface PostingWithAccount extends PrismaPosting {
  account: PrismaAccount;
}

export interface RegisterEntry {
  id: string;
  date: Date;
  payee: string;
  memo?: string;
  reference?: string;
  tags?: string[];
  debit?: number;
  credit?: number;
  runningBalance: number;
  postings: PostingWithAccount[];
  status: TransactionStatus;
  cleared: boolean;
  reconciled: boolean;
}

// Split template for memorized rules
export interface SplitTemplate {
  accountId: string;
  percentOrAmount: number;
  isBusiness: boolean;
  gstCode?: GSTCode;
  gstRate?: number;
  memoTemplate?: string;
}

// CSV import types
export interface CSVColumnMapping {
  date?: number;
  payee?: number;
  description?: number;
  debit?: number;
  credit?: number;
  amount?: number;
  reference?: number;
  balance?: number;
}

export interface CSVRow {
  [key: string]: string;
}

export interface ImportPreview {
  row: CSVRow;
  parsed: {
    date?: Date;
    payee?: string;
    amount?: number;
    reference?: string;
  };
  isDuplicate: boolean;
  matchedRule?: MemorizedRule;
  suggestedCategory?: Account;
  selectedCategoryId?: string; // Category ID selected by user or from rule matching
  suggestedPayee?: string; // Payee name from matched rule (for renaming)
}

// Report types
export interface GSTSummary {
  period: { start: Date; end: Date };
  gstCollected: number; // GST on sales
  gstPaid: number; // GST on purchases
  netGST: number; // Amount owed to/from ATO
  byCategory: Array<{
    categoryName: string;
    sales: number;
    purchases: number;
    gstCollected: number;
    gstPaid: number;
  }>;
  byPayee: Array<{
    payee: string;
    gstCollected: number;
    gstPaid: number;
  }>;
}

export interface ProfitAndLoss {
  period: { start: Date; end: Date };
  businessOnly: boolean;
  income: Array<{
    categoryName: string;
    amount: number;
    gstExclusive?: number;
    gst?: number;
  }>;
  expenses: Array<{
    categoryName: string;
    amount: number;
    gstExclusive?: number;
    gst?: number;
  }>;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface BASDraft {
  period: { start: Date; end: Date };
  g1TotalSales: number; // Total sales (GST-exclusive)
  g2ExportSales: number; // Export sales
  g3OtherGSTFree: number; // Other GST-free sales
  g10CapitalPurchases: number; // Capital purchases
  g11NonCapitalPurchases: number; // Non-capital purchases
  oneAGSTOnSales: number; // 1A: GST on sales
  oneBGSTOnPurchases: number; // 1B: GST on purchases
  netGST: number; // Amount owed to/from ATO (rounded to whole dollars)
  reconciliation: Array<{
    description: string;
    value: number;
  }>;
}

export interface BalanceSheet {
  asOfDate: Date;
  assets: Array<{ accountName: string; balance: number; isReal: boolean }>;
  liabilities: Array<{ accountName: string; balance: number; isReal: boolean }>;
  equity: Array<{ accountName: string; balance: number }>;
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export interface CashFlowStatement {
  period: { start: Date; end: Date };
  operating: {
    items: Array<{ categoryName: string; amount: number }>;
    total: number;
  };
  investing: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  financing: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  netCashChange: number;
  openingCash: number;
  closingCash: number;
}

export interface TagSummary {
  tag: string;
  income: number;
  expenses: number;
  net: number;
  businessAmount?: number;
  personalAmount?: number;
}

// Filter types
export interface RegisterFilter {
  dateFrom?: Date;
  dateTo?: Date;
  startDate?: Date;  // Alternative naming for API compatibility
  endDate?: Date;    // Alternative naming for API compatibility
  search?: string;
  searchText?: string;  // Alternative naming for API compatibility
  tags?: string[];
  amountMin?: number;
  amountMax?: number;
  cleared?: boolean;
  clearedOnly?: boolean;
  reconciled?: boolean;
  reconciledOnly?: boolean;
  businessOnly?: boolean;
  personalOnly?: boolean;
}

// Transaction creation/update DTOs
export interface CreateTransactionDTO {
  date: Date;
  payee: string;
  memo?: string;
  reference?: string;
  tags?: string[];
  externalId?: string;
  metadata?: Record<string, any>;
  postings: CreatePostingDTO[];
}

export interface CreatePostingDTO {
  accountId: string;
  amount: number;
  isBusiness?: boolean;
  gstCode?: GSTCode;
  gstRate?: number;
  gstAmount?: number;
  categorySplitLabel?: string;
  cleared?: boolean;
}

export interface UpdateTransactionDTO {
  id: string;
  date?: Date;
  payee?: string;
  memo?: string;
  reference?: string;
  tags?: string[];
  externalId?: string;
  metadata?: Record<string, any>;
  postings?: CreatePostingDTO[];
}

// Search types
export interface SearchFilter {
  scope: 'global' | string;   // 'global' or an accountId
  dateFrom?: Date;
  dateTo?: Date;
  payee?: string;              // text search (contains, case-insensitive)
  amountMin?: number;
  amountMax?: number;
  categoryId?: string;         // filter by category account
  businessOnly?: boolean;
  personalOnly?: boolean;
  limit?: number;
}

export interface SearchResult {
  transactionId: string;
  date: Date;
  payee: string;
  memo?: string;
  amount: number;              // posting amount in the real account
  accountId: string;           // the real (transfer) account
  accountName: string;
  categoryId?: string;
  categoryName?: string;
  isBusiness: boolean;
  tags?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}

export interface BulkUpdateDTO {
  transactionIds: string[];
  updates: {
    payee?: string;
    categoryId?: string;       // reassign category posting
    tags?: string[];           // replace tags
  };
}

// --- Income Tax Types ---

export interface TaxBracket {
  min: number;
  max: number | null; // null = no upper limit
  rate: number;       // e.g. 0.16 for 16%
  baseTax: number;    // cumulative tax at bracket start
}

export interface MedicareLevyConfig {
  rate: number;                // 0.02
  lowIncomeThreshold: number;  // 27222
  shadeInThreshold: number;    // 34027
  shadeInRate: number;         // 0.10 (10c per $1 over threshold)
  familyThreshold: number;     // 45907
  familyChildExtra: number;    // 3760
}

export interface LITOConfig {
  maxOffset: number;           // 700
  fullThreshold: number;       // 37500
  phaseOut1Rate: number;       // 0.05
  phaseOut1Threshold: number;  // 45000
  phaseOut1Amount: number;     // 325 (offset remaining at phaseOut1Threshold)
  phaseOut2Rate: number;       // 0.015
  zeroThreshold: number;       // 66667
}

export interface SmallBusinessOffsetConfig {
  rate: number;                // 0.16
  cap: number;                 // 1000
  turnoverThreshold: number;   // 5000000
}

export interface TaxTablesConfig {
  financialYear: string;       // "2025-26"
  brackets: TaxBracket[];
  medicareLevyConfig: MedicareLevyConfig;
  litoConfig: LITOConfig;
  smallBusinessOffset: SmallBusinessOffsetConfig;
  superGuaranteeRate: number;  // 0.12
}

export type ATOLabel =
  // Business schedule (sole trader)
  | 'BUS_INCOME'         // Gross business income
  | 'BUS_COGS'           // Cost of goods sold
  | 'BUS_EXPENSE'        // Business expenses (default for business categories)
  // Other income items
  | 'INCOME_INTEREST'    // Item 10: Interest
  | 'INCOME_DIVIDENDS'   // Item 11: Dividends
  | 'INCOME_RENT'        // Item 20: Rent
  | 'INCOME_FOREIGN'     // Item 19: Foreign source income
  | 'INCOME_OTHER'       // Item 24: Other income
  // Personal deductions (D1-D15)
  | 'D1_CAR'             // Work-related car expenses
  | 'D2_TRAVEL'          // Work-related travel
  | 'D3_CLOTHING'        // Work-related clothing/laundry
  | 'D4_SELF_ED'         // Work-related self-education
  | 'D5_OTHER_WORK'      // Other work-related expenses
  | 'D7_INTEREST'        // Interest deductions
  | 'D9_GIFTS'           // Gifts/donations
  | 'D10_TAX_AFFAIRS'    // Cost of managing tax affairs
  | 'D12_SUPER'          // Personal superannuation contributions
  | 'D15_OTHER';         // Other deductions

export const ATO_LABEL_DESCRIPTIONS: Record<ATOLabel, string> = {
  BUS_INCOME: 'Gross Business Income',
  BUS_COGS: 'Cost of Goods Sold',
  BUS_EXPENSE: 'Business Expenses',
  INCOME_INTEREST: 'Item 10: Interest',
  INCOME_DIVIDENDS: 'Item 11: Dividends',
  INCOME_RENT: 'Item 20: Rental Income',
  INCOME_FOREIGN: 'Item 19: Foreign Source Income',
  INCOME_OTHER: 'Item 24: Other Income',
  D1_CAR: 'D1: Work-Related Car Expenses',
  D2_TRAVEL: 'D2: Work-Related Travel',
  D3_CLOTHING: 'D3: Work-Related Clothing/Laundry',
  D4_SELF_ED: 'D4: Work-Related Self-Education',
  D5_OTHER_WORK: 'D5: Other Work-Related Expenses',
  D7_INTEREST: 'D7: Interest Deductions',
  D9_GIFTS: 'D9: Gifts/Donations',
  D10_TAX_AFFAIRS: 'D10: Cost of Managing Tax Affairs',
  D12_SUPER: 'D12: Personal Super Contributions',
  D15_OTHER: 'D15: Other Deductions',
};

export interface TaxEstimation {
  financialYear: string;
  period: { start: Date; end: Date };
  // Income breakdown
  grossBusinessIncome: number;
  businessExpenses: number;
  netBusinessIncome: number;
  otherIncome: { label: string; amount: number }[];
  totalOtherIncome: number;
  // Deductions
  personalDeductions: { label: string; atoLabel: string; amount: number }[];
  totalPersonalDeductions: number;
  // Tax calculation
  taxableIncome: number;
  incomeTax: number;
  medicareLevy: number;
  lito: number;
  smallBusinessOffset: number;
  totalTaxPayable: number;
  effectiveRate: number;
  // PAYG context
  paygPaid: number;
  estimatedBalance: number; // positive = owing, negative = refund
}

export interface TaxSummaryItem {
  atoLabel: ATOLabel;
  atoLabelDescription: string;
  categories: { name: string; amount: number }[];
  total: number;
}

export interface TaxSummary {
  financialYear: string;
  period: { start: Date; end: Date };
  businessSchedule: TaxSummaryItem[];
  otherIncome: TaxSummaryItem[];
  personalDeductions: TaxSummaryItem[];
  totalBusinessIncome: number;
  totalBusinessExpenses: number;
  netBusinessIncome: number;
  totalOtherIncome: number;
  totalPersonalDeductions: number;
  taxableIncome: number;
}

export interface PAYGInstallment {
  id: string;
  quarter: string;          // "Q1", "Q2", "Q3", "Q4"
  financialYear: string;    // "2025-26"
  periodStart: string;      // ISO date
  periodEnd: string;        // ISO date
  dueDate: string;          // ISO date
  method: 'amount' | 'rate';
  rate?: number;
  assessedAmount?: number;
  calculatedAmount?: number;
  paidAmount?: number;
  paidDate?: string;
  status: 'upcoming' | 'due' | 'overdue' | 'paid';
  notes?: string;
}

export interface PAYGConfig {
  financialYear: string;
  method: 'amount' | 'rate';
  annualRate?: number;
  annualAmount?: number;
  installments: PAYGInstallment[];
}

// === Spending Analysis Types ===

export type SpendingGranularity = 'weekly' | 'monthly';

export interface SpendingAnalysisRequest {
  startDate: string;
  endDate: string;
  categoryIds?: string[];
  payees?: string[];
  granularity: SpendingGranularity;
  businessOnly?: boolean;
  personalOnly?: boolean;
  includeIncome?: boolean;
}

export interface SpendingByCategoryItem {
  categoryId: string;
  categoryName: string;
  categoryFullPath: string | null;
  total: number;
  percentage: number;
}

export interface SpendingByPayeeItem {
  payee: string;
  total: number;
  percentage: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
  }>;
}

export interface SpendingTimeBucket {
  bucketStart: string;
  bucketLabel: string;
  total: number;
  byCategory: Record<string, number>;
  byPayee: Record<string, number>;
}

export interface SpendingAnalysisResponse {
  period: { start: Date; end: Date };
  granularity: SpendingGranularity;
  grandTotal: number;
  transactionCount: number;
  byCategory: SpendingByCategoryItem[];
  byPayee: SpendingByPayeeItem[];
  timeSeries: SpendingTimeBucket[];
  averagePerBucket: number;
  highestBucket: { label: string; amount: number };
  lowestBucket: { label: string; amount: number };
}
