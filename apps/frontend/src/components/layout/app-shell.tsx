'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';

const NAV_ITEMS = [
  { href: '/overview', label: 'Overview' },
  { href: '/import', label: 'Import' },
  { href: '/reconciliation', label: 'Reconciliation', primary: true },
  { href: '/exceptions', label: 'Exceptions' },
  { href: '/activity', label: 'Activity' },
  { href: '/report', label: 'Report' },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-52 flex-col border-r border-zinc-200 bg-white">
        <div className="flex h-12 items-center border-b border-zinc-200 px-4">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Reconcile</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] font-medium transition-none',
                  active
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
                )}
              >
                <span>{item.label}</span>
                {'primary' in item && item.primary ? (
                  <span aria-hidden className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    main
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 p-3">
          <p className="truncate text-xs font-medium text-zinc-700">{currentUser?.fullName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{currentUser?.email}</p>
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </aside>

      <div className="ml-52 flex min-h-screen w-full flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
