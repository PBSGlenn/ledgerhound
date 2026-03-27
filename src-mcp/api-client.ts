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
  tags?: string[];
  businessOnly?: boolean;
  personalOnly?: boolean;
  minAmount?: number;
  maxAmount?: number;
}) {
  return request('POST', '/api/transactions/search', filters);
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
    gstAmount?: number;
  }>;
}) {
  return request('POST', '/api/transactions', data);
}

export async function getTransaction(id: string) {
  return request('GET', `/api/transactions/${id}`);
}

export async function categorizeTransaction(transactionId: string, newCategoryId: string) {
  return request('POST', `/api/transactions/${transactionId}/recategorize`, { newCategoryId });
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
