/**
 * Stripe Import Service
 * Handles importing transactions from Stripe Balance Transactions API
 *
 * Key Features:
 * - Fetches balance transactions from Stripe (40+ transaction types)
 * - Handles Stripe fees with GST (10% in Australia)
 * - Creates proper double-entry accounting entries
 * - Stores comprehensive metadata for reconciliation and reporting
 *
 * Stripe Balance Transaction Types:
 * Payment-related: charge, payment, payment_refund, refund, refund_failure
 * Payouts: payout, payout_cancel, payout_failure
 * Transfers: transfer, connect_collection_transfer
 * Fees: application_fee, application_fee_refund, stripe_fee, tax_fee
 * Adjustments: adjustment, payment_failure_refund, payment_reversal
 * Reserves: payment_network_reserve_hold, payment_network_reserve_release
 * Issuing: issuing_authorization_hold, issuing_authorization_release, issuing_transaction
 * Other: advance, advance_funding, anticipation_repayment, climate_order_purchase,
 *        contribution, obligation_outbound, reserve_transaction, topup, etc.
 *
 * Metadata Captured:
 * - Transaction details (type, id, amounts, currency, fees)
 * - Timing (created, available_on, status: available/pending)
 * - Classification (reporting_category, description)
 * - Relationships (source transaction ID)
 * - Fee breakdown (fee_details with GST extraction)
 */

import Stripe from 'stripe';
import { getPrismaClient } from '../db';
import { AccountType, GSTCode } from '@prisma/client';

export interface StripeConfig {
  apiKey: string;
  accountId: string;  // Ledgerhound account ID for Stripe (PSP account)
}

export interface StripeTransactionMetadata {
  stripeType: string;  // charge, refund, payout, etc. (40+ possible types)
  stripeId: string;
  grossAmount: number;  // Amount in dollars (converted from cents)
  feeAmount: number;    // Total fee in dollars
  feeGst: number;       // GST on fees (10% of fee) in dollars
  netAmount: number;    // Net amount after fees in dollars
  currency: string;     // ISO currency code (e.g., 'aud', 'usd')
  description?: string; // Stripe's description of the transaction
  availableOn?: number; // Unix timestamp when funds become available
  status?: string;      // 'available' or 'pending'
  reportingCategory?: string; // Accounting classification from Stripe
  exchangeRate?: number; // For multi-currency transactions
  source?: string;      // Source transaction ID (e.g., charge ID for a refund)
  feeDetails?: Stripe.BalanceTransaction.FeeDetail[]; // Detailed fee breakdown
}

export interface ImportOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  transactions: any[];
}

export class StripeImportService {
  private prisma = getPrismaClient();
  private stripe: Stripe | null = null;
  private config: StripeConfig | null = null;
  private feeAccountId: string | null = null;
  private incomeAccountId: string | null = null;
  private gstCollectedAccountId: string | null = null;
  private gstPaidAccountId: string | null = null;

  /**
   * Initialize Stripe client with API key and ensure required accounts exist
   */
  async initialize(config: StripeConfig): Promise<void> {
    this.config = config;
    this.stripe = new Stripe(config.apiKey, {
      apiVersion: '2024-12-18.acacia',
    });

    // Ensure fee and income accounts exist
    await this.ensureRequiredAccounts();
  }

  /**
   * Ensure all required accounts exist for Stripe transactions with proper GST tracking
   */
  private async ensureRequiredAccounts(): Promise<void> {
    // Find or create Consultation Income (for Calendly/invoice payments)
    let incomeAccount = await this.prisma.account.findFirst({
      where: {
        name: 'Consultation Income',
        type: AccountType.INCOME,
      },
    });

    if (!incomeAccount) {
      incomeAccount = await this.prisma.account.create({
        data: {
          name: 'Consultation Income',
          type: AccountType.INCOME,
          kind: 'CATEGORY',
          isReal: false,
          isBusinessDefault: true,
          defaultHasGst: true,
          level: 0,
        },
      });
    }

    // Find or create GST Collected (liability - GST you owe to ATO)
    let gstCollectedAccount = await this.prisma.account.findFirst({
      where: {
        name: 'GST Collected',
        type: AccountType.LIABILITY,
      },
    });

    if (!gstCollectedAccount) {
      gstCollectedAccount = await this.prisma.account.create({
        data: {
          name: 'GST Collected',
          type: AccountType.LIABILITY,
          kind: 'CATEGORY',
          isReal: false,
          isBusinessDefault: true,
          level: 0,
        },
      });
    }

    // Find or create Stripe Fee (expense ex-GST)
    let feeAccount = await this.prisma.account.findFirst({
      where: {
        name: 'Stripe Fee',
        type: AccountType.EXPENSE,
      },
    });

    if (!feeAccount) {
      feeAccount = await this.prisma.account.create({
        data: {
          name: 'Stripe Fee',
          type: AccountType.EXPENSE,
          kind: 'CATEGORY',
          isReal: false,
          isBusinessDefault: true,
          level: 0,
        },
      });
    }

    // Find or create GST Paid (asset - GST you can claim back from ATO)
    let gstPaidAccount = await this.prisma.account.findFirst({
      where: {
        name: 'GST Paid',
        type: AccountType.ASSET,
      },
    });

    if (!gstPaidAccount) {
      gstPaidAccount = await this.prisma.account.create({
        data: {
          name: 'GST Paid',
          type: AccountType.ASSET,
          kind: 'CATEGORY',
          isReal: false,
          isBusinessDefault: true,
          level: 0,
        },
      });
    }

    this.incomeAccountId = incomeAccount.id;
    this.gstCollectedAccountId = gstCollectedAccount.id;
    this.feeAccountId = feeAccount.id;
    this.gstPaidAccountId = gstPaidAccount.id;
  }

  /**
   * Test connection to Stripe API
   */
  async testConnection(): Promise<{ success: boolean; error?: string; accountId?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' };
    }

    try {
      const account = await this.stripe.account.retrieve();
      return {
        success: true,
        accountId: account.id,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Fetch balance transactions from Stripe
   */
  async fetchBalanceTransactions(options: ImportOptions = {}): Promise<Stripe.BalanceTransaction[]> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    const params: Stripe.BalanceTransactionListParams = {
      limit: options.limit || 100,
    };

    if (options.startDate) {
      params.created = {
        gte: Math.floor(options.startDate.getTime() / 1000),
      };
    }

    if (options.endDate) {
      if (!params.created) params.created = {};
      (params.created as { lte: number }).lte = Math.floor(options.endDate.getTime() / 1000);
    }

    const transactions: Stripe.BalanceTransaction[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const response = await this.stripe.balanceTransactions.list({
        ...params,
        starting_after: startingAfter,
      });

      transactions.push(...response.data);
      hasMore = response.has_more;
      if (hasMore && response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      }
    }

    return transactions;
  }

  /**
   * Extract GST amount from Stripe's fee_details array
   * Stripe provides exact breakdown of fees including GST
   * @param feeDetails - Array of fee details from Stripe balance transaction
   * @returns GST amount in dollars
   */
  private extractGSTFromFeeDetails(feeDetails: Stripe.BalanceTransaction.FeeDetail[]): number {
    console.log('Extracting GST from fee_details:', JSON.stringify(feeDetails, null, 2));

    if (!feeDetails || feeDetails.length === 0) {
      console.log('No fee_details provided');
      return 0;
    }

    // Find the tax/GST entry in fee_details
    const gstDetail = feeDetails.find(detail => {
      console.log(`Checking detail: type=${detail.type}, description=${detail.description}`);
      return detail.type === 'tax' && detail.description === 'GST';
    });

    if (gstDetail) {
      const gstAmount = Math.abs(gstDetail.amount) / 100;
      console.log(`Found GST detail: ${gstDetail.amount} cents = $${gstAmount}`);
      return gstAmount;
    }

    console.log('No GST detail found');
    return 0;
  }

  /**
   * Calculate GST on Stripe fees (10% of fee amount)
   * Stripe fees in Australia include GST
   * @param feeAmount - Fee amount in dollars (not cents)
   * @returns GST component in dollars
   * @deprecated Use extractGSTFromFeeDetails instead - Stripe provides exact amounts
   */
  private calculateFeeGST(feeAmount: number): number {
    // Fee includes GST, so we need to extract it
    // GST = Fee * (10/110) = Fee * 0.0909...
    // Example: $4.04 fee * (10/110) = $0.3672... ≈ $0.37
    return Math.round((feeAmount * 10 / 110) * 100) / 100;
  }

  /**
   * Import Stripe balance transactions into Ledgerhound
   */
  async importTransactions(options: ImportOptions = {}): Promise<ImportResult> {
    if (!this.config) {
      throw new Error('Stripe not configured');
    }

    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
      transactions: [],
    };

    try {
      const balanceTransactions = await this.fetchBalanceTransactions(options);

      for (const bt of balanceTransactions) {
        try {
          // Skip payouts - these are just transfers to bank that user will enter manually
          if (bt.type === 'payout') {
            result.skipped++;
            continue;
          }

          // Check if already imported
          const existing = await this.prisma.transaction.findFirst({
            where: { externalId: bt.id },
          });

          if (existing) {
            result.skipped++;
            continue;
          }

          // Convert amounts from cents to dollars
          const grossAmount = bt.amount / 100;
          const feeAmount = Math.abs(bt.fee) / 100;
          const netAmount = bt.net / 100;

          // Extract GST from fee_details (Stripe provides exact breakdown)
          const feeGst = this.extractGSTFromFeeDetails(bt.fee_details);

          // Create transaction metadata with all relevant Stripe fields
          const metadata: StripeTransactionMetadata = {
            stripeType: bt.type,
            stripeId: bt.id,
            grossAmount,
            feeAmount,
            feeGst,
            netAmount,
            currency: bt.currency.toUpperCase(),
            description: bt.description || undefined,
            availableOn: bt.available_on,
            status: bt.status,
            reportingCategory: bt.reporting_category,
            exchangeRate: bt.exchange_rate || undefined,
            source: bt.source || undefined,
            feeDetails: bt.fee_details,
          };

          // Determine payee based on transaction type
          const payee = this.getPayeeFromType(bt.type, bt.description);

          // Create the transaction with postings
          const transaction = await this.createStripeTransaction(
            bt,
            payee,
            metadata
          );

          result.imported++;
          result.transactions.push(transaction);
        } catch (error) {
          result.errors.push(`Failed to import ${bt.id}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to fetch transactions: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Determine payee from transaction type and description
   * Extracts invoice numbers and customer names from Stripe descriptions
   */
  private getPayeeFromType(type: string, description: string | null): string {
    if (!description) {
      const typeMap: Record<string, string> = {
        charge: 'Stripe Charge',
        refund: 'Stripe Refund',
        payout: 'Stripe Payout',
        payment: 'Stripe Payment',
        payment_refund: 'Stripe Payment Refund',
        adjustment: 'Stripe Adjustment',
        application_fee: 'Stripe Application Fee',
        transfer: 'Stripe Transfer',
      };
      return typeMap[type] || `Stripe ${type}`;
    }

    // Extract invoice number from patterns like:
    // "[Calendly] Behaviour Consultation (Payment for Invoice PBS-XXXXX)"
    // "Payment for Invoice PBS-XXXXX"
    const invoiceMatch = description.match(/Invoice\s+([A-Z0-9-]+)/i);
    if (invoiceMatch) {
      return `Invoice ${invoiceMatch[1]}`;
    }

    // Extract customer name from Calendly charges:
    // "[Calendly] Behaviour Consultation with Bridget Kennedy"
    const calendlyMatch = description.match(/\[Calendly\].*with\s+(.+?)(?:\s*\(|$)/i);
    if (calendlyMatch) {
      return calendlyMatch[1];
    }

    // For Stripe invoicing fees, clean up the description
    if (description.startsWith('Invoicing')) {
      return 'Stripe';
    }

    // Default to the full description
    return description;
  }

  /**
   * Detect and return the appropriate income category based on transaction description
   * Creates the category if it doesn't exist
   */
  private async getIncomeCategoryForTransaction(description: string | null): Promise<string> {
    // Default to Consultation Income
    let categoryName = 'Consultation Income';

    if (description) {
      // Calendly charges - all go to Consultation Income
      if (description.includes('[Calendly]') || description.includes('Behaviour Consultation')) {
        categoryName = 'Consultation Income';
      }
      // Stripe Invoice payments
      else if (description === 'Payment for Invoice' || description.includes('Invoice')) {
        categoryName = 'Consultation Income'; // Can be changed to 'Invoiced Sales' if needed
      }
      // Other charges default to Consultation Income
    }

    // Find or create the category
    let category = await this.prisma.account.findFirst({
      where: {
        name: categoryName,
        type: AccountType.INCOME,
      },
    });

    if (!category) {
      category = await this.prisma.account.create({
        data: {
          name: categoryName,
          type: AccountType.INCOME,
          kind: 'CATEGORY',
          isReal: false,
          isBusinessDefault: true,
          defaultHasGst: true,
          level: 0,
        },
      });
    }

    return category.id;
  }

  /**
   * Create a Stripe transaction with proper Australian GST accounting
   *
   * Handles two main types:
   * 1. Customer charges (charge, payment): Income with fees
   * 2. Stripe fees (stripe_fee, fee): Just expenses
   */
  private async createStripeTransaction(
    bt: Stripe.BalanceTransaction,
    payee: string,
    metadata: StripeTransactionMetadata
  ) {
    if (!this.config) {
      throw new Error('Stripe not configured');
    }

    // Handle different transaction types
    if (bt.type === 'stripe_fee' || bt.type.includes('fee')) {
      return this.createStripeFeeTransaction(bt, payee, metadata);
    } else {
      return this.createStripeChargeTransaction(bt, payee, metadata);
    }
  }

  /**
   * Create a customer charge transaction with income and fees
   * Example for a $220 charge with $4.04 fee (includes $0.37 GST):
   * - DR Stripe Account: $215.96 (net received)
   * - DR Stripe Fee: $3.67 (fee ex-GST)
   * - DR GST Paid: $0.37 (claimable GST on fee)
   * - CR Consultation Income: $200.00 (income ex-GST) - auto-detected from description
   * - CR GST Collected: $20.00 (GST owed to ATO)
   */
  private async createStripeChargeTransaction(
    bt: Stripe.BalanceTransaction,
    payee: string,
    metadata: StripeTransactionMetadata
  ) {
    if (!this.config) {
      throw new Error('Stripe not configured');
    }

    const date = new Date(bt.created * 1000);
    const { grossAmount, feeAmount, netAmount, feeGst } = metadata;

    // Calculate GST components
    const incomeExGst = grossAmount / 1.1;  // Income excluding GST
    const gstCollected = grossAmount - incomeExGst;  // GST collected from customer
    const feeExGst = feeAmount - feeGst;  // Fee excluding GST

    // Auto-detect income category based on description
    const incomeCategoryId = await this.getIncomeCategoryForTransaction(bt.description);

    // Create the transaction with 5-way split postings
    return await this.prisma.transaction.create({
      data: {
        date,
        payee,
        memo: `Stripe ${bt.type}`,
        reference: bt.id,
        externalId: bt.id,
        metadata: JSON.stringify(metadata),
        postings: {
          create: [
            // Debit: Stripe account (net amount received in your bank)
            {
              accountId: this.config.accountId,
              amount: netAmount,
              isBusiness: true,
            },
            // Debit: Stripe Fee (expense ex-GST)
            {
              accountId: this.feeAccountId!,
              amount: feeExGst,
              isBusiness: true,
            },
            // Debit: GST Paid (claimable GST on Stripe fee)
            {
              accountId: this.gstPaidAccountId!,
              amount: feeGst,
              isBusiness: true,
            },
            // Credit: Income (ex-GST) - category auto-detected from description
            {
              accountId: incomeCategoryId,
              amount: -incomeExGst,
              isBusiness: true,
            },
            // Credit: GST Collected (GST owed to ATO)
            {
              accountId: this.gstCollectedAccountId!,
              amount: -gstCollected,
              isBusiness: true,
            },
          ],
        },
      },
      include: {
        postings: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  /**
   * Create a Stripe fee transaction (monthly invoicing fees, etc.)
   * Example for a $0.14 fee with $0.01 GST:
   * - DR Stripe Fee: $0.13 (fee ex-GST)
   * - DR GST Paid: $0.01 (claimable GST)
   * - CR Stripe Account: $0.14 (total charged)
   */
  private async createStripeFeeTransaction(
    bt: Stripe.BalanceTransaction,
    payee: string,
    metadata: StripeTransactionMetadata
  ) {
    if (!this.config) {
      throw new Error('Stripe not configured');
    }

    const date = new Date(bt.created * 1000);
    const { feeAmount, netAmount, feeGst } = metadata;

    // For fee transactions, the "gross" is the fee itself
    const totalFee = Math.abs(netAmount);
    const feeExGst = totalFee - feeGst;

    // Create the transaction with 3-way split (no income, just expense)
    return await this.prisma.transaction.create({
      data: {
        date,
        payee,
        memo: `Stripe ${bt.type}`,
        reference: bt.id,
        externalId: bt.id,
        metadata: JSON.stringify(metadata),
        postings: {
          create: [
            // Debit: Stripe Fee (expense ex-GST)
            {
              accountId: this.feeAccountId!,
              amount: feeExGst,
              isBusiness: true,
            },
            // Debit: GST Paid (claimable GST on fee)
            {
              accountId: this.gstPaidAccountId!,
              amount: feeGst,
              isBusiness: true,
            },
            // Credit: Stripe account (total fee charged)
            {
              accountId: this.config.accountId,
              amount: -totalFee,
              isBusiness: true,
            },
          ],
        },
      },
      include: {
        postings: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  /**
   * Get Stripe account balance
   */
  async getBalance(): Promise<{ available: number; pending: number; currency: string } | null> {
    if (!this.stripe) {
      return null;
    }

    try {
      const balance = await this.stripe.balance.retrieve();
      const primaryBalance = balance.available[0] || balance.pending[0];

      if (!primaryBalance) return null;

      return {
        available: (balance.available[0]?.amount || 0) / 100,
        pending: (balance.pending[0]?.amount || 0) / 100,
        currency: primaryBalance.currency.toUpperCase(),
      };
    } catch (error) {
      console.error('Failed to fetch Stripe balance:', error);
      return null;
    }
  }
}

// Singleton instance
export const stripeImportService = new StripeImportService();
