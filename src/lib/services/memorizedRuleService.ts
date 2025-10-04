import { getPrismaClient } from '../db';
import type { MemorizedRule, MatchType, Account, GSTCode } from '@prisma/client';
import type { SplitTemplate } from '../../types';

export class MemorizedRuleService {
  private prisma = getPrismaClient();

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
}

export const memorizedRuleService = new MemorizedRuleService();
