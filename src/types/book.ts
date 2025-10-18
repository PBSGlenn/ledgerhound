/**
 * Book Types
 * Represents a set of accounting books (e.g., personal, business, or separate user's books)
 */

export interface Book {
  id: string;
  name: string;              // "Glenn's Personal & Business"
  ownerName: string;         // "Glenn"
  description?: string;      // Optional description
  databasePath: string;      // Absolute path to SQLite file
  backupPath: string;        // Where backups are stored
  fiscalYearStart: string;   // "07-01" format (MM-DD)
  currency: string;          // "AUD", "USD", etc.
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  createdAt: string;         // ISO date string
  lastAccessedAt: string;    // ISO date string
  isActive: boolean;
}

export interface CreateBookData {
  name: string;
  ownerName: string;
  description?: string;
  databasePath?: string;     // Optional, will use default if not provided
  backupPath?: string;       // Optional, will use default if not provided
  fiscalYearStart: string;
  currency: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
}

export interface BookSummary {
  id: string;
  name: string;
  ownerName: string;
  lastAccessedAt: string;
  accountCount?: number;
  transactionCount?: number;
}
