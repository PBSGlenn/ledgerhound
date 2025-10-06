import { useEffect, useMemo, useRef, useState, useId, type FormEvent } from 'react';
import { accountAPI } from '@/lib/api';
import {
  groupCategoriesByType,
  groupTransfersByType,
  type AccountKind,
  type AccountMeta,
  type CategoryType,
  type TransferType,
} from '@/domain';
import {
  refreshAccountsCache,
  useCategoryAccounts,
  useTransferAccounts,
} from '@/hooks';

interface AccountComboProps {
  mode: AccountKind;
  value?: string;
  onChange: (id: string) => void;
  excludeId?: string;
  placeholder?: string;
}

type GroupedOption = {
  id: string;
  label: string;
  groupKey: CategoryType | TransferType;
  groupLabel: string;
};

type HighlightState = {
  index: number;
  id?: string;
};

const CATEGORY_ORDER: CategoryType[] = ['INCOME', 'EXPENSE'];
const TRANSFER_ORDER: TransferType[] = ['ASSET', 'LIABILITY', 'EQUITY'];

const CATEGORY_LABELS: Record<CategoryType, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
};

const TRANSFER_LABELS: Record<TransferType, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
};

const CREATE_TYPE_OPTIONS: Array<{ value: CategoryType; label: string }> = [
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'INCOME', label: 'Income' },
];

function flattenGroups(
  groups: Record<CategoryType, AccountMeta[]> | Record<TransferType, AccountMeta[]>,
  order: Array<CategoryType | TransferType>,
  labels: Record<string, string>,
): GroupedOption[] {
  const items: GroupedOption[] = [];
  for (const key of order) {
    const accounts = (groups as Record<string, AccountMeta[]>)[key] ?? [];
    for (const account of accounts) {
      items.push({ id: account.id, label: account.name, groupKey: key, groupLabel: labels[key] });
    }
  }
  return items;
}

export function AccountCombo({ mode, value, onChange, excludeId, placeholder = 'Search accounts' }: AccountComboProps) {
  const categoryAccounts = useCategoryAccounts();
  const transferAccounts = useTransferAccounts(excludeId);

  const categoryGroups = useMemo(() => groupCategoriesByType(categoryAccounts), [categoryAccounts]);
  const transferGroups = useMemo(() => groupTransfersByType(transferAccounts), [transferAccounts]);

  const options = useMemo(() => {
    if (mode === 'CATEGORY') {
      return flattenGroups(categoryGroups, CATEGORY_ORDER, CATEGORY_LABELS);
    }
    return flattenGroups(transferGroups, TRANSFER_ORDER, TRANSFER_LABELS);
  }, [categoryGroups, transferGroups, mode]);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<HighlightState>({ index: -1 });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('EXPENSE');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const listboxRef = useRef<HTMLUListElement>(null);
  const comboId = useId();
  const listboxId = `${comboId}-listbox`;

  const trimmedQuery = query.trim();

  const filteredOptions = useMemo(() => {
    if (!trimmedQuery) return options;
    const normalized = trimmedQuery.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, trimmedQuery]);

  const canCreateCategory = mode === 'CATEGORY' && trimmedQuery.length > 0 && filteredOptions.length === 0;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHighlight({ index: -1 });
      setShowCreateForm(false);
      setCreateError(null);
      setCreateBusy(false);
      return;
    }

    if (filteredOptions.length === 0) {
      setHighlight({ index: -1 });
      return;
    }

    setHighlight((prev) => {
      if (prev.index >= 0 && prev.index < filteredOptions.length) {
        const nextId = filteredOptions[prev.index]?.id;
        if (prev.id === nextId) {
          return prev;
        }
        return { index: prev.index, id: nextId };
      }
      const selectedIndex = selectedOption
        ? filteredOptions.findIndex((option) => option.id === selectedOption.id)
        : -1;
      const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
      return { index: nextIndex, id: filteredOptions[nextIndex]?.id };
    });
  }, [filteredOptions, open, selectedOption]);

  useEffect(() => {
    if (!open || highlight.index < 0) return;
    const listbox = listboxRef.current;
    if (!listbox) return;
    const activeItem = listbox.querySelector<HTMLElement>(`[data-index="${highlight.index}"]`);
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [highlight.index, open]);

  useEffect(() => {
    if (!canCreateCategory) {
      setShowCreateForm(false);
      setCreateError(null);
      setCreateBusy(false);
    }
  }, [canCreateCategory]);

  useEffect(() => {
    if (showCreateForm) {
      setNewCategoryName(trimmedQuery);
    }
  }, [showCreateForm, trimmedQuery]);

  useEffect(() => {
    if (mode !== 'CATEGORY') {
      setShowCreateForm(false);
      setCreateError(null);
      setCreateBusy(false);
    }
  }, [mode]);

  const commitSelection = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const moveHighlight = (direction: 1 | -1) => {
    if (!open) {
      setOpen(true);
      return;
    }

    if (filteredOptions.length === 0) {
      setHighlight({ index: -1 });
      return;
    }

    setHighlight((prev) => {
      const current = prev.index >= 0 ? prev.index : direction === 1 ? -1 : filteredOptions.length;
      const nextIndex = Math.max(0, Math.min(current + direction, filteredOptions.length - 1));
      const nextId = filteredOptions[nextIndex]?.id;
      if (prev.index === nextIndex && prev.id === nextId) {
        return prev;
      }
      return { index: nextIndex, id: nextId };
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        moveHighlight(1);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        moveHighlight(-1);
        break;
      }
      case 'Enter': {
        if (showCreateForm && canCreateCategory) {
          return;
        }
        if (open && highlight.index >= 0 && highlight.index < filteredOptions.length) {
          event.preventDefault();
          const option = filteredOptions[highlight.index];
          if (option) {
            commitSelection(option.id);
          }
        }
        break;
      }
      case 'Escape': {
        if (open) {
          event.preventDefault();
          setOpen(false);
          setQuery('');
        }
        break;
      }
      case 'Backspace': {
        if (!query && value) {
          event.preventDefault();
          commitSelection('');
        }
        break;
      }
      default:
        break;
    }
  };

  const activeDescendant = open && highlight.index >= 0 ? `${comboId}-option-${highlight.index}` : undefined;

  const handleCreateTrigger = () => {
    setShowCreateForm(true);
    setNewCategoryType('EXPENSE');
    setCreateError(null);
  };

  const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      setCreateError('Name is required');
      return;
    }

    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await accountAPI.createCategory({
        name,
        type: newCategoryType,
      });
      await refreshAccountsCache();
      if (created?.id) {
        commitSelection(created.id);
      } else {
        setOpen(false);
        setQuery('');
      }
      setShowCreateForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create category';
      setCreateError(message);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="relative" data-account-combo={comboId}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        value={query !== '' ? query : selectedOption?.label ?? ''}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget as HTMLElement | null;
          if (!nextTarget || !listboxRef.current?.contains(nextTarget)) {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder={selectedOption ? undefined : placeholder}
        autoComplete="off"
      />

      {open ? (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-600" role="presentation">
              <p className="mb-2 text-slate-500">No matches</p>
              {canCreateCategory ? (
                showCreateForm ? (
                  <form onSubmit={handleCreateCategory} className="space-y-2" aria-live="polite">
                    <input
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Category name"
                      autoFocus
                    />
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      {CREATE_TYPE_OPTIONS.map((option) => (
                        <label key={option.value} className="inline-flex items-center gap-1">
                          <input
                            type="radio"
                            name={`${comboId}-category-type`}
                            value={option.value}
                            checked={newCategoryType === option.value}
                            onChange={() => setNewCategoryType(option.value)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                    {createError ? (
                      <p className="text-xs text-rose-600">{createError}</p>
                    ) : null}
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setCreateError(null);
                          setCreateBusy(false);
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-200"
                        disabled={createBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-full bg-emerald-500 px-3 py-1 font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
                        disabled={createBusy}
                      >
                        {createBusy ? 'Creating...' : `Create ${newCategoryType.toLowerCase()}`}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateTrigger}
                    onMouseDown={(event) => event.preventDefault()}
                    className="w-full rounded-md border border-dashed border-emerald-300 px-3 py-2 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                  >
                    Create category "{trimmedQuery}" (Income/Expense)
                  </button>
                )
              ) : null}
            </li>
          ) : (
            filteredOptions.map((option, index) => {
              const active = highlight.index === index;
              const prevOption = filteredOptions[index - 1];
              const showGroupHeader = !prevOption || prevOption.groupKey !== option.groupKey;
              const optionClass = [
                'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50',
              ].join(' ');

              return (
                <li key={option.id}>
                  {showGroupHeader ? (
                    <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {option.groupLabel}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    id={`${comboId}-option-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={active}
                    className={optionClass}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commitSelection(option.id)}
                    onMouseEnter={() => setHighlight({ index, id: option.id })}
                    tabIndex={-1}
                  >
                    <span>{option.label}</span>
                    {value === option.id ? <span className="text-xs text-emerald-600">Selected</span> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
