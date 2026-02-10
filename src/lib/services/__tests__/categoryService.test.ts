import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CategoryService } from '../categoryService';
import type { PrismaClient } from '@prisma/client';
import { AccountType } from '@prisma/client';
import { getTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';

describe('CategoryService', () => {
  let prisma: PrismaClient;
  let categoryService: CategoryService;

  beforeAll(async () => {
    prisma = await getTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(prisma);
    categoryService = new CategoryService(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('createCategory', () => {
    it('should create a root-level category', async () => {
      const category = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      expect(category.name).toBe('Groceries');
      expect(category.type).toBe(AccountType.EXPENSE);
      expect(category.level).toBe(1);
      expect(category.fullPath).toBe('EXPENSE/Groceries');
      expect(category.parentId).toBeNull();
    });

    it('should create a nested category', async () => {
      // Create parent
      const parent = await categoryService.createCategory({
        name: 'Food & Dining',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      // Create child
      const child = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      expect(child.name).toBe('Groceries');
      expect(child.parentId).toBe(parent.id);
      expect(child.level).toBe(2);
      expect(child.fullPath).toBe('EXPENSE/Food & Dining/Groceries');
    });

    it('should inherit parent business default', async () => {
      const parent = await categoryService.createCategory({
        name: 'Business Expenses',
        type: AccountType.EXPENSE,
        isBusinessDefault: true,
      });

      const child = await categoryService.createCategory({
        name: 'Office Supplies',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      expect(child.isBusinessDefault).toBe(true);
    });

    it('should create business category', async () => {
      const category = await categoryService.createCategory({
        name: 'Consulting Income',
        type: AccountType.INCOME,
        isBusinessDefault: true,
      });

      expect(category.isBusinessDefault).toBe(true);
    });
  });

  describe('getAllCategories', () => {
    beforeEach(async () => {
      // Create test categories
      await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });
      await categoryService.createCategory({
        name: 'Salary',
        type: AccountType.INCOME,
        isBusinessDefault: false,
      });
      await categoryService.createCategory({
        name: 'Office Supplies',
        type: AccountType.EXPENSE,
        isBusinessDefault: true,
      });
    });

    it('should get all categories', async () => {
      const categories = await categoryService.getAllCategories();

      expect(categories.length).toBe(3);
    });

    it('should filter by type', async () => {
      const expenses = await categoryService.getAllCategories({
        type: AccountType.EXPENSE,
      });

      expect(expenses.length).toBe(2);
      expect(expenses.every((c) => c.type === AccountType.EXPENSE)).toBe(true);
    });

    it('should exclude archived categories by default', async () => {
      const categories = await categoryService.getAllCategories();
      const categoryToArchive = categories[0];

      await categoryService.archiveCategory(categoryToArchive.id);

      const activeCategories = await categoryService.getAllCategories();
      expect(activeCategories.length).toBe(2);
    });

    it('should include archived categories when requested', async () => {
      const categories = await categoryService.getAllCategories();
      const categoryToArchive = categories[0];

      await categoryService.archiveCategory(categoryToArchive.id);

      const allCategories = await categoryService.getAllCategories({
        includeArchived: true,
      });
      expect(allCategories.length).toBe(3);
    });
  });

  describe('getCategoryTree', () => {
    beforeEach(async () => {
      // Create business expense categories
      const businessExpense = await categoryService.createCategory({
        name: 'Marketing',
        type: AccountType.EXPENSE,
        isBusinessDefault: true,
      });
      await categoryService.createCategory({
        name: 'Digital Ads',
        type: AccountType.EXPENSE,
        parentId: businessExpense.id,
      });

      // Create personal expense category
      await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      // Create personal income category
      await categoryService.createCategory({
        name: 'Salary',
        type: AccountType.INCOME,
        isBusinessDefault: false,
      });
    });

    it('should build tree with virtual parent nodes', async () => {
      const tree = await categoryService.getCategoryTree();

      expect(tree.length).toBe(2); // Income and Expenses
      expect(tree[0].name).toBe('Income');
      expect(tree[1].name).toBe('Expenses');

      // Check virtual nodes
      expect(tree[0].children?.length).toBe(2); // Business Income + Personal Income
      expect(tree[1].children?.length).toBe(2); // Business Expenses + Personal Expenses
    });

    it('should filter tree by type', async () => {
      const tree = await categoryService.getCategoryTree({
        type: AccountType.EXPENSE,
      });

      expect(tree.length).toBe(1);
      expect(tree[0].name).toBe('Expenses');
    });

    it('should filter tree by business only', async () => {
      const tree = await categoryService.getCategoryTree({
        businessOnly: true,
      });

      // Should still have Income and Expenses roots, but only business categories
      expect(tree.length).toBe(2);
    });
  });

  describe('getLeafCategories', () => {
    beforeEach(async () => {
      const parent = await categoryService.createCategory({
        name: 'Food & Dining',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      await categoryService.createCategory({
        name: 'Restaurants',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      await categoryService.createCategory({
        name: 'Utilities',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });
    });

    it('should get only leaf categories', async () => {
      const leaves = await categoryService.getLeafCategories();

      // Should get Groceries, Restaurants, Utilities (not Food & Dining parent)
      expect(leaves.length).toBe(3);
      expect(leaves.every((c) => c.name !== 'Food & Dining')).toBe(true);
    });

    it('should filter leaf categories by type', async () => {
      const expenseLeaves = await categoryService.getLeafCategories({
        type: AccountType.EXPENSE,
      });

      expect(expenseLeaves.length).toBe(3);
    });
  });

  describe('getCategoryPath', () => {
    it('should get path from leaf to root', async () => {
      const grandparent = await categoryService.createCategory({
        name: 'Expenses',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      const parent = await categoryService.createCategory({
        name: 'Food & Dining',
        type: AccountType.EXPENSE,
        parentId: grandparent.id,
      });

      const child = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      const path = await categoryService.getCategoryPath(child.id);

      expect(path.length).toBe(3);
      expect(path[0].name).toBe('Expenses');
      expect(path[1].name).toBe('Food & Dining');
      expect(path[2].name).toBe('Groceries');
    });

    it('should handle single-level category', async () => {
      const category = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      const path = await categoryService.getCategoryPath(category.id);

      expect(path.length).toBe(1);
      expect(path[0].name).toBe('Groceries');
    });
  });

  describe('getCategoryChildren', () => {
    it('should get direct children of a category', async () => {
      const parent = await categoryService.createCategory({
        name: 'Food & Dining',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      await categoryService.createCategory({
        name: 'Restaurants',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      const children = await categoryService.getCategoryChildren(parent.id);

      expect(children.length).toBe(2);
    });

    it('should return empty array for leaf category', async () => {
      const category = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      const children = await categoryService.getCategoryChildren(category.id);

      expect(children.length).toBe(0);
    });
  });

  describe('getCategoriesByLevel', () => {
    beforeEach(async () => {
      // Level 1
      const parent = await categoryService.createCategory({
        name: 'Food & Dining',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      // Level 2
      const child = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      // Level 3
      await categoryService.createCategory({
        name: 'Produce',
        type: AccountType.EXPENSE,
        parentId: child.id,
      });
    });

    it('should get categories at specific level', async () => {
      const level1 = await categoryService.getCategoriesByLevel(1);
      const level2 = await categoryService.getCategoriesByLevel(2);
      const level3 = await categoryService.getCategoriesByLevel(3);

      expect(level1.length).toBe(1);
      expect(level1[0].name).toBe('Food & Dining');

      expect(level2.length).toBe(1);
      expect(level2[0].name).toBe('Groceries');

      expect(level3.length).toBe(1);
      expect(level3[0].name).toBe('Produce');
    });
  });

  describe('searchCategories', () => {
    beforeEach(async () => {
      await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });
      await categoryService.createCategory({
        name: 'Grocery Store Fees',
        type: AccountType.EXPENSE,
        isBusinessDefault: true,
      });
      await categoryService.createCategory({
        name: 'Salary',
        type: AccountType.INCOME,
        isBusinessDefault: false,
      });
    });

    it('should search by name', async () => {
      const results = await categoryService.searchCategories('Grocery');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((c) => c.name.toLowerCase().includes('grocery'))).toBe(
        true
      );
      // Should find at least Groceries, possibly also Grocery Store Fees
      const names = results.map(c => c.name);
      expect(names.some(n => n.includes('Groceries') || n.includes('Grocery'))).toBe(true);
    });

    it('should be case insensitive', async () => {
      const results = await categoryService.searchCategories('grocery');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((c) => c.name.toLowerCase().includes('grocery'))).toBe(
        true
      );
    });

    it('should filter search results by business only', async () => {
      const results = await categoryService.searchCategories('Grocery', {
        businessOnly: true,
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Grocery Store Fees');
    });
  });

  describe('getCategoryWithContext', () => {
    it('should get category with path, children, and siblings', async () => {
      const parent = await categoryService.createCategory({
        name: 'Food & Dining',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      const child1 = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      const child2 = await categoryService.createCategory({
        name: 'Restaurants',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      const grandchild = await categoryService.createCategory({
        name: 'Produce',
        type: AccountType.EXPENSE,
        parentId: child1.id,
      });

      const context = await categoryService.getCategoryWithContext(child1.id);

      expect(context.category.name).toBe('Groceries');
      expect(context.path.length).toBe(2); // Food & Dining > Groceries
      expect(context.children.length).toBe(1); // Produce
      expect(context.siblings.length).toBe(1); // Restaurants
      expect(context.siblings[0].name).toBe('Restaurants');
    });

    it('should throw error for non-existent category', async () => {
      await expect(
        categoryService.getCategoryWithContext('non-existent-id')
      ).rejects.toThrow('Category not found');
    });
  });

  describe('updateCategory', () => {
    it('should update category name', async () => {
      const category = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      const updated = await categoryService.updateCategory(category.id, {
        name: 'Grocery Shopping',
      });

      expect(updated.name).toBe('Grocery Shopping');
      expect(updated.fullPath).toBe('EXPENSE/Grocery Shopping');
    });

    it('should update category parent', async () => {
      const newParent = await categoryService.createCategory({
        name: 'Food & Dining',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      const category = await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      const updated = await categoryService.updateCategory(category.id, {
        parentId: newParent.id,
      });

      expect(updated.parentId).toBe(newParent.id);
      expect(updated.level).toBe(2);
      expect(updated.fullPath).toBe('EXPENSE/Food & Dining/Groceries');
    });

    it('should update business default', async () => {
      const category = await categoryService.createCategory({
        name: 'Consulting',
        type: AccountType.INCOME,
        isBusinessDefault: false,
      });

      const updated = await categoryService.updateCategory(category.id, {
        isBusinessDefault: true,
      });

      expect(updated.isBusinessDefault).toBe(true);
    });
  });

  describe('deleteCategory', () => {
    it('should delete category without children or transactions', async () => {
      const category = await categoryService.createCategory({
        name: 'Test Category',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      await categoryService.deleteCategory(category.id);

      const categories = await categoryService.getAllCategories();
      expect(categories.find((c) => c.id === category.id)).toBeUndefined();
    });

    it('should not delete category with children', async () => {
      const parent = await categoryService.createCategory({
        name: 'Food & Dining',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      await categoryService.createCategory({
        name: 'Groceries',
        type: AccountType.EXPENSE,
        parentId: parent.id,
      });

      await expect(categoryService.deleteCategory(parent.id)).rejects.toThrow(
        'Cannot delete category with subcategories'
      );
    });
  });

  describe('archiveCategory', () => {
    it('should archive category', async () => {
      const category = await categoryService.createCategory({
        name: 'Test Category',
        type: AccountType.EXPENSE,
        isBusinessDefault: false,
      });

      const archived = await categoryService.archiveCategory(category.id);

      expect(archived.id).toBe(category.id);

      // Verify it's excluded from default getAllCategories
      const active = await categoryService.getAllCategories();
      expect(active.find((c) => c.id === category.id)).toBeUndefined();

      // Verify it's included when requesting archived
      const all = await categoryService.getAllCategories({
        includeArchived: true,
      });
      expect(all.find((c) => c.id === category.id)).toBeDefined();
    });
  });
});
