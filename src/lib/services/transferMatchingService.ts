/**
 * Transfer Matching Service
 * Finds and merges duplicate transfer transactions across two accounts.
 * After importing CSVs from two bank accounts, inter-account transfers exist
 * as separate transactions. This service matches and merges them into proper
 * double-entry transfer transactions.
 */
import munkres from 'munkres-js';
import type { Transaction, Posting, Account, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../db';

type PostingWithAccount = Posting & { account: Account };
type TransactionWithPostings = Transaction & { postings: PostingWithAccount[] };

export interface TransferCandidate {
  transaction: TransactionWithPostings;
  realAccountPosting: PostingWithAccount;
  categoryPosting: PostingWithAccount;
  amount: number;
  date: Date;
  payee: string;
  isReconciled: boolean;
}

export interface TransferMatchPair {
  candidateA: TransferCandidate;
  candidateB: TransferCandidate;
  matchScore: number;
  matchType: 'exact' | 'probable' | 'possible';
  reasons: string[];
}

export interface TransferMatchPreview {
  matches: TransferMatchPair[];
  unmatchedA: TransferCandidate[];
  unmatchedB: TransferCandidate[];
  summary: {
    totalCandidatesA: number;
    totalCandidatesB: number;
    exactMatches: number;
    probableMatches: number;
    possibleMatches: number;
    unmatched: number;
  };
}

export interface TransferMatchResult {
  merged: number;
  skipped: number;
  errors: string[];
}

const TRANSFER_KEYWORDS = [
  'internal transfer',
  'transfer',
  'from macbank',
  'to macbank',
  'from linked account',
  'to linked account',
  'internet transfer',
  'tfr',
];

export class TransferMatchingService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

  /**
   * Find transactions that look like one side of a transfer on a given account.
   * Criteria: exactly 2 postings, one to the specified real account, the other
   * to a category account (Uncategorized or transfer-like).
   */
  async findTransferCandidates(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransferCandidate[]> {
    // Buffer dates ±1 day for timezone safety
    const bufferedStart = startDate ? new Date(startDate.getTime() - 24 * 60 * 60 * 1000) : undefined;
    const bufferedEnd = endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : undefined;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: 'NORMAL',
        postings: { some: { accountId } },
        ...(bufferedStart || bufferedEnd ? {
          date: {
            ...(bufferedStart && { gte: bufferedStart }),
            ...(bufferedEnd && { lte: bufferedEnd }),
          },
        } : {}),
      },
      include: {
        postings: { include: { account: true } },
      },
      orderBy: { date: 'asc' },
    });

    const candidates: TransferCandidate[] = [];

    for (const tx of transactions) {
      // Must have exactly 2 postings
      if (tx.postings.length !== 2) continue;

      const realPosting = tx.postings.find((p: PostingWithAccount) => p.accountId === accountId);
      const otherPosting = tx.postings.find((p: PostingWithAccount) => p.accountId !== accountId);

      if (!realPosting || !otherPosting) continue;

      // Other posting must be to a CATEGORY account (not another real/TRANSFER account)
      // If other posting is already to a TRANSFER account, this is already a proper transfer
      if (otherPosting.account.kind !== 'CATEGORY') continue;

      // Check if transaction looks like a transfer (category name or payee keywords)
      if (!this.isTransferLikely(otherPosting.account, tx.payee)) continue;

      candidates.push({
        transaction: tx,
        realAccountPosting: realPosting,
        categoryPosting: otherPosting,
        amount: realPosting.amount,
        date: new Date(tx.date),
        payee: tx.payee,
        isReconciled: realPosting.reconciled,
      });
    }

    return candidates;
  }

  /**
   * Check if a transaction is likely a transfer based on category name and payee.
   */
  private isTransferLikely(categoryAccount: Account, payee: string): boolean {
    const catName = categoryAccount.name.toLowerCase();
    const payeeLower = payee.toLowerCase();

    // Category is "Uncategorized" or contains "transfer"
    if (catName === 'uncategorized' || catName.includes('transfer')) return true;

    // Payee contains transfer keywords
    return TRANSFER_KEYWORDS.some(kw => payeeLower.includes(kw));
  }

  /**
   * Check if a payee string contains transfer-related keywords.
   */
  private hasTransferKeyword(payee: string): boolean {
    const lower = payee.toLowerCase();
    return TRANSFER_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Calculate a match score between two transfer candidates.
   * Max score: 100 (50 amount + 30 date + 20 keywords)
   */
  calculateMatchScore(
    a: TransferCandidate,
    b: TransferCandidate
  ): { total: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 1. AMOUNT MATCHING (0-50 points)
    // Transfers should have opposite signs and equal absolute amounts
    const absA = Math.abs(a.amount);
    const absB = Math.abs(b.amount);
    const signsOpposite = (a.amount > 0 && b.amount < 0) || (a.amount < 0 && b.amount > 0);

    if (signsOpposite && Math.abs(absA - absB) < 0.01) {
      score += 50;
      reasons.push('Exact amount match with opposite signs');
    } else if (Math.abs(absA - absB) < 0.01) {
      // Same amounts but same sign — unusual but possible
      score += 30;
      reasons.push('Exact amount match (same sign)');
    } else if (Math.abs(absA - absB) < 1.00) {
      score += 15;
      reasons.push('Amount within $1');
    }

    // 2. DATE MATCHING (0-30 points)
    const dateDiff = Math.abs(a.date.getTime() - b.date.getTime()) / (1000 * 60 * 60 * 24);

    if (dateDiff < 0.5) {
      score += 30;
      reasons.push('Same date');
    } else if (dateDiff <= 1) {
      score += 25;
      reasons.push('Date within 1 day');
    } else if (dateDiff <= 3) {
      score += 15;
      reasons.push('Date within 3 days');
    } else if (dateDiff <= 7) {
      score += 5;
      reasons.push('Date within 7 days');
    }

    // 3. DESCRIPTION/PAYEE MATCHING (0-20 points)
    const aIsTransfer = this.hasTransferKeyword(a.payee);
    const bIsTransfer = this.hasTransferKeyword(b.payee);

    if (aIsTransfer && bIsTransfer) {
      score += 20;
      reasons.push('Both payees contain transfer keywords');
    } else if (aIsTransfer || bIsTransfer) {
      score += 10;
      reasons.push('One payee contains transfer keyword');
    }

    return { total: score, reasons };
  }

  /**
   * Get match type label from score.
   */
  private getMatchType(score: number): 'exact' | 'probable' | 'possible' {
    if (score >= 80) return 'exact';
    if (score >= 60) return 'probable';
    return 'possible';
  }

  /**
   * Match transfer candidates between two accounts using Hungarian algorithm.
   */
  async matchTransfers(
    accountIdA: string,
    accountIdB: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransferMatchPreview> {
    const candidatesA = await this.findTransferCandidates(accountIdA, startDate, endDate);
    const candidatesB = await this.findTransferCandidates(accountIdB, startDate, endDate);

    if (candidatesA.length === 0 || candidatesB.length === 0) {
      return {
        matches: [],
        unmatchedA: candidatesA,
        unmatchedB: candidatesB,
        summary: {
          totalCandidatesA: candidatesA.length,
          totalCandidatesB: candidatesB.length,
          exactMatches: 0,
          probableMatches: 0,
          possibleMatches: 0,
          unmatched: candidatesA.length + candidatesB.length,
        },
      };
    }

    // Build score matrix
    const scoreMatrix: number[][] = [];
    const reasonsMatrix: string[][][] = [];

    for (let i = 0; i < candidatesA.length; i++) {
      scoreMatrix[i] = [];
      reasonsMatrix[i] = [];
      for (let j = 0; j < candidatesB.length; j++) {
        const result = this.calculateMatchScore(candidatesA[i], candidatesB[j]);
        scoreMatrix[i][j] = result.total;
        reasonsMatrix[i][j] = result.reasons;
      }
    }

    // Convert to cost matrix for Hungarian algorithm (munkres minimizes cost)
    const maxScore = 100;
    const matrixSize = Math.max(candidatesA.length, candidatesB.length);
    const costMatrix: number[][] = [];

    for (let i = 0; i < matrixSize; i++) {
      costMatrix[i] = [];
      for (let j = 0; j < matrixSize; j++) {
        if (i < candidatesA.length && j < candidatesB.length) {
          costMatrix[i][j] = maxScore - scoreMatrix[i][j];
        } else {
          costMatrix[i][j] = maxScore; // Padding for non-square matrix
        }
      }
    }

    // Run Hungarian algorithm for optimal 1:1 assignment
    const assignments = munkres(costMatrix);

    const matches: TransferMatchPair[] = [];
    const matchedAIndices = new Set<number>();
    const matchedBIndices = new Set<number>();

    for (const [idxA, idxB] of assignments) {
      if (idxA >= candidatesA.length || idxB >= candidatesB.length) continue;

      const score = scoreMatrix[idxA][idxB];
      if (score < 40) continue; // Minimum threshold

      matchedAIndices.add(idxA);
      matchedBIndices.add(idxB);

      matches.push({
        candidateA: candidatesA[idxA],
        candidateB: candidatesB[idxB],
        matchScore: score,
        matchType: this.getMatchType(score),
        reasons: reasonsMatrix[idxA][idxB],
      });
    }

    // Sort matches by score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    const unmatchedA = candidatesA.filter((_, i) => !matchedAIndices.has(i));
    const unmatchedB = candidatesB.filter((_, i) => !matchedBIndices.has(i));

    return {
      matches,
      unmatchedA,
      unmatchedB,
      summary: {
        totalCandidatesA: candidatesA.length,
        totalCandidatesB: candidatesB.length,
        exactMatches: matches.filter(m => m.matchType === 'exact').length,
        probableMatches: matches.filter(m => m.matchType === 'probable').length,
        possibleMatches: matches.filter(m => m.matchType === 'possible').length,
        unmatched: unmatchedA.length + unmatchedB.length,
      },
    };
  }

  /**
   * Commit selected match pairs — merge each pair into a single transfer transaction.
   * For each pair: keep Transaction A, replace its category posting with Account B's
   * real posting (preserving B's original amount), delete Transaction B.
   * All within a Prisma transaction for atomicity.
   */
  async commitMatches(
    pairs: Array<{ candidateAId: string; candidateBId: string }>
  ): Promise<TransferMatchResult> {
    let merged = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const pair of pairs) {
      try {
        await this.prisma.$transaction(async (tx: any) => {
          // Re-fetch both transactions with full data
          const txA = await tx.transaction.findUnique({
            where: { id: pair.candidateAId },
            include: { postings: { include: { account: true } } },
          });
          const txB = await tx.transaction.findUnique({
            where: { id: pair.candidateBId },
            include: { postings: { include: { account: true } } },
          });

          if (!txA || !txB) throw new Error('Transaction not found');

          // Identify postings
          const aRealPosting = txA.postings.find((p: PostingWithAccount) => p.account.kind === 'TRANSFER');
          const aCategoryPosting = txA.postings.find((p: PostingWithAccount) => p.account.kind === 'CATEGORY');
          const bRealPosting = txB.postings.find((p: PostingWithAccount) => p.account.kind === 'TRANSFER');

          if (!aRealPosting || !aCategoryPosting || !bRealPosting) {
            throw new Error('Cannot identify transfer postings');
          }

          // Safety: accounts must be different (no self-transfers)
          if (aRealPosting.accountId === bRealPosting.accountId) {
            throw new Error('Both transactions post to the same account');
          }

          // Safety: skip reconciled postings
          if (aRealPosting.reconciled || bRealPosting.reconciled) {
            throw new Error('Cannot merge reconciled transactions');
          }

          // Use B's real posting amount (preserves the sign from B's CSV import).
          // Adjust A's posting to balance if needed (double-entry: sum must be zero).
          const bAmount = bRealPosting.amount;
          const aAmount = -bAmount; // Ensure double-entry balance

          // Delete the category posting from Transaction A
          await tx.posting.delete({ where: { id: aCategoryPosting.id } });

          // Update Transaction A's real posting amount to ensure balance
          await tx.posting.update({
            where: { id: aRealPosting.id },
            data: { amount: aAmount },
          });

          // Create new posting on Transaction A for Account B's real account
          await tx.posting.create({
            data: {
              transactionId: txA.id,
              accountId: bRealPosting.accountId,
              amount: bAmount, // Preserve B's original amount and sign
              isBusiness: bRealPosting.isBusiness,
              cleared: bRealPosting.cleared,
            },
          });

          // Update Transaction A with merge metadata, preserve both payees, use earlier date
          const existingMeta = txA.metadata ? JSON.parse(txA.metadata) : {};
          await tx.transaction.update({
            where: { id: txA.id },
            data: {
              date: new Date(Math.min(new Date(txA.date).getTime(), new Date(txB.date).getTime())),
              payee: txA.payee || txB.payee || 'Transfer',
              metadata: JSON.stringify({
                ...existingMeta,
                transferMatched: true,
                mergedTransactionId: txB.id,
                mergedPayee: txB.payee, // Preserve B's payee for reference
                mergedAt: new Date().toISOString(),
              }),
            },
          });

          // Delete Transaction B and its postings
          await tx.posting.deleteMany({ where: { transactionId: txB.id } });
          await tx.transaction.delete({ where: { id: txB.id } });
        });

        merged++;
      } catch (err) {
        skipped++;
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    return { merged, skipped, errors };
  }
}

export const transferMatchingService = new TransferMatchingService();
