// Import pdf-parse using createRequire for ESM/CommonJS compatibility
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse, VerbosityLevel } = require('pdf-parse');

export interface StatementTransaction {
  date: Date;
  description: string;
  debit?: number;
  credit?: number;
  balance?: number;
  rawText?: string;
}

export interface StatementInfo {
  accountNumber?: string;
  accountName?: string;
  statementPeriod?: { start: Date; end: Date };
  openingBalance?: number;
  closingBalance?: number;
}

export interface ParsedStatement {
  info: StatementInfo;
  transactions: StatementTransaction[];
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
}

// Type for text extractor function (for testing)
export type TextExtractor = (pdfBuffer: Buffer) => Promise<string>;

export class PDFStatementService {
  private textExtractor?: TextExtractor;

  /**
   * Create a PDF statement service with optional custom text extractor (for testing)
   */
  constructor(textExtractor?: TextExtractor) {
    this.textExtractor = textExtractor;
  }

  /**
   * Parse a PDF bank statement
   */
  async parseStatement(pdfBuffer: Buffer): Promise<ParsedStatement> {
    let text: string;

    if (this.textExtractor) {
      // Use custom text extractor (for testing)
      text = await this.textExtractor(pdfBuffer);
    } else {
      // Create parser instance with the PDF data and minimal verbosity
      const parser = new PDFParse({
        verbosity: VerbosityLevel.ERRORS,
        data: pdfBuffer,
      });

      // Load the PDF
      await parser.load();

      // Extract text from all pages
      const textResult = await parser.getText();
      text = textResult.pages.map((p: { text: string; num: number }) => p.text).join('\n');

      // Clean up parser
      parser.destroy();
    }

    // Try to detect bank format and extract info
    const info = this.extractStatementInfo(text);
    const transactions = this.extractTransactions(text);
    const confidence = this.assessConfidence(info, transactions);

    return {
      info,
      transactions,
      rawText: text,
      confidence,
    };
  }

  /**
   * Detect the bank format from the PDF text
   */
  private detectBankFormat(text: string): 'commbank-cc' | 'commbank-savings' | 'generic' {
    // CommBank credit card indicators
    if (text.includes('Ultimate Awards Credit Card') ||
        text.includes('Awards points balance') ||
        (text.includes('commbank.com.au') && text.includes('Credit limit'))) {
      return 'commbank-cc';
    }

    // CommBank savings/transaction account indicators
    if (text.includes('Smart Access') ||
        (text.includes('commbank.com.au') && text.includes('NetBank'))) {
      return 'commbank-savings';
    }

    return 'generic';
  }

  /**
   * Extract statement metadata
   */
  private extractStatementInfo(text: string): StatementInfo {
    const bankFormat = this.detectBankFormat(text);

    if (bankFormat === 'commbank-cc') {
      return this.extractCommBankCCInfo(text);
    }

    if (bankFormat === 'commbank-savings') {
      return this.extractCommBankSavingsInfo(text);
    }

    return this.extractGenericInfo(text);
  }

  /**
   * Extract CommBank credit card statement info
   */
  private extractCommBankCCInfo(text: string): StatementInfo {
    const info: StatementInfo = {};

    // Extract card number (format: 5523 5082 0188 9606)
    const cardMatch = text.match(/(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})/);
    if (cardMatch) {
      info.accountNumber = cardMatch[1].replace(/\s+/g, '');
    }

    // Extract statement period (format: "Statement Period 8 Nov 2025 - 8 Dec 2025")
    const periodMatch = text.match(/Statement\s+Period\s+(\d{1,2}\s+\w{3}\s+\d{4})\s*-\s*(\d{1,2}\s+\w{3}\s+\d{4})/i);
    if (periodMatch) {
      info.statementPeriod = {
        start: this.parseCommBankDate(periodMatch[1]),
        end: this.parseCommBankDate(periodMatch[2]),
      };
    }

    // Extract opening balance (format: "Opening balance at 8 Nov $4,113.69")
    const openingMatch = text.match(/Opening\s+balance\s+at\s+\d{1,2}\s+\w{3}\s+\$?([\d,]+\.\d{2})/i);
    if (openingMatch) {
      info.openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
    }

    // Extract closing balance (format: "Closing balance at 8 Dec $5,277.37")
    const closingMatch = text.match(/Closing\s+balance\s+at\s+\d{1,2}\s+\w{3}\s+\$?([\d,]+\.\d{2})/i);
    if (closingMatch) {
      info.closingBalance = parseFloat(closingMatch[1].replace(/,/g, ''));
    }

    return info;
  }

  /**
   * Extract CommBank savings/transaction account statement info
   */
  private extractCommBankSavingsInfo(text: string): StatementInfo {
    const info: StatementInfo = {};

    // Account Number: "06 3116 00623182"
    const accountMatch = text.match(/Account\s+Number\s+(\d{2}\s+\d{4}\s+\d{8})/i);
    if (accountMatch) {
      info.accountNumber = accountMatch[1].replace(/\s+/g, '');
    }

    // Statement Period: "Period 1 Jun 2025 - 30 Nov 2025"
    // Note: "Statement" and "Period" may be on separate lines in PDF extraction
    const periodMatch = text.match(/Period\s+(\d{1,2}\s+\w{3}\s+\d{4})\s*-\s*(\d{1,2}\s+\w{3}\s+\d{4})/i);
    if (periodMatch) {
      info.statementPeriod = {
        start: this.parseCommBankDate(periodMatch[1]),
        end: this.parseCommBankDate(periodMatch[2]),
      };
    }

    // Opening Balance: "$108.42 CR" (from OPENING BALANCE line)
    const openingMatch = text.match(/OPENING\s+BALANCE\s+\$?([\d,]+\.\d{2})\s*(CR|DR)?/i);
    if (openingMatch) {
      info.openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
    }

    // Closing Balance: "$37.78 CR"
    const closingMatch = text.match(/Closing\s+Balance\s+\$?([\d,]+\.\d{2})\s*(CR|DR)?/i);
    if (closingMatch) {
      info.closingBalance = parseFloat(closingMatch[1].replace(/,/g, ''));
    }

    return info;
  }

  /**
   * Extract generic statement info (original logic)
   */
  private extractGenericInfo(text: string): StatementInfo {
    const info: StatementInfo = {};

    // Extract account number (various Australian formats)
    const accountPatterns = [
      /Account\s+Number:?\s*(\d[\d\s-]+\d)/i,
      /BSB\s*[-:]?\s*(\d{3}[-\s]?\d{3})\s+Account\s*:?\s*(\d+)/i,
      /Account:?\s*(\d{6,})/i,
    ];

    for (const pattern of accountPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.accountNumber = match[match.length - 1].replace(/[\s-]/g, '');
        break;
      }
    }

    // Extract statement period
    const periodPattern = /Statement\s+Period:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
    const periodMatch = text.match(periodPattern);
    if (periodMatch) {
      info.statementPeriod = {
        start: this.parseDate(periodMatch[1]),
        end: this.parseDate(periodMatch[2]),
      };
    }

    // Extract opening/closing balance
    const openingPattern = /Opening\s+Balance:?\s*\$?([\d,]+\.\d{2})/i;
    const closingPattern = /Closing\s+Balance:?\s*\$?([\d,]+\.\d{2})/i;

    const openingMatch = text.match(openingPattern);
    if (openingMatch) {
      info.openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
    }

    const closingMatch = text.match(closingPattern);
    if (closingMatch) {
      info.closingBalance = parseFloat(closingMatch[1].replace(/,/g, ''));
    }

    return info;
  }

  /**
   * Extract transactions from statement text
   */
  private extractTransactions(text: string): StatementTransaction[] {
    const bankFormat = this.detectBankFormat(text);

    if (bankFormat === 'commbank-cc') {
      return this.extractCommBankCCTransactions(text);
    }

    if (bankFormat === 'commbank-savings') {
      return this.extractCommBankSavingsTransactions(text);
    }

    return this.extractGenericTransactions(text);
  }

  /**
   * Extract CommBank credit card transactions
   * Format: "DD MMM Description Location Amount" or "DD MMM Description Location Amount-" (for credits)
   */
  private extractCommBankCCTransactions(text: string): StatementTransaction[] {
    const transactions: StatementTransaction[] = [];
    const lines = text.split('\n');

    // Get statement year from the period
    const periodMatch = text.match(/Statement\s+Period\s+\d{1,2}\s+\w{3}\s+(\d{4})/i);
    const statementYear = periodMatch ? parseInt(periodMatch[1]) : new Date().getFullYear();

    // Track whether we're in the transactions section
    let inTransactions = false;

    // Pattern for CommBank CC transactions:
    // "DD MMM Description Location Amount" or "DD MMM Description Amount-" (credit has trailing minus)
    // Examples:
    // "08 Nov Apple.Com/Bill Sydney 22.99"
    // "24 Nov Payment Received, Thank You 4,113.69-"
    // "08 Dec Monthly Fee Waived" (no amount - skip these)
    const transactionPattern = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(.+?)\s+([\d,]+\.\d{2})(-)?$/i;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Look for start of transactions section
      if (trimmedLine.includes('Date Transaction details Amount')) {
        inTransactions = true;
        continue;
      }

      // Skip non-transaction lines
      if (!inTransactions) continue;

      // Stop at end of transactions (look for page markers or summary sections)
      if (trimmedLine.startsWith('TransactionsAccount') ||
          trimmedLine.startsWith('Please check your transactions') ||
          trimmedLine.includes('Interest charged on')) {
        // Don't break - there may be more transaction pages
        continue;
      }

      const match = trimmedLine.match(transactionPattern);
      if (match) {
        const [, day, month, description, amountStr, isCredit] = match;

        // Determine the year based on month (handle year boundary in statements)
        const monthNum = this.monthToNumber(month);
        let year = statementYear;

        // If the statement spans Dec-Jan, transactions in Jan should be next year
        // But for now, use the statement year as the base

        const date = new Date(year, monthNum, parseInt(day));
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        // Credit card: purchases are debits (positive), payments/refunds are credits (negative)
        // CommBank marks credits with trailing "-"
        if (isCredit === '-') {
          transactions.push({
            date,
            description: description.trim(),
            credit: amount,
            rawText: trimmedLine,
          });
        } else {
          transactions.push({
            date,
            description: description.trim(),
            debit: amount,
            rawText: trimmedLine,
          });
        }
      }
    }

    return transactions;
  }

  /**
   * Extract CommBank savings/transaction account transactions
   *
   * Actual PDF text patterns (from pdf-parse):
   *   Debit:  "01 Jun Account Fee 4.00 ( $104.42 CR"  — amount then ( or $
   *   Credit: "06 Jun Direct Credit ... $2.27 $106.69 CR"  — $amount
   *   Balance always ends line: "$xxx.xx CR" or "$xxx.xx DR"
   *   Descriptions can span multiple lines (Direct Debit refs, Overdraw Fee details)
   */
  private extractCommBankSavingsTransactions(text: string): StatementTransaction[] {
    const transactions: StatementTransaction[] = [];
    const lines = text.split('\n');

    // Get statement year from the period (note: "Statement" and "Period" may be on separate lines)
    const periodMatch = text.match(/Period\s+\d{1,2}\s+\w{3}\s+(\d{4})/i);
    const statementYear = periodMatch ? parseInt(periodMatch[1]) : new Date().getFullYear();

    // Also get end year for cross-year statements
    const endPeriodMatch = text.match(/Period\s+\d{1,2}\s+\w{3}\s+\d{4}\s*-\s*\d{1,2}\s+\w{3}\s+(\d{4})/i);
    const endYear = endPeriodMatch ? parseInt(endPeriodMatch[1]) : statementYear;

    // Date pattern at start of line
    const dateLinePattern = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;

    // Balance at end of line: $xxx.xx CR or $xxx.xx DR
    const balancePattern = /\$([\d,]+\.\d{2})\s*(CR|DR)\s*$/i;

    let inTransactions = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect start of transaction section
      if (line.match(/^Date\s+Transaction/i)) {
        inTransactions = true;
        continue;
      }

      // Skip OPENING/CLOSING BALANCE lines
      if (line.includes('OPENING BALANCE') || line.includes('CLOSING BALANCE')) {
        continue;
      }

      // Stop at summary/info sections
      if (line.match(/^Opening\s+balance\s+-\s+Total/i) ||
          line.match(/^Transaction\s+Summary/i) ||
          line.match(/^Important\s+Information/i)) {
        inTransactions = false;
        continue;
      }

      if (!inTransactions) continue;

      // Must start with a date
      const dateMatch = line.match(dateLinePattern);
      if (!dateMatch) continue;

      const day = parseInt(dateMatch[1]);
      const monthNum = this.monthToNumber(dateMatch[2]);

      // Handle year boundary for cross-year statements
      let year = statementYear;
      if (endYear > statementYear && monthNum < 6) {
        year = endYear;
      }

      const date = new Date(year, monthNum, day);

      // Join continuation lines (lines that don't start with a date or section marker)
      const afterDate = line.substring(dateMatch[0].length).trim();
      let fullLine = afterDate;
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (!nextLine || dateLinePattern.test(nextLine) ||
            nextLine.match(/^Date\s+Transaction/i) ||
            nextLine.includes('OPENING BALANCE') ||
            nextLine.includes('CLOSING BALANCE') ||
            nextLine.match(/^Opening\s+balance/i) ||
            nextLine.match(/^Transaction\s+Summary/i) ||
            nextLine.match(/^Important\s+Information/i) ||
            nextLine.match(/^Statement\s+\d+/i) ||
            nextLine.match(/^Account\s+Number/i) ||
            nextLine.match(/^\d{4}\.\d{4}/)) {
          break;
        }
        fullLine += ' ' + nextLine;
        j++;
      }

      // Step 1: Extract and remove balance from end
      const balMatch = fullLine.match(balancePattern);
      if (!balMatch) continue;

      const balanceVal = parseFloat(balMatch[1].replace(/,/g, ''));
      const crDr = balMatch[2].toUpperCase();
      const balance = crDr === 'DR' ? -balanceVal : balanceVal;

      // Remove balance portion from end
      let remaining = fullLine.substring(0, fullLine.lastIndexOf(balMatch[0])).trim();

      // Step 2: Look for transaction amount at end of remaining text
      // Credits have $ prefix: "$2.27", "$400.00"
      // Debits have no prefix, followed by ( or $: "4.00 (", "19.99 (", "4.00 $"
      const creditAmtMatch = remaining.match(/\$([\d,]+\.\d{2})\s*$/);
      const debitAmtMatch = remaining.match(/([\d,]+\.\d{2})\s*[\(\$]\s*$/);

      if (creditAmtMatch) {
        const amount = parseFloat(creditAmtMatch[1].replace(/,/g, ''));
        let description = remaining.substring(0, remaining.lastIndexOf(creditAmtMatch[0])).trim();
        description = description.replace(/[\$\(\)]+\s*$/, '').trim();

        transactions.push({
          date, description, credit: amount, balance, rawText: line,
        });
      } else if (debitAmtMatch) {
        const amount = parseFloat(debitAmtMatch[1].replace(/,/g, ''));
        let description = remaining.substring(0, remaining.lastIndexOf(debitAmtMatch[0])).trim();
        description = description.replace(/[\$\(\)]+\s*$/, '').trim();

        transactions.push({
          date, description, debit: amount, balance, rawText: line,
        });
      }
    }

    return transactions;
  }

  /**
   * Convert month abbreviation to number (0-indexed)
   */
  private monthToNumber(month: string): number {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    return months[month.toLowerCase()] ?? 0;
  }

  /**
   * Parse CommBank date format (e.g., "8 Nov 2025")
   */
  private parseCommBankDate(dateStr: string): Date {
    const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
    if (match) {
      const day = parseInt(match[1]);
      const month = this.monthToNumber(match[2]);
      const year = parseInt(match[3]);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  }

  /**
   * Extract generic transactions (original logic)
   */
  private extractGenericTransactions(text: string): StatementTransaction[] {
    const transactions: StatementTransaction[] = [];
    const lines = text.split('\n');

    // Pattern for Australian bank transactions
    // Format: DD/MM/YYYY Description Amount Balance
    // or: Date Description Debit Credit Balance
    const transactionPattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?(?:\s+([\d,]+\.\d{2}))?/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(transactionPattern);

      if (match) {
        const [, dateStr, description, amount1, amount2, amount3] = match;

        // Parse amounts - different formats possible:
        // 1. Date Desc Amount Balance
        // 2. Date Desc Debit Credit Balance
        let debit: number | undefined;
        let credit: number | undefined;
        let balance: number | undefined;

        if (amount3) {
          // Three amounts: debit, credit, balance
          debit = amount1 ? parseFloat(amount1.replace(/,/g, '')) : undefined;
          credit = amount2 ? parseFloat(amount2.replace(/,/g, '')) : undefined;
          balance = amount3 ? parseFloat(amount3.replace(/,/g, '')) : undefined;
        } else if (amount2) {
          // Two amounts: amount, balance
          const amt = parseFloat(amount1.replace(/,/g, ''));
          balance = parseFloat(amount2.replace(/,/g, ''));

          // Determine if debit or credit by checking if description indicates withdrawal
          if (this.isDebit(description)) {
            debit = amt;
          } else {
            credit = amt;
          }
        } else {
          // Single amount - assume it's a debit
          debit = parseFloat(amount1.replace(/,/g, ''));
        }

        transactions.push({
          date: this.parseDate(dateStr),
          description: description.trim(),
          debit,
          credit,
          balance,
          rawText: line,
        });
      }
    }

    return transactions;
  }

  /**
   * Determine if a transaction description indicates a debit
   */
  private isDebit(description: string): boolean {
    const debitKeywords = [
      'withdrawal',
      'payment',
      'purchase',
      'fee',
      'charge',
      'debit',
      'transfer to',
      'eftpos',
      'atm',
    ];

    const desc = description.toLowerCase();
    return debitKeywords.some(keyword => desc.includes(keyword));
  }

  /**
   * Parse various date formats (DD/MM/YYYY, DD-MM-YYYY, etc.)
   */
  private parseDate(dateStr: string): Date {
    // Try DD/MM/YYYY format (Australian standard)
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
      let year = parseInt(parts[2], 10);

      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      return new Date(year, month, day);
    }

    // Fallback to native parsing
    return new Date(dateStr);
  }

  /**
   * Assess confidence in the parsing results
   */
  private assessConfidence(
    info: StatementInfo,
    transactions: StatementTransaction[]
  ): 'high' | 'medium' | 'low' {
    let score = 0;

    // Has account number
    if (info.accountNumber) score += 20;

    // Has statement period
    if (info.statementPeriod) score += 20;

    // Has opening/closing balance
    if (info.openingBalance !== undefined) score += 10;
    if (info.closingBalance !== undefined) score += 10;

    // Has transactions
    if (transactions.length > 0) score += 20;
    if (transactions.length > 10) score += 10;

    // Transactions have balances
    const hasBalances = transactions.filter(t => t.balance !== undefined).length;
    if (hasBalances / transactions.length > 0.8) score += 10;

    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}

export const pdfStatementService = new PDFStatementService();
