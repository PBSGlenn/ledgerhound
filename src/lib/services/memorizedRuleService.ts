import { getPrismaClient } from '../db';
import type { MemorizedRule, MatchType, Account, GSTCode, PrismaClient } from '@prisma/client';
import type { SplitTemplate } from '../../types';

export class MemorizedRuleService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

  /**
   * Get all memorized rules ordered by priority
   */
  async getAllRules(): Promise<MemorizedRule[]> {
    return this.prisma.memorizedRule.findMany({
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get rule by ID
   */
  async getRuleById(id: string): Promise<MemorizedRule | null> {
    return this.prisma.memorizedRule.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new memorized rule
   */
  async createRule(data: {
    name: string;
    matchType: MatchType;
    matchValue: string;
    defaultPayee?: string;
    defaultAccountId?: string;
    defaultSplits?: SplitTemplate[];
    applyOnImport?: boolean;
    applyOnManualEntry?: boolean;
    priority?: number;
  }): Promise<MemorizedRule> {
    return this.prisma.memorizedRule.create({
      data: {
        name: data.name,
        matchType: data.matchType,
        matchValue: data.matchValue,
        defaultPayee: data.defaultPayee,
        defaultAccountId: data.defaultAccountId,
        defaultSplits: data.defaultSplits
          ? JSON.stringify(data.defaultSplits)
          : null,
        applyOnImport: data.applyOnImport ?? true,
        applyOnManualEntry: data.applyOnManualEntry ?? true,
        priority: data.priority ?? 0,
      },
    });
  }

  /**
   * Update a memorized rule
   */
  async updateRule(
    id: string,
    data: Partial<{
      name: string;
      matchType: MatchType;
      matchValue: string;
      defaultPayee: string;
      defaultAccountId: string;
      defaultSplits: SplitTemplate[];
      applyOnImport: boolean;
      applyOnManualEntry: boolean;
      priority: number;
    }>
  ): Promise<MemorizedRule> {
    return this.prisma.memorizedRule.update({
      where: { id },
      data: {
        ...data,
        defaultSplits: data.defaultSplits
          ? JSON.stringify(data.defaultSplits)
          : undefined,
      },
    });
  }

  /**
   * Delete a memorized rule
   */
  async deleteRule(id: string): Promise<void> {
    await this.prisma.memorizedRule.delete({
      where: { id },
    });
  }

  /**
   * Match a payee/description against rules
   */
  matchPayee(
    payee: string,
    rules: MemorizedRule[],
    context: 'import' | 'manual'
  ): MemorizedRule | null {
    // Filter rules by context
    const applicableRules = rules.filter((rule) =>
      context === 'import' ? rule.applyOnImport : rule.applyOnManualEntry
    );

    // Sort by priority and find first match
    for (const rule of applicableRules) {
      if (this.testMatch(payee, rule.matchType, rule.matchValue)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Test if a string matches a pattern
   */
  private testMatch(
    text: string,
    matchType: MatchType,
    pattern: string
  ): boolean {
    switch (matchType) {
      case 'EXACT':
        return text.toLowerCase() === pattern.toLowerCase();

      case 'CONTAINS':
        return text.toLowerCase().includes(pattern.toLowerCase());

      case 'REGEX':
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(text);
        } catch (e) {
          console.error('Invalid regex pattern:', pattern, e);
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Reorder rules by priority
   */
  async reorderRules(ruleIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      ruleIds.map((id, index) =>
        this.prisma.memorizedRule.update({
          where: { id },
          data: { priority: index },
        })
      )
    );
  }

  /**
   * Get default splits for a rule
   */
  getDefaultSplits(rule: MemorizedRule): SplitTemplate[] {
    if (!rule.defaultSplits) {
      return [];
    }

    try {
      return JSON.parse(rule.defaultSplits);
    } catch (e) {
      console.error('Failed to parse default splits:', e);
      return [];
    }
  }

  /**
   * Create a rule from a transaction (learn from example)
   */
  async createRuleFromTransaction(data: {
    name: string;
    payee: string;
    matchType: MatchType;
    accountId: string;
    isBusiness: boolean;
    gstCode?: GSTCode;
    gstRate?: number;
  }): Promise<MemorizedRule> {
    const splitTemplate: SplitTemplate = {
      accountId: data.accountId,
      percentOrAmount: 100,
      isBusiness: data.isBusiness,
      gstCode: data.gstCode,
      gstRate: data.gstRate,
    };

    return this.createRule({
      name: data.name,
      matchType: data.matchType,
      matchValue: data.payee,
      defaultPayee: data.payee,
      defaultAccountId: data.accountId,
      defaultSplits: [splitTemplate],
      applyOnImport: true,
      applyOnManualEntry: true,
      priority: 0,
    });
  }

  /**
   * Preview which transactions would be affected by applying a rule
   * Returns matching transactions without modifying them
   */
  async previewRuleApplication(ruleId: string) {
    const rule = await this.getRuleById(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    // Get all transactions
    const transactions = await this.prisma.transaction.findMany({
      include: {
        postings: {
          include: {
            account: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Filter transactions that match the rule
    const matchingTransactions = transactions.filter((tx) =>
      this.testMatch(tx.payee || '', rule.matchType, rule.matchValue)
    );

    return {
      rule,
      transactions: matchingTransactions.map(tx => ({
        id: tx.id,
        date: tx.date,
        currentPayee: tx.payee,
        newPayee: rule.defaultPayee || tx.payee,
        amount: tx.postings.reduce((sum, p) => sum + p.amount, 0),
        memo: tx.memo,
      })),
    };
  }

  /**
   * Apply a rule to specific existing transactions
   * Returns count of transactions updated
   */
  async applyRuleToExisting(ruleId: string, transactionIds?: string[]): Promise<{ count: number; transactions: string[] }> {
    const rule = await this.getRuleById(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    // If no specific transaction IDs provided, find all matching transactions
    let transactionsToUpdate;
    if (transactionIds && transactionIds.length > 0) {
      transactionsToUpdate = await this.prisma.transaction.findMany({
        where: {
          id: { in: transactionIds },
        },
      });
    } else {
      const allTransactions = await this.prisma.transaction.findMany();
      transactionsToUpdate = allTransactions.filter((tx) =>
        this.testMatch(tx.payee || '', rule.matchType, rule.matchValue)
      );
    }

    if (transactionsToUpdate.length === 0) {
      return { count: 0, transactions: [] };
    }

    // Update transactions
    const updatedIds: string[] = [];
    for (const tx of transactionsToUpdate) {
      // Update payee if rule has a default payee
      if (rule.defaultPayee) {
        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: { payee: rule.defaultPayee },
        });
        updatedIds.push(tx.id);
      }
    }

    return {
      count: updatedIds.length,
      transactions: updatedIds,
    };
  }

  /**
   * Find a matching rule for a given payee and memo
   */
  async findMatchingRule(
    payee: string,
    memo?: string
  ): Promise<MemorizedRule | null> {
    const rules = await this.getAllRules();
    const match = this.matchPayee(payee, rules, 'manual');
    return match;
  }
}

export const memorizedRuleService = new MemorizedRuleService();
