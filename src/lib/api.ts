import type { AccountKind } from '@/domain';
import type {
  CSVColumnMapping,
  ImportPreview,
  MemorizedRule,
  Account,
  AccountWithBalance,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionWithPostings,
  RegisterEntry,
  RegisterFilter,
  ProfitAndLoss,
  GSTSummary,
  BASDraft,
  TagSummary,
  BalanceSheet,
  CashFlowStatement,
  Reconciliation,
  AccountType,
  AccountSubtype,
  SearchFilter,
  SearchResponse,
  BulkUpdateDTO,
  TaxEstimation,
  TaxSummary,
  TaxTablesConfig,
  PAYGConfig,
  SpendingAnalysisRequest,
  SpendingAnalysisResponse,
} from '../types';

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  importBatchId: string;
}

// In production (served from Express), use relative URL; in dev, use the API server port
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

type CategoryAccountPayload = {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  isBusinessDefault?: boolean;
};

/**
 * Account API
 */
export const accountAPI = {
  async getAllAccountsWithBalances(options?: { kind?: AccountKind; includeArchived?: boolean; isReal?: boolean }): Promise<AccountWithBalance[]> {
    const params = new URLSearchParams();
    if (options?.kind) params.set('kind', options.kind);
    if (options?.includeArchived) params.set('includeArchived', 'true');
    if (options?.isReal) params.set('isReal', 'true');

    const query = params.toString();
    const path = query ? `${API_BASE}/accounts?${query}` : `${API_BASE}/accounts`;
    const response = await fetch(path);
    if (!response.ok) throw new Error('Failed to fetch accounts');
    const accounts = await response.json();

    const accountsWithBalances = await Promise.all(
      accounts.map(async (account: Account) => {
        try {
          const balanceResponse = await fetch(`${API_BASE}/accounts/${account.id}/balance`);
          if (!balanceResponse.ok) {
            console.warn(`Failed to fetch balance for account ${account.id}`);
            return { ...account, currentBalance: 0, clearedBalance: 0 };
          }
          const { balance } = await balanceResponse.json();
          return {
            ...account,
            currentBalance: balance ?? 0,
            clearedBalance: balance ?? 0,
          };
        } catch (error) {
          console.warn(`Error fetching balance for account ${account.id}:`, error);
          return { ...account, currentBalance: 0, clearedBalance: 0 };
        }
      })
    );

    return accountsWithBalances;
  },

  async getCategories(options?: { includeArchived?: boolean }): Promise<Account[]> {
    return this.getAllAccountsWithBalances({ ...options, kind: 'CATEGORY' });
  },
  async getAccountById(id: string): Promise<Account | null> {
    const response = await fetch(`${API_BASE}/accounts/${id}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch account');
    return await response.json();
  },

  async getAccountWithBalance(id: string): Promise<AccountWithBalance | null> {
    const account = await this.getAccountById(id);
    if (!account) return null;

    try {
      const balanceResponse = await fetch(`${API_BASE}/accounts/${id}/balance`);
      if (!balanceResponse.ok) {
        console.warn(`Failed to fetch balance for account ${id}`);
        return { ...account, currentBalance: 0, clearedBalance: 0 };
      }
      const { balance } = await balanceResponse.json();
      return {
        ...account,
        currentBalance: balance ?? 0,
        clearedBalance: balance ?? 0,
      };
    } catch (error) {
      console.warn(`Error fetching balance for account ${id}:`, error);
      return { ...account, currentBalance: 0, clearedBalance: 0 };
    }
  },

  async createCategory(payload: CategoryAccountPayload): Promise<Account> {
    const response = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        type: payload.type,
        kind: 'CATEGORY',
        isReal: false,
        isBusinessDefault: payload.isBusinessDefault ?? false,
        sortOrder: 0,
      }),
    });

    if (!response.ok) {
      let message = 'Failed to create category';
      try {
        const error = await response.json();
        if (error?.error) {
          message = error.error;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    return await response.json();
  },

  async createAccount(payload: {
    name: string;
    type: AccountType;
    subtype?: AccountSubtype | null;
    kind: 'TRANSFER' | 'CATEGORY';
    isReal: boolean;
    openingBalance?: number;
    openingDate?: Date;
    isBusinessDefault?: boolean;
    defaultHasGst?: boolean;
    parentId?: string;
  }): Promise<Account> {
    const response = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        type: payload.type,
        subtype: payload.subtype || null,
        kind: payload.kind,
        isReal: payload.isReal,
        openingBalance: payload.openingBalance ?? 0,
        openingDate: payload.openingDate ? payload.openingDate.toISOString() : new Date().toISOString(),
        isBusinessDefault: payload.isBusinessDefault ?? false,
        defaultHasGst: payload.defaultHasGst,
        parentId: payload.parentId,
        sortOrder: 0,
      }),
    });

    if (!response.ok) {
      let message = 'Failed to create account';
      try {
        const error = await response.json();
        if (error?.error) {
          message = error.error;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    return await response.json();
  },

  async updateAccount(accountId: string, payload: {
    name?: string;
    parentId?: string | null;
    isBusinessDefault?: boolean;
    defaultHasGst?: boolean;
    openingBalance?: number;
    openingDate?: Date;
    currency?: string;
    sortOrder?: number;
  }): Promise<Account> {
    const response = await fetch(`${API_BASE}/accounts/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        openingDate: payload.openingDate ? payload.openingDate.toISOString() : undefined,
      }),
    });

    if (!response.ok) {
      let message = 'Failed to update account';
      try {
        const error = await response.json();
        if (error?.error) {
          message = error.error;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    return await response.json();
  },

  async updateCategory(categoryId: string, payload: {
    name?: string;
    parentId?: string | null;
    isBusinessDefault?: boolean;
    defaultHasGst?: boolean;
    atoLabel?: string | null;
  }): Promise<Account> {
    const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = 'Failed to update category';
      try {
        const error = await response.json();
        if (error?.error) {
          message = error.error;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    return await response.json();
  },

  async deleteCategory(categoryId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      let message = 'Failed to delete category';
      try {
        const error = await response.json();
        if (error?.error) {
          message = error.error;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }
  },

  async deleteAccount(accountId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/accounts/${accountId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      let message = 'Failed to delete account';
      try {
        const error = await response.json();
        if (error?.error) {
          message = error.error;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }
  },
};

/**
 * Transaction API
 */
export const transactionAPI = {
  async getRegisterEntries(
    accountId: string,
    filter?: RegisterFilter
  ): Promise<RegisterEntry[]> {
    const params = new URLSearchParams();
    if (filter?.startDate) params.set('startDate', filter.startDate.toISOString());
    if (filter?.endDate) params.set('endDate', filter.endDate.toISOString());
    if (filter?.searchText) params.set('searchText', filter.searchText);
    if (filter?.cleared !== undefined) params.set('cleared', String(filter.cleared));
    if (filter?.reconciled !== undefined) params.set('reconciled', String(filter.reconciled));

    const url = `${API_BASE}/transactions/register/${accountId}?${params}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch register entries');
    return await response.json();
  },

  async createTransaction(data: CreateTransactionDTO): Promise<TransactionWithPostings> {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create transaction');
    }
    return await response.json();
  },

  async updateTransaction(data: UpdateTransactionDTO): Promise<TransactionWithPostings> {
    const response = await fetch(`${API_BASE}/transactions/${data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update transaction');
    }
    return await response.json();
  },

  async getTransaction(id: string): Promise<TransactionWithPostings> {
    const response = await fetch(`${API_BASE}/transactions/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch transaction');
    }
    return await response.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete transaction');
    }
  },

  async bulkAddTags(transactionIds: string[], tags: string[]): Promise<void> {
    const response = await fetch(`${API_BASE}/transactions/bulk-add-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds, tags }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add tags');
    }
  },

  async markCleared(postingIds: string[], cleared: boolean): Promise<void> {
    const response = await fetch(`${API_BASE}/transactions/mark-cleared`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postingIds, cleared }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to mark as cleared');
    }
  },

  async searchTransactions(filter: SearchFilter): Promise<SearchResponse> {
    const body: any = { scope: filter.scope };
    if (filter.dateFrom) body.dateFrom = filter.dateFrom instanceof Date ? filter.dateFrom.toISOString() : filter.dateFrom;
    if (filter.dateTo) body.dateTo = filter.dateTo instanceof Date ? filter.dateTo.toISOString() : filter.dateTo;
    if (filter.payee) body.payee = filter.payee;
    if (filter.amountMin !== undefined) body.amountMin = filter.amountMin;
    if (filter.amountMax !== undefined) body.amountMax = filter.amountMax;
    if (filter.categoryId) body.categoryId = filter.categoryId;
    if (filter.businessOnly) body.businessOnly = filter.businessOnly;
    if (filter.personalOnly) body.personalOnly = filter.personalOnly;
    if (filter.limit) body.limit = filter.limit;

    const response = await fetch(`${API_BASE}/transactions/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search transactions');
    }
    return await response.json();
  },

  async bulkUpdateTransactions(data: BulkUpdateDTO): Promise<{ updatedCount: number }> {
    const response = await fetch(`${API_BASE}/transactions/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to bulk update transactions');
    }
    return await response.json();
  },
};

/**
 * Memorized Rule API
 */
export const memorizedRuleAPI = {
  async getAllRules(): Promise<MemorizedRule[]> {
    const response = await fetch(`${API_BASE}/rules`);
    if (!response.ok) throw new Error('Failed to fetch memorized rules');
    return await response.json();
  },

  async createRule(data: Partial<MemorizedRule>): Promise<MemorizedRule> {
    const response = await fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create rule');
    return await response.json();
  },

  async updateRule(id: string, data: Partial<MemorizedRule>): Promise<MemorizedRule> {
    const response = await fetch(`${API_BASE}/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update rule');
    return await response.json();
  },

  async deleteRule(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/rules/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete rule');
  },

  async reorderRules(ruleIds: string[]): Promise<void> {
    const response = await fetch(`${API_BASE}/rules/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleIds }),
    });
    if (!response.ok) throw new Error('Failed to reorder rules');
  },

  async applyToExisting(ruleId: string): Promise<{ count: number; transactions: string[] }> {
    const response = await fetch(`${API_BASE}/rules/${ruleId}/apply-to-existing`, {
      method: 'POST',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to apply rule to existing transactions');
    }
    return await response.json();
  },
};

/**
 * Import API
 */
export const importAPI = {
  async previewImport(
    csvText: string,
    mapping: CSVColumnMapping,
    sourceAccountId: string
  ): Promise<ImportPreview[]> {
    const response = await fetch(`${API_BASE}/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText, mapping, sourceAccountId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to preview import');
    }
    return await response.json();
  },

  async importTransactions(
    previews: ImportPreview[],
    sourceAccountId: string,
    sourceName: string,
    mapping: CSVColumnMapping,
    options?: { skipDuplicates?: boolean; applyRules?: boolean }
  ): Promise<ImportResult> {
    const response = await fetch(`${API_BASE}/import/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previews, sourceAccountId, sourceName, mapping, options }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to import transactions');
    }
    return await response.json();
  },

  async saveImportMappingTemplate(
    name: string,
    mapping: CSVColumnMapping,
    accountId?: string
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/import/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mapping, accountId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save import mapping template');
    }
  },

  async getImportMappingTemplates(accountId?: string): Promise<Array<{ name: string; mapping: CSVColumnMapping; accountId?: string }>> {
    const params = new URLSearchParams();
    if (accountId) params.set('accountId', accountId);
    const query = params.toString();
    const path = query ? `${API_BASE}/import/mappings?${query}` : `${API_BASE}/import/mappings`;
    const response = await fetch(path);
    if (!response.ok) throw new Error('Failed to fetch import mapping templates');
    return await response.json();
  },
};

/**
 * Report API
 */
export const reportAPI = {
  async generateProfitAndLoss(
    startDate: Date,
    endDate: Date,
    options?: {
      businessOnly?: boolean;
      personalOnly?: boolean;
      gstInclusive?: boolean;
    }
  ): Promise<ProfitAndLoss> {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());
    if (options?.businessOnly) params.set('businessOnly', 'true');
    if (options?.personalOnly) params.set('personalOnly', 'true');
    if (options?.gstInclusive) params.set('gstInclusive', 'true');

    const response = await fetch(`${API_BASE}/reports/profit-loss?${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate P&L report');
    }
    return await response.json();
  },

  async generateGSTSummary(startDate: Date, endDate: Date): Promise<GSTSummary> {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());

    const response = await fetch(`${API_BASE}/reports/gst-summary?${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate GST summary');
    }
    return await response.json();
  },

  async generateBASDraft(startDate: Date, endDate: Date): Promise<BASDraft> {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());

    const response = await fetch(`${API_BASE}/reports/bas-draft?${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate BAS draft');
    }
    return await response.json();
  },

  async generateTagSummary(
    startDate: Date,
    endDate: Date,
    options?: { businessOnly?: boolean; personalOnly?: boolean }
  ): Promise<TagSummary[]> {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());
    if (options?.businessOnly) params.set('businessOnly', 'true');
    if (options?.personalOnly) params.set('personalOnly', 'true');

    const response = await fetch(`${API_BASE}/reports/tag-summary?${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate tag summary');
    }
    return await response.json();
  },

  async generateBalanceSheet(asOfDate: Date): Promise<BalanceSheet> {
    const params = new URLSearchParams();
    params.set('asOfDate', asOfDate.toISOString());

    const response = await fetch(`${API_BASE}/reports/balance-sheet?${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate balance sheet');
    }
    return await response.json();
  },

  async generateCashFlow(startDate: Date, endDate: Date): Promise<CashFlowStatement> {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());

    const response = await fetch(`${API_BASE}/reports/cash-flow?${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate cash flow statement');
    }
    return await response.json();
  },

  async generateSpendingAnalysis(request: SpendingAnalysisRequest): Promise<SpendingAnalysisResponse> {
    const response = await fetch(`${API_BASE}/reports/spending-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate spending analysis');
    }
    return await response.json();
  },
};

/**
 * Tax API
 */
export const taxAPI = {
  async generateTaxEstimation(startDate: Date, endDate: Date): Promise<TaxEstimation> {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());

    const response = await fetch(`${API_BASE}/tax/estimation?${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate tax estimation');
    }
    return await response.json();
  },

  async generateTaxSummary(startDate: Date, endDate: Date): Promise<TaxSummary> {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());

    const response = await fetch(`${API_BASE}/tax/summary?${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate tax summary');
    }
    return await response.json();
  },

  async getAvailableYears(): Promise<string[]> {
    const response = await fetch(`${API_BASE}/tax/tables`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get available years');
    }
    return await response.json();
  },

  async getTaxTables(financialYear: string): Promise<TaxTablesConfig> {
    const response = await fetch(`${API_BASE}/tax/tables/${financialYear}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get tax tables');
    }
    return await response.json();
  },

  async saveTaxTables(config: TaxTablesConfig): Promise<void> {
    const response = await fetch(`${API_BASE}/tax/tables/${config.financialYear}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save tax tables');
    }
  },

  async getPAYGConfig(financialYear: string): Promise<PAYGConfig | null> {
    const response = await fetch(`${API_BASE}/tax/payg/${financialYear}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get PAYG config');
    }
    return await response.json();
  },

  async savePAYGConfig(config: PAYGConfig): Promise<void> {
    const response = await fetch(`${API_BASE}/tax/payg/${config.financialYear}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save PAYG config');
    }
  },
};

/**
 * Reconciliation API
 */
export const reconciliationAPI = {
  async startReconciliation(data: {
    accountId: string;
    statementStartDate: Date;
    statementEndDate: Date;
    statementStartBalance: number;
    statementEndBalance: number;
    notes?: string;
  }): Promise<Reconciliation> {
    const response = await fetch(`${API_BASE}/reconciliation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: data.accountId,
        statementStartDate: data.statementStartDate.toISOString(),
        statementEndDate: data.statementEndDate.toISOString(),
        statementStartBalance: data.statementStartBalance,
        statementEndBalance: data.statementEndBalance,
        notes: data.notes,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start reconciliation');
    }
    return await response.json();
  },

  async getReconciliation(id: string): Promise<Reconciliation> {
    const response = await fetch(`${API_BASE}/reconciliation/${id}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get reconciliation');
    }
    return await response.json();
  },

  async getInProgressReconciliation(accountId: string): Promise<Reconciliation | null> {
    const response = await fetch(`${API_BASE}/reconciliation/in-progress/${accountId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get in-progress reconciliation');
    }
    return await response.json();
  },

  async getReconciliationStatus(id: string): Promise<{
    statementBalance: number;
    clearedBalance: number;
    unreconciledBalance: number;
    difference: number;
    isBalanced: boolean;
    reconciledCount: number;
    unreconciledCount: number;
  }> {
    const response = await fetch(`${API_BASE}/reconciliation/${id}/status`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get reconciliation status');
    }
    return await response.json();
  },

  async reconcilePostings(reconciliationId: string, postingIds: string[]): Promise<void> {
    const response = await fetch(`${API_BASE}/reconciliation/${reconciliationId}/reconcile-postings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postingIds }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reconcile postings');
    }
  },

  async unreconcilePostings(reconciliationId: string, postingIds: string[]): Promise<void> {
    const response = await fetch(`${API_BASE}/reconciliation/${reconciliationId}/unreconcile-postings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postingIds }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unreconcile postings');
    }
  },

  async lockReconciliation(id: string): Promise<Reconciliation> {
    const response = await fetch(`${API_BASE}/reconciliation/${id}/lock`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to lock reconciliation');
    }
    return await response.json();
  },

  async parsePDF(file: File): Promise<{
    info: {
      accountNumber?: string;
      accountName?: string;
      statementPeriod?: { start: Date; end: Date };
      openingBalance?: number;
      closingBalance?: number;
    };
    transactions: Array<{
      date: Date;
      description: string;
      debit?: number;
      credit?: number;
      balance?: number;
      rawText: string;
    }>;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch(`${API_BASE}/reconciliation/parse-pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to parse PDF');
    }

    const result = await response.json();

    // Convert date strings back to Date objects
    if (result.info.statementPeriod) {
      result.info.statementPeriod.start = new Date(result.info.statementPeriod.start);
      result.info.statementPeriod.end = new Date(result.info.statementPeriod.end);
    }

    result.transactions = result.transactions.map((tx: any) => ({
      ...tx,
      date: new Date(tx.date),
    }));

    return result;
  },

  async matchTransactions(
    reconciliationId: string,
    statementTransactions: Array<{
      date: Date;
      description: string;
      debit?: number;
      credit?: number;
      balance?: number;
      rawText?: string;
    }>
  ): Promise<{
    exactMatches: Array<any>;
    probableMatches: Array<any>;
    possibleMatches: Array<any>;
    unmatchedStatement: Array<any>;
    unmatchedLedger: Array<any>;
    summary: {
      totalStatement: number;
      totalMatched: number;
      totalUnmatched: number;
      statementBalance?: number;
      ledgerBalance: number;
      difference?: number;
    };
  }> {
    const response = await fetch(`${API_BASE}/reconciliation/${reconciliationId}/match-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statementTransactions: statementTransactions.map(tx => ({
          ...tx,
          date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to match transactions');
    }

    const result = await response.json();

    // Convert date strings back to Date objects
    const convertDates = (matches: any[]) =>
      matches.map(match => ({
        ...match,
        statementTx: {
          ...match.statementTx,
          date: new Date(match.statementTx.date),
        },
        ledgerTx: match.ledgerTx
          ? {
              ...match.ledgerTx,
              date: new Date(match.ledgerTx.date),
            }
          : undefined,
      }));

    return {
      ...result,
      exactMatches: convertDates(result.exactMatches),
      probableMatches: convertDates(result.probableMatches),
      possibleMatches: convertDates(result.possibleMatches),
      unmatchedStatement: result.unmatchedStatement.map((tx: any) => ({
        ...tx,
        date: new Date(tx.date),
      })),
      unmatchedLedger: result.unmatchedLedger.map((tx: any) => ({
        ...tx,
        date: new Date(tx.date),
      })),
    };
  },
};

// Backup API
export const backupAPI = {
  async createBackup(type?: 'manual' | 'auto' | 'pre-import' | 'pre-reconcile'): Promise<{
    filename: string;
    timestamp: Date;
    size: number;
    type: string;
  }> {
    const response = await fetch(`${API_BASE}/backup/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type || 'manual' }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create backup');
    }
    return await response.json();
  },

  async listBackups(): Promise<Array<{
    filename: string;
    timestamp: Date;
    size: number;
    type: string;
  }>> {
    const response = await fetch(`${API_BASE}/backup/list`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list backups');
    }
    return await response.json();
  },

  async restoreBackup(filename: string): Promise<void> {
    const response = await fetch(`${API_BASE}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to restore backup');
    }
  },

  async deleteBackup(filename: string): Promise<void> {
    const response = await fetch(`${API_BASE}/backup/${filename}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete backup');
    }
  },

  async cleanOldBackups(keepCount: number = 10): Promise<{ deletedCount: number }> {
    const response = await fetch(`${API_BASE}/backup/clean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepCount }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to clean old backups');
    }
    return await response.json();
  },

  async getStats(): Promise<{
    accounts: number;
    transactions: number;
    postings: number;
    size: number;
  }> {
    const response = await fetch(`${API_BASE}/backup/stats`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get database stats');
    }
    return await response.json();
  },

  async exportToJSON(): Promise<void> {
    window.open(`${API_BASE}/backup/export-json`, '_blank');
  },
};

export interface VersionInfo {
  version: string;
  gitHash: string;
  gitBranch: string;
  lastCommitDate: string;
  lastCommitMessage: string;
  nodeVersion: string;
  platform: string;
}

export interface UpdateCheck {
  updateAvailable: boolean;
  currentHash: string;
  remoteHash: string;
  behindBy: number;
  latestCommitMessage: string;
}

export interface UpdateResult {
  success: boolean;
  newVersion: string;
  newHash: string;
  pullOutput: string;
  installOutput: string;
  restartRequired: boolean;
}

export const systemAPI = {
  async getVersion(): Promise<VersionInfo> {
    const response = await fetch(`${API_BASE}/system/version`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get version info');
    }
    return await response.json();
  },

  async checkUpdate(): Promise<UpdateCheck> {
    const response = await fetch(`${API_BASE}/system/check-update`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to check for updates');
    }
    return await response.json();
  },

  async performUpdate(): Promise<UpdateResult> {
    const response = await fetch(`${API_BASE}/system/update`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to perform update');
    }
    return await response.json();
  },
};

/**
 * Books API — server-side database switching
 */
export const booksAPI = {
  async switchDatabase(databasePath: string): Promise<{ success: boolean; isNew: boolean }> {
    const response = await fetch(`${API_BASE}/books/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databasePath }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to switch database');
    }
    return await response.json();
  },

  async getActiveDb(): Promise<{ currentDbUrl: string }> {
    const response = await fetch(`${API_BASE}/books/active-db`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get active database');
    }
    return await response.json();
  },
};

/**
 * Transfer Matching API — find and merge duplicate transfers across accounts
 */
export const transferMatchingAPI = {
  async previewMatches(
    accountIdA: string,
    accountIdB: string,
    startDate?: string,
    endDate?: string,
  ) {
    const response = await fetch(`${API_BASE}/transfers/match-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountIdA, accountIdB, startDate, endDate }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to preview transfer matches');
    }
    return await response.json();
  },

  async commitMatches(
    pairs: Array<{ candidateAId: string; candidateBId: string }>,
  ) {
    const response = await fetch(`${API_BASE}/transfers/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairs }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to commit transfer matches');
    }
    return await response.json();
  },
};

