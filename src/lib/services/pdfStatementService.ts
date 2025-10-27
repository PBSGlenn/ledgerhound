import pdf from 'pdf-parse';

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

export class PDFStatementService {
  /**
   * Parse a PDF bank statement
   */
  async parseStatement(pdfBuffer: Buffer): Promise<ParsedStatement> {
    // Extract text from PDF
    const data = await pdf(pdfBuffer);
    const text = data.text;

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
   * Extract statement metadata
   */
  private extractStatementInfo(text: string): StatementInfo {
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
