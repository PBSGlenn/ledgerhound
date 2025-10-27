import { compareTwoStrings } from 'string-similarity';
import type { StatementTransaction } from './pdfStatementService';
import type { Transaction, Posting } from '@prisma/client';
import { getPrismaClient } from '../db';

export interface TransactionMatch {
  statementTx: StatementTransaction;
  ledgerTx?: Transaction & { postings: Posting[] };
  matchScore: number;
  matchType: 'exact' | 'probable' | 'possible' | 'none';
  reasons: string[];
}

export interface ReconciliationPreview {
  exactMatches: TransactionMatch[];
  probableMatches: TransactionMatch[];
  possibleMatches: TransactionMatch[];
  unmatchedStatement: StatementTransaction[];
  unmatchedLedger: (Transaction & { postings: Posting[] })[];
  summary: {
    totalStatement: number;
    totalMatched: number;
    totalUnmatched: number;
    statementBalance?: number;
    ledgerBalance: number;
    difference?: number;
  };
}

export class ReconciliationMatchingService {
  private prisma = getPrismaClient();

  /**
   * Match statement transactions with ledger transactions
   */
  async matchTransactions(
    accountId: string,
    statementTransactions: StatementTransaction[],
    startDate?: Date,
    endDate?: Date
  ): Promise<ReconciliationPreview> {
    // Get ledger transactions for the account in the date range
    const ledgerTransactions = await this.getLedgerTransactions(
      accountId,
      startDate,
      endDate
    );

    const exactMatches: TransactionMatch[] = [];
    const probableMatches: TransactionMatch[] = [];
    const possibleMatches: TransactionMatch[] = [];
    const unmatchedStatement: StatementTransaction[] = [];
    const matchedLedgerIds = new Set<string>();

    // Try to match each statement transaction
    for (const stmtTx of statementTransactions) {
      const match = this.findBestMatch(stmtTx, ledgerTransactions, matchedLedgerIds);

      if (match.matchType === 'exact') {
        exactMatches.push(match);
        if (match.ledgerTx) matchedLedgerIds.add(match.ledgerTx.id);
      } else if (match.matchType === 'probable') {
        probableMatches.push(match);
        if (match.ledgerTx) matchedLedgerIds.add(match.ledgerTx.id);
      } else if (match.matchType === 'possible') {
        possibleMatches.push(match);
      } else {
        unmatchedStatement.push(stmtTx);
      }
    }

    // Find unmatched ledger transactions
    const unmatchedLedger = ledgerTransactions.filter(
      tx => !matchedLedgerIds.has(tx.id)
    );

    // Calculate summary
    const totalMatched = exactMatches.length + probableMatches.length;
    const ledgerBalance = this.calculateBalance(accountId, ledgerTransactions);
    const statementBalance = statementTransactions[statementTransactions.length - 1]?.balance;

    return {
      exactMatches,
      probableMatches,
      possibleMatches,
      unmatchedStatement,
      unmatchedLedger,
      summary: {
        totalStatement: statementTransactions.length,
        totalMatched,
        totalUnmatched: unmatchedStatement.length,
        statementBalance,
        ledgerBalance,
        difference: statementBalance !== undefined ? ledgerBalance - statementBalance : undefined,
      },
    };
  }

  /**
   * Find the best matching ledger transaction for a statement transaction
   */
  private findBestMatch(
    stmtTx: StatementTransaction,
    ledgerTransactions: (Transaction & { postings: Posting[] })[],
    excludeIds: Set<string>
  ): TransactionMatch {
    let bestMatch: TransactionMatch = {
      statementTx: stmtTx,
      matchScore: 0,
      matchType: 'none',
      reasons: [],
    };

    for (const ledgerTx of ledgerTransactions) {
      if (excludeIds.has(ledgerTx.id)) continue;

      const score = this.calculateMatchScore(stmtTx, ledgerTx);

      if (score.total > bestMatch.matchScore) {
        bestMatch = {
          statementTx: stmtTx,
          ledgerTx,
          matchScore: score.total,
          matchType: this.getMatchType(score.total),
          reasons: score.reasons,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate match score between statement and ledger transactions
   */
  private calculateMatchScore(
    stmtTx: StatementTransaction,
    ledgerTx: Transaction & { postings: Posting[] }
  ): { total: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Date matching (±3 days tolerance)
    const dateDiff = Math.abs(
      stmtTx.date.getTime() - new Date(ledgerTx.date).getTime()
    ) / (1000 * 60 * 60 * 24);

    if (dateDiff === 0) {
      score += 40;
      reasons.push('Exact date match');
    } else if (dateDiff <= 1) {
      score += 30;
      reasons.push('Date within 1 day');
    } else if (dateDiff <= 3) {
      score += 20;
      reasons.push('Date within 3 days');
    } else if (dateDiff <= 7) {
      score += 10;
      reasons.push('Date within 7 days');
    }

    // Amount matching
    const stmtAmount = (stmtTx.debit || 0) - (stmtTx.credit || 0);
    const ledgerAmount = ledgerTx.postings.reduce((sum, p) => sum + p.amount, 0);

    if (Math.abs(Math.abs(stmtAmount) - Math.abs(ledgerAmount)) < 0.01) {
      score += 40;
      reasons.push('Exact amount match');
    } else if (Math.abs(Math.abs(stmtAmount) - Math.abs(ledgerAmount)) < 1) {
      score += 20;
      reasons.push('Amount within $1');
    }

    // Description matching (fuzzy)
    const descriptionSimilarity = compareTwoStrings(
      this.normalizeDescription(stmtTx.description),
      this.normalizeDescription(ledgerTx.payee || '')
    );

    if (descriptionSimilarity > 0.8) {
      score += 20;
      reasons.push(`High description similarity (${(descriptionSimilarity * 100).toFixed(0)}%)`);
    } else if (descriptionSimilarity > 0.5) {
      score += 10;
      reasons.push(`Medium description similarity (${(descriptionSimilarity * 100).toFixed(0)}%)`);
    } else if (descriptionSimilarity > 0.3) {
      score += 5;
      reasons.push(`Low description similarity (${(descriptionSimilarity * 100).toFixed(0)}%)`);
    }

    return { total: score, reasons };
  }

  /**
   * Normalize description for better matching
   */
  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Determine match type based on score
   */
  private getMatchType(score: number): 'exact' | 'probable' | 'possible' | 'none' {
    if (score >= 80) return 'exact';
    if (score >= 60) return 'probable';
    if (score >= 40) return 'possible';
    return 'none';
  }

  /**
   * Get ledger transactions for an account in a date range
   */
  private async getLedgerTransactions(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<(Transaction & { postings: Posting[] })[]> {
    return this.prisma.transaction.findMany({
      where: {
        postings: {
          some: {
            accountId,
          },
        },
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: 'NORMAL',
      },
      include: {
        postings: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  /**
   * Calculate running balance for ledger transactions
   */
  private calculateBalance(
    accountId: string,
    transactions: (Transaction & { postings: Posting[] })[]
  ): number {
    let balance = 0;
    for (const tx of transactions) {
      const accountPosting = tx.postings.find(p => p.accountId === accountId);
      if (accountPosting) {
        balance += accountPosting.amount;
      }
    }
    return balance;
  }
}

export const reconciliationMatchingService = new ReconciliationMatchingService();
