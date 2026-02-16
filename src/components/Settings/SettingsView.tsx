/**
 * Settings View
 * User preferences and application configuration
 */

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Database, Download, Upload, Trash2, HardDrive, FolderTree, ListFilter, CreditCard, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../../hooks/useToast';
import { backupAPI } from '../../lib/api';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { CategoriesManager } from './CategoriesManager';
import { MemorizedRulesManager } from './MemorizedRulesManager';
import { StripeSettings } from './StripeSettings';
import { AboutTab } from './AboutTab';

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

interface BackupInfo {
  filename: string;
  timestamp: Date;
  size: number;
  type: string;
}

interface DBStats {
  accounts: number;
  transactions: number;
  postings: number;
  size: number;
}

type SettingsTab = 'settings' | 'categories' | 'rules' | 'stripe' | 'about';

export function SettingsView() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('settings');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [dbStats, setDBStats] = useState<DBStats | null>(null);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadBackups();
    loadDBStats();
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

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const backupList = await backupAPI.listBackups();
      setBackups(backupList);
    } catch (error) {
      showError('Failed to load backups', (error as Error).message);
    } finally {
      setLoadingBackups(false);
    }
  };

  const loadDBStats = async () => {
    try {
      const stats = await backupAPI.getStats();
      setDBStats(stats);
    } catch (error) {
      console.error('Failed to load database stats:', error);
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

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await backupAPI.createBackup('manual');
      await loadBackups();
      await loadDBStats();
      showSuccess('Backup created', 'Database backup created successfully');
    } catch (error) {
      showError('Backup failed', (error as Error).message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    setRestoringBackup(filename);
    try {
      await backupAPI.restoreBackup(filename);
      await loadDBStats();
      showSuccess('Backup restored', 'Database restored successfully. Please refresh the page.');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      showError('Restore failed', (error as Error).message);
    } finally {
      setRestoringBackup(null);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    try {
      await backupAPI.deleteBackup(filename);
      await loadBackups();
      showSuccess('Backup deleted', 'Backup file deleted successfully');
    } catch (error) {
      showError('Delete failed', (error as Error).message);
    }
  };

  const handleExportJSON = () => {
    try {
      backupAPI.exportToJSON();
      showSuccess('Export started', 'JSON export download will begin shortly');
    } catch (error) {
      showError('Export failed', (error as Error).message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

          {activeTab === 'settings' && (
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
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            App Settings
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            Categories
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            Memorized Rules
          </button>
          <button
            onClick={() => setActiveTab('stripe')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'stripe'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Stripe
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'about'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Info className="w-4 h-4" />
            About
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'categories' && <CategoriesManager />}
        {activeTab === 'rules' && <MemorizedRulesManager />}
        {activeTab === 'stripe' && <StripeSettings />}
        {activeTab === 'about' && <AboutTab />}
        {activeTab === 'settings' && (
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

          {/* Backup & Restore */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Backup & Restore
            </h2>

            {/* Database Stats */}
            {dbStats && (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">Database Info</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Accounts:</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{dbStats.accounts}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Transactions:</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{dbStats.transactions}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Postings:</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{dbStats.postings}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Database Size:</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{formatBytes(dbStats.size)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Backup Actions */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Database className="w-4 h-4" />
                {creatingBackup ? 'Creating...' : 'Create Backup'}
              </button>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export to JSON
              </button>
            </div>

            {/* Backup List */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Available Backups</h3>
              {loadingBackups ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading backups...</p>
              ) : backups.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No backups found</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {backups.map((backup) => (
                    <div
                      key={backup.filename}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {backup.filename}
                          </span>
                          <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                            {backup.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {format(new Date(backup.timestamp), 'PPpp')} • {formatBytes(backup.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertDialog.Root>
                          <AlertDialog.Trigger asChild>
                            <button
                              disabled={restoringBackup === backup.filename}
                              className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialog.Trigger>
                          <AlertDialog.Portal>
                            <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                            <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl z-50">
                              <AlertDialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                                Restore Backup?
                              </AlertDialog.Title>
                              <AlertDialog.Description className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                This will replace your current database with the backup from{' '}
                                <strong>{format(new Date(backup.timestamp), 'PPpp')}</strong>.
                                <br />
                                <br />
                                <span className="text-red-600 dark:text-red-400 font-medium">
                                  Warning: All current data will be replaced. This cannot be undone.
                                </span>
                              </AlertDialog.Description>
                              <div className="flex justify-end gap-2">
                                <AlertDialog.Cancel asChild>
                                  <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                    Cancel
                                  </button>
                                </AlertDialog.Cancel>
                                <AlertDialog.Action asChild>
                                  <button
                                    onClick={() => handleRestoreBackup(backup.filename)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                                  >
                                    Restore Backup
                                  </button>
                                </AlertDialog.Action>
                              </div>
                            </AlertDialog.Content>
                          </AlertDialog.Portal>
                        </AlertDialog.Root>

                        <AlertDialog.Root>
                          <AlertDialog.Trigger asChild>
                            <button className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded text-sm font-medium transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialog.Trigger>
                          <AlertDialog.Portal>
                            <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                            <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl z-50">
                              <AlertDialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                                Delete Backup?
                              </AlertDialog.Title>
                              <AlertDialog.Description className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Are you sure you want to delete this backup? This action cannot be undone.
                              </AlertDialog.Description>
                              <div className="flex justify-end gap-2">
                                <AlertDialog.Cancel asChild>
                                  <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                    Cancel
                                  </button>
                                </AlertDialog.Cancel>
                                <AlertDialog.Action asChild>
                                  <button
                                    onClick={() => handleDeleteBackup(backup.filename)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                                  >
                                    Delete
                                  </button>
                                </AlertDialog.Action>
                              </div>
                            </AlertDialog.Content>
                          </AlertDialog.Portal>
                        </AlertDialog.Root>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Tip:</strong> Backups are created automatically when the app starts. You can also create manual backups before important operations.
              </p>
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
        )}
      </div>
    </div>
  );
}
