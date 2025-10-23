/**
 * Category Management UI
 * Add, edit, reorganize, and archive categories
 */

import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Archive,
  Trash2,
  ChevronRight,
  ChevronDown,
  Building2,
  User,
  FolderPlus,
  Save,
  X,
} from 'lucide-react';
import type { AccountType } from '@prisma/client';
import { useToast } from '../../hooks/useToast';

interface CategoryNode {
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

export function CategoryManagement() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<AccountType>('EXPENSE');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Add new category state
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [newCategoryType, setNewCategoryType] = useState<AccountType>('EXPENSE');
  const [newCategoryIsBusiness, setNewCategoryIsBusiness] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    loadCategories();
  }, [selectedType]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('type', selectedType);

      const response = await fetch(`http://localhost:3001/api/categories/tree?${params}`);
      if (!response.ok) throw new Error('Failed to load categories');

      const tree = await response.json();
      setCategories(tree);

      // Auto-expand level 1 (Personal/Business)
      const level1Ids = tree.map((node: CategoryNode) => node.id);
      setExpandedNodes(new Set(level1Ids));
    } catch (error) {
      console.error('Error loading categories:', error);
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
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

  const handleStartEdit = (category: CategoryNode) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      const response = await fetch(`http://localhost:3001/api/categories/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (!response.ok) throw new Error('Failed to update category');

      showToast('Category updated successfully', 'success');
      setEditingId(null);
      setEditingName('');
      loadCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      showToast('Failed to update category', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleArchive = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Archive category "${categoryName}"? It will be hidden but data will be preserved.`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/categories/${categoryId}/archive`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to archive category');

      showToast('Category archived successfully', 'success');
      loadCategories();
    } catch (error) {
      console.error('Error archiving category:', error);
      showToast('Failed to archive category', 'error');
    }
  };

  const handleDelete = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Delete category "${categoryName}"? This cannot be undone and only works if no transactions exist.`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete category');
      }

      showToast('Category deleted successfully', 'success');
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      showToast((error as Error).message, 'error');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/categories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          type: newCategoryType,
          parentId: newCategoryParent,
          isBusinessDefault: newCategoryIsBusiness,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create category');
      }

      showToast('Category created successfully', 'success');
      setIsAdding(false);
      setNewCategoryName('');
      setNewCategoryParent(null);
      setNewCategoryType('EXPENSE');
      setNewCategoryIsBusiness(false);
      loadCategories();
    } catch (error) {
      console.error('Error creating category:', error);
      showToast((error as Error).message, 'error');
    }
  };

  const handleAddSubcategory = (parentId: string) => {
    setIsAdding(true);
    setNewCategoryParent(parentId);
    setNewCategoryType(selectedType);

    // Auto-expand parent
    const newExpanded = new Set(expandedNodes);
    newExpanded.add(parentId);
    setExpandedNodes(newExpanded);
  };

  const renderCategoryNode = (node: CategoryNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isEditing = editingId === node.id;
    const isLeaf = !hasChildren;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group ${
            isEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
          style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.id)}
              className="flex-shrink-0 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {/* Icon */}
          {node.level === 1 && (
            <span className="flex-shrink-0">
              {node.isBusinessDefault ? (
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              )}
            </span>
          )}

          {/* Name (editable) */}
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="flex-1 px-2 py-1 border border-blue-500 rounded text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              autoFocus
            />
          ) : (
            <span className={`flex-1 text-sm ${!isLeaf ? 'font-semibold' : ''} text-slate-900 dark:text-slate-100`}>
              {node.name}
            </span>
          )}

          {/* Path breadcrumb */}
          {!isEditing && node.fullPath && (
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden lg:block">
              {node.fullPath.split('/').slice(0, -1).join(' › ')}
            </span>
          )}

          {/* Child count */}
          {!isEditing && hasChildren && (
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
              {node.children?.length}
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 rounded transition-colors"
                  title="Save"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded transition-colors"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                {/* Add subcategory */}
                <button
                  onClick={() => handleAddSubcategory(node.id)}
                  className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded transition-colors"
                  title="Add subcategory"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>

                {/* Edit */}
                <button
                  onClick={() => handleStartEdit(node)}
                  className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded transition-colors"
                  title="Edit name"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Archive (if has children or transactions) */}
                {isLeaf && (
                  <button
                    onClick={() => handleArchive(node.id, node.name)}
                    className="p-1.5 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded transition-colors"
                    title="Archive category"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}

                {/* Delete (only if no children and no transactions) */}
                {isLeaf && (
                  <button
                    onClick={() => handleDelete(node.id, node.name)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-2 mt-1 border-l-2 border-slate-200 dark:border-slate-700">
            {node.children!.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Category Management
          </h1>

          <div className="flex items-center justify-between gap-4">
            {/* Type Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedType('INCOME')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedType === 'INCOME'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                Income Categories
              </button>
              <button
                onClick={() => setSelectedType('EXPENSE')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedType === 'EXPENSE'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                Expense Categories
              </button>
            </div>

            {/* Add Top-Level Category */}
            <button
              onClick={() => {
                setIsAdding(true);
                setNewCategoryParent(null);
                setNewCategoryType(selectedType);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-medium shadow-sm transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Category
            </button>
          </div>
        </div>

        {/* Add Category Form */}
        {isAdding && (
          <div className="border-b border-slate-200 dark:border-slate-700 p-6 bg-blue-50 dark:bg-blue-900/10">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {newCategoryParent ? 'Add Subcategory' : 'Add New Category'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory();
                    if (e.key === 'Escape') setIsAdding(false);
                  }}
                  placeholder="e.g., Software Subscriptions"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-slate-700 dark:text-white"
                  autoFocus
                />
              </div>

              {!newCategoryParent && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="newBusiness"
                    checked={newCategoryIsBusiness}
                    onChange={(e) => setNewCategoryIsBusiness(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                  />
                  <label htmlFor="newBusiness" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Business Category (track GST)
                  </label>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  Add Category
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewCategoryName('');
                    setNewCategoryParent(null);
                  }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Tree */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No categories found. Click "Add Category" to create one.
            </div>
          ) : (
            <div className="space-y-1">
              {categories.map((node) => renderCategoryNode(node))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-900/50">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            How to manage categories:
          </h3>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <li>• <strong>Add subcategory</strong>: Click the folder+ icon to add a child category</li>
            <li>• <strong>Edit name</strong>: Click the pencil icon to rename a category</li>
            <li>• <strong>Archive</strong>: Hide categories with transactions (preserves data)</li>
            <li>• <strong>Delete</strong>: Permanently remove unused categories (only if no transactions)</li>
            <li>• <strong>Organize</strong>: Use Personal/Business groups and subcategories for better reports</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
