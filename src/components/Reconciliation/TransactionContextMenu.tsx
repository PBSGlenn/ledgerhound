import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Edit, Trash2, Plus, ExternalLink } from 'lucide-react';

interface TransactionContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  // Transaction info
  transaction?: {
    id: string;
    payee: string;
    date: Date | string;
    amount: number;
    metadata?: any;
    originalDescription?: string;
  };
  // For PDF transactions (unmatched from statement)
  isPdfTransaction?: boolean;
  pdfDescription?: string;
  // Actions
  onViewOriginalDescription?: () => void;
  onViewInLedger?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddToLedger?: () => void;
  onIgnore?: () => void;
}

export function TransactionContextMenu({
  x,
  y,
  onClose,
  transaction,
  isPdfTransaction = false,
  pdfDescription,
  onViewInLedger,
  onEdit,
  onDelete,
  onAddToLedger,
  onIgnore,
}: TransactionContextMenuProps) {
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

  // Adjust position to keep menu on screen
  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  // Extract original description from metadata if available
  let originalDescription = transaction?.originalDescription;
  if (!originalDescription && transaction?.metadata) {
    try {
      const metadata = typeof transaction.metadata === 'string'
        ? JSON.parse(transaction.metadata)
        : transaction.metadata;
      originalDescription = metadata?.originalDescription;
    } catch {
      // Ignore parse errors
    }
  }

  // Render in a portal to escape the Dialog's DOM hierarchy
  // This ensures the context menu receives mouse events properly
  return createPortal(
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 min-w-[220px]"
      style={{
        top: adjustedY,
        left: adjustedX,
        zIndex: 99999,
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 truncate max-w-[220px]">
        {isPdfTransaction ? 'PDF Transaction' : (transaction?.payee || 'Transaction')}
      </div>

      {/* Original Description (for ledger transactions that were imported) */}
      {!isPdfTransaction && originalDescription && (
        <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
          <div className="font-medium mb-1">Original Bank Description:</div>
          <div className="text-slate-700 dark:text-slate-300 break-words">
            {originalDescription}
          </div>
        </div>
      )}

      {/* PDF Transaction - show description */}
      {isPdfTransaction && pdfDescription && (
        <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
          <div className="font-medium mb-1">Statement Description:</div>
          <div className="text-slate-700 dark:text-slate-300 break-words">
            {pdfDescription}
          </div>
        </div>
      )}

      {/* Actions for Ledger Transactions */}
      {!isPdfTransaction && transaction && (
        <>
          {onViewInLedger && (
            <button
              onClick={() => {
                onViewInLedger();
                onClose();
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"
            >
              <ExternalLink className="w-4 h-4" />
              View in Ledger
            </button>
          )}

          {onEdit && (
            <button
              onClick={() => onEdit()}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"
            >
              <Edit className="w-4 h-4" />
              Edit Transaction
            </button>
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

          {onDelete && (
            <button
              onClick={() => onDelete()}
              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              Delete Transaction
            </button>
          )}
        </>
      )}

      {/* Actions for PDF Transactions (unmatched from statement) */}
      {isPdfTransaction && (
        <>
          {onAddToLedger && (
            <button
              onClick={() => onAddToLedger()}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"
            >
              <Plus className="w-4 h-4" />
              Add to Ledger
            </button>
          )}

          {onIgnore && (
            <button
              onClick={() => {
                onIgnore();
                onClose();
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-500 dark:text-slate-400"
            >
              <Eye className="w-4 h-4" />
              Ignore (outside date range)
            </button>
          )}
        </>
      )}
    </div>,
    document.body
  );
}
