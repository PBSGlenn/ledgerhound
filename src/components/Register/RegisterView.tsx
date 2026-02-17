import { RegisterGrid } from './RegisterGrid';

interface RegisterViewProps {
  accountId: string;
  highlightTransactionId?: string | null;
  onNavigateToAccount?: (accountId: string) => void;
}

export function RegisterView({ accountId, highlightTransactionId, onNavigateToAccount }: RegisterViewProps) {
  return (
    <div className="space-y-6">
      <RegisterGrid
        accountId={accountId}
        highlightTransactionId={highlightTransactionId}
        onNavigateToAccount={onNavigateToAccount}
      />
    </div>
  );
}
