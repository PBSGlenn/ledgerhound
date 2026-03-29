import { getPrismaClient } from '../db';
import type { PrismaClient, BillFrequency } from '@prisma/client';
import type {
  RecurringBillWithAccounts,
  CreateRecurringBillDTO,
  UpdateRecurringBillDTO,
  UpcomingBill,
  TransactionWithPostings,
} from '../../types';
import { transactionService } from './transactionService';

const BILL_INCLUDE = {
  categoryAccount: { select: { id: true, name: true, fullPath: true } },
  payFromAccount: { select: { id: true, name: true } },
} as const;

export class RecurringBillService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

  async getAllBills(): Promise<RecurringBillWithAccounts[]> {
    return this.prisma.recurringBill.findMany({
      include: BILL_INCLUDE,
      orderBy: [{ nextDueDate: 'asc' }, { name: 'asc' }],
    }) as Promise<RecurringBillWithAccounts[]>;
  }

  async getBillById(id: string): Promise<RecurringBillWithAccounts | null> {
    return this.prisma.recurringBill.findUnique({
      where: { id },
      include: BILL_INCLUDE,
    }) as Promise<RecurringBillWithAccounts | null>;
  }

  async createBill(data: CreateRecurringBillDTO): Promise<RecurringBillWithAccounts> {
    const startDate = new Date(data.startDate);
    const nextDueDate = this.computeFirstDueDate(data.frequency, data.dueDay, startDate);

    return this.prisma.recurringBill.create({
      data: {
        name: data.name,
        payee: data.payee,
        expectedAmount: data.expectedAmount,
        frequency: data.frequency,
        dueDay: data.dueDay,
        startDate,
        nextDueDate,
        notes: data.notes,
        categoryAccount: { connect: { id: data.categoryAccountId } },
        payFromAccount: { connect: { id: data.payFromAccountId } },
      },
      include: BILL_INCLUDE,
    }) as Promise<RecurringBillWithAccounts>;
  }

  async updateBill(id: string, data: UpdateRecurringBillDTO): Promise<RecurringBillWithAccounts> {
    const existing = await this.prisma.recurringBill.findUnique({ where: { id } });
    if (!existing) throw new Error('Recurring bill not found');

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.payee !== undefined) updateData.payee = data.payee;
    if (data.expectedAmount !== undefined) updateData.expectedAmount = data.expectedAmount;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.categoryAccountId !== undefined) {
      updateData.categoryAccount = { connect: { id: data.categoryAccountId } };
    }
    if (data.payFromAccountId !== undefined) {
      updateData.payFromAccount = { connect: { id: data.payFromAccountId } };
    }

    // If frequency or dueDay changed, recompute nextDueDate
    const frequency = data.frequency ?? existing.frequency;
    const dueDay = data.dueDay ?? existing.dueDay;
    if (data.frequency !== undefined || data.dueDay !== undefined || data.startDate !== undefined) {
      const afterDate = existing.lastPaidDate ?? new Date(data.startDate ?? existing.startDate);
      updateData.nextDueDate = this.computeNextDueDate(frequency, dueDay, afterDate);
      updateData.frequency = frequency;
      updateData.dueDay = dueDay;
    }

    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate);
    }

    return this.prisma.recurringBill.update({
      where: { id },
      data: updateData,
      include: BILL_INCLUDE,
    }) as Promise<RecurringBillWithAccounts>;
  }

  async deleteBill(id: string): Promise<void> {
    await this.prisma.recurringBill.delete({ where: { id } });
  }

  async recordPayment(
    id: string,
    overrideAmount?: number,
    date?: string,
  ): Promise<TransactionWithPostings> {
    const bill = await this.getBillById(id);
    if (!bill) throw new Error('Recurring bill not found');

    const amount = overrideAmount ?? bill.expectedAmount;
    const paymentDate = date ? new Date(date) : new Date();

    // Create a double-entry transaction: debit from pay-from account, credit to category
    // For an expense: the real account gets a negative posting (money going out),
    // and the category account gets a positive posting (expense recorded)
    const transaction = await transactionService.createTransaction({
      date: paymentDate,
      payee: bill.payee,
      memo: `Recurring: ${bill.name}`,
      postings: [
        {
          accountId: bill.payFromAccountId,
          amount: -amount,
        },
        {
          accountId: bill.categoryAccountId,
          amount: amount,
        },
      ],
    });

    // Advance the bill to the next due date
    const nextDueDate = this.computeNextDueDate(bill.frequency, bill.dueDay, paymentDate);
    await this.prisma.recurringBill.update({
      where: { id },
      data: {
        lastPaidDate: paymentDate,
        nextDueDate,
      },
    });

    return transaction;
  }

  async skipOccurrence(id: string): Promise<RecurringBillWithAccounts> {
    const bill = await this.prisma.recurringBill.findUnique({ where: { id } });
    if (!bill) throw new Error('Recurring bill not found');

    const nextDueDate = this.computeNextDueDate(bill.frequency, bill.dueDay, bill.nextDueDate);
    return this.prisma.recurringBill.update({
      where: { id },
      data: { nextDueDate },
      include: BILL_INCLUDE,
    }) as Promise<RecurringBillWithAccounts>;
  }

  async getUpcomingBills(daysAhead: number = 14): Promise<UpcomingBill[]> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + daysAhead);

    const bills = await this.prisma.recurringBill.findMany({
      where: {
        status: 'ACTIVE',
        nextDueDate: { lte: cutoff },
      },
      include: BILL_INCLUDE,
      orderBy: { nextDueDate: 'asc' },
    });

    return bills.map((bill) => {
      const dueDate = new Date(bill.nextDueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffMs = dueDate.getTime() - now.getTime();
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      return {
        id: bill.id,
        name: bill.name,
        payee: bill.payee,
        expectedAmount: bill.expectedAmount,
        frequency: bill.frequency,
        nextDueDate: bill.nextDueDate.toISOString(),
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
        payFromAccountId: bill.payFromAccountId,
        payFromAccountName: (bill as unknown as RecurringBillWithAccounts).payFromAccount.name,
        categoryAccountId: bill.categoryAccountId,
        categoryAccountName: (bill as unknown as RecurringBillWithAccounts).categoryAccount.name,
      };
    });
  }

  async getUpcomingCount(daysAhead: number = 14): Promise<{ upcoming: number; overdue: number }> {
    const bills = await this.getUpcomingBills(daysAhead);
    return {
      upcoming: bills.filter((b) => !b.isOverdue).length,
      overdue: bills.filter((b) => b.isOverdue).length,
    };
  }

  /**
   * Compute the first due date on or after startDate for the given frequency/dueDay.
   */
  computeFirstDueDate(frequency: BillFrequency, dueDay: number, startDate: Date): Date {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    if (frequency === 'WEEKLY' || frequency === 'FORTNIGHTLY') {
      // dueDay is 1=Monday..7=Sunday
      const currentDow = start.getDay(); // 0=Sun..6=Sat
      const targetDow = dueDay === 7 ? 0 : dueDay; // convert to JS day
      let diff = targetDow - currentDow;
      if (diff < 0) diff += 7;
      const result = new Date(start);
      result.setDate(result.getDate() + diff);
      return result;
    }

    // MONTHLY, QUARTERLY, YEARLY — dueDay is day-of-month
    const result = new Date(start.getFullYear(), start.getMonth(), 1);
    result.setDate(Math.min(dueDay, this.daysInMonth(result.getFullYear(), result.getMonth())));

    if (result < start) {
      // Move to next period
      return this.computeNextDueDate(frequency, dueDay, start);
    }
    return result;
  }

  /**
   * Compute the next due date after `afterDate` for the given frequency/dueDay.
   */
  computeNextDueDate(frequency: BillFrequency, dueDay: number, afterDate: Date): Date {
    const after = new Date(afterDate);
    after.setHours(0, 0, 0, 0);

    switch (frequency) {
      case 'WEEKLY': {
        const result = new Date(after);
        result.setDate(result.getDate() + 7);
        return result;
      }
      case 'FORTNIGHTLY': {
        const result = new Date(after);
        result.setDate(result.getDate() + 14);
        return result;
      }
      case 'MONTHLY': {
        return this.addMonths(after, 1, dueDay);
      }
      case 'QUARTERLY': {
        return this.addMonths(after, 3, dueDay);
      }
      case 'YEARLY': {
        return this.addMonths(after, 12, dueDay);
      }
    }
  }

  private addMonths(date: Date, months: number, dueDay: number): Date {
    const year = date.getFullYear();
    const month = date.getMonth() + months;
    const targetYear = year + Math.floor(month / 12);
    const targetMonth = month % 12;
    const maxDay = this.daysInMonth(targetYear, targetMonth);
    const day = Math.min(dueDay, maxDay);
    return new Date(targetYear, targetMonth, day);
  }

  private daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }
}

export const recurringBillService = new RecurringBillService();
