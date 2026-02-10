import { z } from 'zod';
import { AccountType, AccountKind, GSTCode, MatchType } from '@prisma/client';
import type { Response } from 'express';

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

export interface APIErrorResponse {
  status: 'error';
  error: string;
  details?: Record<string, string[]> | string;
  code?: string;
}

export interface APISuccessResponse<T = unknown> {
  status: 'success';
  data: T;
}

/**
 * Send a standardized error response
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  options?: { details?: Record<string, string[]> | string; code?: string }
): Response {
  const response: APIErrorResponse = {
    status: 'error',
    error: message,
    ...(options?.details && { details: options.details }),
    ...(options?.code && { code: options.code }),
  };
  return res.status(statusCode).json(response);
}

/**
 * Send a validation error response (400)
 */
export function sendValidationError(res: Response, error: z.ZodError): Response {
  const details: Record<string, string[]> = {};
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(err.message);
  });

  return sendError(res, 400, 'Validation failed', { details, code: 'VALIDATION_ERROR' });
}

/**
 * Send a not found error response (404)
 */
export function sendNotFound(res: Response, resource: string): Response {
  return sendError(res, 404, `${resource} not found`, { code: 'NOT_FOUND' });
}

/**
 * Send a conflict error response (409)
 */
export function sendConflict(res: Response, message: string): Response {
  return sendError(res, 409, message, { code: 'CONFLICT' });
}

/**
 * Send an internal server error response (500)
 */
export function sendServerError(res: Response, error: unknown): Response {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  console.error('Server error:', error);
  return sendError(res, 500, message, { code: 'INTERNAL_ERROR' });
}

/**
 * Validate request body with Zod schema
 * Returns parsed data or sends error response
 */
export function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return null;
  }
  return result.data;
}

/**
 * Validate request query with Zod schema
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  query: unknown,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(query);
  if (!result.success) {
    sendValidationError(res, result.error);
    return null;
  }
  return result.data;
}

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

// Enum validators
export const accountTypeSchema = z.nativeEnum(AccountType);
export const accountKindSchema = z.nativeEnum(AccountKind);
export const gstCodeSchema = z.nativeEnum(GSTCode);
export const matchTypeSchema = z.nativeEnum(MatchType);

// Date string validator (ISO format)
export const dateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date format. Expected ISO 8601 date string.' }
);

// UUID validator
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Non-empty string
export const nonEmptyStringSchema = z.string().min(1, 'This field is required');

// Positive number
export const positiveNumberSchema = z.number().positive('Must be a positive number');

// Non-negative number
export const nonNegativeNumberSchema = z.number().min(0, 'Must be zero or positive');

// ============================================================================
// ACCOUNT SCHEMAS
// ============================================================================

export const createAccountSchema = z.object({
  name: nonEmptyStringSchema.max(255, 'Name must be 255 characters or less'),
  type: accountTypeSchema,
  subtype: z.string().nullable().optional(),
  kind: accountKindSchema.optional(),
  isReal: z.boolean().optional().default(true),
  openingBalance: z.number().optional().default(0),
  openingDate: z.string().optional(),
  isBusinessDefault: z.boolean().optional().default(false),
  defaultHasGst: z.boolean().optional(),
  parentId: uuidSchema.nullable().optional(),
  sortOrder: z.number().optional().default(0),
});

export const updateAccountSchema = z.object({
  name: nonEmptyStringSchema.max(255).optional(),
  isBusinessDefault: z.boolean().optional(),
  defaultHasGst: z.boolean().optional(),
  openingBalance: z.number().optional(),
  openingDate: z.string().optional(),
  currency: z.string().optional(),
  sortOrder: z.number().optional(),
  parentId: uuidSchema.nullable().optional(),
});

// ============================================================================
// CATEGORY SCHEMAS
// ============================================================================

export const createCategorySchema = z.object({
  name: nonEmptyStringSchema.max(255, 'Name must be 255 characters or less'),
  type: z.enum(['INCOME', 'EXPENSE']),
  parentId: uuidSchema.nullable().optional(),
  isBusinessDefault: z.boolean().optional().default(false),
  defaultHasGst: z.boolean().optional(),
  sortOrder: z.number().optional().default(0),
});

export const updateCategorySchema = z.object({
  name: nonEmptyStringSchema.max(255).optional(),
  parentId: uuidSchema.nullable().optional(),
  isBusinessDefault: z.boolean().optional(),
  defaultHasGst: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

// ============================================================================
// TRANSACTION SCHEMAS
// ============================================================================

export const postingSchema = z.object({
  accountId: uuidSchema,
  amount: z.number(),
  isBusiness: z.boolean().optional().default(false),
  gstCode: gstCodeSchema.optional(),
  gstRate: z.number().optional(),
  gstAmount: z.number().optional(),
  categorySplitLabel: z.string().optional(),
});

export const createTransactionSchema = z.object({
  date: z.union([dateStringSchema, z.date()]),
  payee: nonEmptyStringSchema.max(500, 'Payee must be 500 characters or less'),
  memo: z.string().max(1000).optional(),
  externalId: z.string().optional(),
  metadata: z.string().optional(),
  postings: z.array(postingSchema).min(2, 'Transaction must have at least 2 postings'),
});

export const updateTransactionSchema = z.object({
  id: uuidSchema,
  date: z.union([dateStringSchema, z.date()]).optional(),
  payee: nonEmptyStringSchema.max(500).optional(),
  memo: z.string().max(1000).optional(),
  postings: z.array(postingSchema).min(2).optional(),
});

// ============================================================================
// REPORT SCHEMAS
// ============================================================================

export const reportDateRangeSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date', path: ['startDate'] }
);

// Note: Using separate schema since Zod v4 doesn't allow .extend() on refined schemas
export const profitLossQuerySchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  businessOnly: z.enum(['true', 'false']).optional(),
  personalOnly: z.enum(['true', 'false']).optional(),
  gstInclusive: z.enum(['true', 'false']).optional(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date', path: ['startDate'] }
);

// ============================================================================
// RECONCILIATION SCHEMAS
// ============================================================================

export const startReconciliationSchema = z.object({
  accountId: uuidSchema,
  statementStartDate: dateStringSchema,
  statementEndDate: dateStringSchema,
  statementStartBalance: z.number(),
  statementEndBalance: z.number(),
  notes: z.string().optional(),
});

export const reconcilePostingsSchema = z.object({
  postingIds: z.array(uuidSchema).min(1, 'At least one posting ID is required'),
});

// ============================================================================
// IMPORT SCHEMAS
// ============================================================================

// Column mapping can use either column indices (numbers) or column names (strings)
const columnValueSchema = z.union([z.number().int().min(0), z.string()]).optional();

export const columnMappingSchema = z.object({
  date: columnValueSchema,
  amount: columnValueSchema,
  debit: columnValueSchema,
  credit: columnValueSchema,
  payee: columnValueSchema,
  description: columnValueSchema,
  memo: columnValueSchema,
  balance: columnValueSchema,
  reference: columnValueSchema,
});

export const importPreviewSchema = z.object({
  csvText: nonEmptyStringSchema,
  mapping: columnMappingSchema,
  sourceAccountId: uuidSchema,
});

export const importExecuteSchema = z.object({
  previews: z.array(z.any()).min(1, 'At least one transaction preview is required'),
  sourceAccountId: uuidSchema,
  sourceName: nonEmptyStringSchema,
  mapping: columnMappingSchema,
  options: z.object({
    skipDuplicates: z.boolean().optional(),
    applyRules: z.boolean().optional(),
  }).optional(),
});

// ============================================================================
// MEMORIZED RULE SCHEMAS
// ============================================================================

// Helper to validate regex patterns
const regexPatternSchema = z.string().refine(
  (val) => {
    try {
      new RegExp(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid regex pattern' }
);

export const createRuleSchema = z.object({
  name: nonEmptyStringSchema.max(255),
  matchType: matchTypeSchema.optional().default('CONTAINS'),
  matchValue: nonEmptyStringSchema,
  defaultPayee: z.string().optional(),
  defaultAccountId: uuidSchema.optional(),
  defaultSplits: z.string().optional(), // JSON string
  applyOnImport: z.boolean().optional().default(true),
  applyOnManualEntry: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
}).refine(
  (data) => {
    // If matchType is REGEX, validate the pattern
    if (data.matchType === 'REGEX') {
      try {
        new RegExp(data.matchValue);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },
  { message: 'Invalid regex pattern in matchValue', path: ['matchValue'] }
);

export const updateRuleSchema = createRuleSchema.partial();

export const reorderRulesSchema = z.object({
  ruleIds: z.array(uuidSchema).min(1, 'At least one rule ID is required'),
});

// ============================================================================
// BULK OPERATION SCHEMAS
// ============================================================================

export const bulkAddTagsSchema = z.object({
  transactionIds: z.array(uuidSchema).min(1, 'At least one transaction ID is required'),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
});

export const markClearedSchema = z.object({
  postingIds: z.array(uuidSchema).min(1, 'At least one posting ID is required'),
  cleared: z.boolean(),
});

// ============================================================================
// BACKUP SCHEMAS
// ============================================================================

export const createBackupSchema = z.object({
  type: z.enum(['manual', 'auto', 'pre-import', 'pre-reconcile']).optional().default('manual'),
});

export const restoreBackupSchema = z.object({
  filename: nonEmptyStringSchema,
});

export const cleanBackupsSchema = z.object({
  keepCount: z.number().int().min(1).optional().default(10),
});

// ============================================================================
// STRIPE SCHEMAS
// ============================================================================

export const stripeSettingsSchema = z.object({
  apiKey: z.string().optional(),
  accountId: z.string().optional(),
  payoutDestinationAccountId: uuidSchema.optional(),
});

export const stripeImportSchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
