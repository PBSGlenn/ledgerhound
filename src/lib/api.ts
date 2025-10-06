import type { AccountKind } from '@/domain';
/**
 * API bridge layer for Express backend
 *
 * Connects the React UI to the Express API server running on localhost:3001
 */

import type {
  Account,
  AccountWithBalance,
  RegisterEntry,
  RegisterFilter,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionWithPostings,
} from '../types';

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
    const params = new URLSearchParams();
    params.set('kind', 'CATEGORY');
    if (options?.includeArchived) params.set('includeArchived', 'true');

    const query = params.toString();
    const path = query ? `${API_BASE}/categories?${query}` : `${API_BASE}/categories`;
    const response = await fetch(path);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
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
};
