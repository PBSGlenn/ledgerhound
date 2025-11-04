import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MemorizedRuleService } from '../memorizedRuleService';
import { TransactionService } from '../transactionService';
import type { PrismaClient, MemorizedRule } from '@prisma/client';
import { MatchType, GSTCode } from '@prisma/client';
import { createTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';

describe('MemorizedRuleService', () => {
  let prisma: PrismaClient;
  let ruleService: MemorizedRuleService;
  let transactionService: TransactionService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  beforeEach(async () => {
    prisma = await createTestDb();
    await resetTestDb(prisma);
    ruleService = new MemorizedRuleService(prisma);
    transactionService = new TransactionService(prisma);
    accounts = await seedTestAccounts(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('createRule', () => {
    it('should create a simple exact match rule', async () => {
      const rule = await ruleService.createRule({
        name: 'Woolworths Groceries',
        matchType: MatchType.EXACT,
        matchValue: 'Woolworths',
        defaultPayee: 'Woolworths Supermarket',
        defaultAccountId: accounts.groceries.id,
      });

      expect(rule.name).toBe('Woolworths Groceries');
      expect(rule.matchType).toBe(MatchType.EXACT);
      expect(rule.matchValue).toBe('Woolworths');
      expect(rule.defaultPayee).toBe('Woolworths Supermarket');
      expect(rule.defaultAccountId).toBe(accounts.groceries.id);
      expect(rule.priority).toBe(0);
      expect(rule.applyOnImport).toBe(true);
      expect(rule.applyOnManualEntry).toBe(true);
    });

    it('should create a contains match rule', async () => {
      const rule = await ruleService.createRule({
        name: 'Coffee Shops',
        matchType: MatchType.CONTAINS,
        matchValue: 'coffee',
        defaultAccountId: accounts.groceries.id,
      });

      expect(rule.matchType).toBe(MatchType.CONTAINS);
      expect(rule.matchValue).toBe('coffee');
    });

    it('should create a regex match rule', async () => {
      const rule = await ruleService.createRule({
        name: 'Invoice Payments',
        matchType: MatchType.REGEX,
        matchValue: '^Invoice.*PBS-\\d+',
        defaultAccountId: accounts.salesIncome.id,
      });

      expect(rule.matchType).toBe(MatchType.REGEX);
      expect(rule.matchValue).toBe('^Invoice.*PBS-\\d+');
    });

    it('should create rule with split templates', async () => {
      const rule = await ruleService.createRule({
        name: 'Office Supplies with GST',
        matchType: MatchType.CONTAINS,
        matchValue: 'Officeworks',
        defaultAccountId: accounts.officeSupplies.id,
        defaultSplits: [
          {
            accountId: accounts.officeSupplies.id,
            percentOrAmount: 100,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
          },
        ],
      });

      expect(rule.defaultSplits).toBeDefined();
      const splits = ruleService.getDefaultSplits(rule);
      expect(splits).toHaveLength(1);
      expect(splits[0].accountId).toBe(accounts.officeSupplies.id);
      expect(splits[0].isBusiness).toBe(true);
      expect(splits[0].gstCode).toBe(GSTCode.GST);
    });

    it('should create rule with custom priority', async () => {
      const rule = await ruleService.createRule({
        name: 'High Priority Rule',
        matchType: MatchType.EXACT,
        matchValue: 'Important Vendor',
        defaultAccountId: accounts.officeSupplies.id,
        priority: 5,
      });

      expect(rule.priority).toBe(5);
    });

    it('should create rule with selective application', async () => {
      const rule = await ruleService.createRule({
        name: 'Import Only Rule',
        matchType: MatchType.CONTAINS,
        matchValue: 'test',
        defaultAccountId: accounts.groceries.id,
        applyOnImport: true,
        applyOnManualEntry: false,
      });

      expect(rule.applyOnImport).toBe(true);
      expect(rule.applyOnManualEntry).toBe(false);
    });
  });

  describe('getAllRules', () => {
    beforeEach(async () => {
      // Create rules with different priorities
      await ruleService.createRule({
        name: 'Rule 1',
        matchType: MatchType.EXACT,
        matchValue: 'vendor1',
        defaultAccountId: accounts.groceries.id,
        priority: 2,
      });
      await ruleService.createRule({
        name: 'Rule 2',
        matchType: MatchType.EXACT,
        matchValue: 'vendor2',
        defaultAccountId: accounts.groceries.id,
        priority: 0,
      });
      await ruleService.createRule({
        name: 'Rule 3',
        matchType: MatchType.EXACT,
        matchValue: 'vendor3',
        defaultAccountId: accounts.groceries.id,
        priority: 1,
      });
    });

    it('should get all rules ordered by priority', async () => {
      const rules = await ruleService.getAllRules();

      expect(rules).toHaveLength(3);
      expect(rules[0].priority).toBe(0);
      expect(rules[1].priority).toBe(1);
      expect(rules[2].priority).toBe(2);
    });
  });

  describe('getRuleById', () => {
    it('should get rule by ID', async () => {
      const created = await ruleService.createRule({
        name: 'Test Rule',
        matchType: MatchType.EXACT,
        matchValue: 'test',
        defaultAccountId: accounts.groceries.id,
      });

      const retrieved = await ruleService.getRuleById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Rule');
    });

    it('should return null for non-existent rule', async () => {
      const rule = await ruleService.getRuleById('non-existent-id');
      expect(rule).toBeNull();
    });
  });

  describe('updateRule', () => {
    it('should update rule name', async () => {
      const rule = await ruleService.createRule({
        name: 'Original Name',
        matchType: MatchType.EXACT,
        matchValue: 'test',
        defaultAccountId: accounts.groceries.id,
      });

      const updated = await ruleService.updateRule(rule.id, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.matchType).toBe(MatchType.EXACT); // Unchanged
    });

    it('should update match pattern', async () => {
      const rule = await ruleService.createRule({
        name: 'Test Rule',
        matchType: MatchType.EXACT,
        matchValue: 'old pattern',
        defaultAccountId: accounts.groceries.id,
      });

      const updated = await ruleService.updateRule(rule.id, {
        matchType: MatchType.CONTAINS,
        matchValue: 'new pattern',
      });

      expect(updated.matchType).toBe(MatchType.CONTAINS);
      expect(updated.matchValue).toBe('new pattern');
    });

    it('should update default splits', async () => {
      const rule = await ruleService.createRule({
        name: 'Test Rule',
        matchType: MatchType.EXACT,
        matchValue: 'test',
        defaultAccountId: accounts.groceries.id,
      });

      const updated = await ruleService.updateRule(rule.id, {
        defaultSplits: [
          {
            accountId: accounts.officeSupplies.id,
            percentOrAmount: 50,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
          },
          {
            accountId: accounts.groceries.id,
            percentOrAmount: 50,
            isBusiness: false,
          },
        ],
      });

      const splits = ruleService.getDefaultSplits(updated);
      expect(splits).toHaveLength(2);
      expect(splits[0].percentOrAmount).toBe(50);
      expect(splits[1].percentOrAmount).toBe(50);
    });

    it('should update priority', async () => {
      const rule = await ruleService.createRule({
        name: 'Test Rule',
        matchType: MatchType.EXACT,
        matchValue: 'test',
        defaultAccountId: accounts.groceries.id,
        priority: 0,
      });

      const updated = await ruleService.updateRule(rule.id, {
        priority: 10,
      });

      expect(updated.priority).toBe(10);
    });
  });

  describe('deleteRule', () => {
    it('should delete rule', async () => {
      const rule = await ruleService.createRule({
        name: 'Test Rule',
        matchType: MatchType.EXACT,
        matchValue: 'test',
        defaultAccountId: accounts.groceries.id,
      });

      await ruleService.deleteRule(rule.id);

      const deleted = await ruleService.getRuleById(rule.id);
      expect(deleted).toBeNull();
    });
  });

  describe('matchPayee', () => {
    let rules: MemorizedRule[];

    beforeEach(async () => {
      rules = [
        await ruleService.createRule({
          name: 'Exact Match',
          matchType: MatchType.EXACT,
          matchValue: 'Woolworths',
          defaultAccountId: accounts.groceries.id,
          priority: 1,
        }),
        await ruleService.createRule({
          name: 'Contains Match',
          matchType: MatchType.CONTAINS,
          matchValue: 'coffee',
          defaultAccountId: accounts.groceries.id,
          priority: 2,
        }),
        await ruleService.createRule({
          name: 'Regex Match',
          matchType: MatchType.REGEX,
          matchValue: '^Office.*',
          defaultAccountId: accounts.officeSupplies.id,
          priority: 3,
        }),
      ];
    });

    it('should match exact payee (case insensitive)', () => {
      const match = ruleService.matchPayee('woolworths', rules, 'import');
      expect(match).toBeDefined();
      expect(match?.name).toBe('Exact Match');
    });

    it('should match payee containing substring', () => {
      const match = ruleService.matchPayee('Starbucks Coffee', rules, 'import');
      expect(match).toBeDefined();
      expect(match?.name).toBe('Contains Match');
    });

    it('should match payee with regex', () => {
      const match = ruleService.matchPayee('Officeworks', rules, 'import');
      expect(match).toBeDefined();
      expect(match?.name).toBe('Regex Match');
    });

    it('should return null for no match', () => {
      const match = ruleService.matchPayee('Unknown Vendor', rules, 'import');
      expect(match).toBeNull();
    });

    it('should respect priority order', async () => {
      // Create two rules that both match, but different priorities
      const rules = [
        await ruleService.createRule({
          name: 'Lower Priority',
          matchType: MatchType.CONTAINS,
          matchValue: 'test',
          defaultAccountId: accounts.groceries.id,
          priority: 2,
        }),
        await ruleService.createRule({
          name: 'Higher Priority',
          matchType: MatchType.CONTAINS,
          matchValue: 'test',
          defaultAccountId: accounts.officeSupplies.id,
          priority: 1,
        }),
      ];

      const allRules = await ruleService.getAllRules();
      const match = ruleService.matchPayee('testing', allRules, 'import');

      // Should match the higher priority rule (lower number = higher priority)
      expect(match?.name).toBe('Higher Priority');
    });

    it('should filter by context (import)', async () => {
      const rule = await ruleService.createRule({
        name: 'Import Only',
        matchType: MatchType.EXACT,
        matchValue: 'ImportOnly',
        defaultAccountId: accounts.groceries.id,
        applyOnImport: true,
        applyOnManualEntry: false,
      });

      const rules = await ruleService.getAllRules();

      const importMatch = ruleService.matchPayee('ImportOnly', rules, 'import');
      expect(importMatch).toBeDefined();

      const manualMatch = ruleService.matchPayee('ImportOnly', rules, 'manual');
      expect(manualMatch).toBeNull();
    });

    it('should handle invalid regex gracefully', async () => {
      const rule = await ruleService.createRule({
        name: 'Invalid Regex',
        matchType: MatchType.REGEX,
        matchValue: '[invalid(',
        defaultAccountId: accounts.groceries.id,
      });

      const rules = await ruleService.getAllRules();
      const match = ruleService.matchPayee('test', rules, 'import');

      expect(match).toBeNull();
    });
  });

  describe('reorderRules', () => {
    it('should reorder rules by priority', async () => {
      const rule1 = await ruleService.createRule({
        name: 'Rule 1',
        matchType: MatchType.EXACT,
        matchValue: 'test1',
        defaultAccountId: accounts.groceries.id,
        priority: 0,
      });

      const rule2 = await ruleService.createRule({
        name: 'Rule 2',
        matchType: MatchType.EXACT,
        matchValue: 'test2',
        defaultAccountId: accounts.groceries.id,
        priority: 1,
      });

      const rule3 = await ruleService.createRule({
        name: 'Rule 3',
        matchType: MatchType.EXACT,
        matchValue: 'test3',
        defaultAccountId: accounts.groceries.id,
        priority: 2,
      });

      // Reorder: rule3, rule1, rule2
      await ruleService.reorderRules([rule3.id, rule1.id, rule2.id]);

      const rules = await ruleService.getAllRules();
      expect(rules[0].id).toBe(rule3.id);
      expect(rules[0].priority).toBe(0);
      expect(rules[1].id).toBe(rule1.id);
      expect(rules[1].priority).toBe(1);
      expect(rules[2].id).toBe(rule2.id);
      expect(rules[2].priority).toBe(2);
    });
  });

  describe('getDefaultSplits', () => {
    it('should parse default splits from JSON', async () => {
      const rule = await ruleService.createRule({
        name: 'Test Rule',
        matchType: MatchType.EXACT,
        matchValue: 'test',
        defaultAccountId: accounts.officeSupplies.id,
        defaultSplits: [
          {
            accountId: accounts.officeSupplies.id,
            percentOrAmount: 100,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
          },
        ],
      });

      const splits = ruleService.getDefaultSplits(rule);

      expect(splits).toHaveLength(1);
      expect(splits[0].accountId).toBe(accounts.officeSupplies.id);
      expect(splits[0].percentOrAmount).toBe(100);
      expect(splits[0].isBusiness).toBe(true);
      expect(splits[0].gstCode).toBe(GSTCode.GST);
      expect(splits[0].gstRate).toBe(0.1);
    });

    it('should return empty array for no splits', async () => {
      const rule = await ruleService.createRule({
        name: 'Test Rule',
        matchType: MatchType.EXACT,
        matchValue: 'test',
        defaultAccountId: accounts.groceries.id,
      });

      const splits = ruleService.getDefaultSplits(rule);
      expect(splits).toHaveLength(0);
    });

    it('should handle invalid JSON gracefully', async () => {
      const rule = await ruleService.createRule({
        name: 'Test Rule',
        matchType: MatchType.EXACT,
        matchValue: 'test',
        defaultAccountId: accounts.groceries.id,
      });

      // Manually corrupt the JSON
      await prisma.memorizedRule.update({
        where: { id: rule.id },
        data: { defaultSplits: 'invalid json' },
      });

      const corrupted = await ruleService.getRuleById(rule.id);
      const splits = ruleService.getDefaultSplits(corrupted!);

      expect(splits).toHaveLength(0);
    });
  });

  describe('createRuleFromTransaction', () => {
    it('should create rule from transaction example', async () => {
      const rule = await ruleService.createRuleFromTransaction({
        name: 'Woolworths Rule',
        payee: 'Woolworths',
        matchType: MatchType.CONTAINS,
        accountId: accounts.groceries.id,
        isBusiness: false,
      });

      expect(rule.name).toBe('Woolworths Rule');
      expect(rule.matchType).toBe(MatchType.CONTAINS);
      expect(rule.matchValue).toBe('Woolworths');
      expect(rule.defaultPayee).toBe('Woolworths');
      expect(rule.defaultAccountId).toBe(accounts.groceries.id);

      const splits = ruleService.getDefaultSplits(rule);
      expect(splits).toHaveLength(1);
      expect(splits[0].accountId).toBe(accounts.groceries.id);
      expect(splits[0].percentOrAmount).toBe(100);
      expect(splits[0].isBusiness).toBe(false);
    });

    it('should create business rule with GST', async () => {
      const rule = await ruleService.createRuleFromTransaction({
        name: 'Officeworks Rule',
        payee: 'Officeworks',
        matchType: MatchType.EXACT,
        accountId: accounts.officeSupplies.id,
        isBusiness: true,
        gstCode: GSTCode.GST,
        gstRate: 0.1,
      });

      const splits = ruleService.getDefaultSplits(rule);
      expect(splits[0].isBusiness).toBe(true);
      expect(splits[0].gstCode).toBe(GSTCode.GST);
      expect(splits[0].gstRate).toBe(0.1);
    });
  });

  describe('previewRuleApplication', () => {
    it('should preview affected transactions', async () => {
      // Create some transactions
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Woolworths',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 50, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Woolworths',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -30, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 30, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-17'),
        payee: 'Coles',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -40, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 40, isBusiness: false },
        ],
      });

      const rule = await ruleService.createRule({
        name: 'Woolworths Rule',
        matchType: MatchType.EXACT,
        matchValue: 'Woolworths',
        defaultPayee: 'Woolworths Supermarket',
        defaultAccountId: accounts.groceries.id,
      });

      const preview = await ruleService.previewRuleApplication(rule.id);

      expect(preview.transactions).toHaveLength(2);
      expect(preview.transactions[0].currentPayee).toBe('Woolworths');
      expect(preview.transactions[0].newPayee).toBe('Woolworths Supermarket');
    });

    it('should throw error for non-existent rule', async () => {
      await expect(
        ruleService.previewRuleApplication('non-existent-id')
      ).rejects.toThrow('Rule not found');
    });
  });

  describe('applyRuleToExisting', () => {
    it('should apply rule to all matching transactions', async () => {
      // Create transactions
      const tx1 = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Woolworths',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 50, isBusiness: false },
        ],
      });

      const tx2 = await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Woolworths',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -30, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 30, isBusiness: false },
        ],
      });

      const rule = await ruleService.createRule({
        name: 'Woolworths Rule',
        matchType: MatchType.EXACT,
        matchValue: 'Woolworths',
        defaultPayee: 'Woolworths Supermarket',
        defaultAccountId: accounts.groceries.id,
      });

      const result = await ruleService.applyRuleToExisting(rule.id);

      expect(result.count).toBe(2);
      expect(result.transactions).toHaveLength(2);

      // Verify transactions were updated
      const updated1 = await transactionService.getTransactionById(tx1.id);
      const updated2 = await transactionService.getTransactionById(tx2.id);

      expect(updated1?.payee).toBe('Woolworths Supermarket');
      expect(updated2?.payee).toBe('Woolworths Supermarket');
    });

    it('should apply rule to specific transactions', async () => {
      const tx1 = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Woolworths',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 50, isBusiness: false },
        ],
      });

      const tx2 = await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Woolworths',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -30, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 30, isBusiness: false },
        ],
      });

      const rule = await ruleService.createRule({
        name: 'Woolworths Rule',
        matchType: MatchType.EXACT,
        matchValue: 'Woolworths',
        defaultPayee: 'Woolworths Supermarket',
        defaultAccountId: accounts.groceries.id,
      });

      // Only apply to tx1
      const result = await ruleService.applyRuleToExisting(rule.id, [tx1.id]);

      expect(result.count).toBe(1);
      expect(result.transactions).toContain(tx1.id);

      const updated1 = await transactionService.getTransactionById(tx1.id);
      const updated2 = await transactionService.getTransactionById(tx2.id);

      expect(updated1?.payee).toBe('Woolworths Supermarket');
      expect(updated2?.payee).toBe('Woolworths'); // Unchanged
    });

    it('should return zero count for no matches', async () => {
      const rule = await ruleService.createRule({
        name: 'No Match Rule',
        matchType: MatchType.EXACT,
        matchValue: 'NonExistent',
        defaultPayee: 'Test',
        defaultAccountId: accounts.groceries.id,
      });

      const result = await ruleService.applyRuleToExisting(rule.id);

      expect(result.count).toBe(0);
      expect(result.transactions).toHaveLength(0);
    });

    it('should throw error for non-existent rule', async () => {
      await expect(
        ruleService.applyRuleToExisting('non-existent-id')
      ).rejects.toThrow('Rule not found');
    });
  });

  describe('findMatchingRule', () => {
    beforeEach(async () => {
      await ruleService.createRule({
        name: 'Woolworths Rule',
        matchType: MatchType.CONTAINS,
        matchValue: 'Woolworths',
        defaultPayee: 'Woolworths Supermarket',
        defaultAccountId: accounts.groceries.id,
      });

      await ruleService.createRule({
        name: 'Officeworks Rule',
        matchType: MatchType.EXACT,
        matchValue: 'Officeworks',
        defaultAccountId: accounts.officeSupplies.id,
        applyOnImport: true,
        applyOnManualEntry: true,
      });
    });

    it('should find matching rule for payee', async () => {
      const match = await ruleService.findMatchingRule('Woolworths');
      expect(match).toBeDefined();
      expect(match?.name).toBe('Woolworths Rule');
    });

    it('should return null for no match', async () => {
      const match = await ruleService.findMatchingRule('Unknown Vendor');
      expect(match).toBeNull();
    });

    it('should use manual context', async () => {
      const rule = await ruleService.createRule({
        name: 'Import Only',
        matchType: MatchType.EXACT,
        matchValue: 'ImportOnly',
        defaultAccountId: accounts.groceries.id,
        applyOnImport: true,
        applyOnManualEntry: false,
      });

      const match = await ruleService.findMatchingRule('ImportOnly');
      expect(match).toBeNull(); // Should not match in manual context
    });
  });
});
