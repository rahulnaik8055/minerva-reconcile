import type { Metadata } from 'next';
import { DashboardHeader } from '@/components/layout/dashboard-header';

export const metadata: Metadata = {
  title: 'Overview | Reconcile',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="rounded-lg border bg-card p-8">
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Evidence-first reconciliation workbench. Import bank transactions and ledger entries to
            start a reconciliation.
          </p>
        </div>
      </main>
    </div>
  );
}
