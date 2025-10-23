/**
 * CategorySelector Component
 * Hierarchical dropdown for selecting income/expense categories
 */

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Building2, User, X } from 'lucide-react';
import type { AccountType } from '@prisma/client';

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

interface CategorySelectorProps {
  value: string | null;  // Selected category ID
  onChange: (categoryId: string | null) => void;
  type?: AccountType;    // Filter by INCOME or EXPENSE
  businessOnly?: boolean;
  personalOnly?: boolean;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function CategorySelector({
  value,
  onChange,
  type,
  businessOnly,
  personalOnly,
  placeholder = 'Select category...',
  required = false,
  disabled = false,
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [flatCategories, setFlatCategories] = useState<CategoryNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Load categories from API
  useEffect(() => {
    loadCategories();
  }, [type, businessOnly, personalOnly]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (businessOnly) params.set('businessOnly', 'true');
      if (personalOnly) params.set('personalOnly', 'true');

      const response = await fetch(`http://localhost:3001/api/categories/tree?${params}`);
      if (!response.ok) throw new Error('Failed to load categories');

      const tree = await response.json();
      setCategories(tree);

      // Flatten for search and selection
      const flattened = flattenTree(tree);
      setFlatCategories(flattened);

      // Auto-expand to show selected category
      if (value) {
        await expandToCategory(value, flattened);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const flattenTree = (nodes: CategoryNode[], result: CategoryNode[] = []): CategoryNode[] => {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        flattenTree(node.children, result);
      }
    });
    return result;
  };

  const expandToCategory = async (categoryId: string, flattened: CategoryNode[]) => {
    try {
      const response = await fetch(`http://localhost:3001/api/categories/${categoryId}/path`);
      if (!response.ok) return;

      const path = await response.json();
      const newExpanded = new Set(expandedNodes);
      path.forEach((node: CategoryNode) => {
        if (node.id !== categoryId) {
          newExpanded.add(node.id);
        }
      });
      setExpandedNodes(newExpanded);
    } catch (error) {
      console.error('Error expanding to category:', error);
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleSelect = (categoryId: string, node: CategoryNode) => {
    // Only allow selecting leaf categories (no children)
    if (node.children && node.children.length > 0) {
      toggleNode(categoryId);
      return;
    }

    onChange(categoryId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // Get display name for selected category
  const selectedCategory = useMemo(() => {
    return flatCategories.find((c) => c.id === value);
  }, [value, flatCategories]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;

    const searchLower = searchTerm.toLowerCase();
    const matches = flatCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.fullPath?.toLowerCase().includes(searchLower)
    );

    // Auto-expand parents of matches
    const matchIds = new Set(matches.map((m) => m.id));
    const newExpanded = new Set<string>();
    matches.forEach((match) => {
      let current = flatCategories.find((c) => c.id === match.parentId);
      while (current) {
        newExpanded.add(current.id);
        current = flatCategories.find((c) => c.id === current?.parentId);
      }
    });
    setExpandedNodes(newExpanded);

    // Filter tree to only show matches and their parents/children
    return filterTree(categories, matchIds);
  }, [searchTerm, categories, flatCategories]);

  const filterTree = (nodes: CategoryNode[], matchIds: Set<string>): CategoryNode[] => {
    return nodes
      .map((node) => {
        const hasMatchingChild = node.children?.some((child) =>
          matchIds.has(child.id) || (child.children && filterTree([child], matchIds).length > 0)
        );

        if (matchIds.has(node.id) || hasMatchingChild) {
          return {
            ...node,
            children: node.children ? filterTree(node.children, matchIds) : undefined,
          };
        }
        return null;
      })
      .filter((node): node is CategoryNode => node !== null);
  };

  const renderCategoryNode = (node: CategoryNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = value === node.id;
    const isLeaf = !hasChildren;

    return (
      <div key={node.id} className="select-none">
        <button
          type="button"
          onClick={() => handleSelect(node.id, node)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            isSelected
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100'
              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100'
          } ${!isLeaf ? 'font-medium' : ''}`}
          style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
        >
          {hasChildren && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
            </span>
          )}
          {!hasChildren && <span className="w-4" />}

          {node.level === 1 && (
            <span className="flex-shrink-0">
              {node.isBusinessDefault ? (
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              )}
            </span>
          )}

          <span className={`flex-1 ${!isLeaf ? 'font-semibold' : ''}`}>
            {node.name}
          </span>

          {!isLeaf && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {node.children?.length}
            </span>
          )}
        </button>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Selected Value / Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-slate-400 dark:hover:border-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
        }`}
      >
        <span className="flex-1 text-left truncate">
          {selectedCategory ? (
            <span className="flex items-center gap-2">
              {selectedCategory.level === 1 && selectedCategory.isBusinessDefault && (
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              )}
              {selectedCategory.level === 1 && !selectedCategory.isBusinessDefault && (
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              )}
              <span className="text-slate-900 dark:text-slate-100">{selectedCategory.name}</span>
              {selectedCategory.fullPath && (
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {selectedCategory.fullPath.split('/').slice(0, -1).join(' › ')}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          {value && !required && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-96 flex flex-col">
            {/* Search */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Category Tree */}
            <div className="flex-1 overflow-y-auto p-1">
              {loading ? (
                <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading categories...
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  {searchTerm ? 'No categories found' : 'No categories available'}
                </div>
              ) : (
                filteredCategories.map((node) => renderCategoryNode(node))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
