import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CreditCard, Key, Trash2, Wallet } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: string;
  subtype?: string;
}

interface StripeSettingsData {
  configured: boolean;
  accountId?: string;
  accountName?: string;
  apiKeyMasked?: string;
}

export const StripeSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<StripeSettingsData | null>(null);
  const [pspAccounts, setPspAccounts] = useState<Account[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPspAccounts();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stripe/settings');
      const data = await response.json();
      setSettings(data);

      if (data.configured && data.accountId) {
        setSelectedAccountId(data.accountId);
      }
    } catch (error) {
      console.error('Failed to load Stripe settings:', error);
    }
  };

  const loadPspAccounts = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/accounts');
      const accounts = await response.json();

      // Filter for PSP accounts (Payment Service Providers)
      const psp = accounts.filter((acc: Account) => acc.subtype === 'PSP');
      setPspAccounts(psp);
    } catch (error) {
      console.error('Failed to load PSP accounts:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey && !settings?.configured) {
      toast.error('Please enter your Stripe API key');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('http://localhost:3001/api/stripe/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey || undefined }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('✓ Connected to Stripe');
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey && !settings?.configured) {
      toast.error('Please enter your Stripe API key');
      return;
    }

    if (!selectedAccountId) {
      toast.error('Please select a PSP account');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/stripe/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          accountId: selectedAccountId,
        }),
      });

      if (response.ok) {
        toast.success('Stripe settings saved successfully!');
        setApiKey('');
        setShowApiKey(false);
        await loadSettings();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to disconnect Stripe? This will not delete the account or transactions.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/stripe/settings', {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Stripe disconnected');
        setSettings(null);
        setApiKey('');
        setSelectedAccountId('');
      } else {
        toast.error('Failed to disconnect Stripe');
      }
    } catch (error) {
      toast.error('Failed to disconnect Stripe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Stripe Integration
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Connect your Stripe account to automatically import transactions via API or manually import CSV files.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        {settings?.configured ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {settings.accountName || 'Stripe'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Connected
                  </p>
                </div>
              </div>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Disconnect
              </button>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-slate-400" />
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  API Key
                </label>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-lg text-sm font-mono">
                  {settings.apiKeyMasked}
                </code>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Change
                </button>
              </div>
            </div>

            {showApiKey && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  New API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_... or sk_test_..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-900 dark:text-white"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={loading || !apiKey}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Saving...' : 'Update Key'}
                  </button>
                  <button
                    onClick={() => {
                      setShowApiKey(false);
                      setApiKey('');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                How to use Stripe integration
              </h4>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
                <li className="flex items-start gap-2">
                  <span className="font-semibold">•</span>
                  <span>The <strong>{settings.accountName}</strong> account appears in your account list</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold">•</span>
                  <span>Click on it to view the register, just like a bank account</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold">•</span>
                  <span><strong>Manual import:</strong> Download CSV from Stripe, then use "Import CSV" button</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold">•</span>
                  <span><strong>API sync:</strong> Click "Sync from Stripe" button when viewing the account</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {pspAccounts.length === 0 ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2">
                  No PSP Account Found
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-400 mb-3">
                  Before connecting Stripe, you need to create a PSP (Payment Service Provider) account.
                </p>
                <ol className="space-y-2 text-sm text-amber-800 dark:text-amber-400 ml-4 list-decimal">
                  <li>Click the <strong>"Add Account"</strong> button in the sidebar</li>
                  <li>Select <strong>"Stripe"</strong> from the Banking section</li>
                  <li>Create the account</li>
                  <li>Come back here to configure the API connection</li>
                </ol>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    PSP Account
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">Select a PSP account...</option>
                    {pspAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Select the Stripe, PayPal, or other PSP account you created
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Stripe API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk_live_... or sk_test_..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-900 dark:text-white"
                  />
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Find your API key in your Stripe Dashboard under Developers → API keys
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={loading || !apiKey || !selectedAccountId}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Connecting...' : 'Connect Stripe'}
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !apiKey}
                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                    What happens when you connect?
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold">•</span>
                      <span>Your selected PSP account will be linked to Stripe</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold">•</span>
                      <span>You can import transactions via CSV download from Stripe</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold">•</span>
                      <span>Or sync automatically via the Stripe API (click "Sync from Stripe" when viewing the account)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold">•</span>
                      <span>Transactions will include fees, GST calculations, and full metadata</span>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
