import { getPrismaClient } from '../db';
import { AccountKind, AccountSubtype, AccountType, PrismaClient } from '@prisma/client';
import type { AccountWithBalance } from '../../types';

export class AccountService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

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
    console.log('getAllAccounts called with options:', options);
    try {
      const accounts = await this.prisma.account.findMany({
        where: {
          archived: options?.includeArchived ? undefined : false,
          type: options?.type,
          kind: options?.kind,
          isReal: options?.isReal,
          isBusinessDefault: options?.isBusinessDefault,
        },
        orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      });
      console.log('Successfully fetched accounts:', accounts.length);
      return accounts;
    } catch (error) {
      console.error('Error in getAllAccounts:', error);
      throw error; // Re-throw the error so it propagates
    }
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
        `Cannot delete account with ${postingCount} transactions. Archive it instead.`
      );
    }

    await this.prisma.account.delete({
      where: { id },
    });
  }

  /**
   * Calculate account balance
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

    // Sum all postings
    const postings = await this.prisma.posting.findMany({
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
      select: {
        amount: true,
      },
    });

    balance += postings.reduce((sum, p) => sum + p.amount, 0);

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
