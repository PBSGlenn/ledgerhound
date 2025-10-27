import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface StripeBalance {
  available: number;
  pending: number;
  currency: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  transactions: any[];
}

export const StripeImportWizard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<StripeBalance | null>(null);
  const [configured, setConfigured] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const [formData, setFormData] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // Today
    limit: 100,
  });

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stripe/settings');
      const data = await response.json();
      setConfigured(data.configured);

      if (data.configured) {
        loadBalance();
      }
    } catch (error) {
      console.error('Failed to check Stripe configuration:', error);
    }
  };

  const loadBalance = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stripe/balance');
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error('Failed to load Stripe balance:', error);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/stripe/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        if (data.imported > 0) {
          toast.success(`Successfully imported ${data.imported} transactions`);
        }
        if (data.skipped > 0) {
          toast(`Skipped ${data.skipped} duplicate transactions`, { icon: 'ℹ️' });
        }
        if (data.errors.length > 0) {
          toast.error(`${data.errors.length} errors occurred`);
        }
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch (error) {
      toast.error('Failed to import transactions');
    } finally {
      setLoading(false);
    }
  };

  if (!configured) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Stripe Not Configured</h2>
          <p className="text-gray-600 mb-6">
            Please configure your Stripe integration in Settings before importing transactions.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                // Navigate to settings - this could be improved with proper routing
                window.location.hash = '#settings';
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Import from Stripe</h2>
              <p className="text-gray-600 mt-1">
                Fetch balance transactions directly from your Stripe account
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {balance && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Current Stripe Balance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-blue-700">Available</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {balance.currency} ${balance.available.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Pending</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {balance.currency} ${balance.pending.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Transactions
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.limit}
              onChange={(e) => setFormData({ ...formData, limit: parseInt(e.target.value) || 100 })}
              min="1"
              max="1000"
            />
            <p className="text-xs text-gray-500 mt-1">
              Limit the number of transactions to import (1-1000)
            </p>
          </div>

          {result && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-gray-900 mb-3">Import Results</h3>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-sm text-green-700">Imported</p>
                  <p className="text-2xl font-bold text-green-900">{result.imported}</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-700">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-900">{result.skipped}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-700">Errors</p>
                  <p className="text-2xl font-bold text-red-900">{result.errors.length}</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm font-medium text-red-900 mb-2">Errors:</p>
                  <ul className="text-sm text-red-800 space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={index} className="truncate">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2">Important Notes</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Duplicate transactions are automatically skipped based on Stripe transaction ID</li>
              <li>• Stripe fees include 10% GST which is automatically extracted</li>
              <li>• All amounts are converted from cents to dollars</li>
              <li>• Transactions will be marked as business transactions</li>
              <li>• You may need to categorize imported transactions manually</li>
            </ul>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Importing...
              </span>
            ) : (
              'Import Transactions'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
