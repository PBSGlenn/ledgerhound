import { getPrismaClient } from '../db';
import { parse } from 'date-fns';
import type { ImportBatch, Account, Settings, PrismaClient } from '@prisma/client';
import type { CSVColumnMapping, CSVRow, ImportPreview } from '../../types';
import { memorizedRuleService } from './memorizedRuleService';

export class ImportService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

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
    // Parse date
    let date: Date | undefined;
    if (mapping.date !== undefined) {
      const dateStr = row[mapping.date];
      const parsedDate = this.parseDate(dateStr);
      if (parsedDate) {
        date = parsedDate;
      }
    }

    // Parse payee
    let payee: string | undefined;
    if (mapping.payee !== undefined) {
      payee = row[mapping.payee];
    } else if (mapping.description !== undefined) {
      payee = row[mapping.description];
    }

    // Parse amount
    let amount: number | undefined;
    if (mapping.amount !== undefined) {
      amount = this.parseAmount(row[mapping.amount]) ?? undefined;
    } else if (mapping.debit !== undefined && mapping.credit !== undefined) {
      const debit = this.parseAmount(row[mapping.debit]) ?? 0;
      const credit = this.parseAmount(row[mapping.credit]) ?? 0;
      amount = debit - credit;
    }

    // Parse reference
    let reference: string | undefined;
    if (mapping.reference !== undefined) {
      reference = row[mapping.reference];
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
    let suggestedPayee = undefined;

    if (payee) {
      matchedRule = memorizedRuleService.matchPayee(payee, rules, 'import');
      if (matchedRule?.defaultAccountId) {
        suggestedCategory = await this.prisma.account.findUnique({
          where: { id: matchedRule.defaultAccountId },
        });
      }
      // Get suggested payee name from rule
      if (matchedRule?.defaultPayee) {
        suggestedPayee = matchedRule.defaultPayee;
      }
    }

    const parsed = {
      date,
      payee,
      amount,
      reference,
    };

    return {
      row,
      parsed,
      isDuplicate,
      matchedRule: matchedRule ?? undefined,
      suggestedCategory: suggestedCategory ?? undefined,
      suggestedPayee,
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
        payee: payee ? { contains: payee } : undefined,
        postings: {
          some: {
            accountId,
            amount: {
              // For source account, amount is negative (money leaving)
              // So we check for -amount ± 0.01
              gte: -amount - 0.01,
              lte: -amount + 0.01,
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
  ): Promise<{
    imported: number;
    skipped: number;
    batchId: string;
    skippedDetails?: Array<{ rowIndex: number; reason: string; data?: Record<string, unknown> }>;
  }> {
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
    const skippedDetails: Array<{ rowIndex: number; reason: string; data?: Record<string, unknown> }> = [];

    console.log('Importing transactions:');
    console.log('  sourceAccountId:', sourceAccountId);
    console.log('  sourceName:', sourceName);
    console.log('  mapping:', mapping);

    // Get or create uncategorized account
    let uncategorizedAccount = await this.prisma.account.findFirst({
      where: { name: 'Uncategorized', type: 'EXPENSE' },
    });

    if (!uncategorizedAccount) {
      // Create the Uncategorized account if it doesn't exist
      uncategorizedAccount = await this.prisma.account.create({
        data: {
          name: 'Uncategorized',
          type: 'EXPENSE',
          kind: 'CATEGORY',
          archived: false,
        },
      });
    }

    for (let i = 0; i < previews.length; i++) {
      const preview = previews[i];

      // Skip duplicates if requested
      if (options.skipDuplicates && preview.isDuplicate) {
        skipped++;
        skippedDetails.push({
          rowIndex: i,
          reason: 'Duplicate transaction detected',
          data: { date: preview.parsed.date, payee: preview.parsed.payee, amount: preview.parsed.amount },
        });
        continue;
      }

      // Skip invalid rows - track specific missing fields
      const missingFields: string[] = [];
      if (!preview.parsed.date) missingFields.push('date');
      if (!preview.parsed.amount) missingFields.push('amount');
      if (!preview.parsed.payee) missingFields.push('payee/description');

      if (missingFields.length > 0) {
        skipped++;
        skippedDetails.push({
          rowIndex: i,
          reason: `Missing required fields: ${missingFields.join(', ')}`,
          data: preview.row,
        });
        continue;
      }

      // Determine category
      let categoryAccountId = uncategorizedAccount.id;
      let isBusiness = false;
      let gstCode = null;
      let gstRate = null;
      let gstAmount = null;

      // Priority 1: Explicit category selection from frontend (user override or matched rule)
      if (preview.selectedCategoryId) {
        categoryAccountId = preview.selectedCategoryId;

        // Look up category to get business/GST settings
        const selectedCategory = await this.prisma.account.findUnique({
          where: { id: preview.selectedCategoryId },
        });

        if (selectedCategory) {
          isBusiness = selectedCategory.isBusinessDefault ?? false;

          // Check if GST should be applied
          if (isBusiness && selectedCategory.defaultHasGst !== false) {
            gstCode = 'GST';
            gstRate = 0.1; // 10% GST in Australia
            gstAmount = preview.parsed.amount * gstRate / (1 + gstRate);
          }
        }
      }
      // Priority 2: Apply rules if enabled and matched
      else if (options.applyRules && preview.matchedRule) {
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
      }
      // Priority 3: Suggested category from preview
      else if (preview.suggestedCategory) {
        categoryAccountId = preview.suggestedCategory.id;
      }

      // Prepare postings
      const postings: any[] = [
        // Source account posting (use amount as-is from bank statement)
        {
          accountId: sourceAccountId,
          amount: preview.parsed.amount,
          isBusiness: false,
        },
      ];

      // If business transaction with GST, create separate GST posting
      if (isBusiness && gstAmount && Math.abs(gstAmount) > 0.01) {
        // Find GST account based on transaction type
        // Note: Bank statement amounts are from bank's perspective
        // Positive = money IN (income), Negative = money OUT (expense)
        const isExpense = preview.parsed.amount < 0;
        const gstAccount = await this.prisma.account.findFirst({
          where: {
            name: isExpense ? 'GST Paid' : 'GST Collected',
            type: isExpense ? 'ASSET' : 'LIABILITY',
          },
        });

        if (gstAccount) {
          // Category posting (GST-exclusive amount, negated to balance)
          const gstExclusiveAmount = -(preview.parsed.amount - gstAmount);
          postings.push({
            accountId: categoryAccountId,
            amount: gstExclusiveAmount,
            isBusiness: true,
            gstCode,
            gstRate,
            gstAmount: -gstAmount,
          });

          // GST posting (negated to balance)
          postings.push({
            accountId: gstAccount.id,
            amount: -gstAmount,
            isBusiness: false,
          });
        } else {
          console.warn('GST account not found, falling back to single posting with metadata');
          // Fallback to old behavior (negate to balance)
          postings.push({
            accountId: categoryAccountId,
            amount: -preview.parsed.amount,
            isBusiness,
            gstCode,
            gstRate,
            gstAmount: -gstAmount,
          });
        }
      } else {
        // No GST - single posting (negate to balance the source posting)
        postings.push({
          accountId: categoryAccountId,
          amount: -preview.parsed.amount,
          isBusiness,
          gstCode,
          gstRate,
          gstAmount,
        });
      }

      // Build metadata - store original description for reconciliation matching
      const metadata: Record<string, any> = {};
      if (preview.suggestedPayee && preview.parsed.payee !== preview.suggestedPayee) {
        // Original description was transformed by a rule - store it for matching
        metadata.originalDescription = preview.parsed.payee;
      }
      if (preview.matchedRule) {
        metadata.matchedRuleId = preview.matchedRule.id;
        metadata.matchedRuleName = preview.matchedRule.name;
      }

      // Create transaction
      await this.prisma.transaction.create({
        data: {
          date: preview.parsed.date,
          payee: preview.suggestedPayee || preview.parsed.payee,
          reference: preview.parsed.reference,
          importBatchId: batch.id,
          externalId: preview.parsed.reference,
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
          postings: {
            create: postings,
          },
        },
      });

      imported++;
    }

    return {
      imported,
      skipped,
      batchId: batch.id,
      ...(skippedDetails.length > 0 && { skippedDetails }),
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
