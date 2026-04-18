import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Account, SplitRatio } from '../../types';

interface SplitBusinessPersonalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (ratio: SplitRatio) => void;
  totalAmount: number; // the absolute expense amount being split
  categories: Account[];
  initialRatio?: SplitRatio | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function SplitBusinessPersonalDialog({
  isOpen,
  onClose,
  onApply,
  totalAmount,
  categories,
  initialRatio,
}: SplitBusinessPersonalDialogProps) {
  const [businessPercent, setBusinessPercent] = useState<number>(25);
  const [personalCategoryId, setPersonalCategoryId] = useState<string>('');
  const [businessCategoryId, setBusinessCategoryId] = useState<string>('');
  const [gstOnBusiness, setGstOnBusiness] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;
    if (initialRatio) {
      setBusinessPercent(initialRatio.businessPercent);
      setPersonalCategoryId(initialRatio.personalCategoryId);
      setBusinessCategoryId(initialRatio.businessCategoryId);
      setGstOnBusiness(initialRatio.gstOnBusiness);
    } else {
      setBusinessPercent(25);
      setPersonalCategoryId('');
      setBusinessCategoryId('');
      setGstOnBusiness(true);
    }
  }, [isOpen, initialRatio]);

  const personalCategories = useMemo(
    () => categories.filter(c => !c.isBusinessDefault),
    [categories]
  );
  const businessCategories = useMemo(
    () => categories.filter(c => c.isBusinessDefault),
    [categories]
  );

  const absTotal = Math.abs(totalAmount);
  const businessGross = round2(absTotal * (businessPercent / 100));
  const personalGross = round2(absTotal - businessGross);
  const gstAmount = gstOnBusiness ? round2(businessGross / 11) : 0;
  const businessExGst = round2(businessGross - gstAmount);

  const canApply =
    personalCategoryId.length > 0 &&
    businessCategoryId.length > 0 &&
    businessPercent >= 0 &&
    businessPercent <= 100;

  const handleApply = () => {
    if (!canApply) return;
    onApply({
      kind: 'SPLIT_RATIO',
      personalCategoryId,
      businessCategoryId,
      businessPercent,
      gstOnBusiness,
    });
    onClose();
  };

  const renderCategoryOption = (cat: Account) => {
    const parent = categories.find(c => c.id === cat.parentId);
    const label = parent ? `${parent.name}: ${cat.name}` : cat.name;
    return (
      <option key={cat.id} value={cat.id}>
        {label}
      </option>
    );
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg z-[60]">
          <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Split Business / Personal
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Divide a mixed-use expense into separate personal and business postings.
          </Dialog.Description>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                Business use %
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={businessPercent}
                  onChange={(e) => setBusinessPercent(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={businessPercent}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) setBusinessPercent(Math.max(0, Math.min(100, v)));
                  }}
                  className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                Personal category
              </label>
              <select
                value={personalCategoryId}
                onChange={(e) => setPersonalCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
              >
                <option value="">Select personal category…</option>
                {personalCategories.map(renderCategoryOption)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                Business category
              </label>
              <select
                value={businessCategoryId}
                onChange={(e) => setBusinessCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
              >
                <option value="">Select business category…</option>
                {businessCategories.map(renderCategoryOption)}
              </select>
            </div>

            <label className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={gstOnBusiness}
                onChange={(e) => setGstOnBusiness(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Claim GST on the business portion (10% GST-inclusive)
              </span>
            </label>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm space-y-1">
              <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Preview</div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Personal ({(100 - businessPercent).toFixed(1)}%)</span>
                <span className="font-mono">${personalGross.toFixed(2)}</span>
              </div>
              {gstOnBusiness ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Business ex-GST</span>
                    <span className="font-mono">${businessExGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">GST credit</span>
                    <span className="font-mono">${gstAmount.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Business ({businessPercent.toFixed(1)}%)</span>
                  <span className="font-mono">${businessGross.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 mt-1 border-t border-slate-200 dark:border-slate-700 font-semibold">
                <span>Total</span>
                <span className="font-mono">${absTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              Apply split
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
