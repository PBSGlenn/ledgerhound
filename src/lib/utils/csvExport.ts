/**
 * CSV Export Utilities
 * Handles exporting data to CSV format with proper escaping and formatting
 */

export interface CSVColumn {
  header: string;
  accessor: (row: any) => string | number | null | undefined;
}

/**
 * Convert data to CSV format
 */
export function generateCSV(data: any[], columns: CSVColumn[]): string {
  // Create header row
  const headers = columns.map((col) => escapeCSVField(col.header));
  const headerRow = headers.join(',');

  // Create data rows
  const dataRows = data.map((row) => {
    const values = columns.map((col) => {
      const value = col.accessor(row);
      return escapeCSVField(value);
    });
    return values.join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Escape a CSV field value
 */
function escapeCSVField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Format date for CSV export (YYYY-MM-DD)
 */
export function formatDateForCSV(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Format currency for CSV export (no symbols, 2 decimal places)
 */
export function formatCurrencyForCSV(amount: number): string {
  return amount.toFixed(2);
}
