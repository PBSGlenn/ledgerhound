/**
 * CategorySelector Component
 * Hierarchical dropdown for selecting income/expense categories
 *
 * Uses Radix Popover for proper focus management when used inside Radix Dialog.
 * This ensures the search input works correctly even when nested in modals.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import type { AccountType } from '@prisma/client';
import { CategoryFormModal } from './CategoryFormModal';
import { useToast } from '../../hooks/useToast';

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // New category modal state
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryParent, setNewCategoryParent] = useState<CategoryNode | null>(null);
  const { showToast } = useToast();

  // Close dropdown function
  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Use setTimeout to ensure focus happens after Radix portal/modal is fully rendered
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Load categories from API
  useEffect(() => {
    loadCategories();
  }, [type, businessOnly, personalOnly]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('includeRoot', 'true'); // Include level=0 categories (leaf categories without parents)
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

      // Auto-expand virtual parent nodes (Income, Expenses, Business/Personal groupings)
      const virtualNodes = flattened.filter(n => n.id.startsWith('virtual-'));
      const newExpanded = new Set(virtualNodes.map(n => n.id));

      // Auto-expand to show selected category
      if (value) {
        await expandToCategory(value, flattened);
      } else {
        setExpandedNodes(newExpanded);
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
      // Always expand virtual nodes
      const virtualNodes = flattened.filter(n => n.id.startsWith('virtual-'));
      const newExpanded = new Set(virtualNodes.map(n => n.id));

      const response = await fetch(`http://localhost:3001/api/categories/${categoryId}/path`);
      if (!response.ok) {
        setExpandedNodes(newExpanded);
        return;
      }

      const path = await response.json();
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
    // Don't allow selecting virtual parent nodes or categories with children
    if (categoryId.startsWith('virtual-') || (node.children && node.children.length > 0)) {
      toggleNode(categoryId);
      return;
    }

    onChange(categoryId);
    closeDropdown();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleNewCategory = () => {
    setNewCategoryParent(null);
    setShowNewCategoryModal(true);
    closeDropdown(); // Close dropdown so modal is visible
  };

  const handleCreateCategory = async (categoryName: string) => {
    // Determine the type and business settings from parent or current selector type
    const categoryType = newCategoryParent?.type || type || 'EXPENSE';
    const isBusiness = newCategoryParent?.isBusinessDefault || false;
    const parentId = newCategoryParent?.id.startsWith('virtual-') ? null : newCategoryParent?.id || null;

    const response = await fetch('http://localhost:3001/api/categories/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: categoryName,
        type: categoryType,
        parentId,
        isBusinessDefault: isBusiness,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create category');
    }

    const newCategory = await response.json();
    showToast('success', `Category "${categoryName}" created`);

    // Reload categories and select the new one
    await loadCategories();
    onChange(newCategory.id);
    setShowNewCategoryModal(false);
    closeDropdown();
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
    const result: CategoryNode[] = [];
    for (const node of nodes) {
      const hasMatchingChild = node.children?.some((child) =>
        matchIds.has(child.id) || (child.children && filterTree([child], matchIds).length > 0)
      );

      if (matchIds.has(node.id) || hasMatchingChild) {
        result.push({
          ...node,
          children: node.children ? filterTree(node.children, matchIds) : undefined,
        });
      }
    }
    return result;
  };

  // Highlight search term in text
  const highlightMatch = (text: string) => {
    if (!searchTerm) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const renderCategoryNode = (node: CategoryNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = value === node.id;
    const isLeaf = !hasChildren;
    const isVirtual = node.id.startsWith('virtual-');

    return (
      <div key={node.id} className="select-none">
        <button
          type="button"
          onClick={() => handleSelect(node.id, node)}
          className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors ${
            isSelected
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
              : isVirtual || !isLeaf
                ? 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-default'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100'
          } ${!isLeaf ? 'font-semibold' : ''}`}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          title={!isLeaf ? 'Click to expand/collapse' : undefined}
        >
          {hasChildren ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="flex-shrink-0 cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              )}
            </span>
          ) : (
            <span className="w-3.5" />
          )}

          <span className="flex-1 truncate">
            {highlightMatch(node.name)}
          </span>

          {!isLeaf && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex-shrink-0">
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
    <div className="relative" data-category-selector>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen} modal={true}>
        {/* Trigger Button */}
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm transition-colors ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-slate-400 dark:hover:border-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
            }`}
          >
            <span className="flex-1 text-left truncate">
              {selectedCategory ? (
                <span className="flex items-center gap-2">
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
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={handleClear}
                  onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
                  className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </button>
        </Popover.Trigger>

        {/* Dropdown Content - Radix Portal properly integrates with Dialog focus management */}
        <Popover.Portal>
          <Popover.Content
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-80 flex flex-col w-[var(--radix-popover-trigger-width)] z-[9999]"
            sideOffset={4}
            align="start"
            onOpenAutoFocus={(e) => {
              // Prevent Popover from focusing the first focusable element
              // We'll manually focus the search input
              e.preventDefault();
              searchInputRef.current?.focus();
            }}
          >
            {/* Search */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    closeDropdown();
                  }
                }}
                placeholder="Search categories..."
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none"
                autoComplete="off"
              />
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

            {/* New Category Button */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-2">
              <button
                type="button"
                onClick={handleNewCategory}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Category...</span>
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* New Category Modal */}
      <CategoryFormModal
        isOpen={showNewCategoryModal}
        onClose={() => {
          setShowNewCategoryModal(false);
          setNewCategoryParent(null);
        }}
        parentName={newCategoryParent?.name || (type === 'INCOME' ? 'Income' : 'Expenses')}
        accountType={newCategoryParent?.type || type || 'EXPENSE'}
        isBusinessDefault={newCategoryParent?.isBusinessDefault || false}
        onSuccess={handleCreateCategory}
      />
    </div>
  );
}
