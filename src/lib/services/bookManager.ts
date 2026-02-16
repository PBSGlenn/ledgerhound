/**
 * Book Manager Service
 * Manages multiple accounting books (separate databases for different users/purposes)
 */

import type { Book, CreateBookData, BookSummary } from '../../types/book';

const BOOKS_STORAGE_KEY = 'ledgerhound-books';
const ACTIVE_BOOK_KEY = 'ledgerhound-active-book';
const DEFAULT_DB_DIR = 'books';
const DEFAULT_BACKUP_DIR = 'books';

export class BookManager {
  /**
   * Get all books
   */
  getAllBooks(): Book[] {
    const booksJson = localStorage.getItem(BOOKS_STORAGE_KEY);
    if (!booksJson) return [];

    try {
      return JSON.parse(booksJson);
    } catch (error) {
      console.error('Failed to parse books:', error);
      return [];
    }
  }

  /**
   * Get a specific book by ID
   */
  getBook(id: string): Book | null {
    const books = this.getAllBooks();
    return books.find(book => book.id === id) || null;
  }

  /**
   * Get the currently active book
   */
  getActiveBook(): Book | null {
    const activeBookId = localStorage.getItem(ACTIVE_BOOK_KEY);
    if (!activeBookId) return null;

    return this.getBook(activeBookId);
  }

  /**
   * Create a new book
   */
  createBook(data: CreateBookData): Book {
    const books = this.getAllBooks();
    const id = this.generateId();

    // Generate default paths if not provided
    const databasePath = data.databasePath || this.getDefaultDatabasePath(id);
    const backupPath = data.backupPath || this.getDefaultBackupPath(id);

    const newBook: Book = {
      id,
      name: data.name,
      ownerName: data.ownerName,
      description: data.description,
      databasePath,
      backupPath,
      fiscalYearStart: data.fiscalYearStart,
      currency: data.currency,
      dateFormat: data.dateFormat,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      isActive: false,
    };

    books.push(newBook);
    this.saveBooks(books);

    return newBook;
  }

  /**
   * Update a book
   */
  updateBook(id: string, updates: Partial<Book>): Book {
    const books = this.getAllBooks();
    const index = books.findIndex(book => book.id === id);

    if (index === -1) {
      throw new Error('Book not found');
    }

    books[index] = {
      ...books[index],
      ...updates,
      id, // Ensure ID doesn't change
    };

    this.saveBooks(books);
    return books[index];
  }

  /**
   * Delete a book
   */
  deleteBook(id: string): void {
    const books = this.getAllBooks();
    const filtered = books.filter(book => book.id !== id);

    if (filtered.length === books.length) {
      throw new Error('Book not found');
    }

    // If deleting the active book, clear active book
    const activeBookId = localStorage.getItem(ACTIVE_BOOK_KEY);
    if (activeBookId === id) {
      localStorage.removeItem(ACTIVE_BOOK_KEY);
    }

    this.saveBooks(filtered);
  }

  /**
   * Set the active book
   */
  setActiveBook(id: string): Book {
    const book = this.getBook(id);
    if (!book) {
      throw new Error('Book not found');
    }

    // Update last accessed time
    this.updateBook(id, {
      lastAccessedAt: new Date().toISOString(),
    });

    localStorage.setItem(ACTIVE_BOOK_KEY, id);

    return this.getBook(id)!;
  }

  /**
   * Get book summaries (lightweight list)
   */
  getBookSummaries(): BookSummary[] {
    const books = this.getAllBooks();
    return books.map(book => ({
      id: book.id,
      name: book.name,
      ownerName: book.ownerName,
      lastAccessedAt: book.lastAccessedAt,
    }));
  }

  /**
   * Check if this is the first run (no books exist)
   */
  isFirstRun(): boolean {
    return this.getAllBooks().length === 0;
  }

  /**
   * Check if there's an active book
   */
  hasActiveBook(): boolean {
    return this.getActiveBook() !== null;
  }

  /**
   * Get recently accessed books
   */
  getRecentBooks(limit: number = 5): BookSummary[] {
    const summaries = this.getBookSummaries();
    return summaries
      .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Private: Save books to localStorage
   */
  private saveBooks(books: Book[]): void {
    localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(books));
  }

  /**
   * Private: Generate a unique ID
   */
  private generateId(): string {
    return `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Private: Get default database path for a book
   */
  private getDefaultDatabasePath(bookId: string): string {
    // In a real app, this would use the user's documents folder
    // For now, we'll use a relative path pattern
    return `${DEFAULT_DB_DIR}/${bookId}/ledger.db`;
  }

  /**
   * Private: Get default backup path for a book
   */
  private getDefaultBackupPath(bookId: string): string {
    return `${DEFAULT_BACKUP_DIR}/${bookId}`;
  }

  /**
   * Export book list (for backup/migration)
   */
  exportBookList(): string {
    const books = this.getAllBooks();
    return JSON.stringify(books, null, 2);
  }

  /**
   * Import book list (for restore/migration)
   */
  importBookList(json: string): void {
    try {
      const books = JSON.parse(json);
      if (!Array.isArray(books)) {
        throw new Error('Invalid book list format');
      }
      this.saveBooks(books);
    } catch (error) {
      throw new Error(`Failed to import book list: ${(error as Error).message}`);
    }
  }
}

// Singleton instance
export const bookManager = new BookManager();
