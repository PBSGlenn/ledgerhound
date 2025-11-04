import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFStatementService } from '../pdfStatementService';

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn((buffer: Buffer) => {
    // Return mocked text based on test scenario
    return Promise.resolve({
      text: buffer.toString('utf-8'),
      numpages: 1,
      numrender: 1,
      info: {},
      metadata: null,
      version: '1.0',
    });
  }),
}));

describe('PDFStatementService', () => {
  let service: PDFStatementService;

  beforeEach(() => {
    service = new PDFStatementService();
  });

  describe('parseStatement', () => {
    it('should parse a complete bank statement', async () => {
      const statementText = `
        Commonwealth Bank
        Account Number: 123456789
        BSB: 063-001
        Statement Period: 01/01/2025 to 31/01/2025
        Opening Balance: $1,250.50
        Closing Balance: $1,450.75

        Date        Description                    Debit    Credit   Balance
        05/01/2025  Woolworths Purchase            50.00             1,200.50
        10/01/2025  Salary Deposit                         2,500.00 3,700.50
        15/01/2025  Rent Payment                   1,200.00          2,500.50
        20/01/2025  Coffee Shop                    4.50              2,496.00
      `;

      const buffer = Buffer.from(statementText, 'utf-8');
      const result = await service.parseStatement(buffer);

      expect(result.info.accountNumber).toBe('123456789');
      expect(result.info.openingBalance).toBe(1250.5);
      expect(result.info.closingBalance).toBe(1450.75);
      expect(result.info.statementPeriod).toBeDefined();
      expect(result.info.statementPeriod?.start.getDate()).toBe(1);
      expect(result.info.statementPeriod?.end.getDate()).toBe(31);

      expect(result.transactions).toHaveLength(4);
      expect(result.confidence).toBe('high');
    });

    it('should handle statements with minimal information', async () => {
      const statementText = `
        Date        Description                    Amount
        05/01/2025  Purchase                       50.00
      `;

      const buffer = Buffer.from(statementText, 'utf-8');
      const result = await service.parseStatement(buffer);

      expect(result.transactions).toHaveLength(1);
      expect(result.confidence).toBe('low');
    });
  });

  describe('extractStatementInfo', () => {
    it('should extract account number from various formats', () => {
      const text1 = 'Account Number: 123456789';
      const info1 = (service as any).extractStatementInfo(text1);
      expect(info1.accountNumber).toBe('123456789');

      const text2 = 'BSB: 063-001 Account: 987654321';
      const info2 = (service as any).extractStatementInfo(text2);
      expect(info2.accountNumber).toBe('987654321');

      const text3 = 'Account: 111222333';
      const info3 = (service as any).extractStatementInfo(text3);
      expect(info3.accountNumber).toBe('111222333');
    });

    it('should extract account number with spaces and dashes', () => {
      const text = 'Account Number: 123-456-789';
      const info = (service as any).extractStatementInfo(text);
      expect(info.accountNumber).toBe('123456789');
    });

    it('should extract statement period', () => {
      const text = 'Statement Period: 01/01/2025 to 31/01/2025';
      const info = (service as any).extractStatementInfo(text);

      expect(info.statementPeriod).toBeDefined();
      expect(info.statementPeriod.start).toBeInstanceOf(Date);
      expect(info.statementPeriod.end).toBeInstanceOf(Date);
      expect(info.statementPeriod.start.getMonth()).toBe(0); // January
      expect(info.statementPeriod.end.getDate()).toBe(31);
    });

    it('should extract statement period with dash separator', () => {
      const text = 'Statement Period: 15/06/2024 - 14/07/2024';
      const info = (service as any).extractStatementInfo(text);

      expect(info.statementPeriod).toBeDefined();
      expect(info.statementPeriod.start.getDate()).toBe(15);
      expect(info.statementPeriod.end.getDate()).toBe(14);
    });

    it('should extract opening and closing balances', () => {
      const text = `
        Opening Balance: $1,250.50
        Closing Balance: $2,345.67
      `;
      const info = (service as any).extractStatementInfo(text);

      expect(info.openingBalance).toBe(1250.5);
      expect(info.closingBalance).toBe(2345.67);
    });

    it('should handle balances without dollar signs', () => {
      const text = `
        Opening Balance: 1,000.00
        Closing Balance: 1,500.00
      `;
      const info = (service as any).extractStatementInfo(text);

      expect(info.openingBalance).toBe(1000);
      expect(info.closingBalance).toBe(1500);
    });

    it('should return empty info when no patterns match', () => {
      const text = 'Just some random text with no structured data';
      const info = (service as any).extractStatementInfo(text);

      expect(info.accountNumber).toBeUndefined();
      expect(info.statementPeriod).toBeUndefined();
      expect(info.openingBalance).toBeUndefined();
      expect(info.closingBalance).toBeUndefined();
    });
  });

  describe('extractTransactions', () => {
    it('should extract transactions with debit, credit, and balance', () => {
      const text = `
        05/01/2025  Woolworths Purchase            50.00             1,200.50
        10/01/2025  Salary Deposit                         2,500.00 3,700.50
        15/01/2025  Rent Payment                   1,200.00          2,500.50
      `;

      const transactions = (service as any).extractTransactions(text);

      expect(transactions).toHaveLength(3);

      expect(transactions[0].description).toBe('Woolworths Purchase');
      expect(transactions[0].debit).toBe(50);
      expect(transactions[0].balance).toBe(1200.5);

      expect(transactions[1].description).toBe('Salary Deposit');
      expect(transactions[1].credit).toBe(2500);
      expect(transactions[1].balance).toBe(3700.5);

      expect(transactions[2].description).toBe('Rent Payment');
      expect(transactions[2].debit).toBe(1200);
      expect(transactions[2].balance).toBe(2500.5);
    });

    it('should extract transactions with only amount and balance', () => {
      const text = `
        05/01/2025  Withdrawal                     100.00   1,150.00
        10/01/2025  Deposit                        250.00   1,400.00
      `;

      const transactions = (service as any).extractTransactions(text);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].debit).toBe(100);
      expect(transactions[0].balance).toBe(1150);
      expect(transactions[1].credit).toBe(250);
      expect(transactions[1].balance).toBe(1400);
    });

    it('should extract transactions with only amount (no balance)', () => {
      const text = `
        05/01/2025  ATM Withdrawal                 50.00
        10/01/2025  Purchase                       25.50
      `;

      const transactions = (service as any).extractTransactions(text);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].debit).toBe(50);
      expect(transactions[0].balance).toBeUndefined();
      expect(transactions[1].debit).toBe(25.5);
      expect(transactions[1].balance).toBeUndefined();
    });

    it('should handle dates with dashes', () => {
      const text = `
        05-01-2025  Coffee Shop                    4.50     1,195.50
      `;

      const transactions = (service as any).extractTransactions(text);

      expect(transactions).toHaveLength(1);
      expect(transactions[0].date).toBeInstanceOf(Date);
      expect(transactions[0].date.getDate()).toBe(5);
    });

    it('should parse amounts with commas', () => {
      const text = `
        05/01/2025  Large Purchase                 1,234.56 10,000.00
      `;

      const transactions = (service as any).extractTransactions(text);

      expect(transactions).toHaveLength(1);
      expect(transactions[0].debit).toBe(1234.56);
      expect(transactions[0].balance).toBe(10000);
    });

    it('should store raw text for each transaction', () => {
      const text = `
        05/01/2025  Coffee Shop                    4.50     1,195.50
      `;

      const transactions = (service as any).extractTransactions(text);

      expect(transactions[0].rawText).toContain('05/01/2025');
      expect(transactions[0].rawText).toContain('Coffee Shop');
    });

    it('should return empty array when no transactions found', () => {
      const text = 'Header text with no transaction data';

      const transactions = (service as any).extractTransactions(text);

      expect(transactions).toEqual([]);
    });
  });

  describe('isDebit', () => {
    it('should identify debit keywords', () => {
      expect((service as any).isDebit('ATM Withdrawal')).toBe(true);
      expect((service as any).isDebit('Card Payment')).toBe(true);
      expect((service as any).isDebit('EFTPOS Purchase')).toBe(true);
      expect((service as any).isDebit('Bank Fee')).toBe(true);
      expect((service as any).isDebit('Direct Debit')).toBe(true);
      expect((service as any).isDebit('Transfer to Savings')).toBe(true);
    });

    it('should not identify credit keywords as debit', () => {
      expect((service as any).isDebit('Salary Deposit')).toBe(false);
      expect((service as any).isDebit('Transfer from Checking')).toBe(false);
      expect((service as any).isDebit('Interest Credit')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect((service as any).isDebit('WITHDRAWAL')).toBe(true);
      expect((service as any).isDebit('withdrawal')).toBe(true);
      expect((service as any).isDebit('Withdrawal')).toBe(true);
    });
  });

  describe('parseDate', () => {
    it('should parse DD/MM/YYYY format', () => {
      const date = (service as any).parseDate('05/01/2025');

      expect(date).toBeInstanceOf(Date);
      expect(date.getDate()).toBe(5);
      expect(date.getMonth()).toBe(0); // January (0-indexed)
      expect(date.getFullYear()).toBe(2025);
    });

    it('should parse DD-MM-YYYY format', () => {
      const date = (service as any).parseDate('15-06-2024');

      expect(date).toBeInstanceOf(Date);
      expect(date.getDate()).toBe(15);
      expect(date.getMonth()).toBe(5); // June (0-indexed)
      expect(date.getFullYear()).toBe(2024);
    });

    it('should handle 2-digit years (20xx)', () => {
      const date = (service as any).parseDate('05/01/25');

      expect(date.getFullYear()).toBe(2025);
    });

    it('should handle 2-digit years (19xx)', () => {
      const date = (service as any).parseDate('05/01/95');

      expect(date.getFullYear()).toBe(1995);
    });

    it('should handle single-digit day and month', () => {
      const date = (service as any).parseDate('5/1/2025');

      expect(date.getDate()).toBe(5);
      expect(date.getMonth()).toBe(0);
    });
  });

  describe('assessConfidence', () => {
    it('should return high confidence for complete data', () => {
      const info = {
        accountNumber: '123456789',
        statementPeriod: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
        },
        openingBalance: 1000,
        closingBalance: 1500,
      };

      const transactions = Array(15).fill({
        date: new Date(),
        description: 'Test',
        debit: 100,
        balance: 1000,
      });

      const confidence = (service as any).assessConfidence(info, transactions);

      expect(confidence).toBe('high');
    });

    it('should return medium confidence for partial data', () => {
      const info = {
        accountNumber: '123456789',
        openingBalance: 1000,
      };

      const transactions = Array(5).fill({
        date: new Date(),
        description: 'Test',
        debit: 100,
      });

      const confidence = (service as any).assessConfidence(info, transactions);

      expect(confidence).toBe('medium');
    });

    it('should return low confidence for minimal data', () => {
      const info = {};

      const transactions = [
        {
          date: new Date(),
          description: 'Test',
          debit: 100,
        },
      ];

      const confidence = (service as any).assessConfidence(info, transactions);

      expect(confidence).toBe('low');
    });

    it('should return low confidence with no transactions', () => {
      const info = {
        accountNumber: '123456789',
        openingBalance: 1000,
      };

      const transactions: any[] = [];

      const confidence = (service as any).assessConfidence(info, transactions);

      expect(confidence).toBe('low');
    });

    it('should give bonus for transactions with balances', () => {
      const info = {
        accountNumber: '123456789',
        statementPeriod: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
        },
      };

      const transactions = Array(15).fill({
        date: new Date(),
        description: 'Test',
        debit: 100,
        balance: 1000,
      });

      const confidence = (service as any).assessConfidence(info, transactions);

      expect(confidence).toBe('high');
    });
  });

  describe('Integration', () => {
    it('should parse a realistic Commonwealth Bank statement', async () => {
      const statementText = `
        Commonwealth Bank
        NetBank Saver Account
        BSB: 063-001
        Account Number: 123456789

        Statement Period: 01/01/2025 to 31/01/2025
        Opening Balance: $5,000.00
        Closing Balance: $4,750.25

        Transaction History
        Date        Description                         Debit      Credit     Balance
        02/01/2025  Woolworths Sydney                   125.50                4,874.50
        05/01/2025  Salary - ACME Corp                             3,000.00   7,874.50
        10/01/2025  Transfer to Savings                 1,000.00              6,874.50
        15/01/2025  Rent Payment                        2,000.00              4,874.50
        20/01/2025  Electricity Direct Debit            124.25                4,750.25
      `;

      const buffer = Buffer.from(statementText, 'utf-8');
      const result = await service.parseStatement(buffer);

      expect(result.info.accountNumber).toBe('123456789');
      expect(result.info.openingBalance).toBe(5000);
      expect(result.info.closingBalance).toBe(4750.25);
      expect(result.transactions).toHaveLength(5);
      expect(result.confidence).toBe('high');

      const salaryTxn = result.transactions.find(t => t.description.includes('Salary'));
      expect(salaryTxn?.credit).toBe(3000);

      const rentTxn = result.transactions.find(t => t.description.includes('Rent'));
      expect(rentTxn?.debit).toBe(2000);
    });

    it('should parse a statement with mixed date formats', async () => {
      const statementText = `
        Statement Period: 1/1/2025 - 31/1/2025

        1/1/2025    Opening Balance                                  1,000.00
        05/01/2025  Purchase                            50.00        950.00
        15-01-2025  Deposit                                  100.00  1,050.00
      `;

      const buffer = Buffer.from(statementText, 'utf-8');
      const result = await service.parseStatement(buffer);

      expect(result.info.statementPeriod?.start.getDate()).toBe(1);
      expect(result.transactions.length).toBeGreaterThan(0);
    });

    it('should handle statements with no metadata', async () => {
      const statementText = `
        05/01/2025  Purchase 1                      50.00
        10/01/2025  Purchase 2                      25.00
        15/01/2025  Purchase 3                      100.00
      `;

      const buffer = Buffer.from(statementText, 'utf-8');
      const result = await service.parseStatement(buffer);

      expect(result.transactions).toHaveLength(3);
      expect(result.confidence).toBe('low');
      expect(result.info.accountNumber).toBeUndefined();
    });
  });
});
