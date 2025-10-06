export type AccountKind = 'CATEGORY' | 'TRANSFER';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransferType = 'ASSET' | 'LIABILITY' | 'EQUITY';

export interface AccountMeta {
  id: string;
  name: string;
  kind: AccountKind;
  categoryType?: CategoryType;
  transferType?: TransferType;
  archived?: boolean;
}

export function isCategory(account: AccountMeta): account is AccountMeta & { kind: 'CATEGORY'; categoryType?: CategoryType } {
  return account.kind === 'CATEGORY';
}

export function isTransfer(account: AccountMeta): account is AccountMeta & { kind: 'TRANSFER'; transferType?: TransferType } {
  return account.kind === 'TRANSFER';
}
