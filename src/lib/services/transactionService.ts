import { getPrismaClient } from '../db';
import type {
  Transaction,
  Posting,
  Account,
  TransactionStatus,
} from '@prisma/client';
import type {
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionWithPostings,
  RegisterEntry,
  RegisterFilter,
} from '../../types';

export class TransactionService {
  private prisma = getPrismaClient();

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

      // Validate GST calculation (amount should be GST-exclusive)
      const expectedGST = posting.amount * posting.gstRate / (1 + posting.gstRate);
      const diff = Math.abs((posting.gstAmount ?? 0) - expectedGST);

      // Allow for small rounding differences (±0.02)
      if (diff > 0.02) {
        console.warn(
          `GST amount mismatch: expected ${expectedGST.toFixed(2)}, got ${posting.gstAmount?.toFixed(2)}`
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
    // Validate double-entry
    this.validateDoubleEntry(data.postings);

    // Validate each posting's GST
    data.postings.forEach((posting) => this.validateGST(posting));

    // Delete existing postings and create new ones (simpler than trying to update)
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Delete old postings
      await tx.posting.deleteMany({
        where: { transactionId: data.id },
      });

      // Update transaction and create new postings
      return tx.transaction.update({
        where: { id: data.id },
        data: {
          date: data.date,
          payee: data.payee,
          memo: data.memo,
          reference: data.reference,
          tags: data.tags ? JSON.stringify(data.tags) : null,
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
      orderBy: [{ transaction: { date: 'desc' } }, { createdAt: 'desc' }],
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

    // Calculate running balance
    let runningBalance = 0;

    // Convert to register entries
    const entries: RegisterEntry[] = postings.map((posting) => {
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
        debit: posting.amount > 0 ? posting.amount : undefined,
        credit: posting.amount < 0 ? Math.abs(posting.amount) : undefined,
        runningBalance,
        postings: txPostings,
        status: posting.transaction.status,
        cleared: accountPosting?.cleared ?? false,
        reconciled: accountPosting?.reconciled ?? false,
      };
    });

    return entries;
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
   * Bulk update category for multiple transactions
   */
  async bulkUpdateCategory(
    transactionIds: string[],
    oldAccountId: string,
    newAccountId: string
  ): Promise<void> {
    await this.prisma.posting.updateMany({
      where: {
        transactionId: { in: transactionIds },
        accountId: oldAccountId,
      },
      data: {
        accountId: newAccountId,
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
