import { useEffect, useMemo, useState } from 'react';
import { accountAPI } from '@/lib/api';
import type { AccountType, AccountWithBalance } from '@/types';
import type { AccountMeta, AccountKind, CategoryType, TransferType } from '@/domain';
import { onlySelectableCategories, onlySelectableTransfers } from '@/domain';

let accountsCache: AccountMeta[] | null = null;
let accountsPromise: Promise<AccountMeta[]> | null = null;
const listeners = new Set<(accounts: AccountMeta[]) => void>();

const CATEGORY_TYPES: readonly CategoryType[] = ['INCOME', 'EXPENSE'];
const TRANSFER_TYPES: readonly TransferType[] = ['ASSET', 'LIABILITY', 'EQUITY'];

function notify(accounts: AccountMeta[]) {
  listeners.forEach((listener) => {
    try {
      listener(accounts);
    } catch (error) {
      console.error('Account listener failed', error);
    }
  });
}

function setAccountsCache(accounts: AccountMeta[]): AccountMeta[] {
  accountsCache = accounts;
  notify(accounts);
  return accounts;
}

function mapAccountToMeta(account: AccountWithBalance): AccountMeta {
  const { id, name, type, archived } = account;
  const kind = (account as AccountWithBalance & { kind?: AccountKind }).kind;
  const resolvedKind: AccountKind = kind ?? (isCategoryType(type) ? 'CATEGORY' : 'TRANSFER');

  if (resolvedKind === 'CATEGORY') {
    return {
      id,
      name,
      kind: 'CATEGORY',
      categoryType: isCategoryType(type) ? type : 'EXPENSE',
      archived: archived ?? false,
    };
  }

  return {
    id,
    name,
    kind: 'TRANSFER',
    transferType: sanitizeTransferType(type),
    archived: archived ?? false,
  };
}

function isCategoryType(type: AccountType): type is CategoryType {
  return CATEGORY_TYPES.includes(type as CategoryType);
}

async function fetchAccountsByKind(kind: AccountKind): Promise<AccountMeta[]> {
  const accounts = await accountAPI.getAllAccountsWithBalances({ kind });
  return accounts.map(mapAccountToMeta);
}

function sanitizeTransferType(type: AccountType): TransferType | undefined {
  if (TRANSFER_TYPES.includes(type as TransferType)) {
    return type as TransferType;
  }
  return undefined;
}

async function scheduleFetch(): Promise<AccountMeta[]> {
  if (!accountsPromise) {
    accountsPromise = (async () => {
      const [categories, transfers] = await Promise.all([
        fetchAccountsByKind('CATEGORY'),
        fetchAccountsByKind('TRANSFER'),
      ]);
      const combined = [...categories, ...transfers];
      return setAccountsCache(combined);
    })()
      .catch((error) => {
        accountsPromise = null;
        throw error;
      })
      .finally(() => {
        accountsPromise = null;
      }) as Promise<AccountMeta[]>;
  }

  return accountsPromise;
}

async function fetchAccountsMeta(): Promise<AccountMeta[]> {
  if (accountsCache) {
    return accountsCache;
  }
  return scheduleFetch();
}

export function useAllAccounts(): AccountMeta[] {
  const [accounts, setAccounts] = useState<AccountMeta[]>(() => accountsCache ?? []);

  useEffect(() => {
    const listener = (next: AccountMeta[]) => {
      setAccounts(next);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (accountsCache) {
      setAccounts(accountsCache);
      return;
    }

    let cancelled = false;
    scheduleFetch()
      .then((result) => {
        if (!cancelled) {
          setAccounts(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load accounts', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return accounts;
}

export function useCategoryAccounts(): AccountMeta[] {
  const accounts = useAllAccounts();
  return useMemo(() => onlySelectableCategories(accounts), [accounts]);
}

export function useTransferAccounts(excludeId?: string): AccountMeta[] {
  const accounts = useAllAccounts();
  return useMemo(() => onlySelectableTransfers(accounts, excludeId), [accounts, excludeId]);
}

export function primeAccountsCache(accounts: AccountWithBalance[]): void {
  setAccountsCache(accounts.map(mapAccountToMeta));
}

export function invalidateAccountsCache(): void {
  accountsCache = null;
  accountsPromise = null;
}

export async function refreshAccountsCache(): Promise<AccountMeta[]> {
  accountsCache = null;
  return scheduleFetch();
}
