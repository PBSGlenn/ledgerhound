/**
 * Settings View
 * User preferences and application configuration
 */

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface AppSettings {
  currency: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  fiscalYearStart: string; // MM-DD format
  defaultBusinessAccount: boolean;
  theme: 'light' | 'dark' | 'system';
}

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'AUD',
  dateFormat: 'DD/MM/YYYY',
  fiscalYearStart: '07-01', // July 1 (Australian FY)
  defaultBusinessAccount: false,
  theme: 'system',
};

export function SettingsView() {
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('ledgerhound-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem('ledgerhound-settings', JSON.stringify(settings));
      setHasChanges(false);
      showSuccess('Settings saved', 'Your preferences have been saved successfully');
    } catch (error) {
      showError('Failed to save', 'Could not save settings. Please try again.');
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
    showSuccess('Settings reset', 'Settings have been reset to defaults');
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Configure your preferences and defaults
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md font-medium flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors ${
                hasChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Regional Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Regional Settings
            </h2>

            <div className="space-y-4">
              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Currency
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => updateSetting('currency', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="NZD">NZD - New Zealand Dollar</option>
                </select>
              </div>

              {/* Date Format */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Date Format
                </label>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => updateSetting('dateFormat', e.target.value as AppSettings['dateFormat'])}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                </select>
              </div>

              {/* Fiscal Year Start */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Fiscal Year Start
                </label>
                <select
                  value={settings.fiscalYearStart}
                  onChange={(e) => updateSetting('fiscalYearStart', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="01-01">January 1 (Calendar Year)</option>
                  <option value="07-01">July 1 (Australian FY)</option>
                  <option value="04-01">April 1</option>
                  <option value="10-01">October 1</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Used for financial year calculations in reports
                </p>
              </div>
            </div>
          </div>

          {/* Business Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Business Settings
            </h2>

            <div className="space-y-4">
              {/* Default Business Account */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="defaultBusiness"
                  checked={settings.defaultBusinessAccount}
                  onChange={(e) => updateSetting('defaultBusinessAccount', e.target.checked)}
                  className="mt-1 w-4 h-4 text-emerald-600 border-slate-300 dark:border-slate-600 rounded focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <label
                    htmlFor="defaultBusiness"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Enable GST tracking by default for new accounts
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    When enabled, new accounts will have "Business Default" checked, automatically
                    enabling GST tracking for transactions in those accounts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Appearance
            </h2>

            <div className="space-y-4">
              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Theme
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => updateSetting('theme', e.target.value as AppSettings['theme'])}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="system">System Default</option>
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Choose your preferred color scheme
                </p>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Settings are stored locally in your browser. Changing devices
              or clearing browser data will reset these preferences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
