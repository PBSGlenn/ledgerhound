import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { validateLine, explainLineError } from '../transactions';

const XOR_MESSAGE = 'Choose either a category or a transfer account for each line.';

describe('validateLine', () => {
  it('accepts lines with only categoryId', () => {
    const line = validateLine({ categoryId: 'cat-1' });
    expect(line.categoryId).toBe('cat-1');
    expect(line.transferAccountId).toBeUndefined();
  });

  it('accepts lines with only transferAccountId', () => {
    const line = validateLine({ transferAccountId: 'acc-1' });
    expect(line.transferAccountId).toBe('acc-1');
    expect(line.categoryId).toBeUndefined();
  });

  it('rejects lines with both categoryId and transferAccountId', () => {
    expect(() => validateLine({ categoryId: 'cat-1', transferAccountId: 'acc-1' })).toThrow(ZodError);
  });

  it('rejects lines with neither categoryId nor transferAccountId', () => {
    expect(() => validateLine({ memo: 'Missing category and transfer' })).toThrow(ZodError);
  });
});

describe('explainLineError', () => {
  it('returns friendly message for XOR violations', () => {
    try {
      validateLine({ categoryId: 'cat-1', transferAccountId: 'acc-1' });
    } catch (error) {
      expect(explainLineError(error)).toContain(XOR_MESSAGE);
    }
  });

  it('falls back to error message for non-zod errors', () => {
    const error = new Error('Custom failure');
    expect(explainLineError(error)).toBe('Custom failure');
  });

  it('returns default message for unknown errors', () => {
    expect(explainLineError('mystery')).toBe(XOR_MESSAGE);
  });
});
