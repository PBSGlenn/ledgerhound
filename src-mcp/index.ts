#!/usr/bin/env node
/**
 * Ledgerhound MCP Server
 *
 * Exposes Ledgerhound accounting tools to Claude Desktop / Claude Cowork
 * via the Model Context Protocol. Requires the Express API server to be
 * running on localhost:3001 (npm run api).
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { basename } from 'path';
import * as api from './api-client.js';

const server = new McpServer({
  name: 'ledgerhound',
  version: '1.0.0',
});

// ════════════════════════════════════════════════════════════════════════════
// TOOLS
// ════════════════════════════════════════════════════════════════════════════

// ── Account Tools ──

server.registerTool(
  'list_accounts',
  {
    title: 'List Accounts',
    description: 'List all bank accounts, credit cards, and other transfer accounts with their current and cleared balances. Returns account names, types, balances, and whether they are business defaults.',
    annotations: { readOnlyHint: true },
  },
  async () => {
    const data = await api.listAccountsWithBalances();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'get_account_balance',
  {
    title: 'Get Account Balance',
    description: 'Get the current and cleared balance for a specific account by its ID.',
    inputSchema: {
      accountId: z.string().describe('The UUID of the account'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ accountId }) => {
    const data = await api.getAccountBalance(accountId);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Category Tools ──

server.registerTool(
  'list_categories',
  {
    title: 'List Categories',
    description: 'Get the full category tree hierarchy. Categories are used to classify transactions (e.g. Groceries, Rent, Salary). Returns nested tree structure with parent/child relationships.',
    annotations: { readOnlyHint: true },
  },
  async () => {
    const data = await api.getCategoryTree();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'search_categories',
  {
    title: 'Search Categories',
    description: 'Search for categories by name. Useful for finding the right category ID before creating or categorizing transactions.',
    inputSchema: {
      query: z.string().describe('Search term to match against category names'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => {
    const data = await api.searchCategories(query);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Transaction Tools ──

server.registerTool(
  'get_register',
  {
    title: 'Get Account Register',
    description: 'Get the transaction register for a specific account. Shows all transactions with dates, payees, amounts, categories, and running balance. Supports date range and other filters.',
    inputSchema: {
      accountId: z.string().describe('The UUID of the account'),
      dateFrom: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
      dateTo: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
      search: z.string().optional().describe('Search payee/memo text'),
      clearedOnly: z.boolean().optional().describe('Only show cleared transactions'),
      reconciledOnly: z.boolean().optional().describe('Only show reconciled transactions'),
      businessOnly: z.boolean().optional().describe('Only show business transactions'),
      personalOnly: z.boolean().optional().describe('Only show personal transactions'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ accountId, ...filters }) => {
    const data = await api.getRegister(accountId, filters);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'search_transactions',
  {
    title: 'Search Transactions',
    description: 'Search for transactions across all accounts. Find transactions by payee name, memo, date range, tags, amount range, or business/personal status.',
    inputSchema: {
      search: z.string().optional().describe('Search term for payee/memo'),
      dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      dateTo: z.string().optional().describe('End date (YYYY-MM-DD)'),
      accountId: z.string().optional().describe('Limit to specific account'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      businessOnly: z.boolean().optional().describe('Only business transactions'),
      personalOnly: z.boolean().optional().describe('Only personal transactions'),
      minAmount: z.number().optional().describe('Minimum amount'),
      maxAmount: z.number().optional().describe('Maximum amount'),
    },
    annotations: { readOnlyHint: true },
  },
  async (filters) => {
    const data = await api.searchTransactions(filters);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'create_transaction',
  {
    title: 'Create Transaction',
    description: `Create a new double-entry accounting transaction. Every transaction must have 2+ postings that sum to zero.

IMPORTANT RULES:
- Postings must sum to zero (double-entry). E.g. spending $50 from a bank account on groceries: one posting of -50 to the bank account, one posting of +50 to the Groceries category.
- For expenses: negative amount on the bank/card account, positive amount on the expense category.
- For income: positive amount on the bank account, negative amount on the income category.
- For transfers between bank accounts: negative on source, positive on destination — no category needed.
- Set isBusiness=true on postings that are business-related (enables GST tracking).
- Use gstCode (GST, GST_FREE, INPUT_TAXED, EXPORT, OTHER) and gstAmount for business postings with GST.

Use list_accounts and list_categories first to find the correct account/category IDs.`,
    inputSchema: {
      date: z.string().describe('Transaction date (YYYY-MM-DD)'),
      payee: z.string().describe('Payee/merchant name'),
      memo: z.string().optional().describe('Optional memo/description'),
      reference: z.string().optional().describe('Optional reference number'),
      tags: z.array(z.string()).optional().describe('Optional tags'),
      postings: z.array(z.object({
        accountId: z.string().describe('Account or category UUID'),
        amount: z.number().describe('Amount (positive=debit, negative=credit for ASSET/EXPENSE; reversed for LIABILITY/INCOME/EQUITY)'),
        isBusiness: z.boolean().optional().describe('Whether this posting is business-related'),
        gstCode: z.string().optional().describe('GST code: GST, GST_FREE, INPUT_TAXED, EXPORT, OTHER'),
        gstAmount: z.number().optional().describe('GST amount included (for GST code = GST)'),
      })).describe('Array of postings that must sum to zero'),
    },
    annotations: { readOnlyHint: false },
  },
  async (data) => {
    const result = await api.createTransaction(data);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'categorize_transaction',
  {
    title: 'Categorize Transaction',
    description: 'Change the category of a single transaction. Use search_transactions or get_register to find the transaction ID, and search_categories or list_categories to find the target category ID.',
    inputSchema: {
      transactionId: z.string().describe('The UUID of the transaction to recategorize'),
      newCategoryId: z.string().describe('The UUID of the new category'),
    },
    annotations: { readOnlyHint: false },
  },
  async ({ transactionId, newCategoryId }) => {
    const result = await api.categorizeTransaction(transactionId, newCategoryId);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'get_uncategorized_summary',
  {
    title: 'Get Uncategorized Summary',
    description: 'List all uncategorized transactions grouped by payee name, with counts and total amounts. Useful for identifying transactions that need categorization.',
    annotations: { readOnlyHint: true },
  },
  async () => {
    const data = await api.getUncategorizedSummary();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'bulk_categorize',
  {
    title: 'Bulk Categorize Transactions',
    description: 'Categorize all transactions from specific payees at once. Optionally create memorized rules so future transactions from these payees are auto-categorized. Use get_uncategorized_summary first to see what needs categorizing.',
    inputSchema: {
      items: z.array(z.object({
        payee: z.string().describe('Exact payee name to match'),
        categoryId: z.string().describe('Target category UUID'),
        createRule: z.boolean().optional().describe('Create a memorized rule for this payee (default: false)'),
      })).describe('Array of payee-to-category assignments'),
    },
    annotations: { readOnlyHint: false },
  },
  async ({ items }) => {
    const result = await api.bulkRecategorize(items);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Report Tools ──

server.registerTool(
  'profit_and_loss',
  {
    title: 'Profit & Loss Report',
    description: 'Generate a Profit & Loss (income statement) report for a date range. Shows income and expenses by category with totals. Can filter to business-only, personal-only, or all. Optionally GST-inclusive.',
    inputSchema: {
      startDate: z.string().describe('Report start date (YYYY-MM-DD)'),
      endDate: z.string().describe('Report end date (YYYY-MM-DD)'),
      businessOnly: z.boolean().optional().describe('Only include business transactions'),
      personalOnly: z.boolean().optional().describe('Only include personal transactions'),
      gstInclusive: z.boolean().optional().describe('Show GST-inclusive amounts (default: exclusive)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ startDate, endDate, ...options }) => {
    const data = await api.profitAndLoss(startDate, endDate, options);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'gst_summary',
  {
    title: 'GST Summary Report',
    description: 'Generate a GST (Goods & Services Tax) summary for a date range. Shows GST collected on sales and GST paid on purchases, broken down by category and payee. Australian 10% GST.',
    inputSchema: {
      startDate: z.string().describe('Report start date (YYYY-MM-DD)'),
      endDate: z.string().describe('Report end date (YYYY-MM-DD)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ startDate, endDate }) => {
    const data = await api.gstSummary(startDate, endDate);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'bas_draft',
  {
    title: 'BAS Draft Report',
    description: 'Generate a Business Activity Statement (BAS) draft for a period. Returns ATO fields: G1 (total sales), G2 (export sales), G3 (GST-free sales), G10 (capital purchases), G11 (non-capital purchases), 1A (GST on sales), 1B (GST on purchases). Used for quarterly ATO lodgement.',
    inputSchema: {
      startDate: z.string().describe('BAS period start date (YYYY-MM-DD)'),
      endDate: z.string().describe('BAS period end date (YYYY-MM-DD)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ startDate, endDate }) => {
    const data = await api.basDraft(startDate, endDate);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'spending_analysis',
  {
    title: 'Spending Analysis Report',
    description: 'Analyze spending patterns by category, payee, or both over time. Supports weekly or monthly granularity. Returns time-series data, totals by category, totals by payee, and summary statistics.',
    inputSchema: {
      startDate: z.string().describe('Analysis start date (YYYY-MM-DD)'),
      endDate: z.string().describe('Analysis end date (YYYY-MM-DD)'),
      groupBy: z.string().optional().describe('Group by: "category", "payee", or "both" (default: "both")'),
      granularity: z.string().optional().describe('Time granularity: "weekly" or "monthly" (default: "monthly")'),
      categoryIds: z.array(z.string()).optional().describe('Filter to specific category UUIDs'),
      payees: z.array(z.string()).optional().describe('Filter to specific payee names'),
      businessOnly: z.boolean().optional().describe('Only business spending'),
      includeIncome: z.boolean().optional().describe('Include income (default: expenses only)'),
    },
    annotations: { readOnlyHint: true },
  },
  async (params) => {
    const data = await api.spendingAnalysis(params);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'balance_sheet',
  {
    title: 'Balance Sheet Report',
    description: 'Generate a balance sheet as of a specific date. Shows total assets, liabilities, and equity.',
    inputSchema: {
      asOfDate: z.string().describe('Balance sheet date (YYYY-MM-DD)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ asOfDate }) => {
    const data = await api.balanceSheet(asOfDate);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'tax_estimation',
  {
    title: 'Tax Estimation',
    description: 'Estimate Australian income tax for a period. Calculates taxable income, tax brackets, Medicare Levy, Low Income Tax Offset (LITO), and Small Business Offset. Shows PAYG installment context if configured.',
    inputSchema: {
      startDate: z.string().describe('Tax period start date (YYYY-MM-DD)'),
      endDate: z.string().describe('Tax period end date (YYYY-MM-DD)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ startDate, endDate }) => {
    const data = await api.taxEstimation(startDate, endDate);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Rule Tools ──

server.registerTool(
  'list_rules',
  {
    title: 'List Memorized Rules',
    description: 'List all memorized rules used for auto-categorizing transactions. Rules match on payee name (exact, contains, or regex) and assign a default category.',
    annotations: { readOnlyHint: true },
  },
  async () => {
    const data = await api.listRules();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'create_rule',
  {
    title: 'Create Memorized Rule',
    description: 'Create a memorized rule for auto-categorizing transactions. When a transaction payee matches the pattern, the rule assigns the specified category. Match types: EXACT (exact payee match), CONTAINS (substring match), REGEX (regular expression).',
    inputSchema: {
      name: z.string().describe('Rule name for display'),
      matchType: z.string().describe('Match type: EXACT, CONTAINS, or REGEX'),
      matchValue: z.string().describe('The pattern to match against payee names'),
      defaultPayee: z.string().optional().describe('Override the payee name when rule matches'),
      defaultAccountId: z.string().optional().describe('Default category UUID to assign'),
      applyOnImport: z.boolean().optional().describe('Apply this rule during CSV imports (default: true)'),
      applyOnManualEntry: z.boolean().optional().describe('Apply during manual entry (default: false)'),
    },
    annotations: { readOnlyHint: false },
  },
  async (data) => {
    const result = await api.createRule(data);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);


// ── Import Tools ──

server.registerTool(
  'get_import_mappings',
  {
    title: 'Get Saved Import Mappings',
    description: 'Get saved CSV column mapping templates. These define how CSV columns map to transaction fields (date, payee, amount, etc.). Optionally filter by account ID to get mappings saved for a specific bank account.',
    inputSchema: {
      accountId: z.string().optional().describe('Filter mappings for a specific account UUID'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ accountId }) => {
    const data = await api.getImportMappings(accountId);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'import_preview',
  {
    title: 'Preview CSV Import',
    description: `Parse a bank CSV file and preview what will be imported. Returns parsed transactions with duplicate detection and rule-matched categories.

COLUMN MAPPING: The mapping object tells the importer which CSV column index (0-based) maps to which field:
- date: column index for transaction date
- payee: column index for payee/description
- description: alternative to payee (used as fallback)
- amount: column index for single amount column (negative = debit, positive = credit)
- debit: column index for separate debit column (use instead of amount)
- credit: column index for separate credit column (use instead of amount)
- reference: column index for bank reference/transaction ID
- balance: column index for running balance (informational only)
- memo: column index for memo/notes

TIPS FOR DETECTING COLUMNS:
- Look at the CSV headers and first few rows to determine which columns contain dates, amounts, descriptions
- Australian banks commonly use dd/MM/yyyy date format
- Some banks use separate debit/credit columns; others use a single amount column
- If you have a saved mapping for this account (from get_import_mappings), use that

Call list_accounts first to get the sourceAccountId for the bank account being imported into.`,
    inputSchema: {
      csvText: z.string().describe('The full CSV file content as a string'),
      sourceAccountId: z.string().describe('UUID of the bank account to import into'),
      mapping: z.object({
        date: z.number().int().min(0).optional().describe('Column index for date'),
        payee: z.number().int().min(0).optional().describe('Column index for payee/description'),
        description: z.number().int().min(0).optional().describe('Column index for description (fallback for payee)'),
        amount: z.number().int().min(0).optional().describe('Column index for amount (single column)'),
        debit: z.number().int().min(0).optional().describe('Column index for debit amount'),
        credit: z.number().int().min(0).optional().describe('Column index for credit amount'),
        reference: z.number().int().min(0).optional().describe('Column index for reference/transaction ID'),
        balance: z.number().int().min(0).optional().describe('Column index for running balance'),
        memo: z.number().int().min(0).optional().describe('Column index for memo/notes'),
      }).describe('Maps CSV column indexes to transaction fields'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ csvText, sourceAccountId, mapping }) => {
    const data = await api.importPreview(csvText, mapping, sourceAccountId);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'import_execute',
  {
    title: 'Execute CSV Import',
    description: `Execute the import after previewing. Takes the preview results (from import_preview) and creates the transactions in the ledger.

IMPORTANT: Always call import_preview first, review the results with the user, then call this to actually import.

Options:
- skipDuplicates: Skip transactions flagged as duplicates (recommended: true)
- applyRules: Apply memorized rules for auto-categorization (recommended: true)

The previews array should be passed through from import_preview. You can modify selectedCategoryId on individual previews if the user wants to override categories before importing.`,
    inputSchema: {
      previews: z.array(z.any()).describe('The preview array returned from import_preview (pass through, or modify selectedCategoryId on items)'),
      sourceAccountId: z.string().describe('UUID of the bank account being imported into'),
      sourceName: z.string().describe('Human-readable name for this import (e.g. "CBA March 2026 statement")'),
      mapping: z.object({
        date: z.number().int().min(0).optional(),
        payee: z.number().int().min(0).optional(),
        description: z.number().int().min(0).optional(),
        amount: z.number().int().min(0).optional(),
        debit: z.number().int().min(0).optional(),
        credit: z.number().int().min(0).optional(),
        reference: z.number().int().min(0).optional(),
        balance: z.number().int().min(0).optional(),
        memo: z.number().int().min(0).optional(),
      }).describe('Same column mapping used in import_preview'),
      skipDuplicates: z.boolean().optional().describe('Skip duplicate transactions (default: true)'),
      applyRules: z.boolean().optional().describe('Apply memorized rules for auto-categorization (default: true)'),
    },
    annotations: { readOnlyHint: false },
  },
  async ({ previews, sourceAccountId, sourceName, mapping, skipDuplicates, applyRules }) => {
    const options = {
      skipDuplicates: skipDuplicates ?? true,
      applyRules: applyRules ?? true,
    };
    const result = await api.importExecute(previews, sourceAccountId, sourceName, mapping, options);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);


// ── Reconciliation Tools ──

server.registerTool(
  'parse_bank_pdf',
  {
    title: 'Parse Bank Statement PDF',
    description: `Read a bank statement PDF file from disk and extract transactions, account info, and balances. Supports CommBank credit card, CommBank savings, and generic bank statement formats.

Returns:
- info: account number, name, statement period, opening/closing balance
- transactions: date, description, debit, credit, balance for each line
- confidence: high/medium/low (how well the parser understood the format)

Use this as the first step before starting reconciliation. The parsed statement data feeds into start_reconciliation and match_reconciliation.`,
    inputSchema: {
      filePath: z.string().describe('Absolute path to the PDF file on disk'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ filePath }) => {
    const buffer = readFileSync(filePath);
    const filename = basename(filePath);
    const data = await api.parsePdf(buffer, filename);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'start_reconciliation',
  {
    title: 'Start Reconciliation Session',
    description: `Create a new reconciliation session for a bank account. Use the statement period and balances from parse_bank_pdf.

A reconciliation session tracks which ledger transactions have been matched against the bank statement. Once all transactions are matched and the balance difference is zero, the session can be locked (finalized).`,
    inputSchema: {
      accountId: z.string().describe('UUID of the bank account to reconcile'),
      statementStartDate: z.string().describe('Statement period start date (YYYY-MM-DD)'),
      statementEndDate: z.string().describe('Statement period end date (YYYY-MM-DD)'),
      statementStartBalance: z.number().describe('Opening balance on the statement'),
      statementEndBalance: z.number().describe('Closing balance on the statement'),
      notes: z.string().optional().describe('Optional notes (e.g. "March 2026 statement")'),
    },
    annotations: { readOnlyHint: false },
  },
  async (data) => {
    const result = await api.startReconciliation(data);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'match_reconciliation',
  {
    title: 'Match Statement to Ledger',
    description: `Match parsed bank statement transactions against ledger transactions for a reconciliation session. Uses fuzzy matching with date tolerance (±3 days), exact amount matching, and description similarity.

Returns matches in confidence tiers:
- exactMatches (score 80+): High confidence, safe to auto-reconcile
- probableMatches (60-79): Likely correct, worth reviewing
- possibleMatches (40-59): May need manual verification
- unmatchedStatement: Statement lines with no ledger match (may need to be entered)
- unmatchedLedger: Ledger transactions not on the statement

Pass the transactions array from parse_bank_pdf as statementTransactions.`,
    inputSchema: {
      reconciliationId: z.string().describe('UUID of the reconciliation session'),
      statementTransactions: z.array(z.object({
        date: z.string().describe('Transaction date (ISO string)'),
        description: z.string().describe('Transaction description from statement'),
        debit: z.number().optional().describe('Debit/outflow amount'),
        credit: z.number().optional().describe('Credit/inflow amount'),
        balance: z.number().optional().describe('Running balance'),
      })).describe('Parsed transactions from parse_bank_pdf'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ reconciliationId, statementTransactions }) => {
    const data = await api.matchTransactions(reconciliationId, statementTransactions);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'reconcile_postings',
  {
    title: 'Reconcile Matched Postings',
    description: `Mark ledger postings as reconciled (matched to the bank statement). Pass the posting IDs from the matched transactions returned by match_reconciliation.

Each matched transaction has a ledgerTx with postings — use the posting ID for the account being reconciled.

Typically you would:
1. Auto-reconcile all exactMatches posting IDs
2. Review probableMatches with the user, then reconcile confirmed ones
3. Ask about possibleMatches
4. Check status with get_reconciliation_status`,
    inputSchema: {
      reconciliationId: z.string().describe('UUID of the reconciliation session'),
      postingIds: z.array(z.string()).describe('Array of posting UUIDs to mark as reconciled'),
    },
    annotations: { readOnlyHint: false },
  },
  async ({ reconciliationId, postingIds }) => {
    await api.reconcilePostings(reconciliationId, postingIds);
    return { content: [{ type: 'text', text: 'Postings reconciled successfully.' }] };
  }
);

server.registerTool(
  'unreconcile_postings',
  {
    title: 'Unreconcile Postings',
    description: 'Undo reconciliation on specific postings if a mistake was made.',
    inputSchema: {
      reconciliationId: z.string().describe('UUID of the reconciliation session'),
      postingIds: z.array(z.string()).describe('Array of posting UUIDs to unreconcile'),
    },
    annotations: { readOnlyHint: false },
  },
  async ({ reconciliationId, postingIds }) => {
    await api.unreconcilePostings(reconciliationId, postingIds);
    return { content: [{ type: 'text', text: 'Postings unreconciled successfully.' }] };
  }
);

server.registerTool(
  'get_reconciliation_status',
  {
    title: 'Get Reconciliation Status',
    description: `Check the current status of a reconciliation session. Shows:
- clearedBalance: opening balance + reconciled amounts
- statementBalance: closing balance from the statement
- difference: how far off the reconciliation is (0 = balanced)
- isBalanced: true when difference is zero (ready to lock)
- reconciledCount / unreconciledCount: progress tracking`,
    inputSchema: {
      reconciliationId: z.string().describe('UUID of the reconciliation session'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ reconciliationId }) => {
    const data = await api.getReconciliationStatus(reconciliationId);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'lock_reconciliation',
  {
    title: 'Finalize Reconciliation',
    description: 'Lock/finalize a reconciliation session. Only works when the session is balanced (difference = 0). Once locked, reconciled postings cannot be modified. Check get_reconciliation_status first to verify isBalanced is true.',
    inputSchema: {
      reconciliationId: z.string().describe('UUID of the reconciliation session'),
    },
    annotations: { readOnlyHint: false },
  },
  async ({ reconciliationId }) => {
    const result = await api.lockReconciliation(reconciliationId);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);


// ════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ════════════════════════════════════════════════════════════════════════════

server.registerResource(
  'accounts',
  'ledgerhound://accounts',
  {
    title: 'Accounts & Balances',
    description: 'All Ledgerhound accounts (bank accounts, credit cards, etc.) with their current balances.',
    mimeType: 'application/json',
  },
  async () => {
    const data = await api.listAccountsWithBalances();
    return { contents: [{ uri: 'ledgerhound://accounts', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerResource(
  'categories',
  'ledgerhound://categories',
  {
    title: 'Category Tree',
    description: 'Full category hierarchy used for classifying transactions (income categories, expense categories).',
    mimeType: 'application/json',
  },
  async () => {
    const data = await api.getCategoryTree();
    return { contents: [{ uri: 'ledgerhound://categories', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerResource(
  'rules',
  'ledgerhound://rules',
  {
    title: 'Memorized Rules',
    description: 'All memorized rules for automatic transaction categorization.',
    mimeType: 'application/json',
  },
  async () => {
    const data = await api.listRules();
    return { contents: [{ uri: 'ledgerhound://rules', text: JSON.stringify(data, null, 2) }] };
  }
);

// Dynamic resource: individual account register
server.registerResource(
  'account-register',
  new ResourceTemplate('ledgerhound://accounts/{accountId}/register', {
    list: async () => {
      const accounts = await api.listAccountsWithBalances() as Array<{ id: string; name: string }>;
      return {
        resources: accounts.map((a) => ({
          uri: `ledgerhound://accounts/${a.id}/register`,
          name: `${a.name} Register`,
        })),
      };
    },
  }),
  {
    title: 'Account Register',
    description: 'Transaction register for a specific account.',
    mimeType: 'application/json',
  },
  async (uri, { accountId }) => {
    const data = await api.getRegister(accountId as string);
    return { contents: [{ uri: uri.href, text: JSON.stringify(data, null, 2) }] };
  }
);


// ════════════════════════════════════════════════════════════════════════════
// PROMPTS
// ════════════════════════════════════════════════════════════════════════════

server.registerPrompt(
  'monthly-summary',
  {
    title: 'Monthly Financial Summary',
    description: 'Generate a comprehensive monthly financial summary including account balances, income/expenses, and spending highlights.',
    argsSchema: {
      month: z.string().describe('Month number (1-12)'),
      year: z.string().describe('Year (YYYY)'),
    },
  },
  ({ month, year }) => {
    const m = month.padStart(2, '0');
    const startDate = `${year}-${m}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;

    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Please generate a comprehensive monthly financial summary for ${year}-${m}. Use the following tools:

1. Call list_accounts to get all account balances
2. Call profit_and_loss with startDate="${startDate}" and endDate="${endDate}"
3. Call spending_analysis with startDate="${startDate}" and endDate="${endDate}" and groupBy="both"
4. Call get_uncategorized_summary to check for any uncategorized transactions

Then compile a clear summary covering:
- Total balances across all accounts
- Total income and expenses for the month
- Net profit/loss
- Top spending categories
- Top payees by spend
- Any uncategorized transactions that need attention
- Notable changes or observations

Format it as a clean, readable report with sections and totals in AUD.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'prepare-bas',
  {
    title: 'Prepare BAS',
    description: 'Help prepare a Business Activity Statement (BAS) for a quarter. Walks through GST calculations and ATO field values.',
    argsSchema: {
      quarter: z.string().describe('Quarter: Q1 (Jul-Sep), Q2 (Oct-Dec), Q3 (Jan-Mar), Q4 (Apr-Jun)'),
      financialYear: z.string().describe('Financial year (e.g. "2025-26")'),
    },
  },
  ({ quarter, financialYear }) => {
    const [startYearStr] = financialYear.split('-');
    const startYear = parseInt(startYearStr);
    const endYear = startYear + 1;

    const quarters: Record<string, { start: string; end: string }> = {
      Q1: { start: `${startYear}-07-01`, end: `${startYear}-09-30` },
      Q2: { start: `${startYear}-10-01`, end: `${startYear}-12-31` },
      Q3: { start: `${endYear}-01-01`, end: `${endYear}-03-31` },
      Q4: { start: `${endYear}-04-01`, end: `${endYear}-06-30` },
    };

    const q = quarters[quarter] || quarters.Q1;

    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Please help me prepare my BAS (Business Activity Statement) for ${quarter} of FY${financialYear}. Use the following tools:

1. Call bas_draft with startDate="${q.start}" and endDate="${q.end}"
2. Call gst_summary with the same date range
3. Call profit_and_loss with startDate="${q.start}", endDate="${q.end}", and businessOnly=true

Then provide:
- A clear breakdown of each BAS field (G1, G2, G3, G10, G11, 1A, 1B)
- Net GST position (1A - 1B = amount owed to / refund from ATO)
- Business income and expense summary for the quarter
- Any concerns or items to double-check before lodging
- Reminder of ATO lodgement deadline

Format amounts in AUD. Flag any unusual items that might need review.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'categorize-transactions',
  {
    title: 'Categorize Uncategorized Transactions',
    description: 'Review and help categorize all uncategorized transactions, suggesting appropriate categories based on payee names.',
  },
  () => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Please help me categorize my uncategorized transactions. Follow these steps:

1. Call get_uncategorized_summary to see all uncategorized transactions grouped by payee
2. Call list_categories to get the available categories
3. For each payee group, suggest an appropriate category based on the payee name
4. Present your suggestions as a table: Payee | Suggested Category | # Transactions | Total Amount
5. Ask me to confirm or adjust the suggestions
6. Once confirmed, use bulk_categorize to apply the categorizations (with createRule=true so they auto-categorize in future)

Be smart about matching payees to categories — e.g. "WOOLWORTHS" → Groceries, "SHELL" → Fuel, "NETFLIX" → Entertainment, etc. If unsure about a payee, ask me.`,
        },
      },
    ],
  })
);


server.registerPrompt(
  'import-bank-csv',
  {
    title: 'Import Bank CSV',
    description: 'Import a CSV file from a bank into the ledger. Guides through column mapping, preview, and execution.',
    argsSchema: {
      csvContent: z.string().describe('The full CSV file content'),
      accountName: z.string().optional().describe('The bank account name to import into (e.g. "CBA Smart Access")'),
    },
  },
  ({ csvContent, accountName }) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Please import this bank CSV into my ledger. ${accountName ? `The bank account is "${accountName}".` : 'You\'ll need to ask me which account to import into.'}

Here is the CSV content:
\`\`\`
${csvContent}
\`\`\`

Follow these steps:

1. Call list_accounts to find the target account ID${accountName ? ` (look for "${accountName}")` : ''}
2. Call get_import_mappings with the account ID to check for a saved column mapping
3. Look at the CSV headers and first few data rows. Determine the column mapping:
   - Which column has the date? (look for dates in dd/MM/yyyy or similar format)
   - Which column has the payee/description?
   - Is there a single amount column, or separate debit/credit columns?
   - Is there a reference/transaction ID column?
   - Column indexes are 0-based
4. If a saved mapping exists for this account, use it. Otherwise, show me the headers with index numbers and your proposed mapping for confirmation.
5. Call import_preview with the CSV content, account ID, and mapping
6. Summarize the preview results:
   - Total transactions found
   - How many are duplicates
   - How many matched memorized rules (already categorized)
   - How many are uncategorized
   - Show a sample of the first few parsed transactions to verify correctness
7. Ask me to confirm before proceeding
8. Call import_execute with skipDuplicates=true and applyRules=true
9. Report the final result: how many imported, how many skipped

If any transactions are uncategorized after import, offer to help categorize them using get_uncategorized_summary and bulk_categorize.`,
        },
      },
    ],
  })
);


server.registerPrompt(
  'reconcile-bank-statements',
  {
    title: 'Reconcile Bank Statement PDFs',
    description: 'Process one or more bank statement PDFs and reconcile them against the ledger.',
    argsSchema: {
      filePaths: z.string().describe('Comma-separated absolute file paths to bank statement PDFs'),
      accountName: z.string().optional().describe('The bank account name (e.g. "CBA Smart Access"). If omitted, will try to detect from the PDF.'),
    },
  },
  ({ filePaths, accountName }) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Please reconcile my bank statement PDFs against the ledger. ${accountName ? `The bank account is "${accountName}".` : ''}

PDF files to process:
${filePaths.split(',').map(p => `- ${p.trim()}`).join('\n')}

For each PDF, follow these steps:

1. **Parse the PDF**: Call parse_bank_pdf with the file path. Review the confidence level and extracted info.

2. **Identify the account**: Call list_accounts to find the matching account.${accountName ? ` Look for "${accountName}".` : ' Use the account number/name from the PDF to match.'}

3. **Start reconciliation**: Call start_reconciliation with the account ID and the statement period/balances from the parsed PDF info.

4. **Match transactions**: Call match_statement_transactions with the reconciliation ID and the parsed transactions.

5. **Review matches**: Present a summary:
   - How many exact matches (auto-reconcile these)
   - How many probable matches (review with me)
   - How many possible matches (ask me about each)
   - How many unmatched on statement (may need to be entered as new transactions)
   - How many unmatched in ledger (may be errors or belong to a different period)

6. **Reconcile exact matches**: Call reconcile_postings with the posting IDs from all exact matches.

7. **Review probable/possible matches**: Show me each probable and possible match with the statement description vs ledger payee/amount so I can confirm or reject them. Reconcile the ones I confirm.

8. **Handle unmatched statement items**: For any statement transactions with no match:
   - Ask if I want to create them as new transactions (use create_transaction)
   - Or skip them

9. **Check status**: Call get_reconciliation_status to see if we balance.
   - If balanced (difference === 0): call lock_reconciliation to finalize
   - If not balanced: show the difference and help investigate

10. **Report**: Summarize what was done — transactions reconciled, new transactions created, final balance status.

If there are multiple PDFs, process them one at a time in chronological order. Each statement gets its own reconciliation session.`,
        },
      },
    ],
  })
);


// ════════════════════════════════════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now listening on stdio — Claude Desktop/Cowork will communicate via stdin/stdout.
}

main().catch((err) => {
  console.error('Failed to start Ledgerhound MCP server:', err);
  process.exit(1);
});
