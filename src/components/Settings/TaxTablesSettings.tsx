import { useState, useEffect } from 'react';
import { Save, RotateCcw, Loader2, Plus, Trash2, Info } from 'lucide-react';
import { taxAPI } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import type { TaxTablesConfig, TaxBracket } from '../../types';

function FieldLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <label className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
      {children}
      <span title={tip} className="cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
        <Info className="w-3.5 h-3.5" />
      </span>
    </label>
  );
}

export function TaxTablesSettings() {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState('2025-26');
  const [config, setConfig] = useState<TaxTablesConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadAvailableYears();
  }, []);

  useEffect(() => {
    loadTaxTables(selectedYear);
  }, [selectedYear]);

  const loadAvailableYears = async () => {
    try {
      const years = await taxAPI.getAvailableYears();
      setAvailableYears(years);
    } catch (error) {
      showError('Failed to load', (error as Error).message);
    }
  };

  const loadTaxTables = async (fy: string) => {
    setLoading(true);
    try {
      const tables = await taxAPI.getTaxTables(fy);
      setConfig(tables);
      setHasChanges(false);
    } catch (error) {
      showError('Failed to load', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await taxAPI.saveTaxTables(config);
      setHasChanges(false);
      showSuccess('Saved', 'Tax tables saved successfully');
      if (!availableYears.includes(config.financialYear)) {
        setAvailableYears(prev => [...prev, config.financialYear].sort());
      }
    } catch (error) {
      showError('Failed to save', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadTaxTables(selectedYear);
  };

  const updateBracket = (index: number, field: keyof TaxBracket, value: number | null) => {
    if (!config) return;
    const brackets = [...config.brackets];
    brackets[index] = { ...brackets[index], [field]: value };
    setConfig({ ...config, brackets });
    setHasChanges(true);
  };

  const addBracket = () => {
    if (!config) return;
    const last = config.brackets[config.brackets.length - 1];
    const newMin = (last.max ?? last.min) + 1;
    setConfig({
      ...config,
      brackets: [
        ...config.brackets.map((b, i) =>
          i === config.brackets.length - 1 ? { ...b, max: newMin - 1 } : b
        ),
        { min: newMin, max: null, rate: 0.45, baseTax: 0 },
      ],
    });
    setHasChanges(true);
  };

  const removeBracket = (index: number) => {
    if (!config || config.brackets.length <= 2) return;
    const brackets = config.brackets.filter((_, i) => i !== index);
    // Make the last bracket open-ended
    brackets[brackets.length - 1] = { ...brackets[brackets.length - 1], max: null };
    setConfig({ ...config, brackets });
    setHasChanges(true);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(amount);

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Loading tax tables...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* FY selector + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Financial Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 dark:text-slate-200"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Tax Brackets */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Income Tax Brackets</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600 dark:text-slate-400 border-b dark:border-slate-700">
              <th className="pb-2 pr-4">
                <span className="flex items-center gap-1">From <span title="Lower bound of taxable income for this bracket" className="cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><Info className="w-3.5 h-3.5" /></span></span>
              </th>
              <th className="pb-2 pr-4">
                <span className="flex items-center gap-1">To <span title="Upper bound of taxable income for this bracket. The top bracket has no limit." className="cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><Info className="w-3.5 h-3.5" /></span></span>
              </th>
              <th className="pb-2 pr-4">
                <span className="flex items-center gap-1">Rate <span title="Marginal tax rate — the percentage of tax on each dollar within this bracket" className="cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><Info className="w-3.5 h-3.5" /></span></span>
              </th>
              <th className="pb-2 pr-4">
                <span className="flex items-center gap-1">Base Tax <span title="Cumulative tax owed on all income below this bracket's lower bound" className="cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><Info className="w-3.5 h-3.5" /></span></span>
              </th>
              <th className="pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {config.brackets.map((bracket, idx) => (
              <tr key={idx} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={bracket.min}
                    onChange={(e) => updateBracket(idx, 'min', parseInt(e.target.value) || 0)}
                    className="w-32 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                  />
                </td>
                <td className="py-2 pr-4">
                  {bracket.max !== null ? (
                    <input
                      type="number"
                      value={bracket.max}
                      onChange={(e) => updateBracket(idx, 'max', parseInt(e.target.value) || 0)}
                      className="w-32 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                    />
                  ) : (
                    <span className="text-slate-400 italic">No limit</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={(bracket.rate * 100).toFixed(1)}
                      onChange={(e) => updateBracket(idx, 'rate', (parseFloat(e.target.value) || 0) / 100)}
                      className="w-20 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={bracket.baseTax}
                    onChange={(e) => updateBracket(idx, 'baseTax', parseFloat(e.target.value) || 0)}
                    className="w-32 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                  />
                </td>
                <td className="py-2">
                  {config.brackets.length > 2 && (
                    <button
                      onClick={() => removeBracket(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={addBracket}
          className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <Plus className="w-4 h-4" />
          Add Bracket
        </button>
      </div>

      {/* Medicare Levy */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Medicare Levy</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel tip="Standard Medicare levy percentage applied to taxable income above the shade-in threshold">Rate</FieldLabel>
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                step="0.1"
                value={(config.medicareLevyConfig.rate * 100).toFixed(1)}
                onChange={(e) => {
                  setConfig({
                    ...config,
                    medicareLevyConfig: { ...config.medicareLevyConfig, rate: (parseFloat(e.target.value) || 0) / 100 },
                  });
                  setHasChanges(true);
                }}
                className="w-24 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
              <span className="text-slate-500">%</span>
            </div>
          </div>
          <div>
            <FieldLabel tip="No Medicare levy is payable below this income. Currently $27,222 for 2025-26.">Low-Income Threshold</FieldLabel>
            <input
              type="number"
              value={config.medicareLevyConfig.lowIncomeThreshold}
              onChange={(e) => {
                setConfig({
                  ...config,
                  medicareLevyConfig: { ...config.medicareLevyConfig, lowIncomeThreshold: parseInt(e.target.value) || 0 },
                });
                setHasChanges(true);
              }}
              className="w-full mt-1 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <div>
            <FieldLabel tip="Income above this amount pays the full Medicare levy rate. Between the low-income and shade-in thresholds, a reduced rate applies.">Shade-In Threshold</FieldLabel>
            <input
              type="number"
              value={config.medicareLevyConfig.shadeInThreshold}
              onChange={(e) => {
                setConfig({
                  ...config,
                  medicareLevyConfig: { ...config.medicareLevyConfig, shadeInThreshold: parseInt(e.target.value) || 0 },
                });
                setHasChanges(true);
              }}
              className="w-full mt-1 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <div>
            <FieldLabel tip="Rate applied per dollar in the shade-in range (between low-income and shade-in thresholds). E.g. 10% means 10c levy per $1 earned in that range.">Shade-In Rate</FieldLabel>
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                step="0.1"
                value={(config.medicareLevyConfig.shadeInRate * 100).toFixed(1)}
                onChange={(e) => {
                  setConfig({
                    ...config,
                    medicareLevyConfig: { ...config.medicareLevyConfig, shadeInRate: (parseFloat(e.target.value) || 0) / 100 },
                  });
                  setHasChanges(true);
                }}
                className="w-24 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
              <span className="text-slate-500">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* LITO */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Low Income Tax Offset (LITO)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel tip="The full LITO amount available to taxpayers earning below the full threshold. Currently $700 for 2025-26.">Maximum Offset</FieldLabel>
            <input
              type="number"
              value={config.litoConfig.maxOffset}
              onChange={(e) => {
                setConfig({ ...config, litoConfig: { ...config.litoConfig, maxOffset: parseFloat(e.target.value) || 0 } });
                setHasChanges(true);
              }}
              className="w-full mt-1 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <div>
            <FieldLabel tip="Taxable income up to this amount receives the full LITO. Above this, the offset starts phasing out.">Full Threshold</FieldLabel>
            <input
              type="number"
              value={config.litoConfig.fullThreshold}
              onChange={(e) => {
                setConfig({ ...config, litoConfig: { ...config.litoConfig, fullThreshold: parseInt(e.target.value) || 0 } });
                setHasChanges(true);
              }}
              className="w-full mt-1 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <div>
            <FieldLabel tip="Rate at which LITO reduces per dollar earned above the full threshold. E.g. 5% means the offset drops by 5c per $1.">Phase-Out 1 Rate</FieldLabel>
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                step="0.1"
                value={(config.litoConfig.phaseOut1Rate * 100).toFixed(1)}
                onChange={(e) => {
                  setConfig({ ...config, litoConfig: { ...config.litoConfig, phaseOut1Rate: (parseFloat(e.target.value) || 0) / 100 } });
                  setHasChanges(true);
                }}
                className="w-24 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
              <span className="text-slate-500">%</span>
            </div>
          </div>
          <div>
            <FieldLabel tip="Taxable income at or above this amount receives no LITO at all. The offset has fully phased out.">Zero Threshold</FieldLabel>
            <input
              type="number"
              value={config.litoConfig.zeroThreshold}
              onChange={(e) => {
                setConfig({ ...config, litoConfig: { ...config.litoConfig, zeroThreshold: parseInt(e.target.value) || 0 } });
                setHasChanges(true);
              }}
              className="w-full mt-1 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Small Business Offset */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Small Business Income Tax Offset</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FieldLabel tip="Percentage of tax on net small business income that is offset. Currently 16% for 2025-26.">Rate</FieldLabel>
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                step="0.1"
                value={(config.smallBusinessOffset.rate * 100).toFixed(1)}
                onChange={(e) => {
                  setConfig({ ...config, smallBusinessOffset: { ...config.smallBusinessOffset, rate: (parseFloat(e.target.value) || 0) / 100 } });
                  setHasChanges(true);
                }}
                className="w-24 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
              <span className="text-slate-500">%</span>
            </div>
          </div>
          <div>
            <FieldLabel tip="Maximum offset amount. The offset cannot exceed this regardless of income. Currently $1,000.">Cap</FieldLabel>
            <input
              type="number"
              value={config.smallBusinessOffset.cap}
              onChange={(e) => {
                setConfig({ ...config, smallBusinessOffset: { ...config.smallBusinessOffset, cap: parseFloat(e.target.value) || 0 } });
                setHasChanges(true);
              }}
              className="w-full mt-1 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <div>
            <FieldLabel tip="Aggregated turnover must be below this to qualify for the offset. Currently $5 million.">Turnover Threshold</FieldLabel>
            <input
              type="number"
              value={config.smallBusinessOffset.turnoverThreshold}
              onChange={(e) => {
                setConfig({ ...config, smallBusinessOffset: { ...config.smallBusinessOffset, turnoverThreshold: parseInt(e.target.value) || 0 } });
                setHasChanges(true);
              }}
              className="w-full mt-1 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Super Guarantee */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Superannuation Guarantee</h3>
        <div className="flex items-center gap-2">
          <FieldLabel tip="The compulsory super contribution rate for employees. Used for reference only — not included in tax calculations. Currently 12% for 2025-26.">Rate:</FieldLabel>
          <input
            type="number"
            step="0.5"
            value={(config.superGuaranteeRate * 100).toFixed(1)}
            onChange={(e) => {
              setConfig({ ...config, superGuaranteeRate: (parseFloat(e.target.value) || 0) / 100 });
              setHasChanges(true);
            }}
            className="w-24 px-2 py-1 border rounded text-right font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
          />
          <span className="text-slate-500">%</span>
        </div>
      </div>

      {/* Summary preview */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">Preview: {config.financialYear}</h3>
        <div className="space-y-1 text-sm">
          {config.brackets.map((b, i) => (
            <div key={i} className="flex justify-between font-mono text-blue-800 dark:text-blue-200">
              <span>
                {formatCurrency(b.min)} {b.max ? `- ${formatCurrency(b.max)}` : '+'}
              </span>
              <span>{formatPercent(b.rate)}{b.baseTax > 0 ? ` + ${formatCurrency(b.baseTax)} base` : ''}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-blue-200 dark:border-blue-700 mt-2 space-y-1">
            <div className="flex justify-between text-blue-800 dark:text-blue-200">
              <span>Medicare Levy</span>
              <span className="font-mono">{formatPercent(config.medicareLevyConfig.rate)}</span>
            </div>
            <div className="flex justify-between text-blue-800 dark:text-blue-200">
              <span>LITO (max)</span>
              <span className="font-mono">{formatCurrency(config.litoConfig.maxOffset)}</span>
            </div>
            <div className="flex justify-between text-blue-800 dark:text-blue-200">
              <span>SB Offset</span>
              <span className="font-mono">{formatPercent(config.smallBusinessOffset.rate)} (cap {formatCurrency(config.smallBusinessOffset.cap)})</span>
            </div>
            <div className="flex justify-between text-blue-800 dark:text-blue-200">
              <span>Super Guarantee</span>
              <span className="font-mono">{formatPercent(config.superGuaranteeRate)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
