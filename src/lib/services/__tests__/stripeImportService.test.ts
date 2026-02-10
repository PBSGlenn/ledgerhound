import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { StripeImportService } from '../stripeImportService';
import type { PrismaClient } from '@prisma/client';
import { getTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';
import { AccountType } from '@prisma/client';
import type Stripe from 'stripe';

describe('StripeImportService', () => {
  let prisma: PrismaClient;
  let stripeImportService: StripeImportService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;
  let stripeAccountId: string;

  // Mock Stripe balance transaction data
  const createMockBalanceTransaction = (
    overrides: Partial<Stripe.BalanceTransaction> = {}
  ): Stripe.BalanceTransaction => ({
    id: 'txn_test123',
    object: 'balance_transaction',
    amount: 22000, // $220.00 in cents
    available_on: 1704067200, // Jan 1, 2024
    created: 1704067200,
    currency: 'aud',
    description: '[Calendly] Behaviour Consultation with John Doe',
    exchange_rate: null,
    fee: 404, // $4.04 in cents
    fee_details: [
      {
        amount: 404,
        application: null,
        currency: 'aud',
        description: 'Stripe processing fees',
        type: 'stripe_fee',
      },
      {
        amount: 37,
        application: null,
        currency: 'aud',
        description: 'GST',
        type: 'tax',
      },
    ],
    net: 21596, // $215.96 in cents
    reporting_category: 'charge',
    source: 'ch_test123',
    status: 'available',
    type: 'charge',
    ...overrides,
  });

  beforeAll(async () => {
    prisma = await getTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(prisma);
    stripeImportService = new StripeImportService(prisma);
    accounts = await seedTestAccounts(prisma);

    // Create Stripe PSP account
    const stripeAccount = await prisma.account.create({
      data: {
        name: 'Stripe',
        type: AccountType.ASSET,
        kind: 'TRANSFER',
        isReal: true,
        isBusinessDefault: true,
        level: 0,
      },
    });
    stripeAccountId = stripeAccount.id;
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('initialize', () => {
    it('should initialize with config and create required accounts', async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
      });

      // Verify required accounts were created
      const consultationIncome = await prisma.account.findFirst({
        where: { name: 'Consultation Income', type: AccountType.INCOME },
      });
      expect(consultationIncome).toBeDefined();

      const gstCollected = await prisma.account.findFirst({
        where: { name: 'GST Collected', type: AccountType.LIABILITY },
      });
      expect(gstCollected).toBeDefined();

      const stripeFee = await prisma.account.findFirst({
        where: { name: 'Stripe Fee', type: AccountType.EXPENSE },
      });
      expect(stripeFee).toBeDefined();

      const gstPaid = await prisma.account.findFirst({
        where: { name: 'GST Paid', type: AccountType.ASSET },
      });
      expect(gstPaid).toBeDefined();
    });

    it('should reuse existing accounts on re-initialization', async () => {
      // Create accounts first
      await prisma.account.create({
        data: {
          name: 'Consultation Income',
          type: AccountType.INCOME,
          kind: 'CATEGORY',
          isReal: false,
          isBusinessDefault: true,
          level: 0,
        },
      });

      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
      });

      const incomeAccounts = await prisma.account.findMany({
        where: { name: 'Consultation Income' },
      });

      // Should not duplicate
      expect(incomeAccounts).toHaveLength(1);
    });
  });

  describe('extractGSTFromFeeDetails', () => {
    it('should extract GST from fee_details', () => {
      const feeDetails: Stripe.BalanceTransaction.FeeDetail[] = [
        {
          amount: 404,
          application: null,
          currency: 'aud',
          description: 'Stripe processing fees',
          type: 'stripe_fee',
        },
        {
          amount: 37,
          application: null,
          currency: 'aud',
          description: 'GST',
          type: 'tax',
        },
      ];

      const gst = (stripeImportService as any).extractGSTFromFeeDetails(feeDetails);

      expect(gst).toBe(0.37); // $0.37
    });

    it('should return 0 when no GST in fee_details', () => {
      const feeDetails: Stripe.BalanceTransaction.FeeDetail[] = [
        {
          amount: 404,
          application: null,
          currency: 'aud',
          description: 'Stripe processing fees',
          type: 'stripe_fee',
        },
      ];

      const gst = (stripeImportService as any).extractGSTFromFeeDetails(feeDetails);

      expect(gst).toBe(0);
    });

    it('should return 0 when fee_details is empty', () => {
      const gst = (stripeImportService as any).extractGSTFromFeeDetails([]);

      expect(gst).toBe(0);
    });
  });

  describe('getPayeeFromType', () => {
    it('should extract invoice number from description', () => {
      const payee = (stripeImportService as any).getPayeeFromType(
        'charge',
        '[Calendly] Behaviour Consultation (Payment for Invoice PBS-12345)'
      );

      expect(payee).toBe('Invoice Payment for Invoice PBS-12345');
    });

    it('should extract customer name from Calendly description', () => {
      const payee = (stripeImportService as any).getPayeeFromType(
        'charge',
        '[Calendly] Behaviour Consultation with Bridget Kennedy'
      );

      expect(payee).toBe('Bridget Kennedy');
    });

    it('should simplify Stripe invoicing fee descriptions', () => {
      const payee = (stripeImportService as any).getPayeeFromType(
        'stripe_fee',
        'Invoicing for invoice_123'
      );

      expect(payee).toBe('Stripe');
    });

    it('should use type mapping when no description', () => {
      const payee = (stripeImportService as any).getPayeeFromType('charge', null);

      expect(payee).toBe('Stripe Charge');
    });

    it('should use description as-is when no patterns match', () => {
      const payee = (stripeImportService as any).getPayeeFromType('charge', 'Custom description');

      expect(payee).toBe('Custom description');
    });
  });

  describe('getIncomeCategoryForTransaction', () => {
    beforeEach(async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
      });
    });

    it('should return Consultation Income for Calendly charges', async () => {
      const categoryId = await (stripeImportService as any).getIncomeCategoryForTransaction(
        '[Calendly] Behaviour Consultation with John Doe'
      );

      const category = await prisma.account.findUnique({
        where: { id: categoryId },
      });

      expect(category?.name).toBe('Consultation Income');
    });

    it('should return Consultation Income for invoice payments', async () => {
      const categoryId = await (stripeImportService as any).getIncomeCategoryForTransaction(
        'Payment for Invoice PBS-12345'
      );

      const category = await prisma.account.findUnique({
        where: { id: categoryId },
      });

      expect(category?.name).toBe('Consultation Income');
    });

    it('should default to Consultation Income for other charges', async () => {
      const categoryId = await (stripeImportService as any).getIncomeCategoryForTransaction(
        'Some other charge'
      );

      const category = await prisma.account.findUnique({
        where: { id: categoryId },
      });

      expect(category?.name).toBe('Consultation Income');
    });

    it('should create category if it does not exist', async () => {
      // Delete the category first
      await prisma.account.deleteMany({
        where: { name: 'Consultation Income' },
      });

      const categoryId = await (stripeImportService as any).getIncomeCategoryForTransaction(
        '[Calendly] Test'
      );

      const category = await prisma.account.findUnique({
        where: { id: categoryId },
      });

      expect(category).toBeDefined();
      expect(category?.name).toBe('Consultation Income');
      expect(category?.type).toBe(AccountType.INCOME);
      expect(category?.isBusinessDefault).toBe(true);
      expect(category?.defaultHasGst).toBe(true);
    });
  });

  describe('createStripeChargeTransaction', () => {
    beforeEach(async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
      });
    });

    it('should create charge transaction with 5-way split', async () => {
      const bt = createMockBalanceTransaction();

      const metadata = {
        stripeType: 'charge',
        stripeId: bt.id,
        grossAmount: bt.amount / 100,
        feeAmount: bt.fee / 100,
        feeGst: 0.37,
        netAmount: bt.net / 100,
        currency: bt.currency.toUpperCase(),
        description: bt.description,
        availableOn: bt.available_on,
        status: bt.status,
        reportingCategory: bt.reporting_category,
        source: bt.source,
        feeDetails: bt.fee_details,
      };

      const transaction = await (stripeImportService as any).createStripeChargeTransaction(
        bt,
        'John Doe',
        metadata
      );

      expect(transaction).toBeDefined();
      expect(transaction.payee).toBe('John Doe');
      expect(transaction.postings).toHaveLength(5);

      // Verify postings sum to zero (double-entry)
      const sum = transaction.postings.reduce((acc: number, p: any) => acc + p.amount, 0);
      expect(Math.abs(sum)).toBeLessThan(0.01); // Allow for rounding

      // Verify specific postings
      const stripePosting = transaction.postings.find((p: any) => p.accountId === stripeAccountId);
      expect(stripePosting?.amount).toBeCloseTo(215.96, 2); // Net amount

      const feeAccount = await prisma.account.findFirst({
        where: { name: 'Stripe Fee' },
      });
      const feePosting = transaction.postings.find((p: any) => p.accountId === feeAccount?.id);
      expect(feePosting?.amount).toBeCloseTo(3.67, 2); // Fee ex-GST

      const gstPaidAccount = await prisma.account.findFirst({
        where: { name: 'GST Paid' },
      });
      const gstPaidPosting = transaction.postings.find(
        (p: any) => p.accountId === gstPaidAccount?.id
      );
      expect(gstPaidPosting?.amount).toBeCloseTo(0.37, 2); // GST on fee

      const incomeAccount = await prisma.account.findFirst({
        where: { name: 'Consultation Income' },
      });
      const incomePosting = transaction.postings.find((p: any) => p.accountId === incomeAccount?.id);
      expect(incomePosting?.amount).toBeCloseTo(-200.0, 2); // Income ex-GST (negative = credit)

      const gstCollectedAccount = await prisma.account.findFirst({
        where: { name: 'GST Collected' },
      });
      const gstCollectedPosting = transaction.postings.find(
        (p: any) => p.accountId === gstCollectedAccount?.id
      );
      expect(gstCollectedPosting?.amount).toBeCloseTo(-20.0, 2); // GST collected (negative = credit)
    });

    it('should mark all postings as business', async () => {
      const bt = createMockBalanceTransaction();

      const metadata = {
        stripeType: 'charge',
        stripeId: bt.id,
        grossAmount: bt.amount / 100,
        feeAmount: bt.fee / 100,
        feeGst: 0.37,
        netAmount: bt.net / 100,
        currency: bt.currency.toUpperCase(),
      };

      const transaction = await (stripeImportService as any).createStripeChargeTransaction(
        bt,
        'Test',
        metadata
      );

      expect(transaction.postings.every((p: any) => p.isBusiness === true)).toBe(true);
    });

    it('should store metadata as JSON', async () => {
      const bt = createMockBalanceTransaction();

      const metadata = {
        stripeType: 'charge',
        stripeId: bt.id,
        grossAmount: bt.amount / 100,
        feeAmount: bt.fee / 100,
        feeGst: 0.37,
        netAmount: bt.net / 100,
        currency: bt.currency.toUpperCase(),
        description: bt.description,
      };

      const transaction = await (stripeImportService as any).createStripeChargeTransaction(
        bt,
        'Test',
        metadata
      );

      expect(transaction.metadata).toBeDefined();
      const parsedMetadata = JSON.parse(transaction.metadata);
      expect(parsedMetadata.stripeType).toBe('charge');
      expect(parsedMetadata.stripeId).toBe(bt.id);
    });
  });

  describe('createStripeFeeTransaction', () => {
    beforeEach(async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
      });
    });

    it('should create fee transaction with 3-way split', async () => {
      const bt = createMockBalanceTransaction({
        type: 'stripe_fee',
        amount: -14, // $0.14 fee (negative)
        fee: 0,
        net: -14,
        fee_details: [
          {
            amount: 14,
            application: null,
            currency: 'aud',
            description: 'Invoicing fee',
            type: 'stripe_fee',
          },
          {
            amount: 1,
            application: null,
            currency: 'aud',
            description: 'GST',
            type: 'tax',
          },
        ],
      });

      const metadata = {
        stripeType: 'stripe_fee',
        stripeId: bt.id,
        grossAmount: bt.amount / 100,
        feeAmount: bt.fee / 100,
        feeGst: 0.01,
        netAmount: bt.net / 100,
        currency: bt.currency.toUpperCase(),
      };

      const transaction = await (stripeImportService as any).createStripeFeeTransaction(
        bt,
        'Stripe',
        metadata
      );

      expect(transaction).toBeDefined();
      expect(transaction.postings).toHaveLength(3);

      // Verify postings sum to zero
      const sum = transaction.postings.reduce((acc: number, p: any) => acc + p.amount, 0);
      expect(Math.abs(sum)).toBeLessThan(0.01);

      const feeAccount = await prisma.account.findFirst({
        where: { name: 'Stripe Fee' },
      });
      const feePosting = transaction.postings.find((p: any) => p.accountId === feeAccount?.id);
      expect(feePosting?.amount).toBeCloseTo(0.13, 2); // Fee ex-GST

      const gstPaidAccount = await prisma.account.findFirst({
        where: { name: 'GST Paid' },
      });
      const gstPaidPosting = transaction.postings.find(
        (p: any) => p.accountId === gstPaidAccount?.id
      );
      expect(gstPaidPosting?.amount).toBeCloseTo(0.01, 2); // GST on fee

      const stripePosting = transaction.postings.find((p: any) => p.accountId === stripeAccountId);
      expect(stripePosting?.amount).toBeCloseTo(-0.14, 2); // Total charged (negative = credit)
    });
  });

  describe('createStripePayoutTransfer', () => {
    beforeEach(async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
        payoutDestinationAccountId: accounts.businessChecking.id,
      });
    });

    it('should create payout transfer with 2 postings', async () => {
      const bt = createMockBalanceTransaction({
        type: 'payout',
        amount: -24810, // $248.10 payout (negative - money out)
        fee: 0,
        net: -24810,
        description: 'STRIPE PAYOUT',
      });

      const transaction = await (stripeImportService as any).createStripePayoutTransfer(bt);

      expect(transaction).toBeDefined();
      expect(transaction.postings).toHaveLength(2);

      // Verify postings sum to zero
      const sum = transaction.postings.reduce((acc: number, p: any) => acc + p.amount, 0);
      expect(Math.abs(sum)).toBeLessThan(0.01);

      const stripePosting = transaction.postings.find((p: any) => p.accountId === stripeAccountId);
      expect(stripePosting?.amount).toBeCloseTo(-248.1, 2); // Money OUT (negative)

      const bankPosting = transaction.postings.find(
        (p: any) => p.accountId === accounts.businessChecking.id
      );
      expect(bankPosting?.amount).toBeCloseTo(248.1, 2); // Money IN (positive)
    });

    it('should throw error if payout destination not configured', async () => {
      // Re-initialize without payout destination
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
      });

      const bt = createMockBalanceTransaction({
        type: 'payout',
        amount: -24810,
        fee: 0,
        net: -24810,
      });

      await expect((stripeImportService as any).createStripePayoutTransfer(bt)).rejects.toThrow(
        'Payout destination account not configured'
      );
    });

    it('should mark all postings as business', async () => {
      const bt = createMockBalanceTransaction({
        type: 'payout',
        amount: -24810,
        fee: 0,
        net: -24810,
      });

      const transaction = await (stripeImportService as any).createStripePayoutTransfer(bt);

      expect(transaction.postings.every((p: any) => p.isBusiness === true)).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should handle charge + fee + payout sequence', async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
        payoutDestinationAccountId: accounts.businessChecking.id,
      });

      // 1. Charge transaction
      const charge = createMockBalanceTransaction({
        id: 'txn_charge1',
        type: 'charge',
        amount: 22000,
        fee: 404,
        net: 21596,
      });

      const chargeMetadata = {
        stripeType: 'charge',
        stripeId: charge.id,
        grossAmount: 220,
        feeAmount: 4.04,
        feeGst: 0.37,
        netAmount: 215.96,
        currency: 'AUD',
      };

      const chargeTxn = await (stripeImportService as any).createStripeChargeTransaction(
        charge,
        'Customer',
        chargeMetadata
      );

      expect(chargeTxn.postings).toHaveLength(5);

      // 2. Fee transaction
      const fee = createMockBalanceTransaction({
        id: 'txn_fee1',
        type: 'stripe_fee',
        amount: -14,
        fee: 0,
        net: -14,
      });

      const feeMetadata = {
        stripeType: 'stripe_fee',
        stripeId: fee.id,
        grossAmount: -0.14,
        feeAmount: 0,
        feeGst: 0.01,
        netAmount: -0.14,
        currency: 'AUD',
      };

      const feeTxn = await (stripeImportService as any).createStripeFeeTransaction(
        fee,
        'Stripe',
        feeMetadata
      );

      expect(feeTxn.postings).toHaveLength(3);

      // 3. Payout transfer
      const payout = createMockBalanceTransaction({
        id: 'txn_payout1',
        type: 'payout',
        amount: -24810,
        fee: 0,
        net: -24810,
      });

      const payoutTxn = await (stripeImportService as any).createStripePayoutTransfer(payout);

      expect(payoutTxn.postings).toHaveLength(2);

      // Verify all transactions exist
      const allTransactions = await prisma.transaction.findMany();
      expect(allTransactions).toHaveLength(3);
    });

    it('should handle multiple charges with different categories', async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
      });

      // Calendly charge
      const calendly = createMockBalanceTransaction({
        id: 'txn_calendly',
        description: '[Calendly] Behaviour Consultation with Jane Doe',
      });

      const calendlyMetadata = {
        stripeType: 'charge',
        stripeId: calendly.id,
        grossAmount: 220,
        feeAmount: 4.04,
        feeGst: 0.37,
        netAmount: 215.96,
        currency: 'AUD',
      };

      const calendlyTxn = await (stripeImportService as any).createStripeChargeTransaction(
        calendly,
        'Jane Doe',
        calendlyMetadata
      );

      // Invoice charge
      const invoice = createMockBalanceTransaction({
        id: 'txn_invoice',
        description: 'Payment for Invoice PBS-12345',
      });

      const invoiceMetadata = {
        stripeType: 'charge',
        stripeId: invoice.id,
        grossAmount: 220,
        feeAmount: 4.04,
        feeGst: 0.37,
        netAmount: 215.96,
        currency: 'AUD',
      };

      const invoiceTxn = await (stripeImportService as any).createStripeChargeTransaction(
        invoice,
        'Invoice Payment for Invoice PBS-12345',
        invoiceMetadata
      );

      // Both should use Consultation Income
      const incomeAccount = await prisma.account.findFirst({
        where: { name: 'Consultation Income' },
      });

      const calendlyIncomePosting = calendlyTxn.postings.find(
        (p: any) => p.accountId === incomeAccount?.id
      );
      expect(calendlyIncomePosting).toBeDefined();

      const invoiceIncomePosting = invoiceTxn.postings.find(
        (p: any) => p.accountId === incomeAccount?.id
      );
      expect(invoiceIncomePosting).toBeDefined();
    });
  });

  describe('Double-Entry Validation', () => {
    beforeEach(async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
        payoutDestinationAccountId: accounts.businessChecking.id,
      });
    });

    it('should create balanced charge transactions', async () => {
      const bt = createMockBalanceTransaction();

      const metadata = {
        stripeType: 'charge',
        stripeId: bt.id,
        grossAmount: 220,
        feeAmount: 4.04,
        feeGst: 0.37,
        netAmount: 215.96,
        currency: 'AUD',
      };

      const transaction = await (stripeImportService as any).createStripeChargeTransaction(
        bt,
        'Test',
        metadata
      );

      const sum = transaction.postings.reduce((acc: number, p: any) => acc + p.amount, 0);
      expect(Math.abs(sum)).toBeLessThan(0.01);
    });

    it('should create balanced fee transactions', async () => {
      const bt = createMockBalanceTransaction({
        type: 'stripe_fee',
        amount: -14,
        fee: 0,
        net: -14,
      });

      const metadata = {
        stripeType: 'stripe_fee',
        stripeId: bt.id,
        grossAmount: -0.14,
        feeAmount: 0,
        feeGst: 0.01,
        netAmount: -0.14,
        currency: 'AUD',
      };

      const transaction = await (stripeImportService as any).createStripeFeeTransaction(
        bt,
        'Stripe',
        metadata
      );

      const sum = transaction.postings.reduce((acc: number, p: any) => acc + p.amount, 0);
      expect(Math.abs(sum)).toBeLessThan(0.01);
    });

    it('should create balanced payout transactions', async () => {
      const bt = createMockBalanceTransaction({
        type: 'payout',
        amount: -24810,
        fee: 0,
        net: -24810,
      });

      const transaction = await (stripeImportService as any).createStripePayoutTransfer(bt);

      const sum = transaction.postings.reduce((acc: number, p: any) => acc + p.amount, 0);
      expect(Math.abs(sum)).toBeLessThan(0.01);
    });
  });

  describe('GST Calculations', () => {
    beforeEach(async () => {
      await stripeImportService.initialize({
        apiKey: 'sk_test_123',
        accountId: stripeAccountId,
      });
    });

    it('should calculate correct GST split for $220 charge', async () => {
      const bt = createMockBalanceTransaction({
        amount: 22000, // $220
        fee: 404, // $4.04
        net: 21596, // $215.96
      });

      const metadata = {
        stripeType: 'charge',
        stripeId: bt.id,
        grossAmount: 220,
        feeAmount: 4.04,
        feeGst: 0.37,
        netAmount: 215.96,
        currency: 'AUD',
      };

      const transaction = await (stripeImportService as any).createStripeChargeTransaction(
        bt,
        'Test',
        metadata
      );

      // Income ex-GST should be $220 / 1.1 = $200
      const incomeAccount = await prisma.account.findFirst({
        where: { name: 'Consultation Income' },
      });
      const incomePosting = transaction.postings.find((p: any) => p.accountId === incomeAccount?.id);
      expect(Math.abs(incomePosting.amount)).toBeCloseTo(200.0, 2);

      // GST Collected should be $20
      const gstCollectedAccount = await prisma.account.findFirst({
        where: { name: 'GST Collected' },
      });
      const gstCollectedPosting = transaction.postings.find(
        (p: any) => p.accountId === gstCollectedAccount?.id
      );
      expect(Math.abs(gstCollectedPosting.amount)).toBeCloseTo(20.0, 2);

      // Fee ex-GST should be $4.04 - $0.37 = $3.67
      const feeAccount = await prisma.account.findFirst({
        where: { name: 'Stripe Fee' },
      });
      const feePosting = transaction.postings.find((p: any) => p.accountId === feeAccount?.id);
      expect(feePosting.amount).toBeCloseTo(3.67, 2);

      // GST Paid should be $0.37
      const gstPaidAccount = await prisma.account.findFirst({
        where: { name: 'GST Paid' },
      });
      const gstPaidPosting = transaction.postings.find(
        (p: any) => p.accountId === gstPaidAccount?.id
      );
      expect(gstPaidPosting.amount).toBeCloseTo(0.37, 2);
    });

    it('should handle zero fee GST', async () => {
      const bt = createMockBalanceTransaction({
        fee_details: [
          {
            amount: 404,
            application: null,
            currency: 'aud',
            description: 'Stripe processing fees',
            type: 'stripe_fee',
          },
        ],
      });

      const metadata = {
        stripeType: 'charge',
        stripeId: bt.id,
        grossAmount: 220,
        feeAmount: 4.04,
        feeGst: 0, // No GST
        netAmount: 215.96,
        currency: 'AUD',
      };

      const transaction = await (stripeImportService as any).createStripeChargeTransaction(
        bt,
        'Test',
        metadata
      );

      const gstPaidAccount = await prisma.account.findFirst({
        where: { name: 'GST Paid' },
      });
      const gstPaidPosting = transaction.postings.find(
        (p: any) => p.accountId === gstPaidAccount?.id
      );
      expect(gstPaidPosting.amount).toBe(0);
    });
  });
});
