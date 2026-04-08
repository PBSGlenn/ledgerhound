/**
 * AI Settings Tab
 * Configure Anthropic API key, model selection, and check for model updates.
 */

import { useState, useEffect } from 'react';
import { Brain, Key, RefreshCw, Check, AlertCircle, Trash2, Sparkles, ArrowUp } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { aiAPI } from '../../lib/api';
import type { AISettingsPublic, AIModelInfo } from '../../lib/api';

export function AISettings() {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const [settings, setSettings] = useState<AISettingsPublic | null>(null);
  const [models, setModels] = useState<AIModelInfo[]>([]);

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('claude-haiku-4-5-20251001');
  const [enabled, setEnabled] = useState(true);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; newestModel?: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsData, modelsData] = await Promise.all([
        aiAPI.getSettings(),
        aiAPI.listModels(),
      ]);
      setSettings(settingsData);
      setModels(modelsData);

      if (settingsData.configured) {
        setSelectedModelId(settingsData.modelId || 'claude-haiku-4-5-20251001');
        setEnabled(settingsData.enabled);
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateKey = async () => {
    if (!apiKey.trim()) {
      showError('Please enter an API key');
      return;
    }
    setValidating(true);
    setKeyValid(null);
    try {
      const result = await aiAPI.validateKey(apiKey);
      setKeyValid(result.valid);
      if (result.valid) {
        showSuccess('API key is valid');
      } else {
        showError('Invalid API key', result.error);
      }
    } catch (error) {
      setKeyValid(false);
      showError('Validation failed', (error as Error).message);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: { apiKey?: string; modelId: string; enabled: boolean } = {
        modelId: selectedModelId,
        enabled,
      };
      // Only send apiKey if user entered a new one
      if (apiKey.trim()) {
        data.apiKey = apiKey.trim();
      }

      await aiAPI.saveSettings(data);
      setApiKey(''); // Clear the input after saving
      setKeyValid(null);
      await loadSettings();
      showSuccess('AI settings saved');
    } catch (error) {
      showError('Failed to save settings', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await aiAPI.deleteSettings();
      setApiKey('');
      setKeyValid(null);
      setUpdateInfo(null);
      await loadSettings();
      showSuccess('AI settings removed');
    } catch (error) {
      showError('Failed to remove settings', (error as Error).message);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await aiAPI.checkModelUpdate();
      setUpdateInfo(result);
      if (result.hasUpdate) {
        showSuccess('Model update available', `Newer model: ${result.newestModel}`);
      } else {
        showSuccess('Model is up to date');
      }
    } catch (error) {
      showError('Update check failed', (error as Error).message);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleUpgradeModel = async () => {
    if (!updateInfo?.newestModel) return;
    setSelectedModelId(updateInfo.newestModel);
    // Auto-save with the new model
    setSaving(true);
    try {
      await aiAPI.saveSettings({ modelId: updateInfo.newestModel, enabled });
      setUpdateInfo(null);
      await loadSettings();
      showSuccess('Model upgraded', `Now using ${updateInfo.newestModel}`);
    } catch (error) {
      showError('Upgrade failed', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading AI settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
            <Brain className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">AI-Assisted Categorization</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Uses Claude AI to suggest categories for uncategorized transactions during CSV import.
              Requires an Anthropic API key. Classification uses the Haiku model (&lt;$0.01 per import).
            </p>
          </div>
        </div>
      </div>

      {/* Status */}
      {settings?.configured && (
        <div className={`rounded-lg p-4 border ${
          settings.enabled
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-center gap-2">
            {settings.enabled ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            )}
            <span className={`text-sm font-medium ${
              settings.enabled
                ? 'text-emerald-800 dark:text-emerald-200'
                : 'text-yellow-800 dark:text-yellow-200'
            }`}>
              {settings.enabled ? 'AI categorization is active' : 'AI categorization is disabled'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div>API Key: <span className="font-mono">{settings.apiKeyMasked}</span></div>
            <div>Model: <span className="font-mono">{settings.modelId}</span></div>
          </div>
        </div>
      )}

      {/* API Key */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-500" />
          API Key
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Anthropic API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyValid(null); }}
                placeholder={settings?.configured ? 'Enter new key to replace...' : 'sk-ant-api03-...'}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 font-mono text-sm"
              />
              <button
                onClick={handleValidateKey}
                disabled={!apiKey.trim() || validating}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {validating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : keyValid === true ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : keyValid === false ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : null}
                Test
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Get your API key from{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                 className="text-violet-600 dark:text-violet-400 underline">
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-slate-500" />
          Model
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            {models.map(model => (
              <label
                key={model.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedModelId === model.id
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={selectedModelId === model.id}
                  onChange={() => setSelectedModelId(model.id)}
                  className="mt-1 text-violet-600 focus:ring-violet-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{model.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {model.inputPrice} in / {model.outputPrice} out
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{model.description}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{model.id}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Check for updates */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate || !settings?.configured}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {checkingUpdate ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Check for newer models
            </button>

            {updateInfo?.hasUpdate && (
              <button
                onClick={handleUpgradeModel}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                Upgrade to {updateInfo.newestModel}
              </button>
            )}

            {updateInfo && !updateInfo.hasUpdate && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Up to date
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Enable AI Categorization</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              When enabled, the CSV import wizard will offer AI-powered category suggestions for uncategorized transactions.
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {settings?.configured && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remove AI Configuration
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || (!apiKey.trim() && !settings?.configured)}
          className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  );
}
