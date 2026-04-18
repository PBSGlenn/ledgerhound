import { describe, it, expect } from 'vitest';
import { generateSplitPostings } from '../transactionService';
import type { SplitRatio } from '../../../types';

const ratio = (overrides: Partial<SplitRatio> = {}): SplitRatio => ({
  kind: 'SPLIT_RATIO',
  personalCategoryId: '00000000-0000-0000-0000-000000000001',
  businessCategoryId: '00000000-0000-0000-0000-000000000002',
  businessPercent: 25,
  gstOnBusiness: true,
  ...overrides,
});

const gstPaidId = '00000000-0000-0000-0000-00000000ffff';

const sumAmounts = (postings: { amount: number }[]) =>
  Math.round(postings.reduce((s, p) => s + p.amount, 0) * 100) / 100;

describe('generateSplitPostings', () => {
  describe('basic split with GST', () => {
    it('splits a $200 expense at 25% business into personal $150, business-ex-GST $45.45, GST $4.55', () => {
      const postings = generateSplitPostings(-200, ratio({ businessPercent: 25 }), {
        gstAccountId: gstPaidId,
      });

      expect(postings).toHaveLength(3);

      const [personal, business, gst] = postings;
      expect(personal.accountId).toBe(ratio().personalCategoryId);
      expect(personal.amount).toBe(-150);
      expect(personal.isBusiness).toBe(false);
      expect(personal.gstCode).toBeUndefined();

      expect(business.accountId).toBe(ratio().businessCategoryId);
      expect(business.amount).toBeCloseTo(-45.45, 2);
      expect(business.isBusiness).toBe(true);
      expect(business.gstCode).toBe('GST');
      expect(business.gstRate).toBe(0.1);
      expect(business.gstAmount).toBeCloseTo(4.55, 2);

      expect(gst.accountId).toBe(gstPaidId);
      expect(gst.amount).toBeCloseTo(-4.55, 2);
      expect(gst.isBusiness).toBe(true);
    });

    it('produces three postings that sum to the original total', () => {
      const postings = generateSplitPostings(-200, ratio({ businessPercent: 25 }), {
        gstAccountId: gstPaidId,
      });
      expect(sumAmounts(postings)).toBe(-200);
    });
  });

  describe('edge cases', () => {
    it('emits a single personal posting when businessPercent is 0', () => {
      const postings = generateSplitPostings(-100, ratio({ businessPercent: 0 }), {
        gstAccountId: gstPaidId,
      });
      expect(postings).toHaveLength(1);
      expect(postings[0].accountId).toBe(ratio().personalCategoryId);
      expect(postings[0].amount).toBe(-100);
      expect(postings[0].isBusiness).toBe(false);
    });

    it('emits only business + GST postings when businessPercent is 100', () => {
      const postings = generateSplitPostings(-100, ratio({ businessPercent: 100 }), {
        gstAccountId: gstPaidId,
      });
      expect(postings).toHaveLength(2);
      expect(postings[0].accountId).toBe(ratio().businessCategoryId);
      expect(postings[0].isBusiness).toBe(true);
      expect(postings[1].accountId).toBe(gstPaidId);
      expect(sumAmounts(postings)).toBe(-100);
    });

    it('handles a fractional percentage (33.33%) without rounding drift', () => {
      const postings = generateSplitPostings(-100, ratio({ businessPercent: 33.33, gstOnBusiness: false }), {});
      expect(postings).toHaveLength(2);
      // business amount = round(100 * 0.3333, 2) = 33.33; personal = 100 - 33.33 = 66.67
      expect(postings[0].amount).toBe(-66.67);
      expect(postings[1].amount).toBe(-33.33);
      expect(sumAmounts(postings)).toBe(-100);
    });

    it('skips GST posting when gstOnBusiness is false', () => {
      const postings = generateSplitPostings(-200, ratio({ businessPercent: 25, gstOnBusiness: false }), {});
      expect(postings).toHaveLength(2);
      const business = postings[1];
      expect(business.gstCode).toBeUndefined();
      expect(business.gstRate).toBeUndefined();
      expect(business.gstAmount).toBeUndefined();
      expect(business.amount).toBe(-50);
    });

    it('falls back to no-GST form when gstOnBusiness is true but gstAccountId is not supplied', () => {
      const postings = generateSplitPostings(-200, ratio({ businessPercent: 25, gstOnBusiness: true }), {});
      expect(postings).toHaveLength(2);
      // No GST account → single business posting, no GST split
      expect(postings.find(p => p.gstCode)).toBeUndefined();
      expect(sumAmounts(postings)).toBe(-200);
    });

    it('supports income-side split (positive totalAmount)', () => {
      const postings = generateSplitPostings(500, ratio({ businessPercent: 60, gstOnBusiness: false }), {});
      expect(postings).toHaveLength(2);
      expect(postings[0].amount).toBe(200); // personal 40%
      expect(postings[1].amount).toBe(300); // business 60%
      expect(sumAmounts(postings)).toBe(500);
    });

    it('clamps businessPercent outside 0-100 into the valid range', () => {
      const over = generateSplitPostings(-100, ratio({ businessPercent: 150, gstOnBusiness: false }), {});
      expect(sumAmounts(over)).toBe(-100);
      const under = generateSplitPostings(-100, ratio({ businessPercent: -10, gstOnBusiness: false }), {});
      expect(sumAmounts(under)).toBe(-100);
    });
  });

  describe('passes GST validator contract', () => {
    it('ensures gstAmount ≈ |business amount| × gstRate within ±0.02', () => {
      // Test a few amounts to confirm validator tolerance holds
      const cases = [-200, -50, -73.19, -12345.67];
      for (const total of cases) {
        const postings = generateSplitPostings(total, ratio({ businessPercent: 25 }), {
          gstAccountId: gstPaidId,
        });
        const business = postings.find(p => p.gstCode === 'GST');
        if (!business) continue;
        const expectedGst = Math.abs(business.amount * (business.gstRate ?? 0));
        const diff = Math.abs((business.gstAmount ?? 0) - expectedGst);
        expect(diff).toBeLessThanOrEqual(0.02);
      }
    });
  });
});
