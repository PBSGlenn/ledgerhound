import { RegisterGrid } from './RegisterGrid';

interface RegisterViewProps {
  accountId: string;
}

export function RegisterView({ accountId }: RegisterViewProps) {
  return (
    <div className="space-y-6">
      <RegisterGrid accountId={accountId} />
    </div>
  );
}
