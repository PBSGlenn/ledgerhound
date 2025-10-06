import { isCategory, isTransfer, type AccountMeta, type CategoryType, type TransferType } from './accountKinds';

export function onlySelectableCategories(accounts: AccountMeta[]): AccountMeta[] {
  return accounts.filter((account) => isCategory(account) && !account.archived);
}

export function onlySelectableTransfers(accounts: AccountMeta[], excludeId?: string): AccountMeta[] {
  return accounts.filter(
    (account) => isTransfer(account) && !account.archived && (!excludeId || account.id !== excludeId),
  );
}

type CategoryGroups = Record<CategoryType, AccountMeta[]>;
type TransferGroups = Record<TransferType, AccountMeta[]>;

export function groupCategoriesByType(accounts: AccountMeta[]): CategoryGroups {
  const groups: CategoryGroups = {
    INCOME: [],
    EXPENSE: [],
  };

  for (const account of onlySelectableCategories(accounts)) {
    if (!account.categoryType) continue;
    groups[account.categoryType].push(account);
  }

  return groups;
}

export function groupTransfersByType(accounts: AccountMeta[]): TransferGroups {
  const groups: TransferGroups = {
    ASSET: [],
    LIABILITY: [],
    EQUITY: [],
  };

  for (const account of onlySelectableTransfers(accounts)) {
    if (!account.transferType) continue;
    groups[account.transferType].push(account);
  }

  return groups;
}
