/**
 * Categories Manager
 * UI for managing income and expense categories with hierarchy
 */

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Archive, FolderOpen, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { accountAPI } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import type { Account, AccountType } from '../../types';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface CategoryFormData {
  name: string;
  type: AccountType;
  parentId: string | null;
  isBusinessDefault: boolean;
}

export function CategoriesManager() {
  const { showSuccess, showError } = useToast();
  const [categories, setCategories] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Account | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    type: 'EXPENSE',
    parentId: null,
    isBusinessDefault: false,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await accountAPI.getCategories({ includeArchived: false });
      setCategories(data);

      // Expand all parent categories by default
      const parents = data.filter(c => c.parentId === null);
      setExpandedParents(new Set(parents.map(p => p.id)));
    } catch (error) {
      console.error('Failed to load categories:', error);
      showError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (parentId: string) => {
    const newExpanded = new Set(expandedParents);
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId);
    } else {
      newExpanded.add(parentId);
    }
    setExpandedParents(newExpanded);
  };

  const handleAddParent = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      type: 'EXPENSE',
      parentId: null,
      isBusinessDefault: false,
    });
    setIsAddEditOpen(true);
  };

  const handleAddChild = (parent: Account) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      type: parent.type,
      parentId: parent.id,
      isBusinessDefault: false,
    });
    setIsAddEditOpen(true);
  };

  const handleEdit = (category: Account) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      parentId: category.parentId,
      isBusinessDefault: category.isBusinessDefault || false,
    });
    setIsAddEditOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showError('Category name is required');
      return;
    }

    try {
      if (editingCategory) {
        await accountAPI.updateCategory(editingCategory.id, {
          name: formData.name,
          parentId: formData.parentId,
          isBusinessDefault: formData.isBusinessDefault,
        });
        showSuccess('Category updated successfully');
      } else {
        await accountAPI.createCategory({
          name: formData.name,
          type: formData.type,
          parentId: formData.parentId,
          isBusinessDefault: formData.isBusinessDefault,
        });
        showSuccess('Category created successfully');
      }
      setIsAddEditOpen(false);
      loadCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      showError('Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await accountAPI.deleteCategory(id);
      showSuccess('Category deleted successfully');
      setDeleteCategoryId(null);
      loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      showError('Failed to delete category: ' + (error as Error).message);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await accountAPI.archiveCategory(id);
      showSuccess('Category archived successfully');
      loadCategories();
    } catch (error) {
      console.error('Failed to archive category:', error);
      showError('Failed to archive category');
    }
  };

  // Organize categories by parent
  const parentCategories = categories.filter(c => c.parentId === null);
  const getChildren = (parentId: string) => categories.filter(c => c.parentId === parentId);

  // Recursive category renderer for unlimited nesting
  const renderCategoryChild = (child: typeof categories[0], depth: number = 0): React.ReactNode => {
    const grandchildren = getChildren(child.id);
    const isExpanded = expandedParents.has(child.id);
    const hasChildren = grandchildren.length > 0;

    return (
      <div key={child.id}>
        <div
          className="group flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(child.id)}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-4" />
          )}
          <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
            {child.name}
            {child.isBusinessDefault && (
              <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                BIZ
              </span>
            )}
          </span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <button
              onClick={() => handleAddChild(child)}
              className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              title="Add subcategory"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleEdit(child)}
              className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeleteCategoryId(child.id)}
              className="p-1 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="space-y-1">
            {grandchildren.map(gc => renderCategoryChild(gc, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Categories</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage income and expense categories for organizing transactions
          </p>
        </div>
        <button
          onClick={handleAddParent}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Parent Category
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Income Categories */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-4 flex items-center gap-2">
            <span className="text-2xl">↓</span> Income Categories
          </h3>
          <div className="space-y-1">
            {parentCategories
              .filter(p => p.type === 'INCOME')
              .map(parent => {
                const children = getChildren(parent.id);
                const isExpanded = expandedParents.has(parent.id);

                return (
                  <div key={parent.id}>
                    <div className="group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <button
                        onClick={() => toggleExpand(parent.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Folder className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="flex-1 font-medium text-slate-900 dark:text-white">{parent.name}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={() => handleAddChild(parent)}
                          className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                          title="Add subcategory"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(parent)}
                          className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCategoryId(parent.id)}
                          className="p-1 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && children.length > 0 && (
                      <div className="ml-6 space-y-1">
                        {children.map(child => renderCategoryChild(child))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Expense Categories */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
            <span className="text-2xl">↑</span> Expense Categories
          </h3>
          <div className="space-y-1">
            {parentCategories
              .filter(p => p.type === 'EXPENSE')
              .map(parent => {
                const children = getChildren(parent.id);
                const isExpanded = expandedParents.has(parent.id);

                return (
                  <div key={parent.id}>
                    <div className="group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <button
                        onClick={() => toggleExpand(parent.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Folder className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="flex-1 font-medium text-slate-900 dark:text-white">{parent.name}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={() => handleAddChild(parent)}
                          className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                          title="Add subcategory"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(parent)}
                          className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCategoryId(parent.id)}
                          className="p-1 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && children.length > 0 && (
                      <div className="ml-6 space-y-1">
                        {children.map(child => renderCategoryChild(child))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog.Root open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editingCategory ? 'Edit Category' : formData.parentId ? 'Add Subcategory' : 'Add Parent Category'}
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Office Supplies"
                />
              </div>

              {!editingCategory && !formData.parentId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
              )}

              {formData.parentId && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isBusinessDefault}
                      onChange={(e) => setFormData({ ...formData, isBusinessDefault: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Business category (enable GST tracking by default)
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {editingCategory ? 'Update' : 'Create'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <AlertDialog.Root open={deleteCategoryId !== null} onOpenChange={() => setDeleteCategoryId(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Delete Category?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete this category? This will fail if there are existing transactions using this category.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => deleteCategoryId && handleDelete(deleteCategoryId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Delete
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
