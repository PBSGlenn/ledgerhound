import { Settings, Archive, Trash2, Plus, FolderPlus } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface AccountContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSettings?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onAddCategory?: () => void;
  accountName: string;
  isParentNode?: boolean;
}

export function AccountContextMenu({
  x,
  y,
  onClose,
  onSettings,
  onArchive,
  onDelete,
  onAddCategory,
  accountName,
  isParentNode = false,
}: AccountContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 min-w-[200px] z-50"
      style={{ top: y, left: x }}
    >
      <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
        {accountName}
      </div>

      {isParentNode ? (
        // Parent node menu (e.g., Business Expenses, Personal Expenses)
        <button
          onClick={() => {
            onAddCategory?.();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      ) : (
        // Regular account menu
        <>
          <button
            onClick={() => {
              onSettings?.();
              onClose();
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"
          >
            <Settings className="w-4 h-4" />
            Account Settings
          </button>

          {onAddCategory && (
            <button
              onClick={() => {
                onAddCategory();
                onClose();
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"
            >
              <FolderPlus className="w-4 h-4" />
              Add Subcategory
            </button>
          )}

          <button
            onClick={() => {
              onArchive?.();
              onClose();
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"
          >
            <Archive className="w-4 h-4" />
            Archive Account
          </button>

          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

          <button
            onClick={() => {
              onDelete?.();
              onClose();
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </>
      )}
    </div>
  );
}
