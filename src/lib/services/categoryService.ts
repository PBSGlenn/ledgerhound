/**
 * Category Service
 * Manages hierarchical category structure for income and expenses
 */

import { getPrismaClient } from '../db';
import { AccountType, AccountKind, type PrismaClient } from '@prisma/client';

export interface CategoryNode {
  id: string;
  name: string;
  fullPath: string | null;
  type: AccountType;
  parentId: string | null;
  level: number;
  isBusinessDefault: boolean;
  sortOrder: number;
  children?: CategoryNode[];
}

export interface CategoryTreeOptions {
  includeRoot?: boolean;  // Include level 0 categories
  type?: AccountType;     // Filter by INCOME or EXPENSE
  businessOnly?: boolean; // Only business categories
  personalOnly?: boolean; // Only personal categories
  maxLevel?: number;      // Max depth to return
}

export class CategoryService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

  /**
   * Get all categories as a flat list
   */
  async getAllCategories(options?: {
    type?: AccountType;
    includeArchived?: boolean;
  }): Promise<CategoryNode[]> {
    const where: any = {
      kind: AccountKind.CATEGORY,
      archived: options?.includeArchived ? undefined : false,
    };

    if (options?.type) {
      where.type = options.type;
    }

    const categories = await this.prisma.account.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        fullPath: true,
        type: true,
        parentId: true,
        level: true,
        isBusinessDefault: true,
        sortOrder: true,
      },
    });

    return categories;
  }

  /**
   * Get categories organized as a tree structure
   * Organized as: Income/Expense > Business/Personal > Categories
   */
  async getCategoryTree(options?: CategoryTreeOptions): Promise<CategoryNode[]> {
    const categories = await this.getAllCategories({
      type: options?.type,
      includeArchived: false,
    });

    // Filter based on options
    let filtered = categories;

    // Include root categories (level 0) by default
    if (options?.includeRoot === false) {
      filtered = filtered.filter((c) => c.level > 0);
    }

    if (options?.businessOnly) {
      filtered = filtered.filter((c) => c.isBusinessDefault);
    }

    if (options?.personalOnly) {
      filtered = filtered.filter((c) => !c.isBusinessDefault);
    }

    if (options?.maxLevel !== undefined) {
      filtered = filtered.filter((c) => c.level <= options.maxLevel!);
    }

    // Build tree structure organized by type then business/personal
    const tree = this.buildTypeFirstTree(filtered, options?.type);
    return tree;
  }

  /**
   * Build tree structure organized by Type (Income/Expense) > Business/Personal > Categories
   */
  private buildTypeFirstTree(categories: CategoryNode[], typeFilter?: AccountType): CategoryNode[] {
    const roots: CategoryNode[] = [];

    // Separate by type
    const incomeCategories = categories.filter((c) => c.type === AccountType.INCOME);
    const expenseCategories = categories.filter((c) => c.type === AccountType.EXPENSE);

    // If filtering by type, only create that root node
    if (typeFilter === AccountType.INCOME) {
      const incomeNode = this.buildIncomeNode(incomeCategories);
      return [incomeNode];
    }
    if (typeFilter === AccountType.EXPENSE) {
      const expenseNode = this.buildExpenseNode(expenseCategories);
      return [expenseNode];
    }

    // Create virtual parent nodes for each type+business combination
    const createVirtualParent = (name: string, type: AccountType, isBusiness: boolean): CategoryNode => ({
      id: `virtual-${type}-${isBusiness ? 'business' : 'personal'}`,
      name,
      fullPath: null,
      type,
      parentId: null,
      level: 0,
      isBusinessDefault: isBusiness,
      sortOrder: 0,
      children: [],
    });

    // Process Income - always show even if empty
    const incomeNode = this.buildIncomeNode(incomeCategories, createVirtualParent);
    roots.push(incomeNode);

    // Process Expenses - always show even if empty
    const expenseNode = this.buildExpenseNode(expenseCategories, createVirtualParent);
    roots.push(expenseNode);

    return roots;
  }

  /**
   * Build income node with business/personal children
   */
  private buildIncomeNode(
    incomeCategories: CategoryNode[],
    createVirtualParent?: (name: string, type: AccountType, isBusiness: boolean) => CategoryNode
  ): CategoryNode {
    const virtualParent = createVirtualParent || ((name: string, type: AccountType, isBusiness: boolean): CategoryNode => ({
      id: `virtual-${type}-${isBusiness ? 'business' : 'personal'}`,
      name,
      fullPath: null,
      type,
      parentId: null,
      level: 0,
      isBusinessDefault: isBusiness,
      sortOrder: 0,
      children: [],
    }));

    const businessIncome = incomeCategories.filter((c) => c.isBusinessDefault);
    const personalIncome = incomeCategories.filter((c) => !c.isBusinessDefault);

    const incomeNode: CategoryNode = {
      id: 'virtual-income',
      name: 'Income',
      fullPath: null,
      type: AccountType.INCOME,
      parentId: null,
      level: 0,
      isBusinessDefault: false,
      sortOrder: 0,
      children: [],
    };

    // Always add Business Income and Personal Income nodes, even if empty
    const businessIncomeNode = virtualParent('Business Income', AccountType.INCOME, true);
    businessIncomeNode.children = this.buildTree(businessIncome);
    incomeNode.children!.push(businessIncomeNode);

    const personalIncomeNode = virtualParent('Personal Income', AccountType.INCOME, false);
    personalIncomeNode.children = this.buildTree(personalIncome);
    incomeNode.children!.push(personalIncomeNode);

    return incomeNode;
  }

  /**
   * Build expense node with business/personal children
   */
  private buildExpenseNode(
    expenseCategories: CategoryNode[],
    createVirtualParent?: (name: string, type: AccountType, isBusiness: boolean) => CategoryNode
  ): CategoryNode {
    const virtualParent = createVirtualParent || ((name: string, type: AccountType, isBusiness: boolean): CategoryNode => ({
      id: `virtual-${type}-${isBusiness ? 'business' : 'personal'}`,
      name,
      fullPath: null,
      type,
      parentId: null,
      level: 0,
      isBusinessDefault: isBusiness,
      sortOrder: 0,
      children: [],
    }));

    const businessExpense = expenseCategories.filter((c) => c.isBusinessDefault);
    const personalExpense = expenseCategories.filter((c) => !c.isBusinessDefault);

    const expenseNode: CategoryNode = {
      id: 'virtual-expense',
      name: 'Expenses',
      fullPath: null,
      type: AccountType.EXPENSE,
      parentId: null,
      level: 0,
      isBusinessDefault: false,
      sortOrder: 1,
      children: [],
    };

    // Always add Business Expenses and Personal Expenses nodes, even if empty
    const businessExpenseNode = virtualParent('Business Expenses', AccountType.EXPENSE, true);
    businessExpenseNode.children = this.buildTree(businessExpense);
    expenseNode.children!.push(businessExpenseNode);

    const personalExpenseNode = virtualParent('Personal Expenses', AccountType.EXPENSE, false);
    personalExpenseNode.children = this.buildTree(personalExpense);
    expenseNode.children!.push(personalExpenseNode);

    return expenseNode;
  }

  /**
   * Build tree structure from flat list
   */
  private buildTree(categories: CategoryNode[]): CategoryNode[] {
    const map = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    // First pass: create map and initialize children arrays
    categories.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach((cat) => {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        const parent = map.get(cat.parentId)!;
        parent.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  /**
   * Get all leaf categories (categories without children)
   * These are the categories users can actually assign to transactions
   */
  async getLeafCategories(options?: {
    type?: AccountType;
    businessOnly?: boolean;
    personalOnly?: boolean;
  }): Promise<CategoryNode[]> {
    const allCategories = await this.getAllCategories({ type: options?.type });

    // Find categories with no children
    const parentIds = new Set(allCategories.map((c) => c.parentId).filter(Boolean));
    let leafCategories = allCategories.filter((c) => !parentIds.has(c.id));

    // Apply filters
    if (options?.businessOnly) {
      leafCategories = leafCategories.filter((c) => c.isBusinessDefault);
    }

    if (options?.personalOnly) {
      leafCategories = leafCategories.filter((c) => !c.isBusinessDefault);
    }

    return leafCategories;
  }

  /**
   * Get category path from leaf to root
   * Example: ["Groceries", "Food & Dining", "Personal Expenses"]
   */
  async getCategoryPath(categoryId: string): Promise<CategoryNode[]> {
    const path: CategoryNode[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await this.prisma.account.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          name: true,
          fullPath: true,
          type: true,
          parentId: true,
          level: true,
          isBusinessDefault: true,
          sortOrder: true,
        },
      });

      if (!category) break;

      path.unshift(category);
      currentId = category.parentId;
    }

    return path;
  }

  /**
   * Get children of a specific category
   */
  async getCategoryChildren(
    parentId: string,
    options?: { includeArchived?: boolean }
  ): Promise<CategoryNode[]> {
    const categories = await this.prisma.account.findMany({
      where: {
        parentId,
        kind: AccountKind.CATEGORY,
        archived: options?.includeArchived ? undefined : false,
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        fullPath: true,
        type: true,
        parentId: true,
        level: true,
        isBusinessDefault: true,
        sortOrder: true,
      },
    });

    return categories;
  }

  /**
   * Get categories by level
   * Level 1: Personal/Business groupings
   * Level 2: Main categories
   * Level 3+: Subcategories
   */
  async getCategoriesByLevel(
    level: number,
    options?: {
      type?: AccountType;
      businessOnly?: boolean;
      personalOnly?: boolean;
    }
  ): Promise<CategoryNode[]> {
    let categories = await this.getAllCategories({ type: options?.type });

    categories = categories.filter((c) => c.level === level);

    if (options?.businessOnly) {
      categories = categories.filter((c) => c.isBusinessDefault);
    }

    if (options?.personalOnly) {
      categories = categories.filter((c) => !c.isBusinessDefault);
    }

    return categories;
  }

  /**
   * Search categories by name
   */
  async searchCategories(
    searchTerm: string,
    options?: {
      type?: AccountType;
      businessOnly?: boolean;
      personalOnly?: boolean;
      leafOnly?: boolean;
    }
  ): Promise<CategoryNode[]> {
    const allCategories = await this.getAllCategories({ type: options?.type });

    const searchLower = searchTerm.toLowerCase();
    let results = allCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.fullPath?.toLowerCase().includes(searchLower)
    );

    if (options?.businessOnly) {
      results = results.filter((c) => c.isBusinessDefault);
    }

    if (options?.personalOnly) {
      results = results.filter((c) => !c.isBusinessDefault);
    }

    if (options?.leafOnly) {
      const parentIds = new Set(allCategories.map((c) => c.parentId).filter(Boolean));
      results = results.filter((c) => !parentIds.has(c.id));
    }

    return results;
  }

  /**
   * Get category with its full tree (parent + all ancestors, + children)
   */
  async getCategoryWithContext(categoryId: string): Promise<{
    category: CategoryNode;
    path: CategoryNode[];
    children: CategoryNode[];
    siblings: CategoryNode[];
  }> {
    const category = await this.prisma.account.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        fullPath: true,
        type: true,
        parentId: true,
        level: true,
        isBusinessDefault: true,
        sortOrder: true,
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    const path = await this.getCategoryPath(categoryId);
    const children = await this.getCategoryChildren(categoryId);

    const siblings = category.parentId
      ? await this.getCategoryChildren(category.parentId)
      : await this.getCategoriesByLevel(category.level, { type: category.type });

    return {
      category,
      path,
      children,
      siblings: siblings.filter((s) => s.id !== categoryId),
    };
  }

  /**
   * Create a new category
   */
  async createCategory(data: {
    name: string;
    type: AccountType;
    parentId?: string;
    isBusinessDefault?: boolean;
    defaultHasGst?: boolean;
  }): Promise<CategoryNode> {
    // Determine level and fullPath based on parent
    let level = 1;
    let fullPath = `${data.type}/${data.name}`;
    let inheritedIsBusinessDefault = false;
    let inheritedDefaultHasGst = true;

    if (data.parentId) {
      const parent = await this.prisma.account.findUnique({
        where: { id: data.parentId },
        select: { level: true, fullPath: true, isBusinessDefault: true, defaultHasGst: true },
      });

      if (parent) {
        level = parent.level + 1;
        fullPath = parent.fullPath ? `${parent.fullPath}/${data.name}` : fullPath;
        // Inherit parent's business and GST settings
        inheritedIsBusinessDefault = parent.isBusinessDefault;
        inheritedDefaultHasGst = parent.defaultHasGst ?? true;
      }
    }

    // Get max sort order for this level
    const maxSort = await this.prisma.account.findFirst({
      where: {
        type: data.type,
        level,
        parentId: data.parentId || null,
      },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const sortOrder = (maxSort?.sortOrder || 0) + 1;

    const category = await this.prisma.account.create({
      data: {
        name: data.name,
        type: data.type,
        kind: AccountKind.CATEGORY,
        parentId: data.parentId,
        level,
        fullPath,
        isReal: false,
        isBusinessDefault: data.isBusinessDefault ?? inheritedIsBusinessDefault,
        defaultHasGst: data.defaultHasGst ?? inheritedDefaultHasGst,
        sortOrder,
      },
      select: {
        id: true,
        name: true,
        fullPath: true,
        type: true,
        parentId: true,
        level: true,
        isBusinessDefault: true,
        sortOrder: true,
      },
    });

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    data: {
      name?: string;
      parentId?: string;
      isBusinessDefault?: boolean;
    }
  ): Promise<CategoryNode> {
    const current = await this.prisma.account.findUnique({
      where: { id },
      select: { name: true, type: true, parentId: true, fullPath: true, level: true },
    });

    if (!current) {
      throw new Error('Category not found');
    }

    // If parent is changing, recalculate level and fullPath
    let updateData: any = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.isBusinessDefault !== undefined) {
      updateData.isBusinessDefault = data.isBusinessDefault;
    }

    if (data.parentId !== undefined) {
      updateData.parentId = data.parentId;

      // Recalculate level and fullPath
      if (data.parentId) {
        const newParent = await this.prisma.account.findUnique({
          where: { id: data.parentId },
          select: { level: true, fullPath: true },
        });

        if (newParent) {
          updateData.level = newParent.level + 1;
          const newName = data.name ?? current.name;
          updateData.fullPath = `${newParent.fullPath}/${newName}`;
        }
      } else {
        updateData.level = 1;
        const newName = data.name ?? current.name;
        updateData.fullPath = `${current.type}/${newName}`;
      }
    } else if (data.name && current.fullPath) {
      // Name changed but parent didn't - update fullPath
      const pathParts = current.fullPath.split('/');
      pathParts[pathParts.length - 1] = data.name;
      updateData.fullPath = pathParts.join('/');
    }

    const category = await this.prisma.account.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        fullPath: true,
        type: true,
        parentId: true,
        level: true,
        isBusinessDefault: true,
        sortOrder: true,
      },
    });

    return category;
  }

  /**
   * Delete category (only if it has no children and no transactions)
   */
  async deleteCategory(id: string): Promise<void> {
    // Check for children
    const childCount = await this.prisma.account.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      throw new Error('Cannot delete category with subcategories');
    }

    // Check for transactions
    const transactionCount = await this.prisma.posting.count({
      where: { accountId: id },
    });

    if (transactionCount > 0) {
      throw new Error('Cannot delete category with transactions. Archive it instead.');
    }

    await this.prisma.account.delete({
      where: { id },
    });
  }

  /**
   * Archive category (soft delete)
   */
  async archiveCategory(id: string): Promise<CategoryNode> {
    const category = await this.prisma.account.update({
      where: { id },
      data: { archived: true },
      select: {
        id: true,
        name: true,
        fullPath: true,
        type: true,
        parentId: true,
        level: true,
        isBusinessDefault: true,
        sortOrder: true,
      },
    });

    return category;
  }
}

// Export singleton instance for backward compatibility
const categoryServiceInstance = new CategoryService();

export const categoryService = {
  getAllCategories: (...args: Parameters<CategoryService['getAllCategories']>) =>
    categoryServiceInstance.getAllCategories(...args),
  getCategoryTree: (...args: Parameters<CategoryService['getCategoryTree']>) =>
    categoryServiceInstance.getCategoryTree(...args),
  getLeafCategories: (...args: Parameters<CategoryService['getLeafCategories']>) =>
    categoryServiceInstance.getLeafCategories(...args),
  getCategoryPath: (...args: Parameters<CategoryService['getCategoryPath']>) =>
    categoryServiceInstance.getCategoryPath(...args),
  getCategoryChildren: (...args: Parameters<CategoryService['getCategoryChildren']>) =>
    categoryServiceInstance.getCategoryChildren(...args),
  getCategoriesByLevel: (...args: Parameters<CategoryService['getCategoriesByLevel']>) =>
    categoryServiceInstance.getCategoriesByLevel(...args),
  searchCategories: (...args: Parameters<CategoryService['searchCategories']>) =>
    categoryServiceInstance.searchCategories(...args),
  getCategoryWithContext: (...args: Parameters<CategoryService['getCategoryWithContext']>) =>
    categoryServiceInstance.getCategoryWithContext(...args),
  createCategory: (...args: Parameters<CategoryService['createCategory']>) =>
    categoryServiceInstance.createCategory(...args),
  updateCategory: (...args: Parameters<CategoryService['updateCategory']>) =>
    categoryServiceInstance.updateCategory(...args),
  deleteCategory: (...args: Parameters<CategoryService['deleteCategory']>) =>
    categoryServiceInstance.deleteCategory(...args),
  archiveCategory: (...args: Parameters<CategoryService['archiveCategory']>) =>
    categoryServiceInstance.archiveCategory(...args),
};
