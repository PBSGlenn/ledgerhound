/**
 * Category Service
 * Manages hierarchical category structure for income and expenses
 */

import { prisma } from '../db';
import { AccountType, AccountKind } from '@prisma/client';

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

/**
 * Get all categories as a flat list
 */
export async function getAllCategories(options?: {
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

  const categories = await prisma.account.findMany({
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
 */
export async function getCategoryTree(options?: CategoryTreeOptions): Promise<CategoryNode[]> {
  const categories = await getAllCategories({
    type: options?.type,
    includeArchived: false,
  });

  // Filter based on options
  let filtered = categories;

  if (!options?.includeRoot) {
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

  // Build tree structure
  const tree = buildTree(filtered);
  return tree;
}

/**
 * Build tree structure from flat list
 */
function buildTree(categories: CategoryNode[]): CategoryNode[] {
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
export async function getLeafCategories(options?: {
  type?: AccountType;
  businessOnly?: boolean;
  personalOnly?: boolean;
}): Promise<CategoryNode[]> {
  const allCategories = await getAllCategories({ type: options?.type });

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
export async function getCategoryPath(categoryId: string): Promise<CategoryNode[]> {
  const path: CategoryNode[] = [];
  let currentId: string | null = categoryId;

  while (currentId) {
    const category = await prisma.account.findUnique({
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
export async function getCategoryChildren(
  parentId: string,
  options?: { includeArchived?: boolean }
): Promise<CategoryNode[]> {
  const categories = await prisma.account.findMany({
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
export async function getCategoriesByLevel(
  level: number,
  options?: {
    type?: AccountType;
    businessOnly?: boolean;
    personalOnly?: boolean;
  }
): Promise<CategoryNode[]> {
  let categories = await getAllCategories({ type: options?.type });

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
export async function searchCategories(
  searchTerm: string,
  options?: {
    type?: AccountType;
    businessOnly?: boolean;
    personalOnly?: boolean;
    leafOnly?: boolean;
  }
): Promise<CategoryNode[]> {
  const allCategories = await getAllCategories({ type: options?.type });

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
export async function getCategoryWithContext(categoryId: string): Promise<{
  category: CategoryNode;
  path: CategoryNode[];
  children: CategoryNode[];
  siblings: CategoryNode[];
}> {
  const category = await prisma.account.findUnique({
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

  const path = await getCategoryPath(categoryId);
  const children = await getCategoryChildren(categoryId);

  const siblings = category.parentId
    ? await getCategoryChildren(category.parentId)
    : await getCategoriesByLevel(category.level, { type: category.type });

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
export async function createCategory(data: {
  name: string;
  type: AccountType;
  parentId?: string;
  isBusinessDefault?: boolean;
}): Promise<CategoryNode> {
  // Determine level and fullPath based on parent
  let level = 1;
  let fullPath = `${data.type}/${data.name}`;

  if (data.parentId) {
    const parent = await prisma.account.findUnique({
      where: { id: data.parentId },
      select: { level: true, fullPath: true },
    });

    if (parent) {
      level = parent.level + 1;
      fullPath = parent.fullPath ? `${parent.fullPath}/${data.name}` : fullPath;
    }
  }

  // Get max sort order for this level
  const maxSort = await prisma.account.findFirst({
    where: {
      type: data.type,
      level,
      parentId: data.parentId || null,
    },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const sortOrder = (maxSort?.sortOrder || 0) + 1;

  const category = await prisma.account.create({
    data: {
      name: data.name,
      type: data.type,
      kind: AccountKind.CATEGORY,
      parentId: data.parentId,
      level,
      fullPath,
      isReal: false,
      isBusinessDefault: data.isBusinessDefault ?? false,
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
export async function updateCategory(
  id: string,
  data: {
    name?: string;
    parentId?: string;
    isBusinessDefault?: boolean;
  }
): Promise<CategoryNode> {
  const current = await prisma.account.findUnique({
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
      const newParent = await prisma.account.findUnique({
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

  const category = await prisma.account.update({
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
export async function deleteCategory(id: string): Promise<void> {
  // Check for children
  const childCount = await prisma.account.count({
    where: { parentId: id },
  });

  if (childCount > 0) {
    throw new Error('Cannot delete category with subcategories');
  }

  // Check for transactions
  const transactionCount = await prisma.posting.count({
    where: { accountId: id },
  });

  if (transactionCount > 0) {
    throw new Error('Cannot delete category with transactions. Archive it instead.');
  }

  await prisma.account.delete({
    where: { id },
  });
}

/**
 * Archive category (soft delete)
 */
export async function archiveCategory(id: string): Promise<CategoryNode> {
  const category = await prisma.account.update({
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

export const categoryService = {
  getAllCategories,
  getCategoryTree,
  getLeafCategories,
  getCategoryPath,
  getCategoryChildren,
  getCategoriesByLevel,
  searchCategories,
  getCategoryWithContext,
  createCategory,
  updateCategory,
  deleteCategory,
  archiveCategory,
};
