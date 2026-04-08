/**
 * AI Categorization Service
 * Uses Anthropic Claude API to suggest categories for uncategorized transactions.
 * Model is configurable via settings with automatic upgrade detection.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getPrismaClient } from '../db';
import { settingsService } from './settingsService';
import { memorizedRuleService } from './memorizedRuleService';
import type { PrismaClient } from '@prisma/client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AISettings {
  apiKey: string;
  modelId: string;          // e.g. "claude-haiku-4-5-20251001"
  enabled: boolean;
}

export interface AISettingsPublic {
  configured: boolean;
  enabled: boolean;
  modelId?: string;
  apiKeyMasked?: string;
}

export interface AIModelInfo {
  id: string;
  name: string;
  description: string;
  inputPrice: string;   // per 1M tokens
  outputPrice: string;
}

export interface AICategorySuggestion {
  index: number;                // row index in the preview array
  originalDescription: string;
  cleanPayee: string;
  categoryId: string | null;
  categoryName: string | null;
  isBusiness: boolean;
  confidence: number;           // 0-1
  isTransfer: boolean;                    // true if AI thinks this is an inter-account transfer
  transferTargetAccountId: string | null; // suggested target account for transfers
  transferConfidence: number;             // 0-1, confidence for transfer detection
}

export interface ReconciliationDiagnosis {
  summary: string;
  difference: number;
  issues: Array<{
    type: 'unchecked_transaction' | 'missing_transaction' | 'date_mismatch' | 'duplicate' | 'amount_mismatch' | 'other';
    severity: 'critical' | 'warning' | 'info';
    description: string;
    amount?: number;
    transactionId?: string;
    suggestedAction?: string;
  }>;
  explanation: string;
  remainingAfterFixes: number;
}

export interface ReconciliationDiagnoseRequest {
  accountId: string;
  reconciliation: {
    statementStartDate: string;
    statementEndDate: string;
    statementStartBalance: number;
    statementEndBalance: number;
    accountName: string;
    accountType: string;
  };
  status: {
    difference: number;
    isBalanced: boolean;
    reconciledCount: number;
    unreconciledCount: number;
    reconciledAmount: number;
  };
  ledgerTransactions: Array<{
    id: string;
    date: string;
    payee: string;
    amount: number;
    isReconciled: boolean;
  }>;
  statementTransactions?: Array<{
    date: string;
    description: string;
    debit?: number;
    credit?: number;
  }>;
}

export interface AICategorizationRequest {
  transactions: Array<{
    index: number;
    description: string;
    amount: number;
  }>;
}

// Default model — updated when newer versions are detected
const DEFAULT_MODEL_ID = 'claude-haiku-4-5-20251001';

// ── Service ──────────────────────────────────────────────────────────────────

export class AICategorizationService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrismaClient();
  }

  // ── Settings Management ──────────────────────────────────────────────────

  async getSettings(): Promise<AISettings | null> {
    return settingsService.getJSON<AISettings>('ai_categorization');
  }

  async saveSettings(apiKey: string, modelId: string, enabled: boolean): Promise<AISettings> {
    const settings: AISettings = { apiKey, modelId, enabled };
    await settingsService.setJSON('ai_categorization', settings);
    return settings;
  }

  async deleteSettings(): Promise<void> {
    await settingsService.delete('ai_categorization');
  }

  async getSettingsPublic(): Promise<AISettingsPublic> {
    const settings = await this.getSettings();
    if (!settings) {
      return { configured: false, enabled: false };
    }
    return {
      configured: true,
      enabled: settings.enabled,
      modelId: settings.modelId,
      apiKeyMasked: settings.apiKey
        ? `${settings.apiKey.substring(0, 7)}...${settings.apiKey.slice(-4)}`
        : undefined,
    };
  }

  // ── Model Discovery & Upgrade Detection ──────────────────────────────────

  /**
   * List recommended models for categorization tasks.
   * Returns a static list plus checks the API for any newer Haiku models.
   */
  async listAvailableModels(apiKey?: string): Promise<AIModelInfo[]> {
    const models: AIModelInfo[] = [
      {
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
        description: 'Fast & cost-effective. Best for classification tasks.',
        inputPrice: '$1.00',
        outputPrice: '$5.00',
      },
      {
        id: 'claude-sonnet-4-6-20260220',
        name: 'Claude Sonnet 4.6',
        description: 'Balanced intelligence. Better for ambiguous transactions.',
        inputPrice: '$3.00',
        outputPrice: '$15.00',
      },
    ];

    // If we have an API key, try to discover newer models
    if (apiKey) {
      try {
        const discovered = await this.discoverModels(apiKey);
        if (discovered.length > 0) {
          // Merge discovered models, preferring discovered info for duplicates
          const existingIds = new Set(models.map(m => m.id));
          for (const model of discovered) {
            if (!existingIds.has(model.id)) {
              models.push(model);
            }
          }
        }
      } catch (error) {
        // API discovery is best-effort — fall back to static list
        console.warn('Model discovery failed, using static list:', (error as Error).message);
      }
    }

    return models;
  }

  /**
   * Query the Anthropic API to discover available models.
   * Filters for Haiku/Sonnet models suitable for classification.
   */
  private async discoverModels(apiKey: string): Promise<AIModelInfo[]> {
    const client = new Anthropic({ apiKey });
    const discovered: AIModelInfo[] = [];

    try {
      const response = await client.models.list({ limit: 50 });

      for (const model of response.data) {
        const id = model.id;
        // Only include haiku and sonnet models (suitable for classification)
        if (id.includes('haiku') || id.includes('sonnet')) {
          // Skip very old models
          if (id.includes('claude-3-') && !id.includes('claude-3-5-')) continue;

          const isHaiku = id.includes('haiku');
          discovered.push({
            id,
            name: model.display_name || id,
            description: isHaiku
              ? 'Fast & cost-effective classification'
              : 'Balanced intelligence for ambiguous cases',
            inputPrice: isHaiku ? '$1.00' : '$3.00',
            outputPrice: isHaiku ? '$5.00' : '$15.00',
          });
        }
      }
    } catch (error) {
      // models.list may not be available on all API tiers
      console.warn('Models list API not available:', (error as Error).message);
    }

    return discovered;
  }

  /**
   * Check if a newer model is available than the currently configured one.
   */
  async checkForModelUpdate(apiKey?: string): Promise<{ hasUpdate: boolean; currentModel: string; newestModel?: string }> {
    const settings = await this.getSettings();
    const currentModel = settings?.modelId || DEFAULT_MODEL_ID;
    const key = apiKey || settings?.apiKey;

    if (!key) {
      return { hasUpdate: false, currentModel };
    }

    try {
      const models = await this.listAvailableModels(key);
      const haikuModels = models
        .filter(m => m.id.includes('haiku'))
        .sort((a, b) => b.id.localeCompare(a.id)); // Newest first by date suffix

      if (haikuModels.length > 0 && haikuModels[0].id !== currentModel) {
        return {
          hasUpdate: true,
          currentModel,
          newestModel: haikuModels[0].id,
        };
      }
    } catch {
      // Best-effort
    }

    return { hasUpdate: false, currentModel };
  }

  // ── Validate API Key ─────────────────────────────────────────────────────

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = new Anthropic({ apiKey });
      // Send a minimal request to validate the key
      await client.messages.create({
        model: DEFAULT_MODEL_ID,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return { valid: true };
    } catch (error: any) {
      if (error?.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      if (error?.status === 403) {
        return { valid: false, error: 'API key does not have access to this model' };
      }
      return { valid: false, error: (error as Error).message };
    }
  }

  // ── Core Categorization ──────────────────────────────────────────────────

  /**
   * Categorize a batch of transactions using Claude.
   * Sends the category tree + transaction descriptions, gets back suggestions.
   */
  async categorizeTransactions(
    request: AICategorizationRequest,
    sourceAccountId?: string
  ): Promise<AICategorySuggestion[]> {
    const settings = await this.getSettings();
    if (!settings?.apiKey || !settings.enabled) {
      throw new Error('AI categorization is not configured or not enabled');
    }

    // Load category tree and real accounts for the prompt
    const [categories, realAccounts] = await Promise.all([
      this.prisma.account.findMany({
        where: { kind: 'CATEGORY', archived: false },
        select: { id: true, name: true, type: true, isBusinessDefault: true, defaultHasGst: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.account.findMany({
        where: { kind: 'TRANSFER', archived: false },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (categories.length === 0) {
      throw new Error('No categories found. Please create categories first.');
    }

    // Build category reference for the prompt
    const categoryList = categories.map(c => {
      const parentName = c.parentId
        ? categories.find(p => p.id === c.parentId)?.name
        : null;
      const path = parentName ? `${parentName} > ${c.name}` : c.name;
      const flags = [
        c.type,
        c.isBusinessDefault ? 'business' : 'personal',
      ].join(', ');
      return `- "${path}" (id: ${c.id}, ${flags})`;
    }).join('\n');

    // Build real accounts reference (excluding source account)
    const transferAccountList = realAccounts
      .filter(a => a.id !== sourceAccountId)
      .map(a => `- "${a.name}" (id: ${a.id}, ${a.type})`)
      .join('\n');

    // Build the transactions list
    const transactionLines = request.transactions.map(t =>
      `[${t.index}] "${t.description}" ${t.amount < 0 ? 'DEBIT' : 'CREDIT'} $${Math.abs(t.amount).toFixed(2)}`
    ).join('\n');

    const systemPrompt = `You are a bookkeeping assistant for an Australian small business/personal ledger.
Your job is to categorize bank transactions AND detect inter-account transfers.

Available expense/income categories:
${categoryList}

Bank/real accounts (for transfers):
${transferAccountList}

Rules for CATEGORIZATION:
- Match each transaction to the MOST SPECIFIC category available.
- For expenses (DEBIT), prefer EXPENSE-type categories. For income (CREDIT), prefer INCOME-type categories.
- Set isBusiness=true only if the transaction is clearly a business expense (not groceries, entertainment, personal items).
- Set confidence between 0 and 1. Use 0.9+ for obvious matches (WOOLWORTHS=Groceries), 0.5-0.8 for reasonable guesses, below 0.5 for uncertain.
- Clean up the payee name: remove card numbers, terminal IDs, location suffixes, and VISA/EFTPOS prefixes. Keep the merchant name readable.
- If you cannot determine a category, set categoryId to null.

Rules for TRANSFER DETECTION:
- Set isTransfer=true if the transaction is a transfer between bank accounts, NOT a purchase or payment.
- Transfer keywords: "transfer", "tfr", "internal transfer", "internet transfer", "from linked account", "to linked account", "from macbank", "to macbank", "from savings", "to savings".
- If the description references a specific bank account name from the list above, set transferTargetAccountId to that account's id.
- If it looks like a transfer but you cannot determine which account, set isTransfer=true but transferTargetAccountId=null.
- When isTransfer=true, set categoryId=null (transfers do not have categories).
- Set transferConfidence between 0 and 1. Use 0.9+ for obvious transfers, 0.5-0.8 for likely transfers, below 0.5 for uncertain.
- If NOT a transfer, set isTransfer=false, transferTargetAccountId=null, transferConfidence=0.

Respond with ONLY a JSON array. No markdown, no explanation. Each element:
{"index": number, "originalDescription": string, "cleanPayee": string, "categoryId": string|null, "categoryName": string|null, "isBusiness": boolean, "confidence": number, "isTransfer": boolean, "transferTargetAccountId": string|null, "transferConfidence": number}`;

    const client = new Anthropic({ apiKey: settings.apiKey });

    const response = await client.messages.create({
      model: settings.modelId || DEFAULT_MODEL_ID,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Categorize these transactions:\n${transactionLines}`,
      }],
    });

    // Parse the response
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI');
    }

    try {
      let jsonText = textBlock.text.trim();
      console.log('[AI Categorize] Raw response length:', jsonText.length);
      console.log('[AI Categorize] Raw response first 500 chars:', jsonText.substring(0, 500));

      // Strip markdown code fences if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      // Try to extract JSON array from surrounding text
      const arrayStart = jsonText.indexOf('[');
      const arrayEnd = jsonText.lastIndexOf(']');
      if (arrayStart !== -1 && arrayEnd !== -1 && arrayStart < arrayEnd) {
        jsonText = jsonText.substring(arrayStart, arrayEnd + 1);
      }

      const suggestions: AICategorySuggestion[] = JSON.parse(jsonText);

      // Validate returned IDs
      const validCategoryIds = new Set(categories.map(c => c.id));
      const validTransferIds = new Set(realAccounts.map(a => a.id));

      for (const suggestion of suggestions) {
        // Validate category IDs
        if (suggestion.categoryId && !validCategoryIds.has(suggestion.categoryId)) {
          suggestion.categoryId = null;
          suggestion.categoryName = null;
          suggestion.confidence = 0;
        }
        // Validate transfer target account IDs
        if (suggestion.transferTargetAccountId && !validTransferIds.has(suggestion.transferTargetAccountId)) {
          suggestion.transferTargetAccountId = null;
        }
        // Ensure defaults for missing fields
        suggestion.isTransfer = suggestion.isTransfer ?? false;
        suggestion.transferConfidence = suggestion.transferConfidence ?? 0;
        suggestion.transferTargetAccountId = suggestion.transferTargetAccountId ?? null;
      }

      return suggestions;
    } catch (parseError) {
      console.error('Failed to parse AI response:', textBlock.text);
      throw new Error('Failed to parse AI categorization response');
    }
  }

  // ── Reconciliation Diagnosis ─────────────────────────────────────────────

  /**
   * Analyze a reconciliation session and diagnose why it doesn't balance.
   * Compares ledger transactions against statement lines, identifies missing
   * transactions, unchecked items, date mismatches, and other discrepancies.
   */
  async diagnoseReconciliation(
    request: ReconciliationDiagnoseRequest
  ): Promise<ReconciliationDiagnosis> {
    // Fully algorithmic diagnosis — no AI/LLM involved.
    // Pre-matches statement lines to ledger transactions using memorized rules,
    // amount matching, date tolerance, and full database lookup.
    // Does NOT require an API key.

    const { accountId, reconciliation, status, ledgerTransactions, statementTransactions } = request;

    const rules = await memorizedRuleService.getAllRules();
    const issues: ReconciliationDiagnosis['issues'] = [];
    let fixableAmount = 0;

    // ── Step 1: Check date range mismatch ──────────────────────────────────
    // (No statement data needed for this check)

    // ── Step 2: Pre-match statement lines to ledger transactions ───────────
    const matched: Array<{ stmt: any; ledger: any }> = [];
    const usedLedgerIds = new Set<string>();

    if (statementTransactions && statementTransactions.length > 0) {
      for (const stmt of statementTransactions) {
        const stmtAmount = stmt.debit || stmt.credit || 0;
        const stmtDate = new Date(stmt.date);

        const match = ledgerTransactions.find(lt => {
          if (usedLedgerIds.has(lt.id)) return false;
          const ledgerAmount = Math.abs(lt.amount);
          const amountMatch = Math.abs(stmtAmount - ledgerAmount) < 0.02;
          const ledgerDate = new Date(lt.date);
          const daysDiff = Math.abs((stmtDate.getTime() - ledgerDate.getTime()) / 86400000);
          return amountMatch && daysDiff <= 3;
        });

        if (match) {
          matched.push({ stmt, ledger: match });
          usedLedgerIds.add(match.id);
        }
      }

      // ── Step 3: For unmatched statement lines, check full database ───────
      const unmatchedStmts = statementTransactions.filter(stmt =>
        !matched.some(m => m.stmt === stmt)
      );

      for (const stmt of unmatchedStmts) {
        const stmtAmount = stmt.debit || stmt.credit || 0;
        const stmtDate = new Date(stmt.date);
        const dateStart = new Date(stmtDate);
        dateStart.setDate(dateStart.getDate() - 3);
        const dateEnd = new Date(stmtDate);
        dateEnd.setDate(dateEnd.getDate() + 3);
        const isCredit = !!stmt.credit;

        // Search full database for matching transaction (any reconciliation period)
        const dbMatch = await this.prisma.transaction.findFirst({
          where: {
            postings: {
              some: {
                accountId,
                OR: [
                  { amount: { gte: -stmtAmount - 0.02, lte: -stmtAmount + 0.02 } },
                  { amount: { gte: stmtAmount - 0.02, lte: stmtAmount + 0.02 } },
                ],
              },
            },
            date: { gte: dateStart, lte: dateEnd },
          },
          include: {
            postings: { where: { accountId }, select: { reconciled: true, amount: true } },
          },
        });

        const renamedPayee = (() => {
          const rule = memorizedRuleService.matchPayee(stmt.description, rules, 'import');
          return rule?.defaultPayee || null;
        })();

        if (dbMatch) {
          const isReconciled = dbMatch.postings[0]?.reconciled ?? false;
          if (isReconciled) {
            // Exists and reconciled in another period — no action needed
            issues.push({
              type: 'other',
              severity: 'info',
              description: `"${stmt.description}" ($${stmtAmount.toFixed(2)}, ${stmt.date}) exists in ledger as "${dbMatch.payee}" — already reconciled in a prior period.`,
              amount: stmtAmount,
              suggestedAction: 'No action needed. This transaction overlaps from an adjacent statement period.',
            });
          } else {
            // Exists but not reconciled — might be outside date range
            issues.push({
              type: 'date_mismatch',
              severity: 'warning',
              description: `"${stmt.description}" ($${stmtAmount.toFixed(2)}, ${stmt.date}) exists in ledger as "${dbMatch.payee}" but is outside the reconciliation date range.`,
              amount: stmtAmount,
              transactionId: dbMatch.id,
              suggestedAction: 'Extend the reconciliation date range to include this transaction, or reconcile it in the next period.',
            });
          }
        } else {
          // Genuinely missing from ledger
          const displayName = renamedPayee ? `"${stmt.description}" (would import as "${renamedPayee}")` : `"${stmt.description}"`;
          issues.push({
            type: 'missing_transaction',
            severity: 'critical',
            description: `${displayName} ($${stmtAmount.toFixed(2)}, ${stmt.date}) is on the statement but not found anywhere in the ledger.`,
            amount: stmtAmount,
            suggestedAction: `Add a new ${isCredit ? 'credit' : 'debit'} transaction for $${stmtAmount.toFixed(2)} on ${stmt.date}.`,
          });
          fixableAmount += stmtAmount;
        }
      }
    }

    // ── Step 4: Check matched but unreconciled transactions ────────────────
    const unreconciledMatches = matched.filter(m => !m.ledger.isReconciled);
    for (const { stmt, ledger } of unreconciledMatches) {
      const stmtAmount = stmt.debit || stmt.credit || 0;
      const isCredit = !!stmt.credit;
      issues.push({
        type: 'unchecked_transaction',
        severity: 'critical',
        description: `"${ledger.payee}" ($${stmtAmount.toFixed(2)}, ${ledger.date}) matches statement line "${stmt.description}" but is not checked off.${isCredit ? ' This is a CREDIT (payment) that reduces the balance owed.' : ''}`,
        amount: stmtAmount,
        transactionId: ledger.id,
        suggestedAction: 'Mark this transaction as reconciled (click the checkbox).',
      });
      fixableAmount += stmtAmount;
    }

    // ── Step 5: Check unmatched ledger entries ─────────────────────────────
    const unmatchedLedger = ledgerTransactions.filter(lt => !usedLedgerIds.has(lt.id));
    const reconEndDate = new Date(reconciliation.statementEndDate);
    const reconStartDate = new Date(reconciliation.statementStartDate);

    for (const lt of unmatchedLedger) {
      const ltDate = new Date(lt.date);
      const isOutsidePeriod = ltDate > reconEndDate || ltDate < reconStartDate;

      if (isOutsidePeriod && !lt.isReconciled) {
        issues.push({
          type: 'date_mismatch',
          severity: 'info',
          description: `"${lt.payee}" ($${Math.abs(lt.amount).toFixed(2)}, ${lt.date}) is in the ledger but outside the statement period. It belongs to an adjacent reconciliation.`,
          amount: Math.abs(lt.amount),
          transactionId: lt.id,
          suggestedAction: 'No action needed for this reconciliation. It will be included in the next/previous period.',
        });
      }
    }

    // ── Step 6: Check if no statement was provided ─────────────────────────
    if (!statementTransactions || statementTransactions.length === 0) {
      issues.push({
        type: 'other',
        severity: 'warning',
        description: 'No bank statement PDF has been uploaded. Upload the statement for a more detailed diagnosis.',
        suggestedAction: 'Use Auto-Match to upload and parse the bank statement PDF.',
      });
    }

    // ── Build summary ──────────────────────────────────────────────────────
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const missingCount = issues.filter(i => i.type === 'missing_transaction').length;
    const uncheckedCount = issues.filter(i => i.type === 'unchecked_transaction').length;

    const parts: string[] = [];
    if (missingCount > 0) parts.push(`${missingCount} missing transaction${missingCount > 1 ? 's' : ''}`);
    if (uncheckedCount > 0) parts.push(`${uncheckedCount} unreconciled match${uncheckedCount > 1 ? 'es' : ''}`);
    if (warningCount > 0) parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);

    const summary = criticalCount === 0 && warningCount === 0
      ? 'No issues found. The reconciliation should balance.'
      : `Found ${parts.join(', ')}.`;

    // Estimate remaining difference after fixes
    // This is approximate — the actual effect depends on the account type and sign conventions
    const remainingAfterFixes = Math.abs(status.difference) - fixableAmount;

    return {
      summary,
      difference: status.difference,
      issues,
      explanation: '',  // No AI narrative — the issue cards say it all
      remainingAfterFixes: Math.abs(remainingAfterFixes) < 0.01 ? 0 : remainingAfterFixes,
    };
  }
}

// Singleton
export const aiCategorizationService = new AICategorizationService();
