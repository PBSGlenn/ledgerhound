/**
 * Book List Dialog
 * Shows all accounting books with options to open, edit, or delete them
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Book, Trash2, X, Calendar, HardDrive } from 'lucide-react';
import { format } from 'date-fns';
import { bookManager } from '../../lib/services/bookManager';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import type { Book as BookType } from '../../types/book';

interface BookListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentBookId: string;
  onSwitchBook: (bookId: string) => void;
}

export function BookListDialog({
  isOpen,
  onClose,
  currentBookId,
  onSwitchBook,
}: BookListDialogProps) {
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const books = bookManager.getAllBooks();

  const handleOpenBook = (bookId: string) => {
    if (bookId !== currentBookId) {
      onSwitchBook(bookId);
    }
    onClose();
  };

  const handleDeleteBook = (bookId: string) => {
    setDeleteBookId(bookId);
  };

  const confirmDelete = () => {
    if (deleteBookId) {
      bookManager.deleteBook(deleteBookId);
      setDeleteBookId(null);
      // If we deleted the current book, the app will need to handle this
      if (deleteBookId === currentBookId) {
        onClose();
        // Trigger a reload to handle the missing active book
        window.location.reload();
      }
    }
  };

  const bookToDelete = deleteBookId ? books.find(b => b.id === deleteBookId) : null;

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg z-50 animate-in fade-in zoom-in-95 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Book className="w-5 h-5 text-emerald-600" />
                All Books
              </Dialog.Title>
              <Dialog.Close className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              View and manage all your accounting books
            </Dialog.Description>

            {/* Book List */}
            <div className="flex-1 overflow-y-auto p-4">
              {books.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No books found. Create a new book to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {books.map((book) => (
                    <BookListItem
                      key={book.id}
                      book={book}
                      isCurrent={book.id === currentBookId}
                      onOpen={() => handleOpenBook(book.id)}
                      onDelete={() => handleDeleteBook(book.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                {books.length} book{books.length !== 1 ? 's' : ''} total
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteBookId !== null}
        onClose={() => setDeleteBookId(null)}
        onConfirm={confirmDelete}
        title="Delete Book"
        message={
          bookToDelete
            ? `Are you sure you want to delete "${bookToDelete.name}"? This will remove the book from your list. The database file will not be deleted.`
            : 'Are you sure you want to delete this book?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}

interface BookListItemProps {
  book: BookType;
  isCurrent: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

function BookListItem({ book, isCurrent, onOpen, onDelete }: BookListItemProps) {
  return (
    <div
      className={`
        p-4 rounded-lg border transition-all
        ${isCurrent
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Book Info */}
        <button
          onClick={onOpen}
          className="flex-1 text-left focus:outline-none"
        >
          <div className="flex items-center gap-2 mb-1">
            <Book className={`w-4 h-4 ${isCurrent ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className={`font-medium ${isCurrent ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
              {book.name}
            </span>
            {isCurrent && (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full">
                Current
              </span>
            )}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            {book.ownerName}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Last opened: {format(new Date(book.lastAccessedAt), 'MMM d, yyyy')}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {book.currency}
            </span>
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!isCurrent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete book"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
