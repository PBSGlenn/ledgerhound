import { z, ZodError } from 'zod';

const XOR_MESSAGE = 'Choose either a category or a transfer account for each line.';

const transactionLineSchema = z
  .object({
    categoryId: z
      .string()
      .trim()
      .min(1, { message: 'Category must be a non-empty string when provided.' })
      .optional()
      .nullable(),
    transferAccountId: z
      .string()
      .trim()
      .min(1, { message: 'Transfer account must be a non-empty string when provided.' })
      .optional()
      .nullable(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const hasCategory = typeof data.categoryId === 'string' && data.categoryId.length > 0;
    const hasTransfer = typeof data.transferAccountId === 'string' && data.transferAccountId.length > 0;

    if (hasCategory === hasTransfer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: XOR_MESSAGE });
    }
  });

export type TransactionLine = z.infer<typeof transactionLineSchema>;

export function validateLine(line: unknown): TransactionLine {
  return transactionLineSchema.parse(line);
}

export function explainLineError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join('; ') || XOR_MESSAGE;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return XOR_MESSAGE;
}
