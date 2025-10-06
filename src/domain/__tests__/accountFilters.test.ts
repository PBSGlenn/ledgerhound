import { describe, expect, it } from 'vitest';
import {
  onlySelectableCategories,
  onlySelectableTransfers,
  groupCategoriesByType,
  groupTransfersByType,
} from '../accountFilters';
import type { AccountMeta } from '../accountKinds';

const sampleAccounts: AccountMeta[] = [
  { id: 'inc-1', name: 'Salary', kind: 'CATEGORY', categoryType: 'INCOME' },
  { id: 'exp-1', name: 'Groceries', kind: 'CATEGORY', categoryType: 'EXPENSE' },
  { id: 'exp-archived', name: 'Old Expense', kind: 'CATEGORY', categoryType: 'EXPENSE', archived: true },
  { id: 'exp-unknown', name: 'Nameless Category', kind: 'CATEGORY' },
  { id: 'asset-1', name: 'Everyday Account', kind: 'TRANSFER', transferType: 'ASSET' },
  { id: 'liability-1', name: 'Credit Card', kind: 'TRANSFER', transferType: 'LIABILITY' },
  { id: 'equity-archived', name: 'Closed Equity', kind: 'TRANSFER', transferType: 'EQUITY', archived: true },
  { id: 'transfer-unknown', name: 'Unknown Transfer', kind: 'TRANSFER' },
];

describe('onlySelectableCategories', () => {
  it('returns only non-archived category accounts', () => {
    const result = onlySelectableCategories(sampleAccounts);
    expect(result.map((account) => account.id)).toEqual(['inc-1', 'exp-1', 'exp-unknown']);
  });
});

describe('onlySelectableTransfers', () => {
  it('returns only non-archived transfer accounts', () => {
    const result = onlySelectableTransfers(sampleAccounts);
    expect(result.map((account) => account.id)).toEqual(['asset-1', 'liability-1', 'transfer-unknown']);
  });

  it('excludes the provided account id when present', () => {
    const result = onlySelectableTransfers(sampleAccounts, 'liability-1');
    expect(result.map((account) => account.id)).toEqual(['asset-1', 'transfer-unknown']);
  });
});

describe('groupCategoriesByType', () => {
  it('groups categories by income and expense types, ignoring missing types', () => {
    const result = groupCategoriesByType(sampleAccounts);
    expect(result.INCOME.map((account) => account.id)).toEqual(['inc-1']);
    expect(result.EXPENSE.map((account) => account.id)).toEqual(['exp-1']);
  });
});

describe('groupTransfersByType', () => {
  it('groups transfers by asset, liability, and equity types, ignoring missing types', () => {
    const result = groupTransfersByType(sampleAccounts);
    expect(result.ASSET.map((account) => account.id)).toEqual(['asset-1']);
    expect(result.LIABILITY.map((account) => account.id)).toEqual(['liability-1']);
    expect(result.EQUITY.map((account) => account.id)).toEqual([]);
  });
});
