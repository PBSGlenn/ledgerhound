import { getPrismaClient } from '../db';
import { AccountKind, AccountSubtype, AccountType, PrismaClient } from '@prisma/client';
import type { AccountWithBalance } from '../../types';

export class AccountService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

  // Account type ordering for sorting (standard accounting order)
  private static readonly TYPE_ORDER: Record<AccountType, number> = {
    [AccountType.ASSET]: 0,
    [AccountType.LIABILITY]: 1,
    [AccountType.EQUITY]: 2,
    [AccountType.INCOME]: 3,
    [AccountType.EXPENSE]: 4,
  };

  /**
   * Get all accounts with optional filtering
   */
  async getAllAccounts(options?: {
    includeArchived?: boolean;
    type?: AccountType;
    kind?: AccountKind;
    isReal?: boolean;
    isBusinessDefault?: boolean;
  }): Promise<Account[]> {
    const accounts = await this.prisma.account.findMany({
      where: {
        archived: options?.includeArchived ? undefined : false,
        type: options?.type,
        kind: options?.kind,
        isReal: options?.isReal,
        isBusinessDefault: options?.isBusinessDefault,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Sort by account type using business order (Prisma sorts enums alphabetically)
    return accounts.sort((a, b) => {
      const typeOrderA = AccountService.TYPE_ORDER[a.type];
      const typeOrderB = AccountService.TYPE_ORDER[b.type];
      if (typeOrderA !== typeOrderB) {
        return typeOrderA - typeOrderB;
      }
      // Secondary sort by sortOrder (already handled by Prisma, but maintain for tie-breaking)
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      // Tertiary sort by name
      return a.name.localeCompare(b.name);
    });
  }

  private deriveKind(type: AccountType): AccountKind {
    return type === AccountType.INCOME || type === AccountType.EXPENSE ? AccountKind.CATEGORY : AccountKind.TRANSFER;
  }

  /**
   * Get account by ID
   */
  async getAccountById(id: string): Promise<Account | null> {
    return this.prisma.account.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new account
   */
  async createAccount(data: {
    name: string;
    type: AccountType;
    subtype?: AccountSubtype;
    isReal?: boolean;
    isBusinessDefault?: boolean;
    defaultHasGst?: boolean;
    parentId?: string | null;
    openingBalance?: number;
    openingDate?: Date;
    currency?: string;
    sortOrder?: number;
  }): Promise<Account> {
    // Check for duplicate name within the same type
    const existing = await this.prisma.account.findFirst({
      where: {
        name: data.name,
        type: data.type,
      },
    });

    if (existing) {
      throw new Error(`Account "${data.name}" already exists for type ${data.type}`);
    }

    return this.prisma.account.create({
      data: {
        kind: this.deriveKind(data.type),
        name: data.name,
        type: data.type,
        subtype: data.subtype,
        isReal: data.isReal ?? true,
        isBusinessDefault: data.isBusinessDefault ?? false,
        defaultHasGst: data.defaultHasGst,
        parentId: data.parentId ?? null,
        openingBalance: data.openingBalance ?? 0,
        openingDate: data.openingDate ?? new Date(),
        currency: data.currency ?? 'AUD',
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  /**
   * Update an account
   */
  async updateAccount(
    id: string,
    data: Partial<Omit<Account, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Account> {
    // If name or type is being changed, check for duplicates
    if (data.name || data.type) {
      const current = await this.getAccountById(id);
      if (!current) {
        throw new Error(`Account ${id} not found`);
      }

      const existing = await this.prisma.account.findFirst({
        where: {
          name: data.name ?? current.name,
          type: data.type ?? current.type,
          id: { not: id },
        },
      });

      if (existing) {
        throw new Error(
          `Account "${data.name ?? current.name}" already exists for type ${
            data.type ?? current.type
          }`
        );
      }
    }

    const updateData: Partial<Account> = { ...data };
    if (data.type) {
      updateData.kind = this.deriveKind(data.type);
    } else if ('kind' in updateData) {
      delete (updateData as Partial<Account> & { kind?: AccountKind }).kind;
    }

    return this.prisma.account.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Archive/unarchive an account
   */
  async archiveAccount(id: string, archived: boolean): Promise<Account> {
    return this.prisma.account.update({
      where: { id },
      data: { archived },
    });
  }

  /**
   * Delete an account (only if no postings exist)
   */
  async deleteAccount(id: string): Promise<void> {
    // Check if account has any postings
    const postingCount = await this.prisma.posting.count({
      where: { accountId: id },
    });

    if (postingCount > 0) {
      throw new Error(
        `Cannot delete account with ${postingCount} transaction(s). Archive it instead.`
      );
    }

    // Check if account has any child categories
    const childCount = await this.prisma.account.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      throw new Error(
        `Cannot delete category with ${childCount} subcategory(ies). Delete or move the subcategories first.`
      );
    }

    // Check if account is used in memorized rules
    const ruleCount = await this.prisma.memorizedRule.count({
      where: { defaultAccountId: id },
    });

    if (ruleCount > 0) {
      throw new Error(
        `Cannot delete account used in ${ruleCount} memorized rule(s). Update or delete the rules first.`
      );
    }

    await this.prisma.account.delete({
      where: { id },
    });
  }

  /**
   * Calculate account balance using database aggregation for efficiency
   */
  async getAccountBalance(
    accountId: string,
    options?: {
      upToDate?: Date;
      clearedOnly?: boolean;
      reconciledOnly?: boolean;
    }
  ): Promise<number> {
    const account = await this.getAccountById(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Start with opening balance
    let balance = account.openingBalance;

    // Use database aggregation for sum (more efficient than fetching all postings)
    const result = await this.prisma.posting.aggregate({
      where: {
        accountId,
        transaction: {
          date: options?.upToDate
            ? { lte: options.upToDate }
            : undefined,
          status: 'NORMAL', // Exclude void transactions
        },
        cleared: options?.clearedOnly ? true : undefined,
        reconciled: options?.reconciledOnly ? true : undefined,
      },
      _sum: {
        amount: true,
      },
    });

    balance += result._sum.amount ?? 0;

    return balance;
  }

  /**
   * Get account with balance information
   */
  async getAccountWithBalance(accountId: string): Promise<AccountWithBalance> {
    const account = await this.getAccountById(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const currentBalance = await this.getAccountBalance(accountId);
    const clearedBalance = await this.getAccountBalance(accountId, {
      clearedOnly: true,
    });

    return {
      ...account,
      currentBalance,
      clearedBalance,
    };
  }

  /**
   * Get all accounts with balances
   */
  async getAllAccountsWithBalances(options?: {
    includeArchived?: boolean;
    type?: AccountType;
  }): Promise<AccountWithBalance[]> {
    const accounts = await this.getAllAccounts(options);

    return Promise.all(
      accounts.map(async (account) => {
        const currentBalance = await this.getAccountBalance(account.id);
        const clearedBalance = await this.getAccountBalance(account.id, {
          clearedOnly: true,
        });

        return {
          ...account,
          currentBalance,
          clearedBalance,
        };
      })
    );
  }

  /**
   * Reorder accounts
   */
  async reorderAccounts(accountIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      accountIds.map((id, index) =>
        this.prisma.account.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
  }
}

export const accountService = new AccountService();
