import { AccountsNav } from '@/features/accounts/components/accounts-nav';

export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Every bill, every payment, every party balance — the whole money position in one place.
        </p>
      </div>
      <AccountsNav />
      {children}
    </div>
  );
}
