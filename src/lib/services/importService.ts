import { getPrismaClient } from '../db';
import { parse } from 'date-fns';
import type { ImportBatch, Transaction, Account } from '@prisma/client';
import type { CSVColumnMapping, CSVRow, ImportPreview } from '../../types';
import { memorizedRuleService } from './memorizedRuleService';

export class ImportService {
  private prisma = getPrismaClient();

  /**
   * Parse CSV content into rows
   */
  parseCSV(content: string): CSVRow[] {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      return [];
    }

    // Parse header
    const headers = this.parseCSVLine(lines[0]);

    // Parse data rows
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}`);
        continue;
      }

      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parse a single CSV line (handles quoted fields)
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse a date from various Australian formats
   */
  parseDate(dateStr: string): Date | null {
    const formats = [
      'dd/MM/yyyy',
      'd/M/yyyy',
      'dd/MM/yy',
      'd/M/yy',
      'yyyy-MM-dd',
      'dd-MM-yyyy',
      'd-M-yyyy',
    ];

    for (const format of formats) {
      try {
        const date = parse(dateStr, format, new Date());
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  /**
   * Parse amount from string (handles $, commas, parentheses for negatives)
   */
  parseAmount(amountStr: string): number | null {
    if (!amountStr) return null;

    // Remove currency symbols, commas, and spaces
    let cleaned = amountStr.replace(/[$,\s]/g, '');

    // Handle parentheses for negative amounts (accounting format)
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : amount;
  }

  /**
   * Preview CSV import with column mapping
   */
  async previewImport(
    rows: CSVRow[],
    mapping: CSVColumnMapping,
    sourceAccountId: string
  ): Promise<ImportPreview[]> {
    // Get all memorized rules
    const rules = await memorizedRuleService.getAllRules();

    // Get uncategorized account for fallback
    const uncategorizedAccount = await this.prisma.account.findFirst({
      where: { name: 'Uncategorized', type: 'EXPENSE' },
    });

    const previews: ImportPreview[] = [];

    for (const row of rows) {
      const preview = await this.previewRow(
        row,
        mapping,
        sourceAccountId,
        rules,
        uncategorizedAccount
      );
      previews.push(preview);
    }

    return previews;
  }

  /**
   * Preview a single row
   */
  private async previewRow(
    row: CSVRow,
    mapping: CSVColumnMapping,
    sourceAccountId: string,
    rules: any[],
    uncategorizedAccount: Account | null
  ): Promise<ImportPreview> {
    const columns = Object.keys(row);

    // Parse date
    let date: Date | undefined;
    if (mapping.date !== undefined) {
      const dateStr = row[columns[mapping.date]];
      const parsedDate = this.parseDate(dateStr);
      if (parsedDate) {
        date = parsedDate;
      }
    }

    // Parse payee
    let payee: string | undefined;
    if (mapping.payee !== undefined) {
      payee = row[columns[mapping.payee]];
    } else if (mapping.description !== undefined) {
      payee = row[columns[mapping.description]];
    }

    // Parse amount
    let amount: number | undefined;
    if (mapping.amount !== undefined) {
      amount = this.parseAmount(row[columns[mapping.amount]]) ?? undefined;
    } else if (mapping.debit !== undefined && mapping.credit !== undefined) {
      const debit = this.parseAmount(row[columns[mapping.debit]]) ?? 0;
      const credit = this.parseAmount(row[columns[mapping.credit]]) ?? 0;
      amount = debit - credit;
    }

    // Parse reference
    let reference: string | undefined;
    if (mapping.reference !== undefined) {
      reference = row[columns[mapping.reference]];
    }

    // Check for duplicates
    const isDuplicate = await this.checkDuplicate(
      sourceAccountId,
      date,
      amount,
      payee,
      reference
    );

    // Match against rules
    let matchedRule = null;
    let suggestedCategory = uncategorizedAccount;

    if (payee) {
      matchedRule = memorizedRuleService.matchPayee(payee, rules, 'import');
      if (matchedRule?.defaultAccountId) {
        suggestedCategory = await this.prisma.account.findUnique({
          where: { id: matchedRule.defaultAccountId },
        });
      }
    }

    return {
      row,
      parsed: {
        date,
        payee,
        amount,
        reference,
      },
      isDuplicate,
      matchedRule: matchedRule ?? undefined,
      suggestedCategory: suggestedCategory ?? undefined,
    };
  }

  /**
   * Check if a transaction might be a duplicate
   */
  private async checkDuplicate(
    accountId: string,
    date?: Date,
    amount?: number,
    payee?: string,
    externalId?: string
  ): Promise<boolean> {
    if (!date || !amount) {
      return false;
    }

    // Check for external ID match
    if (externalId) {
      const existing = await this.prisma.transaction.findFirst({
        where: { externalId },
      });
      if (existing) {
        return true;
      }
    }

    // Check for similar transaction within ±3 days
    const dateStart = new Date(date);
    dateStart.setDate(dateStart.getDate() - 3);
    const dateEnd = new Date(date);
    dateEnd.setDate(dateEnd.getDate() + 3);

    const similar = await this.prisma.transaction.findFirst({
      where: {
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
        payee: payee ? { contains: payee, mode: 'insensitive' } : undefined,
        postings: {
          some: {
            accountId,
            amount: {
              gte: amount - 0.01,
              lte: amount + 0.01,
            },
          },
        },
      },
    });

    return !!similar;
  }

  /**
   * Save an import mapping template
   */
  async saveImportMappingTemplate(
    name: string,
    mapping: CSVColumnMapping,
    accountId?: string
  ): Promise<Settings> {
    const key = `import_mapping_template_${name.toLowerCase().replace(/\s/g, '_')}`;
    return this.prisma.settings.upsert({
      where: { key },
      update: { value: JSON.stringify({ mapping, accountId }) },
      create: { key, value: JSON.stringify({ mapping, accountId }) },
    });
  }

  /**
   * Get all import mapping templates
   */
  async getImportMappingTemplates(accountId?: string): Promise<Array<{ name: string; mapping: CSVColumnMapping; accountId?: string }>> {
    const settings = await this.prisma.settings.findMany({
      where: {
        key: { startsWith: 'import_mapping_template_' },
      },
    });

    return settings.map(s => {
      const name = s.key.replace('import_mapping_template_', '').replace(/_/g, ' ');
      const value = JSON.parse(s.value);
      return { name, mapping: value.mapping, accountId: value.accountId };
    }).filter(template => !accountId || template.accountId === accountId);
  }

  /**
   * Import transactions from previewed rows
   */
  async importTransactions(
    previews: ImportPreview[],
    sourceAccountId: string,
    sourceName: string,
    mapping: CSVColumnMapping,
    options: {
      skipDuplicates?: boolean;
      applyRules?: boolean;
    } = {}
  ): Promise<{ imported: number; skipped: number; batchId: string }> {
    // Create import batch
    const batch = await this.prisma.importBatch.create({
      data: {
        sourceAccountId,
        sourceName,
        mappingJson: JSON.stringify(mapping),
      },
    });

    let imported = 0;
    let skipped = 0;

    // Get uncategorized account
    const uncategorizedAccount = await this.prisma.account.findFirst({
      where: { name: 'Uncategorized', type: 'EXPENSE' },
    });

    if (!uncategorizedAccount) {
      throw new Error('Uncategorized account not found');
    }

    for (const preview of previews) {
      // Skip duplicates if requested
      if (options.skipDuplicates && preview.isDuplicate) {
        skipped++;
        continue;
      }

      // Skip invalid rows
      if (!preview.parsed.date || !preview.parsed.amount || !preview.parsed.payee) {
        skipped++;
        continue;
      }

      // Determine category
      let categoryAccountId = uncategorizedAccount.id;
      let isBusiness = false;
      let gstCode = null;
      let gstRate = null;
      let gstAmount = null;

      if (options.applyRules && preview.matchedRule) {
        const splits = memorizedRuleService.getDefaultSplits(preview.matchedRule);
        if (splits.length > 0) {
          const firstSplit = splits[0];
          categoryAccountId = firstSplit.accountId;
          isBusiness = firstSplit.isBusiness;
          gstCode = firstSplit.gstCode ?? null;
          gstRate = firstSplit.gstRate ?? null;

          // Calculate GST if business and GST code is set
          if (isBusiness && gstCode === 'GST' && gstRate) {
            gstAmount = preview.parsed.amount * gstRate / (1 + gstRate);
          }
        }
      } else if (preview.suggestedCategory) {
        categoryAccountId = preview.suggestedCategory.id;
      }

      // Create transaction
      await this.prisma.transaction.create({
        data: {
          date: preview.parsed.date,
          payee: preview.parsed.payee,
          reference: preview.parsed.reference,
          importBatchId: batch.id,
          externalId: preview.parsed.reference,
          postings: {
            create: [
              // Source account posting
              {
                accountId: sourceAccountId,
                amount: -preview.parsed.amount,
                isBusiness: false,
              },
              // Category posting
              {
                accountId: categoryAccountId,
                amount: preview.parsed.amount,
                isBusiness,
                gstCode,
                gstRate,
                gstAmount,
              },
            ],
          },
        },
      });

      imported++;
    }

    return {
      imported,
      skipped,
      batchId: batch.id,
    };
  }

  /**
   * Get import batch by ID
   */
  async getImportBatch(id: string): Promise<ImportBatch | null> {
    return this.prisma.importBatch.findUnique({
      where: { id },
      include: {
        sourceAccount: true,
        transactions: true,
      },
    });
  }

  /**
   * Get all import batches for an account
   */
  async getImportBatches(accountId?: string): Promise<ImportBatch[]> {
    return this.prisma.importBatch.findMany({
      where: accountId ? { sourceAccountId: accountId } : undefined,
      include: {
        sourceAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete an import batch and its transactions
   */
  async deleteImportBatch(id: string): Promise<void> {
    // This will cascade delete all transactions in the batch
    await this.prisma.importBatch.delete({
      where: { id },
    });
  }
}

export const importService = new ImportService();
