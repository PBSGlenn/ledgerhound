import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, FolderPlus } from 'lucide-react';
import type { AccountType } from '../../types';
import { useToast } from '../../hooks/useToast';

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentName: string;
  accountType: AccountType;
  isBusinessDefault: boolean;
  onSuccess: (categoryName: string) => void;
}

export function CategoryFormModal({
  isOpen,
  onClose,
  parentName,
  accountType,
  isBusinessDefault,
  onSuccess,
}: CategoryFormModalProps) {
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onSuccess(categoryName.trim());
      setCategoryName('');
      onClose();
    } catch (err) {
      console.error('Failed to create category:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create category';
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCategoryName('');
    setError(null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" style={{ zIndex: 2147483646 }} />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md" style={{ zIndex: 2147483647 }}>
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-500" />
                <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                  Add Category
                </Dialog.Title>
              </div>
              <Dialog.Close className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </Dialog.Close>
            </div>

            {/* Info */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                Creating new category under <span className="font-semibold text-slate-900 dark:text-white">{parentName}</span>
              </Dialog.Description>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                  {accountType}
                </span>
                {isBusinessDefault && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-200 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                    Business • GST
                  </span>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => {
                    setCategoryName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g., Office Supplies, Marketing, Rent"
                  autoFocus
                  required
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${
                    error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                  }`}
                />
                {error && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !categoryName.trim()}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
