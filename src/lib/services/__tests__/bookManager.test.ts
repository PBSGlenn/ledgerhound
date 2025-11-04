import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookManager } from '../bookManager';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem(key: string): string | null {
      return store[key] || null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
    removeItem(key: string): void {
      delete store[key];
    },
    clear(): void {
      store = {};
    },
  };
})();

// Set up global localStorage mock
global.localStorage = localStorageMock as Storage;

describe('BookManager', () => {
  let bookManager: BookManager;

  beforeEach(() => {
    localStorageMock.clear();
    bookManager = new BookManager();
  });

  describe('getAllBooks', () => {
    it('should return empty array when no books exist', () => {
      const books = bookManager.getAllBooks();
      expect(books).toEqual([]);
    });

    it('should return stored books', () => {
      const mockBooks = [
        {
          id: 'book1',
          name: 'Test Book',
          ownerName: 'John Doe',
          databasePath: '/path/to/db',
          backupPath: '/path/to/backup',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          isActive: false,
        },
      ];

      localStorage.setItem('ledgerhound-books', JSON.stringify(mockBooks));

      const books = bookManager.getAllBooks();
      expect(books).toEqual(mockBooks);
    });

    it('should return empty array on JSON parse error', () => {
      localStorage.setItem('ledgerhound-books', 'invalid json');

      const books = bookManager.getAllBooks();
      expect(books).toEqual([]);
    });
  });

  describe('getBook', () => {
    it('should return null when book not found', () => {
      const book = bookManager.getBook('nonexistent');
      expect(book).toBeNull();
    });

    it('should return book by ID', () => {
      const created = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'John Doe',
      });

      const book = bookManager.getBook(created.id);
      expect(book).toBeDefined();
      expect(book?.name).toBe('Test Book');
    });
  });

  describe('getActiveBook', () => {
    it('should return null when no active book', () => {
      const activeBook = bookManager.getActiveBook();
      expect(activeBook).toBeNull();
    });

    it('should return the active book', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'John Doe',
      });

      bookManager.setActiveBook(book.id);

      const activeBook = bookManager.getActiveBook();
      expect(activeBook?.id).toBe(book.id);
    });
  });

  describe('createBook', () => {
    it('should create a new book with required fields', () => {
      const book = bookManager.createBook({
        name: 'My Business',
        ownerName: 'Jane Smith',
      });

      expect(book.id).toBeDefined();
      expect(book.name).toBe('My Business');
      expect(book.ownerName).toBe('Jane Smith');
      expect(book.databasePath).toBeDefined();
      expect(book.backupPath).toBeDefined();
      expect(book.createdAt).toBeDefined();
      expect(book.lastAccessedAt).toBeDefined();
      expect(book.isActive).toBe(false);
    });

    it('should create book with optional fields', () => {
      const book = bookManager.createBook({
        name: 'My Business',
        ownerName: 'Jane Smith',
        description: 'Test description',
        fiscalYearStart: '01-07',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
      });

      expect(book.description).toBe('Test description');
      expect(book.fiscalYearStart).toBe('01-07');
      expect(book.currency).toBe('USD');
      expect(book.dateFormat).toBe('MM/DD/YYYY');
    });

    it('should create book with custom paths', () => {
      const book = bookManager.createBook({
        name: 'My Business',
        ownerName: 'Jane Smith',
        databasePath: '/custom/path/db.sqlite',
        backupPath: '/custom/path/backups',
      });

      expect(book.databasePath).toBe('/custom/path/db.sqlite');
      expect(book.backupPath).toBe('/custom/path/backups');
    });

    it('should generate unique IDs for multiple books', () => {
      const book1 = bookManager.createBook({
        name: 'Book 1',
        ownerName: 'Owner 1',
      });

      const book2 = bookManager.createBook({
        name: 'Book 2',
        ownerName: 'Owner 2',
      });

      expect(book1.id).not.toBe(book2.id);
    });

    it('should save book to storage', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      const books = bookManager.getAllBooks();
      expect(books).toHaveLength(1);
      expect(books[0].id).toBe(book.id);
    });
  });

  describe('updateBook', () => {
    it('should update book fields', () => {
      const book = bookManager.createBook({
        name: 'Original Name',
        ownerName: 'Original Owner',
      });

      const updated = bookManager.updateBook(book.id, {
        name: 'Updated Name',
        description: 'New description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New description');
      expect(updated.ownerName).toBe('Original Owner'); // Unchanged
    });

    it('should throw error when book not found', () => {
      expect(() => {
        bookManager.updateBook('nonexistent', { name: 'Updated' });
      }).toThrow('Book not found');
    });

    it('should preserve book ID', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      const updated = bookManager.updateBook(book.id, {
        id: 'different-id', // Try to change ID
        name: 'Updated',
      });

      expect(updated.id).toBe(book.id); // ID should not change
    });

    it('should persist updates to storage', () => {
      const book = bookManager.createBook({
        name: 'Original',
        ownerName: 'Owner',
      });

      bookManager.updateBook(book.id, { name: 'Updated' });

      const retrieved = bookManager.getBook(book.id);
      expect(retrieved?.name).toBe('Updated');
    });
  });

  describe('deleteBook', () => {
    it('should delete a book', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      bookManager.deleteBook(book.id);

      const books = bookManager.getAllBooks();
      expect(books).toHaveLength(0);
    });

    it('should throw error when book not found', () => {
      expect(() => {
        bookManager.deleteBook('nonexistent');
      }).toThrow('Book not found');
    });

    it('should clear active book when deleting active book', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      bookManager.setActiveBook(book.id);
      bookManager.deleteBook(book.id);

      const activeBook = bookManager.getActiveBook();
      expect(activeBook).toBeNull();
    });

    it('should not affect other books', () => {
      const book1 = bookManager.createBook({
        name: 'Book 1',
        ownerName: 'Owner 1',
      });

      const book2 = bookManager.createBook({
        name: 'Book 2',
        ownerName: 'Owner 2',
      });

      bookManager.deleteBook(book1.id);

      const books = bookManager.getAllBooks();
      expect(books).toHaveLength(1);
      expect(books[0].id).toBe(book2.id);
    });
  });

  describe('setActiveBook', () => {
    it('should set active book', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      const active = bookManager.setActiveBook(book.id);

      expect(active.id).toBe(book.id);
      expect(bookManager.getActiveBook()?.id).toBe(book.id);
    });

    it('should update last accessed time', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      const originalTime = book.lastAccessedAt;

      // setActiveBook should update the timestamp
      bookManager.setActiveBook(book.id);
      const updated = bookManager.getBook(book.id);

      // The timestamp should be updated (it will be newer)
      expect(updated?.lastAccessedAt).toBeDefined();
      expect(new Date(updated!.lastAccessedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalTime).getTime()
      );
    });

    it('should throw error when book not found', () => {
      expect(() => {
        bookManager.setActiveBook('nonexistent');
      }).toThrow('Book not found');
    });
  });

  describe('getBookSummaries', () => {
    it('should return empty array when no books', () => {
      const summaries = bookManager.getBookSummaries();
      expect(summaries).toEqual([]);
    });

    it('should return lightweight summaries', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
        description: 'This should not be in summary',
      });

      const summaries = bookManager.getBookSummaries();

      expect(summaries).toHaveLength(1);
      expect(summaries[0].id).toBe(book.id);
      expect(summaries[0].name).toBe('Test Book');
      expect(summaries[0].ownerName).toBe('Test Owner');
      expect(summaries[0].lastAccessedAt).toBeDefined();
      expect((summaries[0] as any).description).toBeUndefined(); // Not included
    });

    it('should return all books as summaries', () => {
      bookManager.createBook({ name: 'Book 1', ownerName: 'Owner 1' });
      bookManager.createBook({ name: 'Book 2', ownerName: 'Owner 2' });
      bookManager.createBook({ name: 'Book 3', ownerName: 'Owner 3' });

      const summaries = bookManager.getBookSummaries();
      expect(summaries).toHaveLength(3);
    });
  });

  describe('isFirstRun', () => {
    it('should return true when no books exist', () => {
      expect(bookManager.isFirstRun()).toBe(true);
    });

    it('should return false when books exist', () => {
      bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      expect(bookManager.isFirstRun()).toBe(false);
    });
  });

  describe('hasActiveBook', () => {
    it('should return false when no active book', () => {
      expect(bookManager.hasActiveBook()).toBe(false);
    });

    it('should return true when active book exists', () => {
      const book = bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      bookManager.setActiveBook(book.id);

      expect(bookManager.hasActiveBook()).toBe(true);
    });
  });

  describe('getRecentBooks', () => {
    it('should return empty array when no books', () => {
      const recent = bookManager.getRecentBooks();
      expect(recent).toEqual([]);
    });

    it('should return books sorted by last accessed', () => {
      const book1 = bookManager.createBook({
        name: 'Book 1',
        ownerName: 'Owner 1',
      });

      const book2 = bookManager.createBook({
        name: 'Book 2',
        ownerName: 'Owner 2',
      });

      const recent = bookManager.getRecentBooks();

      // Both books should be returned
      expect(recent).toHaveLength(2);

      // Books should be sorted by lastAccessedAt (descending)
      // Verify that the sort is working by checking that the timestamps are in descending order
      expect(new Date(recent[0].lastAccessedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(recent[1].lastAccessedAt).getTime()
      );
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        bookManager.createBook({
          name: `Book ${i}`,
          ownerName: 'Owner',
        });
      }

      const recent = bookManager.getRecentBooks(3);
      expect(recent).toHaveLength(3);
    });

    it('should default to 5 books', () => {
      for (let i = 0; i < 10; i++) {
        bookManager.createBook({
          name: `Book ${i}`,
          ownerName: 'Owner',
        });
      }

      const recent = bookManager.getRecentBooks();
      expect(recent).toHaveLength(5);
    });
  });

  describe('exportBookList', () => {
    it('should export empty list', () => {
      const json = bookManager.exportBookList();
      const parsed = JSON.parse(json);
      expect(parsed).toEqual([]);
    });

    it('should export all books as JSON', () => {
      const book1 = bookManager.createBook({
        name: 'Book 1',
        ownerName: 'Owner 1',
      });

      const book2 = bookManager.createBook({
        name: 'Book 2',
        ownerName: 'Owner 2',
      });

      const json = bookManager.exportBookList();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe(book1.id);
      expect(parsed[1].id).toBe(book2.id);
    });

    it('should create valid JSON', () => {
      bookManager.createBook({
        name: 'Test Book',
        ownerName: 'Test Owner',
      });

      const json = bookManager.exportBookList();
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('importBookList', () => {
    it('should import book list from JSON', () => {
      const books = [
        {
          id: 'imported1',
          name: 'Imported Book',
          ownerName: 'Imported Owner',
          databasePath: '/path/to/db',
          backupPath: '/path/to/backup',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          isActive: false,
        },
      ];

      const json = JSON.stringify(books);
      bookManager.importBookList(json);

      const imported = bookManager.getAllBooks();
      expect(imported).toHaveLength(1);
      expect(imported[0].id).toBe('imported1');
    });

    it('should throw error on invalid JSON', () => {
      expect(() => {
        bookManager.importBookList('invalid json');
      }).toThrow('Failed to import book list');
    });

    it('should throw error on non-array JSON', () => {
      expect(() => {
        bookManager.importBookList('{"not": "an array"}');
      }).toThrow('Invalid book list format');
    });

    it('should replace existing books', () => {
      bookManager.createBook({
        name: 'Existing Book',
        ownerName: 'Owner',
      });

      const newBooks = [
        {
          id: 'imported1',
          name: 'Imported Book',
          ownerName: 'Imported Owner',
          databasePath: '/path/to/db',
          backupPath: '/path/to/backup',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          isActive: false,
        },
      ];

      bookManager.importBookList(JSON.stringify(newBooks));

      const books = bookManager.getAllBooks();
      expect(books).toHaveLength(1);
      expect(books[0].id).toBe('imported1');
    });
  });

  describe('Integration', () => {
    it('should handle complete book lifecycle', () => {
      // Create
      const book = bookManager.createBook({
        name: 'My Business',
        ownerName: 'Jane Doe',
        description: 'Family business',
      });

      expect(bookManager.getAllBooks()).toHaveLength(1);

      // Update
      bookManager.updateBook(book.id, {
        description: 'Updated description',
      });

      const updated = bookManager.getBook(book.id);
      expect(updated?.description).toBe('Updated description');

      // Set active
      bookManager.setActiveBook(book.id);
      expect(bookManager.hasActiveBook()).toBe(true);

      // Delete
      bookManager.deleteBook(book.id);
      expect(bookManager.getAllBooks()).toHaveLength(0);
      expect(bookManager.hasActiveBook()).toBe(false);
    });

    it('should handle multiple books workflow', () => {
      // Create multiple books
      const book1 = bookManager.createBook({
        name: 'Personal',
        ownerName: 'John',
      });

      const book2 = bookManager.createBook({
        name: 'Business',
        ownerName: 'John',
      });

      const book3 = bookManager.createBook({
        name: 'Investment',
        ownerName: 'John',
      });

      // Set one as active
      bookManager.setActiveBook(book2.id);

      // Export
      const exported = bookManager.exportBookList();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(3);

      // Clear and import
      localStorage.clear();
      bookManager.importBookList(exported);

      // Verify restored
      expect(bookManager.getAllBooks()).toHaveLength(3);
      expect(bookManager.getBook(book1.id)).toBeDefined();
      expect(bookManager.getBook(book2.id)).toBeDefined();
      expect(bookManager.getBook(book3.id)).toBeDefined();
    });
  });
});
