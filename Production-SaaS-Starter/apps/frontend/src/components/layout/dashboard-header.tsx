'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';

export function DashboardHeader() {
  const router = useRouter();
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            R
          </div>
          <span className="text-lg font-bold">Reconcile</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">{currentUser?.fullName}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
