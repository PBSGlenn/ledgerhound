import { compareTwoStrings } from 'string-similarity';
import munkres from 'munkres-js';
import type { StatementTransaction } from './pdfStatementService';
import type { Transaction, Posting, MemorizedRule } from '@prisma/client';
import { getPrismaClient } from '../db';
import { memorizedRuleService } from './memorizedRuleService';

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
  private prisma: any;

  constructor(prisma?: any) {
    this.prisma = prisma ?? getPrismaClient();
  }

  /**
   * Match statement transactions with ledger transactions
   */
  async matchTransactions(
    accountId: string,
    statementTransactions: StatementTransaction[],
    startDate?: Date,
    endDate?: Date
  ): Promise<ReconciliationPreview> {
    // Ensure dates are Date objects (they may be strings from JSON)
    const normalizedStatementTxs = statementTransactions.map(tx => ({
      ...tx,
      date: tx.date instanceof Date ? tx.date : new Date(tx.date),
    }));

    // Get memorized rules to check if statement descriptions would match rules
    const rules = await memorizedRuleService.getAllRules();

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
    const matchedStatementIndices = new Set<number>();

    // Build a cost matrix for the Hungarian algorithm
    // Cost = 100 - score (so higher scores become lower costs)
    // The Hungarian algorithm finds the minimum cost assignment
    const numStatements = normalizedStatementTxs.length;
    const numLedger = ledgerTransactions.length;

    if (numStatements === 0 || numLedger === 0) {
      // No transactions to match
      return {
        exactMatches: [],
        probableMatches: [],
        possibleMatches: [],
        unmatchedStatement: normalizedStatementTxs,
        unmatchedLedger: ledgerTransactions,
        summary: {
          totalStatement: numStatements,
          totalMatched: 0,
          totalUnmatched: numStatements,
          ledgerBalance: this.calculateBalance(accountId, ledgerTransactions),
        },
      };
    }

    // Create score matrix and reasons matrix
    const scoreMatrix: number[][] = [];
    const reasonsMatrix: string[][][] = [];

    for (let i = 0; i < numStatements; i++) {
      scoreMatrix[i] = [];
      reasonsMatrix[i] = [];
      for (let j = 0; j < numLedger; j++) {
        const score = this.calculateMatchScore(
          normalizedStatementTxs[i],
          ledgerTransactions[j],
          rules,
          accountId
        );
        scoreMatrix[i][j] = score.total;
        reasonsMatrix[i][j] = score.reasons;
      }
    }

    // Convert to cost matrix for Hungarian algorithm (minimize cost = maximize score)
    // Use a large penalty for no match (100) so we prefer any match over no match
    const maxScore = 100;
    const costMatrix: number[][] = [];
    const matrixSize = Math.max(numStatements, numLedger);

    for (let i = 0; i < matrixSize; i++) {
      costMatrix[i] = [];
      for (let j = 0; j < matrixSize; j++) {
        if (i < numStatements && j < numLedger) {
          // Convert score to cost (higher score = lower cost)
          costMatrix[i][j] = maxScore - scoreMatrix[i][j];
        } else {
          // Padding for rectangular matrices - high cost to avoid dummy assignments
          costMatrix[i][j] = maxScore;
        }
      }
    }

    // Run Hungarian algorithm to find optimal assignment
    const assignments = munkres(costMatrix);

    // Process assignments
    for (const [stmtIdx, ledgerIdx] of assignments) {
      // Skip padding assignments
      if (stmtIdx >= numStatements || ledgerIdx >= numLedger) continue;

      const score = scoreMatrix[stmtIdx][ledgerIdx];
      const reasons = reasonsMatrix[stmtIdx][ledgerIdx];

      // Only accept matches with minimum score threshold
      if (score < 30) continue;

      const stmtTx = normalizedStatementTxs[stmtIdx];
      const ledgerTx = ledgerTransactions[ledgerIdx];

      const match: TransactionMatch = {
        statementTx: stmtTx,
        ledgerTx: ledgerTx,
        matchScore: score,
        matchType: this.getMatchType(score),
        reasons,
      };

      matchedStatementIndices.add(stmtIdx);
      matchedLedgerIds.add(ledgerTransactions[ledgerIdx].id);

      // Categorize the match
      if (match.matchType === 'exact') {
        exactMatches.push(match);
      } else if (match.matchType === 'probable') {
        probableMatches.push(match);
      } else if (match.matchType === 'possible') {
        possibleMatches.push(match);
      }
    }

    // Find unmatched statement transactions
    for (let i = 0; i < normalizedStatementTxs.length; i++) {
      if (!matchedStatementIndices.has(i)) {
        unmatchedStatement.push(normalizedStatementTxs[i]);
      }
    }

    // Find unmatched ledger transactions
    const unmatchedLedger = ledgerTransactions.filter(
      tx => !matchedLedgerIds.has(tx.id)
    );

    // Calculate summary
    const totalMatched = exactMatches.length + probableMatches.length;
    const ledgerBalance = this.calculateBalance(accountId, ledgerTransactions);
    const statementBalance = normalizedStatementTxs[normalizedStatementTxs.length - 1]?.balance;

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
    excludeIds: Set<string>,
    rules: MemorizedRule[],
    accountId: string
  ): TransactionMatch {
    let bestMatch: TransactionMatch = {
      statementTx: stmtTx,
      matchScore: 0,
      matchType: 'none',
      reasons: [],
    };

    for (const ledgerTx of ledgerTransactions) {
      if (excludeIds.has(ledgerTx.id)) continue;

      const score = this.calculateMatchScore(stmtTx, ledgerTx, rules, accountId);

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
    ledgerTx: Transaction & { postings: Posting[] },
    rules: MemorizedRule[],
    accountId: string
  ): { total: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Date matching (±3 days tolerance)
    const dateDiff = Math.abs(
      stmtTx.date.getTime() - new Date(ledgerTx.date).getTime()
    ) / (1000 * 60 * 60 * 24);

    if (dateDiff === 0) {
      score += 30;
      reasons.push('Exact date match');
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

    // Amount matching - THIS IS CRITICAL
    // Get the statement amount (debit is positive outflow, credit is negative/refund)
    const stmtAmount = (stmtTx.debit || 0) - (stmtTx.credit || 0);

    // Get the ledger amount for this specific account's posting
    const accountPosting = ledgerTx.postings.find(p => p.accountId === accountId);
    const ledgerAmount = accountPosting ? accountPosting.amount : 0;

    // For credit cards: statement debit (purchase) = negative ledger posting (increases liability)
    // So we compare absolute values
    const stmtAbs = Math.abs(stmtAmount);
    const ledgerAbs = Math.abs(ledgerAmount);

    if (Math.abs(stmtAbs - ledgerAbs) < 0.01) {
      // EXACT amount match is worth the most - this is the key differentiator
      score += 50;
      reasons.push('Exact amount match');
    } else if (Math.abs(stmtAbs - ledgerAbs) < 1) {
      score += 25;
      reasons.push('Amount within $1');
    } else {
      // Amount doesn't match - this should heavily penalize the score
      // Don't add any score for amount, and the description score alone
      // won't be enough to make it an "exact" match
    }

    // Description matching (fuzzy) - compare against BOTH payee AND original description
    const normalizedStmtDesc = this.normalizeDescription(stmtTx.description);
    const normalizedPayee = this.normalizeDescription(ledgerTx.payee || '');

    // Get original description from metadata if available (stored during import)
    let originalDescription = '';
    if (ledgerTx.metadata) {
      try {
        const metadata = typeof ledgerTx.metadata === 'string'
          ? JSON.parse(ledgerTx.metadata)
          : ledgerTx.metadata;
        if (metadata.originalDescription) {
          originalDescription = this.normalizeDescription(metadata.originalDescription);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Calculate similarity against payee (cleaned name)
    const payeeSimilarity = compareTwoStrings(normalizedStmtDesc, normalizedPayee);

    // Calculate similarity against original description (raw bank text)
    const originalSimilarity = originalDescription
      ? compareTwoStrings(normalizedStmtDesc, originalDescription)
      : 0;

    // Check if a memorized rule would match the statement description
    // and produce the ledger's payee name - this helps match transformed transactions
    let ruleMatchSimilarity = 0;
    let matchedRuleName = '';
    for (const rule of rules) {
      if (rule.defaultPayee === ledgerTx.payee) {
        // This rule produces the same payee name as the ledger transaction
        // Check if the statement description matches the rule's pattern
        if (this.matchesRulePattern(stmtTx.description, rule)) {
          ruleMatchSimilarity = 1.0; // Perfect match via rule
          matchedRuleName = rule.name;
          break;
        }
      }
    }

    // Use the highest similarity score
    const descriptionSimilarity = Math.max(payeeSimilarity, originalSimilarity, ruleMatchSimilarity);
    let matchedAgainst = 'payee';
    if (ruleMatchSimilarity > payeeSimilarity && ruleMatchSimilarity > originalSimilarity) {
      matchedAgainst = 'rule';
    } else if (originalSimilarity > payeeSimilarity) {
      matchedAgainst = 'original';
    }

    if (descriptionSimilarity > 0.8) {
      score += 20;
      const via = matchedAgainst === 'rule' ? ` via rule "${matchedRuleName}"` :
                  matchedAgainst === 'original' ? ' via original' : '';
      reasons.push(`High description similarity (${(descriptionSimilarity * 100).toFixed(0)}%${via})`);
    } else if (descriptionSimilarity > 0.5) {
      score += 10;
      reasons.push(`Medium description similarity (${(descriptionSimilarity * 100).toFixed(0)}%${matchedAgainst === 'original' ? ' via original' : ''})`);
    } else if (descriptionSimilarity > 0.3) {
      score += 5;
      reasons.push(`Low description similarity (${(descriptionSimilarity * 100).toFixed(0)}%${matchedAgainst === 'original' ? ' via original' : ''})`);
    }

    return { total: score, reasons };
  }

  /**
   * Check if a description matches a memorized rule's pattern
   * Uses flexible matching since PDF descriptions may differ slightly from CSV
   */
  private matchesRulePattern(description: string, rule: MemorizedRule): boolean {
    const desc = description.toLowerCase();
    const pattern = rule.matchValue.toLowerCase();

    switch (rule.matchType) {
      case 'EXACT':
        // Normalize both for comparison (remove extra spaces)
        const normalizedDesc = desc.replace(/\s+/g, ' ').trim();
        const normalizedPattern = pattern.replace(/\s+/g, ' ').trim();
        return normalizedDesc === normalizedPattern;

      case 'CONTAINS':
        // First try exact substring match
        if (desc.includes(pattern)) return true;

        // Try with normalized spaces (PDF vs CSV may have different spacing)
        const descNorm = desc.replace(/\s+/g, ' ').trim();
        const patternNorm = pattern.replace(/\s+/g, ' ').trim();
        if (descNorm.includes(patternNorm)) return true;

        // Try matching the first significant word(s) from the pattern
        // This handles cases like "Woolworths 3124 Chelsea" matching pattern "Woolworths"
        // or "Nahedas Choice Turkis South Yarra" matching pattern with extra spaces
        const patternWords = patternNorm.split(' ').filter(w => w.length > 2);
        const descWords = descNorm.split(' ');

        // Check if first 1-3 significant words of pattern appear in sequence in description
        if (patternWords.length > 0) {
          const firstWords = patternWords.slice(0, Math.min(3, patternWords.length));
          const firstWordsPattern = firstWords.join(' ');
          if (descNorm.includes(firstWordsPattern)) return true;

          // Also check if the key identifier (usually the business name) matches
          // Pattern might be "DISNEY PLUS RICHMOND SA" but desc is "Disney Plus Richmond"
          const firstTwoWords = patternWords.slice(0, 2).join(' ');
          if (firstTwoWords.length >= 5 && descNorm.includes(firstTwoWords)) return true;
        }

        return false;

      case 'REGEX':
        try {
          const regex = new RegExp(rule.matchValue, 'i');
          return regex.test(description);
        } catch {
          return false;
        }
      default:
        return false;
    }
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
