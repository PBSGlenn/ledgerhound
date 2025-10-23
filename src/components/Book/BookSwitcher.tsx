/**
 * Book Switcher
 * Dropdown to switch between different accounting books
 */

import { useState } from 'react';
import { Book, ChevronDown, Plus, FolderOpen } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { format } from 'date-fns';
import { bookManager } from '../../lib/services/bookManager';
import type { Book as BookType } from '../../types/book';

interface BookSwitcherProps {
  currentBook: BookType;
  onSwitchBook: (bookId: string) => void;
  onCreateNew: () => void;
}

export function BookSwitcher({ currentBook, onSwitchBook, onCreateNew }: BookSwitcherProps) {
  const [open, setOpen] = useState(false);
  const recentBooks = bookManager.getRecentBooks(5).filter(b => b.id !== currentBook.id);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
          <Book className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {currentBook.name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {currentBook.ownerName}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 min-w-[280px] z-50"
          sideOffset={5}
          align="start"
        >
          {/* Current Book */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 mb-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Current Book
            </div>
            <div className="flex items-center gap-2">
              <Book className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {currentBook.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {currentBook.ownerName}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Books */}
          {recentBooks.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Recent Books
              </div>
              {recentBooks.map((book) => (
                <DropdownMenu.Item
                  key={book.id}
                  className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer focus:bg-slate-100 dark:focus:bg-slate-700 outline-none"
                  onSelect={() => {
                    onSwitchBook(book.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Book className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {book.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {book.ownerName} • {format(new Date(book.lastAccessedAt), 'MMM d')}
                      </div>
                    </div>
                  </div>
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
            </>
          )}

          {/* Actions */}
          <DropdownMenu.Item
            className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer focus:bg-slate-100 dark:focus:bg-slate-700 outline-none"
            onSelect={() => {
              // TODO: Open book list dialog
              setOpen(false);
            }}
          >
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <FolderOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Open Another Book...</span>
            </div>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="px-3 py-2 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 cursor-pointer focus:bg-emerald-100 dark:focus:bg-emerald-900/30 outline-none"
            onSelect={() => {
              onCreateNew();
              setOpen(false);
            }}
          >
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Create New Book</span>
            </div>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
