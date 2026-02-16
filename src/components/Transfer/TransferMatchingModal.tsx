/**
 * Transfer Matching Modal
 * 3-step wizard to find and merge duplicate transfers across two accounts.
 * Step 1: Select two accounts + optional date range
 * Step 2: Preview matched pairs with checkboxes
 * Step 3: Results summary
 */

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowLeftRight,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Check,
  Minus,
} from 'lucide-react';
import { accountAPI, transferMatchingAPI } from '../../lib/api';
import type { AccountWithBalance } from '../../types';

type Step = 'select' | 'preview' | 'results';

interface TransferMatchingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void | Promise<void>;
}

interface MatchPair {
  candidateA: {
    transaction: { id: string; date: string; payee: string };
    amount: number;
    date: string;
    payee: string;
    isReconciled: boolean;
    realAccountPosting: { account: { name: string } };
  };
  candidateB: {
    transaction: { id: string; date: string; payee: string };
    amount: number;
    date: string;
    payee: string;
    isReconciled: boolean;
    realAccountPosting: { account: { name: string } };
  };
  matchScore: number;
  matchType: 'exact' | 'probable' | 'possible';
  reasons: string[];
}

interface MatchPreview {
  matches: MatchPair[];
  unmatchedA: any[];
  unmatchedB: any[];
  summary: {
    totalCandidatesA: number;
    totalCandidatesB: number;
    exactMatches: number;
    probableMatches: number;
    possibleMatches: number;
    unmatched: number;
  };
}

interface CommitResult {
  merged: number;
  skipped: number;
  errors: string[];
}

export function TransferMatchingModal({
  isOpen,
  onClose,
  onComplete,
}: TransferMatchingModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [accountIdA, setAccountIdA] = useState('');
  const [accountIdB, setAccountIdB] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Preview state
  const [preview, setPreview] = useState<MatchPreview | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(new Set());

  // Results state
  const [result, setResult] = useState<CommitResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      // Reset state
      setStep('select');
      setAccountIdA('');
      setAccountIdB('');
      setStartDate('');
      setEndDate('');
      setPreview(null);
      setSelectedPairs(new Set());
      setResult(null);
      setError('');
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const data = await accountAPI.getAllAccountsWithBalances({ kind: 'TRANSFER' as any });
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handleFindMatches = async () => {
    if (!accountIdA || !accountIdB) {
      setError('Please select two accounts');
      return;
    }
    if (accountIdA === accountIdB) {
      setError('Please select two different accounts');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await transferMatchingAPI.previewMatches(
        accountIdA,
        accountIdB,
        startDate || undefined,
        endDate || undefined,
      );
      setPreview(data);
      // Auto-select all exact and probable matches
      const autoSelected = new Set<number>();
      data.matches.forEach((m: MatchPair, i: number) => {
        if (m.matchType === 'exact' || m.matchType === 'probable') {
          autoSelected.add(i);
        }
      });
      setSelectedPairs(autoSelected);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find matches');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview || selectedPairs.size === 0) return;

    setLoading(true);
    setError('');

    try {
      const pairs = Array.from(selectedPairs).map((i) => ({
        candidateAId: preview.matches[i].candidateA.transaction.id,
        candidateBId: preview.matches[i].candidateB.transaction.id,
      }));
      const data = await transferMatchingAPI.commitMatches(pairs);
      setResult(data);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit matches');
    } finally {
      setLoading(false);
    }
  };

  const togglePair = (index: number) => {
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!preview) return;
    if (selectedPairs.size === preview.matches.length) {
      setSelectedPairs(new Set());
    } else {
      setSelectedPairs(new Set(preview.matches.map((_, i) => i)));
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const getMatchBadgeColor = (type: string) => {
    switch (type) {
      case 'exact':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'probable':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'possible':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const accountNameA = accounts.find((a) => a.id === accountIdA)?.name || 'Account A';
  const accountNameB = accounts.find((a) => a.id === accountIdB)?.name || 'Account B';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 w-[900px] max-h-[85vh] flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                  Match Transfers
                </Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400">
                  {step === 'select' && 'Select two accounts to find matching transfers'}
                  {step === 'preview' && 'Review matched transfer pairs'}
                  {step === 'results' && 'Transfer matching complete'}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </Dialog.Close>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50">
            {(['select', 'preview', 'results'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
                <div
                  className={`flex items-center gap-1.5 text-sm font-medium ${
                    step === s
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : (['select', 'preview', 'results'].indexOf(step) > i)
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s
                      ? 'bg-indigo-100 dark:bg-indigo-900/30'
                      : (['select', 'preview', 'results'].indexOf(step) > i)
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-slate-100 dark:bg-slate-700'
                  }`}>
                    {(['select', 'preview', 'results'].indexOf(step) > i) ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {s === 'select' ? 'Select Accounts' : s === 'preview' ? 'Preview Matches' : 'Results'}
                </div>
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Step 1: Select Accounts */}
            {step === 'select' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Account A
                    </label>
                    <select
                      value={accountIdA}
                      onChange={(e) => setAccountIdA(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select account...</option>
                      {accounts
                        .filter((a) => a.id !== accountIdB)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Account B
                    </label>
                    <select
                      value={accountIdB}
                      onChange={(e) => setAccountIdB(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select account...</option>
                      {accounts
                        .filter((a) => a.id !== accountIdA)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Start Date (optional)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      End Date (optional)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
                  <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">How it works</p>
                  <p>
                    This tool finds transactions that appear as transfers in both accounts (e.g. an
                    outgoing transfer in Account A matching an incoming transfer in Account B).
                    Matched pairs are merged into a single double-entry transaction, eliminating
                    duplicates.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Preview Matches */}
            {step === 'preview' && preview && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {preview.summary.totalCandidatesA}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Candidates A</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {preview.summary.totalCandidatesB}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Candidates B</div>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                      {preview.summary.exactMatches}
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-500">Exact</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                      {preview.summary.probableMatches}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-500">Probable</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                      {preview.summary.possibleMatches}
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-500">Possible</div>
                  </div>
                </div>

                {/* Match table */}
                {preview.matches.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-700/50 text-left">
                          <th className="px-3 py-2 w-8">
                            <button
                              onClick={toggleAll}
                              className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600"
                            >
                              {selectedPairs.size === preview.matches.length ? (
                                <Check className="w-3.5 h-3.5 text-indigo-600" />
                              ) : selectedPairs.size > 0 ? (
                                <Minus className="w-3.5 h-3.5 text-indigo-600" />
                              ) : null}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">
                            Match
                          </th>
                          <th className="px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">
                            {accountNameA}
                          </th>
                          <th className="px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">
                            {accountNameB}
                          </th>
                          <th className="px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">
                            Amount
                          </th>
                          <th className="px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {preview.matches.map((match, i) => (
                          <tr
                            key={i}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer ${
                              selectedPairs.has(i)
                                ? 'bg-indigo-50/50 dark:bg-indigo-900/10'
                                : ''
                            }`}
                            onClick={() => togglePair(i)}
                          >
                            <td className="px-3 py-2.5">
                              <div
                                className={`w-5 h-5 rounded border flex items-center justify-center ${
                                  selectedPairs.has(i)
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {selectedPairs.has(i) && (
                                  <Check className="w-3.5 h-3.5 text-white" />
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getMatchBadgeColor(
                                  match.matchType,
                                )}`}
                              >
                                {match.matchType}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="text-slate-900 dark:text-white font-medium truncate max-w-[180px]">
                                {match.candidateA.payee}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {formatDate(match.candidateA.date)}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="text-slate-900 dark:text-white font-medium truncate max-w-[180px]">
                                {match.candidateB.payee}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {formatDate(match.candidateB.date)}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">
                              <div className="text-slate-900 dark:text-white">
                                {formatCurrency(Math.abs(match.candidateA.amount))}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {match.candidateA.amount > 0 ? 'IN' : 'OUT'} / {match.candidateB.amount > 0 ? 'IN' : 'OUT'}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="text-slate-900 dark:text-white font-mono text-xs">
                                {match.matchScore}/100
                              </div>
                              <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                {match.reasons.slice(0, 2).join(', ')}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No matches found</p>
                    <p className="text-sm mt-1">
                      No matching transfer transactions were found between these accounts.
                    </p>
                  </div>
                )}

                {/* Unmatched info */}
                {(preview.unmatchedA.length > 0 || preview.unmatchedB.length > 0) && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Unmatched: </span>
                    {preview.unmatchedA.length} from {accountNameA},{' '}
                    {preview.unmatchedB.length} from {accountNameB}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Results */}
            {step === 'results' && result && (
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Transfer Matching Complete
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                      {result.merged}
                    </div>
                    <div className="text-sm text-emerald-600 dark:text-emerald-500">Merged</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                      {result.skipped}
                    </div>
                    <div className="text-sm text-amber-600 dark:text-amber-500">Skipped</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                      {result.errors.length}
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-500">Errors</div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Errors:</p>
                    <ul className="text-sm text-red-600 dark:text-red-500 space-y-1">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div>
              {step === 'preview' && (
                <button
                  onClick={() => setStep('select')}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {step === 'results' ? (
                <button
                  onClick={() => {
                    if (onComplete) onComplete();
                    onClose();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Done
                </button>
              ) : step === 'select' ? (
                <button
                  onClick={handleFindMatches}
                  disabled={!accountIdA || !accountIdB || loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finding matches...
                    </>
                  ) : (
                    <>
                      Find Matches
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCommit}
                  disabled={selectedPairs.size === 0 || loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Merge {selectedPairs.size} Transfer{selectedPairs.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
