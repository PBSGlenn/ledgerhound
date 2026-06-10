/**
 * HTTP client for calling the Ledgerhound REST API.
 * The MCP server delegates all operations to the Express API at localhost:3001.
 */

const BASE_URL = process.env.LEDGERHOUND_API_URL || 'http://localhost:3001';

async function request(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.LEDGERHOUND_API_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'error' in data
      ? (data as { error: string }).error
      : `HTTP ${res.status}: ${text.slice(0, 200)}`;
    throw new Error(msg);
  }

  return data;
}

// ── Accounts ──

export async function listAccountsWithBalances() {
  return request('GET', '/api/accounts-with-balances');
}

export async function getAccountBalance(accountId: string) {
  return request('GET', `/api/accounts/${accountId}/balance`);
}

export async function getAccount(accountId: string) {
  return request('GET', `/api/accounts/${accountId}`);
}

// ── Categories ──

export async function getCategoryTree() {
  return request('GET', '/api/categories/tree');
}

export async function searchCategories(query: string) {
  return request('GET', '/api/categories/search', undefined, { q: query });
}

export async function listCategories() {
  return request('GET', '/api/categories');
}

export async function createCategory(data: {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  parentId?: string;
  isBusinessDefault?: boolean;
  defaultHasGst?: boolean;
}) {
  return request('POST', '/api/categories', data);
}

export async function updateCategory(
  categoryId: string,
  data: {
    name?: string;
    parentId?: string | null;
    isBusinessDefault?: boolean;
    defaultHasGst?: boolean;
    atoLabel?: string | null;
  }
) {
  return request('PUT', `/api/categories/${categoryId}`, data);
}

export async function deleteCategory(categoryId: string) {
  return request('DELETE', `/api/categories/${categoryId}`);
}

export async function mergeCategories(sourceId: string, targetId: string) {
  return request('POST', '/api/categories/merge', { sourceId, targetId });
}

// ── Transactions ──

export async function getRegister(accountId: string, filters?: {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  clearedOnly?: boolean;
  reconciledOnly?: boolean;
  businessOnly?: boolean;
  personalOnly?: boolean;
}) {
  const query: Record<string, string> = {};
  if (filters) {
    if (filters.dateFrom) query.dateFrom = filters.dateFrom;
    if (filters.dateTo) query.dateTo = filters.dateTo;
    if (filters.search) query.search = filters.search;
    if (filters.clearedOnly) query.clearedOnly = 'true';
    if (filters.reconciledOnly) query.reconciledOnly = 'true';
    if (filters.businessOnly) query.businessOnly = 'true';
    if (filters.personalOnly) query.personalOnly = 'true';
  }
  return request('GET', `/api/transactions/register/${accountId}`, undefined, query);
}

export async function searchTransactions(filters: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  categoryId?: string;
  businessOnly?: boolean;
  personalOnly?: boolean;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
}) {
  // The /search endpoint (searchTransactionsSchema + transactionService.searchTransactions)
  // uses a different vocabulary than the MCP tool. Map carefully — the server silently
  // strips unknown keys, so a mismatch here produces empty results with no error:
  //   - scope: a real account UUID to limit the search, or the literal 'global' for all
  //     accounts. NOTE: the service treats any scope !== 'global' as an accountId filter,
  //     so the old `scope: 'all'` matched no account and returned [] for every query.
  //   - payee: the free-text search term (MCP exposes it as `search`)
  //   - amountMin/amountMax: matched against the ABSOLUTE posting value (>= 0)
  //   - categoryId: filter to transactions with a sibling posting in this category
  const body: Record<string, unknown> = {
    scope: filters.accountId ?? 'global',
  };
  if (filters.search) body.payee = filters.search;
  if (filters.dateFrom) body.dateFrom = filters.dateFrom;
  if (filters.dateTo) body.dateTo = filters.dateTo;
  if (filters.categoryId) body.categoryId = filters.categoryId;
  if (filters.businessOnly) body.businessOnly = true;
  if (filters.personalOnly) body.personalOnly = true;
  if (filters.minAmount !== undefined) body.amountMin = Math.abs(filters.minAmount);
  if (filters.maxAmount !== undefined) body.amountMax = Math.abs(filters.maxAmount);
  if (filters.limit !== undefined) body.limit = filters.limit;
  return request('POST', '/api/transactions/search', body);
}

export async function createTransaction(data: {
  date: string;
  payee: string;
  memo?: string;
  reference?: string;
  tags?: string[];
  postings: Array<{
    accountId: string;
    amount: number;
    isBusiness?: boolean;
    gstCode?: string;
    gstRate?: number;
    gstAmount?: number;
  }>;
}) {
  return request('POST', '/api/transactions', data);
}

export async function getTransaction(id: string) {
  return request('GET', `/api/transactions/${id}`);
}

export async function categorizeTransaction(transactionId: string, newCategoryId: string, currentCategoryId?: string) {
  // The server infers the current category posting when oldAccountId is omitted (the
  // common single-category case). currentCategoryId disambiguates split transactions.
  const body: Record<string, unknown> = { newCategoryId };
  if (currentCategoryId) body.oldAccountId = currentCategoryId;
  return request('POST', `/api/transactions/${transactionId}/recategorize`, body);
}

export async function deleteTransaction(transactionId: string) {
  return request('DELETE', `/api/transactions/${transactionId}`);
}

export async function getUncategorizedSummary() {
  return request('GET', '/api/transactions/uncategorized-summary');
}

export async function bulkRecategorize(items: Array<{
  payee: string;
  categoryId: string;
  createRule?: boolean;
}>) {
  return request('POST', '/api/transactions/bulk-recategorize', { items });
}

// ── Reports ──

export async function profitAndLoss(startDate: string, endDate: string, options?: {
  businessOnly?: boolean;
  personalOnly?: boolean;
  gstInclusive?: boolean;
}) {
  const query: Record<string, string> = { startDate, endDate };
  if (options?.businessOnly) query.businessOnly = 'true';
  if (options?.personalOnly) query.personalOnly = 'true';
  if (options?.gstInclusive) query.gstInclusive = 'true';
  return request('GET', '/api/reports/profit-loss', undefined, query);
}

export async function gstSummary(startDate: string, endDate: string) {
  return request('GET', '/api/reports/gst-summary', undefined, { startDate, endDate });
}

export async function basDraft(startDate: string, endDate: string) {
  return request('GET', '/api/reports/bas-draft', undefined, { startDate, endDate });
}

export async function spendingAnalysis(params: {
  startDate: string;
  endDate: string;
  groupBy?: string;
  granularity?: string;
  categoryIds?: string[];
  payees?: string[];
  businessOnly?: boolean;
  includeIncome?: boolean;
}) {
  return request('POST', '/api/reports/spending-analysis', params);
}

export async function balanceSheet(asOfDate: string) {
  return request('GET', '/api/reports/balance-sheet', undefined, { asOfDate });
}

export async function taxEstimation(startDate: string, endDate: string) {
  return request('GET', '/api/tax/estimation', undefined, { startDate, endDate });
}

// ── Rules ──

export async function listRules() {
  return request('GET', '/api/rules');
}

export async function createRule(data: {
  name: string;
  matchType: string;
  matchValue: string;
  defaultPayee?: string;
  defaultAccountId?: string;
  applyOnImport?: boolean;
  applyOnManualEntry?: boolean;
}) {
  return request('POST', '/api/rules', data);
}

// ── Import ──

export async function getImportMappings(accountId?: string) {
  const query: Record<string, string> = {};
  if (accountId) query.accountId = accountId;
  return request('GET', '/api/import/mappings', undefined, query);
}

export async function importPreview(csvText: string, mapping: Record<string, unknown>, sourceAccountId: string) {
  return request('POST', '/api/import/preview', { csvText, mapping, sourceAccountId });
}

export async function importExecute(
  previews: unknown[],
  sourceAccountId: string,
  sourceName: string,
  mapping: Record<string, unknown>,
  options?: { skipDuplicates?: boolean; applyRules?: boolean }
) {
  return request('POST', '/api/import/execute', { previews, sourceAccountId, sourceName, mapping, options });
}

// ── Reconciliation ──

export async function parsePdf(pdfBuffer: Buffer, filename: string) {
  const formData = new FormData();
  formData.append('pdf', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), filename);

  const url = `${BASE_URL}/api/reconciliation/parse-pdf`;
  const headers: Record<string, string> = {};
  const apiKey = process.env.LEDGERHOUND_API_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const res = await fetch(url, { method: 'POST', headers, body: formData });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'error' in data
      ? (data as { error: string }).error
      : `HTTP ${res.status}: ${text.slice(0, 200)}`;
    throw new Error(msg);
  }
  return data;
}

export async function startReconciliation(data: {
  accountId: string;
  statementStartDate: string;
  statementEndDate: string;
  statementStartBalance: number;
  statementEndBalance: number;
  notes?: string;
}) {
  return request('POST', '/api/reconciliation/start', data);
}

export async function getReconciliationStatus(reconciliationId: string) {
  return request('GET', `/api/reconciliation/${reconciliationId}/status`);
}

export async function getReconciliation(reconciliationId: string) {
  return request('GET', `/api/reconciliation/${reconciliationId}`);
}

export async function getInProgressReconciliation(accountId: string) {
  return request('GET', `/api/reconciliation/in-progress/${accountId}`);
}

export async function matchTransactions(reconciliationId: string, statementTransactions: unknown[]) {
  return request('POST', `/api/reconciliation/${reconciliationId}/match-transactions`, { statementTransactions });
}

export async function reconcilePostings(reconciliationId: string, postingIds: string[]) {
  return request('POST', `/api/reconciliation/${reconciliationId}/reconcile-postings`, { postingIds });
}

export async function unreconcilePostings(reconciliationId: string, postingIds: string[]) {
  return request('POST', `/api/reconciliation/${reconciliationId}/unreconcile-postings`, { postingIds });
}

export async function lockReconciliation(reconciliationId: string) {
  return request('POST', `/api/reconciliation/${reconciliationId}/lock`);
}

// ── System ──

export async function checkApiHealth(): Promise<boolean> {
  try {
    await request('GET', '/api/system/version');
    return true;
  } catch {
    return false;
  }
}
