import { RegisterGrid } from './RegisterGrid';

interface RegisterViewProps {
  accountId: string;
  highlightTransactionId?: string | null;
  onNavigateToAccount?: (accountId: string, transactionId: string) => void;
  onSearchPayee?: (payee: string) => void;
}

export function RegisterView({ accountId, highlightTransactionId, onNavigateToAccount, onSearchPayee }: RegisterViewProps) {
  return (
    <div className="space-y-6">
      <RegisterGrid
        accountId={accountId}
        highlightTransactionId={highlightTransactionId}
        onNavigateToAccount={onNavigateToAccount}
        onSearchPayee={onSearchPayee}
      />
    </div>
  );
}
