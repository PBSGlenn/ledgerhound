import { useCallback, useEffect, useState } from 'react';
import { AccountCombo } from '@/components/AccountCombo';
import { explainLineError, validateLine } from '@/domain';
import { ToggleSegment } from './ToggleSegment';

type Mode = 'CATEGORY' | 'TRANSFER';

export interface RowEditorLine {
  categoryId?: string | null;
  transferAccountId?: string | null;
  [key: string]: unknown;
}

interface RowEditorProps {
  line: RowEditorLine;
  onChange: (line: RowEditorLine) => void;
  registerAccountId?: string;
  onValidationError?: (message: string | null) => void;
}

const SAME_ACCOUNT_ERROR = 'Transfers must go to a different account.';

export function RowEditor({ line, onChange, registerAccountId, onValidationError }: RowEditorProps) {
  const derivedMode: Mode = line.transferAccountId ? 'TRANSFER' : 'CATEGORY';
  const [mode, setMode] = useState<Mode>(derivedMode);
  const [error, setError] = useState<string | null>(null);

  const revalidate = useCallback(
    (candidate: RowEditorLine) => {
      try {
        validateLine(candidate);
        setError(null);
        onValidationError?.(null);
      } catch (validationError) {
        const message = explainLineError(validationError);
        setError(message);
        onValidationError?.(message);
      }
    },
    [onValidationError],
  );

  useEffect(() => {
    setMode(derivedMode);
  }, [derivedMode]);

  useEffect(() => {
    revalidate(line);
  }, [line, revalidate]);

  useEffect(() => {
    if (mode === 'TRANSFER' && registerAccountId && line.transferAccountId === registerAccountId) {
      setError(SAME_ACCOUNT_ERROR);
      onValidationError?.(SAME_ACCOUNT_ERROR);
    }
  }, [mode, registerAccountId, line.transferAccountId, onValidationError]);

  const selectedValue = line.categoryId ?? line.transferAccountId ?? undefined;
  const placeholder = mode === 'CATEGORY' ? 'Select a category' : 'Select an account';

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) return;

    setMode(nextMode);
    const nextLine: RowEditorLine = { ...line };

    if (nextMode === 'CATEGORY') {
      delete nextLine.transferAccountId;
    } else {
      delete nextLine.categoryId;
      if (registerAccountId && nextLine.transferAccountId === registerAccountId) {
        delete nextLine.transferAccountId;
      }
    }

    onChange(nextLine);
    revalidate(nextLine);
  };

  const handleSelect = (id: string) => {
    const nextValue = id.trim();

    if (mode === 'TRANSFER' && registerAccountId && nextValue && nextValue === registerAccountId) {
      setError(SAME_ACCOUNT_ERROR);
      onValidationError?.(SAME_ACCOUNT_ERROR);
      return;
    }

    const nextLine: RowEditorLine = { ...line };

    if (mode === 'CATEGORY') {
      if (nextValue) {
        nextLine.categoryId = nextValue;
      } else {
        delete nextLine.categoryId;
      }
      delete nextLine.transferAccountId;
    } else {
      if (nextValue) {
        nextLine.transferAccountId = nextValue;
      } else {
        delete nextLine.transferAccountId;
      }
      delete nextLine.categoryId;
    }

    onChange(nextLine);
    revalidate(nextLine);
  };

  return (
    <div className="space-y-2">
      <ToggleSegment
        value={mode}
        options={[
          { value: 'CATEGORY', label: 'Category' },
          { value: 'TRANSFER', label: 'Transfer' },
        ]}
        onChange={handleModeChange}
      />

      <AccountCombo
        mode={mode}
        value={selectedValue}
        onChange={handleSelect}
        excludeId={registerAccountId}
        placeholder={placeholder}
      />

      {error ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
