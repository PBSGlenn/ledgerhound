/**
 * Vitest setup file
 * Runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Suppress console logs during tests (comment out for debugging)
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
// };
