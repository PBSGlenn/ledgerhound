import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Account, CreateTransactionDTO, GSTCode, AccountType } from '../../types';
import { transactionAPI, accountAPI, memorizedRuleAPI } from '../../lib/api';
import { CategorySelector } from '../Category/CategorySelector';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string; // Pre-select account if opening from register
  transactionId?: string; // For editing existing transaction
  onSuccess?: () => void;
}

export function TransactionFormModal({
  isOpen,
  onClose,
  accountId,
  transactionId,
  onSuccess,
}: TransactionFormModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payee, setPayee] = useState('');
  const [originalPayee, setOriginalPayee] = useState(''); // Track original payee for rule suggestion
  const [showRuleSuggestion, setShowRuleSuggestion] = useState(false);
  const [suggestedRuleData, setSuggestedRuleData] = useState<{originalPayee: string; newPayee: string; matchValue: string} | null>(null);
  const [transactionType, setTransactionType] = useState<'expense' | 'transfer-out' | 'transfer-in'>('expense');
  const [totalAmount, setTotalAmount] = useState('');
  const [memo, setMemo] = useState('');
  
  type Split = {
    id: string;
    accountId: string;
    amount: string;
    isBusiness: boolean;
    gstCode?: GSTCode;
    isGstSplit?: boolean;        // True if this is an auto-generated GST Paid/Collected line
    parentSplitId?: string;      // Links to the parent split (for GST splits)
    originalAmount?: string;     // Original gross amount before GST splitting
    manuallyEdited?: boolean;    // True if user manually changed the GST amount
  };

  const [splits, setSplits] = useState<Split[]>([]);
  const [remainingAmount, setRemainingAmount] = useState(0);

  useEffect(() => {
    const total = parseFloat(totalAmount) || 0;
    const allocated = (splits || []).reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0);
    setRemainingAmount(total - allocated);
  }, [totalAmount, splits]);

  // Auto-sync split amount in transfer mode
  useEffect(() => {
    if (transactionType !== 'expense' && splits.length > 0) {
      const total = parseFloat(totalAmount) || 0;
      const amount = transactionType === 'transfer-out' ? -Math.abs(total) : Math.abs(total);

      // Update the first split to match the total amount with correct sign
      const newSplits = [...splits];
      newSplits[0] = {
        ...newSplits[0],
        amount: amount.toFixed(2),
        isBusiness: false, // Transfers don't have GST
      };
      setSplits(newSplits);
    }
  }, [transactionType, totalAmount]);
  const [loading, setLoading] = useState(false);
  const [loadingTransaction, setLoadingTransaction] = useState(false);
  const [categories, setCategories] = useState<Account[]>([]);
  const [transferAccounts, setTransferAccounts] = useState<Account[]>([]);
  const [gstPaidAccount, setGstPaidAccount] = useState<Account | null>(null);
  const [gstCollectedAccount, setGstCollectedAccount] = useState<Account | null>(null);
  const [accountName, setAccountName] = useState<string>('');

  useEffect(() => {
    loadCategories();
    if (accountId) {
      loadAccountName();
    }
  }, [accountId]);

  const loadAccountName = async () => {
    if (!accountId) return;
    try {
      const accounts = await accountAPI.getAllAccountsWithBalances();
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        setAccountName(account.name);
      }
    } catch (error) {
      console.error('Failed to load account name:', error);
    }
  };

  useEffect(() => {
    if (transactionId) {
      loadTransaction();
    } else {
      // Reset form for new transaction
      setDate(new Date().toISOString().split('T')[0]);
      setPayee('');
      setTransactionType('expense');
      setTotalAmount('');
      setSplits([{
        id: `temp-${Date.now()}`,
        accountId: '',
        amount: '',
        isBusiness: false,
      }]);
      setMemo('');
    }
  }, [transactionId]);

  const loadTransaction = async () => {
    if (!transactionId) return;

    setLoadingTransaction(true);
    try {
      const transaction = await transactionAPI.getTransaction(transactionId);

      // Populate form from transaction data
      setDate(new Date(transaction.date).toISOString().split('T')[0]);
      const originalPayeeName = transaction.payee || '';
      console.log('Loading transaction - original payee:', originalPayeeName);
      setPayee(originalPayeeName);
      setOriginalPayee(originalPayeeName); // Store original for comparison
      setMemo(transaction.memo || '');

      const categoryPostings = transaction.postings.filter(p => p.accountId !== accountId);

      // For Stripe transactions, use the gross amount from metadata (what customer paid)
      // Otherwise, use the amount from the account posting
      // Preserve sign: positive = money in (credit for income), negative = money out (debit for expense)
      let total = transaction.postings.find(p => p.accountId === accountId)?.amount || 0;
      if (transaction.metadata) {
        try {
          const metadata = JSON.parse(transaction.metadata);
          if (metadata.stripeType && metadata.grossAmount) {
            total = metadata.grossAmount;
          }
        } catch (e) {
          // Ignore JSON parse errors, use standard total
        }
      }
      setTotalAmount(total.toFixed(2));

      // Find GST accounts directly (in case state hasn't been set yet)
      const allAccounts = await accountAPI.getAllAccountsWithBalances({ kind: 'CATEGORY' });
      const localGstPaid = allAccounts.find(acc => acc.name === 'GST Paid' && acc.type === 'ASSET');
      const localGstCollected = allAccounts.find(acc => acc.name === 'GST Collected' && acc.type === 'LIABILITY');

      // Identify GST postings (GST Paid or GST Collected)
      const gstPostingIds = [localGstPaid?.id, localGstCollected?.id].filter(Boolean) as string[];
      const gstPostings = categoryPostings.filter(p => gstPostingIds.includes(p.accountId));
      const nonGstPostings = categoryPostings.filter(p => !gstPostingIds.includes(p.accountId));

      // Build splits array with GST relationships
      const loadedSplits: Split[] = [];

      for (const posting of nonGstPostings) {
        const postingAmount = posting.amount; // From database (negated when saved)

        // Check if this posting has an associated GST posting
        // GST postings are usually created right after the main posting
        const associatedGst = gstPostings.find(gp => {
          // Match by similar timing and amount relationship
          // GST should be roughly 1/11 of the gross amount
          const gstAmount = gp.amount; // From database (negated when saved)
          const expectedGross = Math.abs(postingAmount) + Math.abs(gstAmount);
          const calculatedGst = expectedGross * 0.1 / 1.1;
          return Math.abs(Math.abs(calculatedGst) - Math.abs(gstAmount)) < 0.02; // Within 2 cents
        });

        if (associatedGst) {
          // This posting has GST - mark it as business and store original gross amount
          const gstAmount = associatedGst.amount; // From database (negated when saved)
          // Negate back to show user what they originally entered
          loadedSplits.push({
            id: posting.id,
            accountId: posting.accountId,
            amount: (-postingAmount).toFixed(2), // Negate back for display
            isBusiness: true,
            gstCode: posting.gstCode || undefined,
            originalAmount: (-(postingAmount + gstAmount)).toFixed(2), // Negate back for display
          });

          // Add the GST split (negate back for display)
          loadedSplits.push({
            id: associatedGst.id,
            accountId: associatedGst.accountId,
            amount: (-gstAmount).toFixed(2), // Negate back for display
            isBusiness: false,
            isGstSplit: true,
            parentSplitId: posting.id,
            manuallyEdited: false,
          });

          // Remove this GST posting from the list so it's not added again
          const gstIndex = gstPostings.indexOf(associatedGst);
          if (gstIndex > -1) {
            gstPostings.splice(gstIndex, 1);
          }
        } else {
          // No GST for this posting (negate back for display)
          loadedSplits.push({
            id: posting.id,
            accountId: posting.accountId,
            amount: (-postingAmount).toFixed(2), // Negate back for display
            isBusiness: posting.isBusiness || false,
            gstCode: posting.gstCode || undefined,
          });
        }
      }

      // Add any remaining unmatched GST postings (negate back for display)
      for (const gstPosting of gstPostings) {
        loadedSplits.push({
          id: gstPosting.id,
          accountId: gstPosting.accountId,
          amount: (-gstPosting.amount).toFixed(2), // Negate back for display
          isBusiness: false,
          isGstSplit: true,
          manuallyEdited: false,
        });
      }

      setSplits(loadedSplits);

      // Detect if this is a transfer (all non-account postings are to transfer accounts)
      const transferAccountsList = await accountAPI.getAllAccountsWithBalances({ kind: 'TRANSFER' });
      const isTransfer = loadedSplits.length === 1 && transferAccountsList.some(acc => acc.id === loadedSplits[0].accountId);

      if (isTransfer) {
        // Determine transfer direction based on sign
        const transferAmount = parseFloat(loadedSplits[0].amount);
        setTransactionType(transferAmount < 0 ? 'transfer-out' : 'transfer-in');
      } else {
        setTransactionType('expense');
      }
    } catch (error) {
      console.error('Failed to load transaction:', error);
      alert('Failed to load transaction');
    } finally {
      setLoadingTransaction(false);
    }
  };

  const loadCategories = async () => {
    try {
      const [categoryAccounts, allTransferAccounts] = await Promise.all([
        accountAPI.getAllAccountsWithBalances({ kind: 'CATEGORY' }),
        accountAPI.getAllAccountsWithBalances({ kind: 'TRANSFER' }),
      ]);
      setCategories(categoryAccounts);
      // Exclude the current account from the list of transfer destinations
      setTransferAccounts(allTransferAccounts.filter(acc => acc.id !== accountId));

      // Find GST Paid and GST Collected accounts
      const gstPaid = categoryAccounts.find(acc => acc.name === 'GST Paid' && acc.type === 'ASSET');
      const gstCollected = categoryAccounts.find(acc => acc.name === 'GST Collected' && acc.type === 'LIABILITY');

      setGstPaidAccount(gstPaid || null);
      setGstCollectedAccount(gstCollected || null);

      if (!gstPaid || !gstCollected) {
        console.warn('GST Paid or GST Collected account not found. GST splitting may not work correctly.');
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const getAccountType = (accountId: string): AccountType | undefined => {
    const account = [...categories, ...transferAccounts].find(acc => acc.id === accountId);
    return account?.type as AccountType;
  };
  const calculateGST = (total: number) => {
    const gstAmount = total * 0.1 / 1.1;
    const gstExclusive = total - gstAmount;
    return { gstAmount, gstExclusive };
  };

  const handleGstToggle = (split: Split, index: number, checked: boolean) => {
    const newSplits = [...splits];

    if (checked) {
      // User checked GST - split into two lines
      const grossAmount = parseFloat(split.amount) || 0;

      // Calculate GST, preserving sign
      // GST amount = gross * 0.1 / 1.1 (with same sign as gross)
      const absGross = Math.abs(grossAmount);
      const { gstAmount: absGst, gstExclusive: absExclusive } = calculateGST(absGross);
      const sign = grossAmount >= 0 ? 1 : -1;
      const gstAmount = absGst * sign;
      const gstExclusive = absExclusive * sign;

      // Determine which GST account to use based on amount sign
      // Positive = expense (use GST Paid), Negative = income (use GST Collected)
      const gstAccount = grossAmount >= 0 ? gstPaidAccount : gstCollectedAccount;

      if (!gstAccount) {
        alert('GST Paid or GST Collected account not found. Please ensure these accounts exist.');
        return;
      }

      // Update the original split to GST-exclusive amount
      newSplits[index] = {
        ...split,
        isBusiness: true,
        amount: gstExclusive.toFixed(2),
        originalAmount: grossAmount.toFixed(2), // Store original for restoration
      };

      // Insert GST split immediately after
      const gstSplit: Split = {
        id: `gst-${split.id}-${Date.now()}`,
        accountId: gstAccount.id,
        amount: gstAmount.toFixed(2),
        isBusiness: false, // GST splits don't have GST themselves
        isGstSplit: true,
        parentSplitId: split.id,
        manuallyEdited: false,
      };

      newSplits.splice(index + 1, 0, gstSplit);
    } else {
      // User unchecked GST - remove GST split and restore original amount
      const originalAmount = split.originalAmount || split.amount;

      // Update the split back to original amount
      newSplits[index] = {
        ...split,
        isBusiness: false,
        amount: originalAmount,
        originalAmount: undefined,
      };

      // Find and remove the associated GST split
      const gstSplitIndex = newSplits.findIndex(
        s => s.isGstSplit && s.parentSplitId === split.id
      );

      if (gstSplitIndex !== -1) {
        newSplits.splice(gstSplitIndex, 1);
      }
    }

    setSplits(newSplits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate accountId exists
    if (!accountId) {
      alert('No account selected');
      return;
    }

    // Validate balance (splits must equal total amount)
    if (Math.abs(remainingAmount) > 0.01) {
      alert('The splits must sum to the total amount.');
      return;
    }

    setLoading(true);

    try {
      const totalAmountNum = parseFloat(totalAmount);

      // Safety check for splits
      if (!splits || splits.length === 0) {
        alert('Please select a category');
        return;
      }

      // Validate all splits have accountIds
      const invalidSplit = splits.find(s => !s.accountId);
      if (invalidSplit) {
        alert('Please select a category for all splits');
        return;
      }

      const categoryPostings = splits.map(split => {
        const splitAmountNum = parseFloat(split.amount);
        const accountType = getAccountType(split.accountId);
        const isTransfer = accountType !== 'INCOME' && accountType !== 'EXPENSE';

        // GST splits are already split out - don't calculate GST on them
        // Only calculate GST metadata for non-GST splits that have isBusiness=true
        const shouldCalculateGst = !isTransfer && split.isBusiness && !split.isGstSplit;
        const gst = shouldCalculateGst ? { gstAmount: parseFloat(split.originalAmount || '0') - splitAmountNum } : null;

        return {
          accountId: split.accountId!, // Validated above
          amount: -splitAmountNum, // Negate: splits are opposite direction from account
          isBusiness: !isTransfer && split.isBusiness,
          gstCode: shouldCalculateGst ? ('GST' as GSTCode) : undefined,
          gstRate: shouldCalculateGst ? 0.1 : undefined,
          gstAmount: gst ? gst.gstAmount : undefined,
        };
      });

      // Mark the main account posting as business if ANY split is business
      const hasBusinessSplit = splits.some(s => s.isBusiness);

      const transactionData = {
        date: new Date(date),
        payee,
        memo: memo || undefined,
        postings: [
          {
            accountId: accountId!, // Validated above
            amount: totalAmountNum, // Positive = credit (money in), Negative = debit (money out)
            isBusiness: hasBusinessSplit,
          },
          ...categoryPostings,
        ],
      };

      if (transactionId) {
        await transactionAPI.updateTransaction({ id: transactionId, ...transactionData });
      } else {
        await transactionAPI.createTransaction(transactionData as CreateTransactionDTO);
      }

      // Check if payee was changed during edit - suggest creating a rule
      console.log('Checking for payee change:', {
        transactionId,
        originalPayee,
        payee,
        changed: payee !== originalPayee
      });

      if (transactionId && originalPayee && payee !== originalPayee && originalPayee.trim() && payee.trim()) {
        console.log('Payee changed! Showing rule suggestion dialog');
        setSuggestedRuleData({ originalPayee, newPayee: payee, matchValue: originalPayee });
        setShowRuleSuggestion(true);
        // Don't close yet - let the rule suggestion dialog handle closing
        // Don't call onSuccess yet - call it when the rule dialog closes
      } else {
        // Success! Call onSuccess and close
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }
    } catch (error) {
      console.error(`Failed to ${transactionId ? 'update' : 'create'} transaction:`, error);
      alert(`Failed to ${transactionId ? 'update' : 'create'} transaction: ` + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!transactionId) return;

    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      await transactionAPI.deleteTransaction(transactionId);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!suggestedRuleData) return;

    try {
      // Use CONTAINS matching with the user-editable match value
      await memorizedRuleAPI.createRule({
        name: `Auto: ${suggestedRuleData.newPayee}`,
        matchType: 'CONTAINS',
        matchValue: suggestedRuleData.matchValue,
        defaultPayee: suggestedRuleData.newPayee,
        defaultAccountId: splits.length > 0 ? splits[0].accountId : undefined,
        applyOnImport: true,
        applyOnManualEntry: true,
      });

      setShowRuleSuggestion(false);
      setSuggestedRuleData(null);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error('Failed to create memorized rule:', error);
      alert('Failed to create rule: ' + (error as Error).message);
    }
  };

  const handleSkipRule = () => {
    setShowRuleSuggestion(false);
    setSuggestedRuleData(null);
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setPayee('');
      setTransactionType('expense');
      setTotalAmount('');
      setSplits([{
        id: `temp-${Date.now()}`,
        accountId: '',
        amount: '',
        isBusiness: false,
      }]);
      setMemo('');
    }
  }, [isOpen]);

  // Custom close handler to prevent closing when showing rule suggestion
  const handleDialogClose = (open: boolean) => {
    if (!open && !showRuleSuggestion) {
      onClose();
    }
  };

  return (
    <>
    <Dialog.Root open={isOpen || showRuleSuggestion} onOpenChange={handleDialogClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl shadow-2xl z-[101] border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                {transactionId ? 'Edit Transaction' : 'New Transaction'}
              </Dialog.Title>
              {accountName && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {accountName}
                </p>
              )}
            </div>
            <Dialog.Close className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <span className="text-slate-500">✕</span>
            </Dialog.Close>
          </div>

          {loadingTransaction ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {/* Transaction Type Selector */}
              <div className="flex gap-2 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTransactionType('expense')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    transactionType === 'expense'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Expense/Income
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType('transfer-out')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    transactionType === 'transfer-out'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Transfer Out
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType('transfer-in')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    transactionType === 'transfer-in'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Transfer In
                </button>
              </div>

              {/* Row 1: Date and Payee */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Payee
                  </label>
                  <input
                    type="text"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    required
                    placeholder="Enter payee name"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Row 2: Total Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => {
                    // Always store as positive - sign is applied by transaction type
                    const val = Math.abs(parseFloat(e.target.value) || 0);
                    setTotalAmount(val.toString());
                  }}
                  onBlur={(e) => {
                    const val = Math.abs(parseFloat(e.target.value) || 0);
                    setTotalAmount(val.toFixed(2));
                  }}
                  required
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Row 3: Split Categories Panel or Transfer Account Selector */}
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {transactionType === 'transfer-out' ? 'Transfer To' : transactionType === 'transfer-in' ? 'Transfer From' : 'Items'}
                  </label>
                  {transactionType === 'expense' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSplits([...splits, {
                          id: `temp-${Date.now()}`,
                          accountId: '',
                          amount: '',
                          isBusiness: false,
                        }]);
                      }}
                      className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    >
                      + Add Split
                    </button>
                  )}
                </div>

                {/* Split lines */}
                <div className="space-y-2">
                  {splits.map((split, index) => (
                    <div
                      key={split.id}
                      className={`flex gap-2 items-center ${split.isGstSplit ? 'ml-6 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg px-2 py-1' : ''}`}
                    >
                      <div className="flex-1">
                        {split.isGstSplit ? (
                          // GST splits show a locked/linked display instead of selector
                          <div className="flex items-center gap-2 px-2 py-1.5 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-slate-700">
                            <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                              {categories.find(c => c.id === split.accountId)?.name || 'GST'}
                            </span>
                            {split.manuallyEdited && (
                              <span className="text-xs text-orange-600 dark:text-orange-400" title="Manually adjusted">⚠</span>
                            )}
                          </div>
                        ) : transactionType !== 'expense' ? (
                          // Transfer mode: show simple account dropdown
                          <select
                            value={split.accountId}
                            onChange={(e) => {
                              const newSplits = [...splits];
                              newSplits[index] = { ...newSplits[index], accountId: e.target.value };
                              setSplits(newSplits);
                            }}
                            required
                            className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          >
                            <option value="">Select account...</option>
                            {transferAccounts.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                          </select>
                        ) : (
                          <CategorySelector
                            value={split.accountId || null}
                            onChange={(categoryId) => {
                              const newSplits = [...splits];
                              newSplits[index] = { ...newSplits[index], accountId: categoryId || '' };
                              setSplits(newSplits);
                            }}
                            placeholder="Select category..."
                            required
                          />
                        )}
                      </div>
                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          value={split.amount}
                          onChange={(e) => {
                            if (transactionType !== 'expense') return; // Read-only in transfer mode

                            const newSplits = [...splits];
                            const newAmount = e.target.value;

                            // Mark GST splits as manually edited if changed
                            if (split.isGstSplit) {
                              newSplits[index] = {
                                ...newSplits[index],
                                amount: newAmount,
                                manuallyEdited: true
                              };
                            } else {
                              newSplits[index] = { ...newSplits[index], amount: newAmount };
                            }

                            setSplits(newSplits);
                          }}
                          onBlur={(e) => {
                            if (transactionType !== 'expense') return; // Read-only in transfer mode

                            const val = parseFloat(e.target.value) || 0;
                            const newSplits = [...splits];
                            newSplits[index] = { ...newSplits[index], amount: val.toFixed(2) };
                            setSplits(newSplits);
                          }}
                          placeholder="0.00"
                          required
                          readOnly={transactionType !== 'expense'}
                          className={`w-full px-2 py-1.5 border rounded-lg focus:ring-2 text-sm text-right font-mono ${
                            split.isGstSplit
                              ? 'border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-700 focus:ring-purple-500 focus:border-purple-500'
                              : transactionType !== 'expense'
                              ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-blue-500 focus:border-blue-500'
                          } dark:text-white`}
                        />
                      </div>
                      {!split.isGstSplit && transactionType === 'expense' && (
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            id={`gst-${split.id}`}
                            checked={split.isBusiness}
                            onChange={(e) => handleGstToggle(split, index, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-2 focus:ring-purple-500"
                            title="Track GST"
                          />
                          <label
                            htmlFor={`gst-${split.id}`}
                            className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap"
                            title="Track GST"
                          >
                            GST
                          </label>
                        </div>
                      )}
                      {split.isGstSplit && (
                        <div className="w-16" title="Spacer for GST splits"></div>
                      )}
                      {transactionType !== 'expense' && (
                        <div className="w-16" title="Spacer for transfer mode"></div>
                      )}
                      {splits.length > 1 && !split.isGstSplit && transactionType === 'expense' && (
                        <button
                          type="button"
                          onClick={() => {
                            // When deleting a split with GST, also remove its GST split
                            const hasGstSplit = split.isBusiness && splits.some(s => s.isGstSplit && s.parentSplitId === split.id);
                            if (hasGstSplit) {
                              const filteredSplits = splits.filter((s, i) => i !== index && !(s.isGstSplit && s.parentSplitId === split.id));
                              setSplits(filteredSplits);
                            } else {
                              setSplits(splits.filter((_, i) => i !== index));
                            }
                          }}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          aria-label="Remove split"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Balance Summary */}
                <div className="mt-3 pt-3 border-t border-slate-300 dark:border-slate-600">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex gap-4">
                      <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">BALANCE:</span>
                        <span className="ml-1 font-mono font-semibold text-slate-900 dark:text-white">
                          ${(parseFloat(totalAmount) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">AMOUNT:</span>
                        <span className="ml-1 font-mono font-semibold text-slate-900 dark:text-white">
                          ${((splits || []).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div>
                      {Math.abs(remainingAmount) < 0.01 ? (
                        <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                          ✓ BALANCED
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-semibold text-sm">
                          {remainingAmount > 0 ? `+$${remainingAmount.toFixed(2)}` : `-$${Math.abs(remainingAmount).toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>


              {/* Memo */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Memo (optional)
                </label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Footer - Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                {/* Delete button - only show when editing */}
                {transactionId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || Math.abs(remainingAmount) > 0.01}
                    className="px-4 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-semibold shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? 'Saving...' : transactionId ? 'Update Transaction' : 'Save Transaction'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    {/* Memorized Rule Suggestion Dialog */}
    <Dialog.Root open={showRuleSuggestion} onOpenChange={(open) => !open && setShowRuleSuggestion(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[200]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-4 w-full max-w-md z-[201]">
          <Dialog.Title className="text-base font-bold text-slate-900 dark:text-white mb-3">
            Create Memorized Rule?
          </Dialog.Title>

          <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            <p className="mb-3">
              You changed the payee name. Create a rule to automatically rename similar transactions?
            </p>
            {suggestedRuleData && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 space-y-2">
                <div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">When payee contains:</span>
                  <input
                    type="text"
                    value={suggestedRuleData.matchValue}
                    onChange={(e) => setSuggestedRuleData({ ...suggestedRuleData, matchValue: e.target.value })}
                    className="font-mono text-xs text-slate-900 dark:text-white mt-1 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="text-center text-slate-400 text-xs">→</div>
                <div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Rename to:</span>
                  <div className="font-mono text-xs text-slate-900 dark:text-white mt-1 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                    {suggestedRuleData.newPayee}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleSkipRule}
              className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
            >
              No, Just This Once
            </button>
            <button
              onClick={handleCreateRule}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Yes, Create Rule
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  );
}
