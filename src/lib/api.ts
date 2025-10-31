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
  Reconciliation,
  AccountType,
  AccountSubtype,
} from '../types';

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  importBatchId: string;
}

const API_BASE = 'http://localhost:3001/api';

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
        const balanceResponse = await fetch(`${API_BASE}/accounts/${account.id}/balance`);
        const { balance } = await balanceResponse.json();
        return {
          ...account,
          currentBalance: balance,
          clearedBalance: balance,
        };
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
    return response.json();
  },

  async getAccountWithBalance(id: string): Promise<AccountWithBalance | null> {
    const account = await this.getAccountById(id);
    if (!account) return null;

    const balanceResponse = await fetch(`${API_BASE}/accounts/${id}/balance`);
    const { balance } = await balanceResponse.json();

    return {
      ...account,
      currentBalance: balance,
      clearedBalance: balance, // TODO: Implement cleared balance calculation
    };
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

    return response.json();
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

    return response.json();
  },

  async updateAccount(accountId: string, payload: {
    name?: string;
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

    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
  },

  async getTransaction(id: string): Promise<TransactionWithPostings> {
    const response = await fetch(`${API_BASE}/transactions/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch transaction');
    }
    return response.json();
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
};

/**
 * Memorized Rule API
 */
export const memorizedRuleAPI = {
  async getAllRules(): Promise<MemorizedRule[]> {
    const response = await fetch(`${API_BASE}/rules`);
    if (!response.ok) throw new Error('Failed to fetch memorized rules');
    return response.json();
  },

  async createRule(data: Partial<MemorizedRule>): Promise<MemorizedRule> {
    const response = await fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create rule');
    return response.json();
  },

  async updateRule(id: string, data: Partial<MemorizedRule>): Promise<MemorizedRule> {
    const response = await fetch(`${API_BASE}/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update rule');
    return response.json();
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
    if (!response.ok) throw new Error('Failed to apply rule to existing transactions');
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
  },

  async getReconciliation(id: string): Promise<Reconciliation> {
    const response = await fetch(`${API_BASE}/reconciliation/${id}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get reconciliation');
    }
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
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
    return response.json();
  },

  async exportToJSON(): Promise<void> {
    window.open(`${API_BASE}/backup/export-json`, '_blank');
  },
};

