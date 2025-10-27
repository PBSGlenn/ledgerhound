/**
 * Memorized Rules Manager
 * UI for managing transaction categorization rules
 */

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, GripVertical, Save, X, AlertCircle, Play } from 'lucide-react';
import { memorizedRuleAPI, accountAPI } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import type { MemorizedRule, Account } from '../../types';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface RuleFormData {
  name: string;
  matchType: 'EXACT' | 'CONTAINS' | 'REGEX';
  matchValue: string;
  defaultPayee: string;
  defaultAccountId: string;
  applyOnImport: boolean;
  applyOnManualEntry: boolean;
}

export function MemorizedRulesManager() {
  const { showSuccess, showError } = useToast();
  const [rules, setRules] = useState<MemorizedRule[]>([]);
  const [categories, setCategories] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MemorizedRule | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [applyRuleId, setApplyRuleId] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{count: number} | null>(null);
  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    matchType: 'CONTAINS',
    matchValue: '',
    defaultPayee: '',
    defaultAccountId: '',
    applyOnImport: true,
    applyOnManualEntry: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, categoriesData] = await Promise.all([
        memorizedRuleAPI.getAllRules(),
        accountAPI.getCategories(),
      ]);
      setRules(rulesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showError('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      matchType: 'CONTAINS',
      matchValue: '',
      defaultPayee: '',
      defaultAccountId: '',
      applyOnImport: true,
      applyOnManualEntry: true,
    });
    setIsAddEditOpen(true);
  };

  const handleEdit = (rule: MemorizedRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      matchType: rule.matchType,
      matchValue: rule.matchValue,
      defaultPayee: rule.defaultPayee || '',
      defaultAccountId: rule.defaultAccountId || '',
      applyOnImport: rule.applyOnImport,
      applyOnManualEntry: rule.applyOnManualEntry,
    });
    setIsAddEditOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showError('Rule name is required');
      return;
    }
    if (!formData.matchValue.trim()) {
      showError('Match pattern is required');
      return;
    }

    try {
      if (editingRule) {
        await memorizedRuleAPI.updateRule(editingRule.id, formData);
        showSuccess('Rule updated successfully');
      } else {
        await memorizedRuleAPI.createRule(formData);
        showSuccess('Rule created successfully');
      }
      setIsAddEditOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to save rule:', error);
      showError('Failed to save rule');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await memorizedRuleAPI.deleteRule(id);
      showSuccess('Rule deleted successfully');
      setDeleteRuleId(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      showError('Failed to delete rule');
    }
  };

  const handleApplyToExisting = async (id: string) => {
    try {
      const result = await memorizedRuleAPI.applyToExisting(id);
      setApplyResult(result);
      setApplyRuleId(null);
      if (result.count > 0) {
        showSuccess(`Updated ${result.count} transaction${result.count !== 1 ? 's' : ''}`);
        loadData();
      } else {
        showSuccess('No matching transactions found');
      }
    } catch (error) {
      console.error('Failed to apply rule:', error);
      showError('Failed to apply rule to existing transactions');
      setApplyRuleId(null);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newRules = [...rules];
    [newRules[index - 1], newRules[index]] = [newRules[index], newRules[index - 1]];
    setRules(newRules);

    try {
      await memorizedRuleAPI.reorderRules(newRules.map(r => r.id));
      showSuccess('Rules reordered');
    } catch (error) {
      console.error('Failed to reorder rules:', error);
      showError('Failed to reorder rules');
      loadData(); // Reload to restore original order
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === rules.length - 1) return;
    const newRules = [...rules];
    [newRules[index], newRules[index + 1]] = [newRules[index + 1], newRules[index]];
    setRules(newRules);

    try {
      await memorizedRuleAPI.reorderRules(newRules.map(r => r.id));
      showSuccess('Rules reordered');
    } catch (error) {
      console.error('Failed to reorder rules:', error);
      showError('Failed to reorder rules');
      loadData(); // Reload to restore original order
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Memorized Rules</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Automatically categorize transactions based on payee patterns
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No rules yet</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Create rules to automatically categorize transactions during import
          </p>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Rule
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Rule Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Match Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Pattern
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Context
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {rules.map((rule, index) => {
                  const category = categories.find(c => c.id === rule.defaultAccountId);
                  const parent = category?.parentId ? categories.find(c => c.id === category.parentId) : null;
                  const categoryName = parent ? `${parent.name}: ${category.name}` : category?.name || 'Uncategorized';

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleMoveDown(index)}
                            disabled={index === rules.length - 1}
                            className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white font-medium">
                        {rule.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {rule.matchType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">
                        {rule.matchValue}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {categoryName}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex gap-1">
                          {rule.applyOnImport && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              Import
                            </span>
                          )}
                          {rule.applyOnManualEntry && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                              Manual
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setApplyRuleId(rule.id)}
                            className="p-1.5 text-slate-600 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Apply to existing transactions"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(rule)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Edit rule"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteRuleId(rule.id)}
                            className="p-1.5 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog.Root open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editingRule ? 'Edit Rule' : 'Add New Rule'}
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Stripe Payments"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Match Type *
                  </label>
                  <select
                    value={formData.matchType}
                    onChange={(e) => setFormData({ ...formData, matchType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="CONTAINS">Contains</option>
                    <option value="EXACT">Exact Match</option>
                    <option value="REGEX">Regular Expression</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Match Pattern *
                  </label>
                  <input
                    type="text"
                    value={formData.matchValue}
                    onChange={(e) => setFormData({ ...formData, matchValue: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={formData.matchType === 'REGEX' ? '^STRIPE' : 'STRIPE'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Payee (optional)
                </label>
                <input
                  type="text"
                  value={formData.defaultPayee}
                  onChange={(e) => setFormData({ ...formData, defaultPayee: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Stripe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Category
                </label>
                <select
                  value={formData.defaultAccountId}
                  onChange={(e) => setFormData({ ...formData, defaultAccountId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Uncategorized</option>
                  {categories
                    .filter(cat => cat.parentId !== null)
                    .map((cat) => {
                      const parent = categories.find(c => c.id === cat.parentId);
                      return (
                        <option key={cat.id} value={cat.id}>
                          {parent ? `${parent.name}: ${cat.name}` : cat.name}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.applyOnImport}
                    onChange={(e) => setFormData({ ...formData, applyOnImport: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Apply during CSV import
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.applyOnManualEntry}
                    onChange={(e) => setFormData({ ...formData, applyOnManualEntry: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Apply during manual transaction entry
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <AlertDialog.Root open={deleteRuleId !== null} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Delete Rule?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete this rule? This action cannot be undone.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => deleteRuleId && handleDelete(deleteRuleId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Delete
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Apply to Existing Confirmation Dialog */}
      <AlertDialog.Root open={applyRuleId !== null} onOpenChange={() => setApplyRuleId(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Apply Rule to Existing Transactions?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-slate-600 dark:text-slate-400 mb-6">
              <p className="mb-2">
                This will update all existing transactions that match this rule's pattern.
              </p>
              <p className="text-sm">
                The payee name will be updated to match the rule's default payee.
              </p>
            </AlertDialog.Description>
            <div className="flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => applyRuleId && handleApplyToExisting(applyRuleId)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Apply to Existing
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
