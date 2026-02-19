import { useState, useEffect, useMemo, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, ChevronRight, Check, X, Search } from 'lucide-react';

interface CategoryNode {
  id: string;
  name: string;
  fullPath: string | null;
  type: string;
  parentId: string | null;
  level: number;
  isBusinessDefault: boolean;
  sortOrder: number;
  children?: CategoryNode[];
}

interface CategoryMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

export function CategoryMultiSelect({ value, onChange }: CategoryMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [flatCategories, setFlatCategories] = useState<CategoryNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Load categories
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('includeRoot', 'true');
      const response = await fetch(`http://localhost:3001/api/categories/tree?${params}`);
      if (!response.ok) throw new Error('Failed to load categories');
      const tree = await response.json();
      setCategories(tree);
      const flattened = flattenTree(tree);
      setFlatCategories(flattened);

      // Auto-expand virtual nodes
      const virtualNodes = flattened.filter(n => n.id.startsWith('virtual-'));
      setExpandedNodes(new Set(virtualNodes.map(n => n.id)));
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

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleCategory = (categoryId: string) => {
    if (categoryId.startsWith('virtual-')) {
      toggleNode(categoryId);
      return;
    }
    const newValue = value.includes(categoryId)
      ? value.filter(id => id !== categoryId)
      : [...value, categoryId];
    onChange(newValue);
  };

  const filteredTree = useMemo(() => {
    if (!searchTerm) return categories;
    const term = searchTerm.toLowerCase();
    const matchingIds = new Set<string>();

    // Find matching nodes and their ancestors
    for (const node of flatCategories) {
      if (node.name.toLowerCase().includes(term)) {
        matchingIds.add(node.id);
        // Add ancestors
        let current = node;
        while (current.parentId) {
          matchingIds.add(current.parentId);
          const parent = flatCategories.find(n => n.id === current.parentId);
          if (!parent) break;
          current = parent;
        }
      }
    }

    // Also add virtual parents that contain matching children
    for (const node of flatCategories) {
      if (node.id.startsWith('virtual-') && node.children) {
        const hasMatch = node.children.some(c => matchingIds.has(c.id));
        if (hasMatch) matchingIds.add(node.id);
      }
    }

    const filterNodes = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes
        .filter(n => matchingIds.has(n.id))
        .map(n => ({
          ...n,
          children: n.children ? filterNodes(n.children) : undefined,
        }));
    };

    return filterNodes(categories);
  }, [categories, flatCategories, searchTerm]);

  const selectedNames = useMemo(() => {
    return value
      .map(id => flatCategories.find(c => c.id === id)?.name)
      .filter(Boolean) as string[];
  }, [value, flatCategories]);

  const renderNode = (node: CategoryNode, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id) || !!searchTerm;
    const isVirtual = node.id.startsWith('virtual-');
    const isSelected = value.includes(node.id);

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 py-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer text-sm ${
            isVirtual ? 'font-semibold text-slate-500 dark:text-slate-400' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren && !isVirtual) {
              toggleNode(node.id);
            }
            toggleCategory(node.id);
          }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {!isVirtual && (
            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
              isSelected
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-slate-300 dark:border-slate-500'
            }`}>
              {isSelected && <Check className="w-3 h-3" />}
            </div>
          )}

          <span className="truncate">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        Categories
      </label>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-500"
          >
            <span className="truncate text-left">
              {value.length === 0
                ? 'All categories'
                : `${selectedNames.slice(0, 2).join(', ')}${value.length > 2 ? ` +${value.length - 2} more` : ''}`
              }
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {value.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded-full">
                  {value.length}
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="z-50 w-80 max-h-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden"
            sideOffset={4}
            align="start"
          >
            {/* Search */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Actions */}
            {value.length > 0 && (
              <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {value.length} selected
                </span>
                <button
                  onClick={() => onChange([])}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Tree */}
            <div className="overflow-auto max-h-72 p-1">
              {loading ? (
                <div className="p-4 text-center text-sm text-slate-500">Loading...</div>
              ) : filteredTree.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No categories found</div>
              ) : (
                filteredTree.map(node => renderNode(node))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedNames.map((name, i) => (
            <span
              key={value[i]}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
            >
              {name}
              <button
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
