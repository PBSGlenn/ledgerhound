/**
 * CategorySelector Component
 * Hierarchical dropdown for selecting income/expense categories
 *
 * NOTE: This component uses a portal to escape overflow:hidden/auto containers.
 * It manually restores pointer-events since Radix Dialog sets pointer-events:none
 * on document.body when modal.
 * See: https://github.com/radix-ui/primitives/issues/1317
 * See: https://github.com/radix-ui/primitives/issues/2122
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // New category modal state
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryParent, setNewCategoryParent] = useState<CategoryNode | null>(null);
  const { showToast } = useToast();

  // Close dropdown function
  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // If click is inside our container (trigger button), don't close
      if (containerRef.current?.contains(target)) {
        return;
      }

      // If click is inside the dropdown (portal), don't close
      if (dropdownRef.current?.contains(target)) {
        return;
      }

      // Click was outside - close dropdown
      closeDropdown();
    };

    // Use mousedown for immediate response, add on next frame to avoid catching opening click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true); // capture phase
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Multiple attempts to focus - Radix Dialog can interfere with focus
      const focusInput = () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      };

      // Try immediately
      focusInput();

      // Try again after a short delay (for DOM readiness)
      const t1 = setTimeout(focusInput, 10);

      // Try again after a longer delay (for Radix Dialog interference)
      const t2 = setTimeout(focusInput, 50);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
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

  // The dropdown content - rendered via portal
  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-80 flex flex-col"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 2147483647, // Max z-index to ensure we're on top
        pointerEvents: 'auto', // Override Radix Dialog's pointer-events:none
      }}
      onMouseDown={(e) => e.stopPropagation()} // Prevent Dialog from intercepting
    >
      {/* Search */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onMouseDown={(e) => {
            e.stopPropagation();
            // Force focus on mousedown before Radix can intercept
            e.currentTarget.focus();
          }}
          onFocus={(e) => {
            // Ensure we keep focus
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.currentTarget.focus();
          }}
          onKeyDown={(e) => {
            e.stopPropagation(); // Prevent Radix from intercepting keystrokes
            if (e.key === 'Enter') {
              e.preventDefault();
            }
            if (e.key === 'Escape') {
              closeDropdown();
            }
          }}
          placeholder="Search categories..."
          className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none"
          autoComplete="off"
          tabIndex={0}
        />
      </div>

      {/* Category Tree */}
      <div
        className="flex-1 overflow-y-auto p-1"
        onWheel={(e) => e.stopPropagation()} // Allow scrolling
      >
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
          onMouseDown={(e) => e.stopPropagation()} // Prevent event bubbling
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Category...</span>
        </button>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative" data-category-selector>
      {/* Trigger Button */}
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

      {/* Dropdown - rendered via portal to document.body to escape overflow containers */}
      {isOpen && !disabled && createPortal(dropdownContent, document.body)}

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
