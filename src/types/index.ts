export {
  AccountType,
  AccountSubtype,
  GSTCode,
  TransactionStatus,
  MatchType,
  type Account,
  type Transaction,
  type Posting,
  type MemorizedRule,
  type ImportBatch,
  type Reconciliation,
  type Settings,
} from '@prisma/client';

// Extended types for UI
export interface AccountWithBalance extends Account {
  currentBalance: number;
  clearedBalance: number;
}

export interface TransactionWithPostings extends Transaction {
  postings: PostingWithAccount[];
}

export interface PostingWithAccount extends Posting {
  account: Account;
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

// Filter types
export interface RegisterFilter {
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  tags?: string[];
  amountMin?: number;
  amountMax?: number;
  clearedOnly?: boolean;
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

export interface UpdateTransactionDTO extends CreateTransactionDTO {
  id: string;
}
