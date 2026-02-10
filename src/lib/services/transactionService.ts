import { getPrismaClient } from '../db';
import type {
  Transaction,
  Posting,
  Account,
  TransactionStatus,
  PrismaClient,
} from '@prisma/client';
import type {
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionWithPostings,
  RegisterEntry,
  RegisterFilter,
} from '../../types';

export class TransactionService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

  /**
   * Validate that postings sum to zero (double-entry requirement)
   */
  private validateDoubleEntry(postings: { amount: number }[]): void {
    const sum = postings.reduce((acc, p) => acc + p.amount, 0);
    // Allow for floating point imprecision (±0.01)
    if (Math.abs(sum) > 0.01) {
      throw new Error(
        `Transaction postings must sum to zero. Current sum: ${sum.toFixed(2)}`
      );
    }
  }

  /**
   * Validate GST on a posting
   */
  private validateGST(posting: {
    isBusiness: boolean;
    gstCode?: string | null;
    gstRate?: number | null;
    gstAmount?: number | null;
    amount: number;
  }): void {
    if (!posting.isBusiness) {
      // Personal postings should not have GST
      if (posting.gstCode || posting.gstRate || posting.gstAmount) {
        throw new Error(
          'Personal transactions (isBusiness=false) cannot have GST information'
        );
      }
      return;
    }

    // Business postings should have GST info if GST code is set
    if (posting.gstCode && posting.gstCode !== 'GST_FREE' && posting.gstCode !== 'INPUT_TAXED') {
      if (!posting.gstRate || posting.gstAmount === undefined) {
        throw new Error(
          `Business posting with GST code "${posting.gstCode}" must have gstRate and gstAmount`
        );
      }

      // Validate GST calculation (amount is GST-exclusive, so GST = |amount| * rate)
      // Use absolute value since gstAmount is always positive regardless of posting sign
      const expectedGST = Math.abs(posting.amount * posting.gstRate);
      const diff = Math.abs((posting.gstAmount ?? 0) - expectedGST);

      // Allow for small rounding differences (±0.02), but throw error for larger discrepancies
      if (diff > 0.02) {
        throw new Error(
          `GST amount mismatch: expected ${expectedGST.toFixed(2)}, got ${posting.gstAmount?.toFixed(2)}. ` +
          `Please check the GST calculation.`
        );
      }
    }
  }

  /**
   * Create a new transaction
   */
  async createTransaction(data: CreateTransactionDTO): Promise<TransactionWithPostings> {
    // Validate double-entry
    this.validateDoubleEntry(data.postings);

    // Validate each posting's GST
    data.postings.forEach((posting) => this.validateGST(posting));

    // Create transaction with postings
    const transaction = await this.prisma.transaction.create({
      data: {
        date: data.date,
        payee: data.payee,
        memo: data.memo,
        reference: data.reference,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        externalId: data.externalId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        postings: {
          create: data.postings.map((p) => ({
            accountId: p.accountId,
            amount: p.amount,
            isBusiness: p.isBusiness ?? false,
            gstCode: p.gstCode,
            gstRate: p.gstRate,
            gstAmount: p.gstAmount,
            categorySplitLabel: p.categorySplitLabel,
            cleared: p.cleared ?? false,
          })),
        },
      },
      include: {
        postings: {
          include: {
            account: true,
          },
        },
      },
    });

    return transaction;
  }

  /**
   * Update an existing transaction
   */
  async updateTransaction(data: UpdateTransactionDTO): Promise<TransactionWithPostings> {
    // If postings are provided, validate them
    if (data.postings) {
      this.validateDoubleEntry(data.postings);
      data.postings.forEach((posting) => this.validateGST(posting));
    }

    // Delete existing postings and create new ones (simpler than trying to update)
    const transaction = await this.prisma.$transaction(async (tx) => {
      // If postings are provided, delete old ones
      if (data.postings) {
        await tx.posting.deleteMany({
          where: { transactionId: data.id },
        });
      }

      // Update transaction and create new postings if provided
      return tx.transaction.update({
        where: { id: data.id },
        data: {
          ...(data.date !== undefined && { date: data.date }),
          ...(data.payee !== undefined && { payee: data.payee }),
          ...(data.memo !== undefined && { memo: data.memo }),
          ...(data.reference !== undefined && { reference: data.reference }),
          ...(data.tags !== undefined && { tags: data.tags ? JSON.stringify(data.tags) : null }),
          ...(data.externalId !== undefined && { externalId: data.externalId }),
          ...(data.metadata !== undefined && { metadata: data.metadata ? JSON.stringify(data.metadata) : null }),
          ...(data.postings && {
            postings: {
              create: data.postings.map((p) => ({
                accountId: p.accountId,
                amount: p.amount,
                isBusiness: p.isBusiness ?? false,
                gstCode: p.gstCode,
                gstRate: p.gstRate,
                gstAmount: p.gstAmount,
                categorySplitLabel: p.categorySplitLabel,
                cleared: p.cleared ?? false,
              })),
            },
          }),
        },
        include: {
          postings: {
            include: {
              account: true,
            },
          },
        },
      });
    });

    return transaction;
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: string): Promise<void> {
    // Check if any postings are reconciled
    const reconciledCount = await this.prisma.posting.count({
      where: {
        transactionId: id,
        reconciled: true,
      },
    });

    if (reconciledCount > 0) {
      throw new Error(
        'Cannot delete transaction with reconciled postings. Void it instead.'
      );
    }

    await this.prisma.transaction.delete({
      where: { id },
    });
  }

  /**
   * Void a transaction (mark as void instead of deleting)
   */
  async voidTransaction(id: string): Promise<Transaction> {
    return this.prisma.transaction.update({
      where: { id },
      data: { status: 'VOID' },
    });
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: string): Promise<TransactionWithPostings | null> {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: {
        postings: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  /**
   * Get register entries for an account
   */
  async getRegisterEntries(
    accountId: string,
    filter?: RegisterFilter
  ): Promise<RegisterEntry[]> {
    // Get account details for opening balance
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { openingBalance: true, openingDate: true, name: true },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Build where clause
    const where: any = {
      accountId,
      transaction: {
        status: 'NORMAL', // Exclude voided transactions
        date: {
          gte: filter?.dateFrom,
          lte: filter?.dateTo,
        },
        ...(filter?.search
          ? {
              OR: [
                { payee: { contains: filter.search, mode: 'insensitive' } },
                { memo: { contains: filter.search, mode: 'insensitive' } },
                { reference: { contains: filter.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      ...(filter?.clearedOnly ? { cleared: true } : {}),
      ...(filter?.reconciledOnly ? { reconciled: true } : {}),
      ...(filter?.businessOnly ? { isBusiness: true } : {}),
      ...(filter?.personalOnly ? { isBusiness: false } : {}),
    };

    // Get postings for this account
    const postings = await this.prisma.posting.findMany({
      where,
      include: {
        transaction: true,
        account: true,
      },
      orderBy: [{ transaction: { date: 'asc' } }, { createdAt: 'asc' }],
    });

    // Get all related transactions with all their postings
    const transactionIds = postings.map((p) => p.transaction.id);
    const allPostings = await this.prisma.posting.findMany({
      where: {
        transactionId: { in: transactionIds },
      },
      include: {
        account: true,
      },
    });

    // Group postings by transaction
    const postingsByTransaction = new Map<string, typeof allPostings>();
    allPostings.forEach((p) => {
      const existing = postingsByTransaction.get(p.transactionId) || [];
      existing.push(p);
      postingsByTransaction.set(p.transactionId, existing);
    });

    // Start running balance with opening balance
    let runningBalance = account.openingBalance;

    // Create opening balance entry (first entry in register)
    const openingBalanceEntry: RegisterEntry = {
      id: `opening-${accountId}`,
      date: account.openingDate,
      payee: 'Opening Balance',
      memo: undefined,
      reference: undefined,
      tags: undefined,
      debit: undefined,  // Opening balance shows only in balance column
      credit: undefined,
      runningBalance: account.openingBalance,
      postings: [],
      status: 'NORMAL',
      cleared: true,
      reconciled: true,
    };

    // Convert to register entries
    const transactionEntries: RegisterEntry[] = postings.map((posting) => {
      const txPostings = postingsByTransaction.get(posting.transactionId) || [];
      const accountPosting = txPostings.find((p) => p.accountId === accountId);

      runningBalance += posting.amount;

      return {
        id: posting.transaction.id,
        date: posting.transaction.date,
        payee: posting.transaction.payee,
        memo: posting.transaction.memo ?? undefined,
        reference: posting.transaction.reference ?? undefined,
        tags: posting.transaction.tags
          ? JSON.parse(posting.transaction.tags)
          : undefined,
        // For asset accounts: negative = debit (money out), positive = credit (money in)
        debit: posting.amount < 0 ? Math.abs(posting.amount) : undefined,
        credit: posting.amount > 0 ? posting.amount : undefined,
        runningBalance,
        postings: txPostings,
        status: posting.transaction.status,
        cleared: accountPosting?.cleared ?? false,
        reconciled: accountPosting?.reconciled ?? false,
      };
    });

    // Sort transaction entries by date (oldest first)
    transactionEntries.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB; // Ascending order
    });

    // Return opening balance + transaction entries
    return [openingBalanceEntry, ...transactionEntries];
  }

  /**
   * Mark postings as cleared
   */
  async markCleared(
    postingIds: string[],
    cleared: boolean
  ): Promise<void> {
    await this.prisma.posting.updateMany({
      where: {
        id: { in: postingIds },
      },
      data: {
        cleared,
      },
    });
  }

  /**
   * Bulk add tags to transactions
   */
  async bulkAddTags(transactionIds: string[], tags: string[]): Promise<void> {
    const transactions = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds } },
    });

    await this.prisma.$transaction(
      transactions.map((tx) => {
        const existingTags = tx.tags ? JSON.parse(tx.tags) : [];
        const newTags = Array.from(new Set([...existingTags, ...tags]));

        return this.prisma.transaction.update({
          where: { id: tx.id },
          data: { tags: JSON.stringify(newTags) },
        });
      })
    );
  }
}

export const transactionService = new TransactionService();
