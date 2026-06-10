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
   * Title-case root segment for stored fullPaths ("Expense", "Income") —
   * matches the convention used by the seeded default categories
   */
  private rootPrefix(type: AccountType): string {
    const s = String(type);
    return s.charAt(0) + s.slice(1).toLowerCase();
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
   * Simply follows parentId relationships - the database handles hierarchy
   */
  async getCategoryTree(options?: CategoryTreeOptions): Promise<CategoryNode[]> {
    // Fetch all categories
    const categories = await this.getAllCategories({
      type: options?.type,
      includeArchived: false,
    });

    // Apply filters
    let filtered = categories;
    if (options?.businessOnly) {
      filtered = filtered.filter((c) => c.isBusinessDefault);
    }
    if (options?.personalOnly) {
      filtered = filtered.filter((c) => !c.isBusinessDefault);
    }
    if (options?.maxLevel !== undefined) {
      filtered = filtered.filter((c) => c.level <= options.maxLevel!);
    }

    // Build tree from parentId relationships (simple!)
    const tree = this.buildTreeFromParentId(filtered);

    // Wrap in virtual Income/Expense nodes for UI organization
    return this.wrapInTypeNodes(tree, options?.type);
  }

  /**
   * Build tree by following parentId relationships - this is what databases do
   */
  private buildTreeFromParentId(categories: CategoryNode[]): CategoryNode[] {
    const map = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    // First pass: create all nodes with empty children
    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] });
    }

    // Second pass: link children to parents
    for (const cat of categories) {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Wrap tree in virtual Income/Expense nodes for UI consistency
   */
  private wrapInTypeNodes(tree: CategoryNode[], typeFilter?: AccountType): CategoryNode[] {
    const incomeRoots = tree.filter(n => n.type === AccountType.INCOME);
    const expenseRoots = tree.filter(n => n.type === AccountType.EXPENSE);

    const result: CategoryNode[] = [];

    if (!typeFilter || typeFilter === AccountType.INCOME) {
      result.push({
        id: 'virtual-income',
        name: 'Income',
        fullPath: null,
        type: AccountType.INCOME,
        parentId: null,
        level: 0,
        isBusinessDefault: false,
        sortOrder: 0,
        children: incomeRoots,
      });
    }

    if (!typeFilter || typeFilter === AccountType.EXPENSE) {
      result.push({
        id: 'virtual-expense',
        name: 'Expenses',
        fullPath: null,
        type: AccountType.EXPENSE,
        parentId: null,
        level: 0,
        isBusinessDefault: false,
        sortOrder: 1,
        children: expenseRoots,
      });
    }

    return result;
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
    // Check for duplicate name within the same type and parent
    const existing = await this.prisma.account.findFirst({
      where: {
        name: data.name,
        type: data.type,
        parentId: data.parentId ?? null,
        kind: AccountKind.CATEGORY,
      },
    });

    if (existing) {
      throw new Error(`Category "${data.name}" already exists under this parent`);
    }

    // Determine level and fullPath based on parent
    let level = 1;
    let fullPath = `${this.rootPrefix(data.type)}/${data.name}`;
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
      parentId?: string | null;
      isBusinessDefault?: boolean;
      defaultHasGst?: boolean;
      atoLabel?: string | null;
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

    if (data.defaultHasGst !== undefined) {
      updateData.defaultHasGst = data.defaultHasGst;
    }

    if (data.atoLabel !== undefined) {
      updateData.atoLabel = data.atoLabel;
    }

    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new Error('Cannot move a category under itself');
      }

      // Recalculate level and fullPath
      if (data.parentId) {
        const newParent = await this.prisma.account.findUnique({
          where: { id: data.parentId },
          select: { level: true, fullPath: true, type: true, kind: true },
        });

        if (!newParent) {
          throw new Error('New parent category not found');
        }
        if (newParent.kind !== AccountKind.CATEGORY) {
          throw new Error('New parent must be a category');
        }
        if (newParent.type !== current.type) {
          throw new Error('Cannot move a category between INCOME and EXPENSE');
        }

        // Refuse cycles: new parent must not be a descendant of this category
        let ancestorId: string | null = data.parentId;
        while (ancestorId) {
          if (ancestorId === id) {
            throw new Error('Cannot move a category under one of its own subcategories');
          }
          const ancestor: { parentId: string | null } | null = await this.prisma.account.findUnique({
            where: { id: ancestorId },
            select: { parentId: true },
          });
          ancestorId = ancestor?.parentId ?? null;
        }

        updateData.parentId = data.parentId;
        updateData.level = newParent.level + 1;
        const newName = data.name ?? current.name;
        updateData.fullPath = `${newParent.fullPath}/${newName}`;
      } else {
        updateData.parentId = null;
        updateData.level = 1;
        const newName = data.name ?? current.name;
        updateData.fullPath = `${this.rootPrefix(current.type)}/${newName}`;
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

    // Rename or move changes this node's path/level, so every descendant's
    // stored fullPath/level prefix is now stale — recompute the subtree
    if (updateData.fullPath !== undefined || updateData.level !== undefined) {
      await this.repairSubtree(category.id, category.level, category.fullPath);
    }

    return category;
  }

  /**
   * Recompute level and fullPath for all descendants of a category
   */
  private async repairSubtree(
    parentId: string,
    parentLevel: number,
    parentFullPath: string | null
  ): Promise<void> {
    const children = await this.prisma.account.findMany({
      where: { parentId, kind: AccountKind.CATEGORY },
      select: { id: true, name: true, type: true },
    });

    for (const child of children) {
      const level = parentLevel + 1;
      const fullPath = parentFullPath
        ? `${parentFullPath}/${child.name}`
        : `${this.rootPrefix(child.type)}/${child.name}`;

      await this.prisma.account.update({
        where: { id: child.id },
        data: { level, fullPath },
      });

      await this.repairSubtree(child.id, level, fullPath);
    }
  }

  /**
   * Merge one category into another: re-point all postings, memorized rules,
   * and recurring bills from source to target, then delete the source.
   */
  async mergeCategories(sourceId: string, targetId: string): Promise<{
    postingsMoved: number;
    rulesMoved: number;
    billsMoved: number;
  }> {
    if (sourceId === targetId) {
      throw new Error('Source and target categories must be different');
    }

    const [source, target] = await Promise.all([
      this.prisma.account.findUnique({
        where: { id: sourceId },
        select: { id: true, name: true, type: true, kind: true },
      }),
      this.prisma.account.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, type: true, kind: true },
      }),
    ]);

    if (!source) throw new Error('Source category not found');
    if (!target) throw new Error('Target category not found');
    if (source.kind !== AccountKind.CATEGORY || target.kind !== AccountKind.CATEGORY) {
      throw new Error('Both source and target must be categories');
    }
    if (source.type !== target.type) {
      throw new Error('Cannot merge categories of different types (INCOME vs EXPENSE)');
    }

    const childCount = await this.prisma.account.count({
      where: { parentId: sourceId },
    });
    if (childCount > 0) {
      throw new Error('Cannot merge a category that has subcategories. Move or merge its subcategories first.');
    }

    return this.prisma.$transaction(async (tx) => {
      const postings = await tx.posting.updateMany({
        where: { accountId: sourceId },
        data: { accountId: targetId },
      });

      const rules = await tx.memorizedRule.updateMany({
        where: { defaultAccountId: sourceId },
        data: { defaultAccountId: targetId },
      });

      const bills = await tx.recurringBill.updateMany({
        where: { categoryAccountId: sourceId },
        data: { categoryAccountId: targetId },
      });

      await tx.account.delete({ where: { id: sourceId } });

      return {
        postingsMoved: postings.count,
        rulesMoved: rules.count,
        billsMoved: bills.count,
      };
    });
  }

  /**
   * Repair hierarchy metadata for all categories: recompute level and fullPath
   * from the parentId chain, and renumber sortOrder within sibling groups that
   * contain duplicates. Fixes categories created via code paths that skipped
   * the metadata computation.
   */
  async repairHierarchy(): Promise<{ pathsRepaired: number; sortOrdersRepaired: number }> {
    const categories = await this.prisma.account.findMany({
      where: {
        kind: AccountKind.CATEGORY,
        // GST system accounts (ASSET/LIABILITY) carry hand-set paths like
        // "GST/Paid" — leave them alone
        type: { in: [AccountType.INCOME, AccountType.EXPENSE] },
      },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        level: true,
        fullPath: true,
        sortOrder: true,
      },
    });

    const byId = new Map(categories.map((c) => [c.id, c]));

    // Compute correct level + fullPath by walking up the parent chain
    const computed = new Map<string, { level: number; fullPath: string }>();
    const compute = (cat: (typeof categories)[number]): { level: number; fullPath: string } => {
      const cached = computed.get(cat.id);
      if (cached) return cached;

      let result: { level: number; fullPath: string };
      const parent = cat.parentId ? byId.get(cat.parentId) : undefined;
      if (parent) {
        const parentResult = compute(parent);
        result = {
          level: parentResult.level + 1,
          fullPath: `${parentResult.fullPath}/${cat.name}`,
        };
      } else {
        result = { level: 1, fullPath: `${this.rootPrefix(cat.type)}/${cat.name}` };
      }

      computed.set(cat.id, result);
      return result;
    };

    let pathsRepaired = 0;
    for (const cat of categories) {
      const correct = compute(cat);
      if (cat.level !== correct.level || cat.fullPath !== correct.fullPath) {
        await this.prisma.account.update({
          where: { id: cat.id },
          data: { level: correct.level, fullPath: correct.fullPath },
        });
        pathsRepaired++;
      }
    }

    // Renumber sortOrder within sibling groups that contain duplicates
    let sortOrdersRepaired = 0;
    const siblingGroups = new Map<string, typeof categories>();
    for (const cat of categories) {
      const key = `${cat.type}:${cat.parentId ?? 'root'}`;
      const group = siblingGroups.get(key) ?? [];
      group.push(cat);
      siblingGroups.set(key, group);
    }

    for (const group of siblingGroups.values()) {
      const orders = group.map((c) => c.sortOrder);
      const hasDuplicates = new Set(orders).size !== orders.length;
      if (!hasDuplicates) continue;

      const sorted = [...group].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      );
      for (let i = 0; i < sorted.length; i++) {
        const newOrder = i + 1;
        if (sorted[i].sortOrder !== newOrder) {
          await this.prisma.account.update({
            where: { id: sorted[i].id },
            data: { sortOrder: newOrder },
          });
          sortOrdersRepaired++;
        }
      }
    }

    return { pathsRepaired, sortOrdersRepaired };
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
  mergeCategories: (...args: Parameters<CategoryService['mergeCategories']>) =>
    categoryServiceInstance.mergeCategories(...args),
  repairHierarchy: (...args: Parameters<CategoryService['repairHierarchy']>) =>
    categoryServiceInstance.repairHierarchy(...args),
};
