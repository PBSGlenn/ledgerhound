import { RegisterGrid } from './RegisterGrid';

interface RegisterViewProps {
  accountId: string;
  onNavigateToAccount?: (accountId: string) => void;
}

export function RegisterView({ accountId, onNavigateToAccount }: RegisterViewProps) {
  return (
    <div className="space-y-6">
      <RegisterGrid accountId={accountId} onNavigateToAccount={onNavigateToAccount} />
    </div>
  );
}
