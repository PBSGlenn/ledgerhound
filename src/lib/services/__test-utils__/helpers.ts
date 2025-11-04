/**
 * Test helper functions
 */

/**
 * Round to 2 decimal places (for currency comparisons)
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Assert that amounts are equal within a small tolerance (for floating point comparisons)
 */
export function expectAmountsEqual(actual: number, expected: number, tolerance: number = 0.01): void {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`Expected ${actual} to equal ${expected} (within ${tolerance}), but difference was ${diff}`);
  }
}

/**
 * Assert that postings sum to zero (double-entry validation)
 */
export function expectPostingsSumToZero(postings: Array<{ amount: number }>): void {
  const sum = postings.reduce((acc, p) => acc + p.amount, 0);
  const rounded = roundCurrency(sum);
  if (rounded !== 0) {
    throw new Error(`Expected postings to sum to zero, but got ${rounded}`);
  }
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a date from a string (YYYY-MM-DD)
 */
export function date(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate GST amount from amount including GST
 */
export function calculateGST(amountIncGst: number, rate: number = 0.1): number {
  return roundCurrency((amountIncGst * rate) / (1 + rate));
}

/**
 * Calculate amount excluding GST
 */
export function calculateAmountExGST(amountIncGst: number, rate: number = 0.1): number {
  const gst = calculateGST(amountIncGst, rate);
  return roundCurrency(amountIncGst - gst);
}

/**
 * Mock console methods for testing (suppress logs)
 */
export function mockConsole() {
  const originalConsole = { ...console };

  beforeEach(() => {
    global.console.log = vi.fn();
    global.console.warn = vi.fn();
    global.console.error = vi.fn();
  });

  afterEach(() => {
    global.console = originalConsole;
  });
}
