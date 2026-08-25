'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Ellipsis, History, LayoutGrid, Menu, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useDemoStatus } from '@/features/reconciliation/hooks/use-demo';

const NAV_ITEMS = [
  { href: '/overview', label: 'Overview' },
  { href: '/import', label: 'Import' },
  { href: '/reconciliation', label: 'Reconciliation', primary: true },
  { href: '/exceptions', label: 'Exceptions' },
  { href: '/activity', label: 'Activity' },
  { href: '/report', label: 'Report' },
] as const;

const MOBILE_NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutGrid },
  { href: '/reconciliation', label: 'Reconcile', icon: ArrowLeftRight },
  { href: '/exceptions', label: 'Exceptions', icon: TriangleAlert },
  { href: '/activity', label: 'Activity', icon: History },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Wordmark() {
  return (
    <span className="font-serif text-base font-semibold tracking-tight text-foreground">
      Reconcile
    </span>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center justify-between rounded-sm px-3 py-1.5 text-meta',
              active
                ? 'bg-surface-muted font-semibold text-foreground'
                : 'font-medium text-foreground-muted hover:bg-surface-muted/70 hover:text-foreground',
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
              />
            ) : null}
            <span>{item.label}</span>
            {'primary' in item && item.primary ? (
              <span
                aria-hidden
                className="text-[9px] font-semibold uppercase tracking-widest text-foreground-muted/70"
              >
                core
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBlock({ onAfterSignOut }: { onAfterSignOut?: () => void }) {
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
    onAfterSignOut?.();
  };

  return (
    <div className="border-t border-border p-3">
      <p className="truncate text-meta font-medium text-foreground">{currentUser?.fullName}</p>
      <p className="mt-0.5 truncate text-meta text-foreground-muted">{currentUser?.email}</p>
      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={handleLogout}>
        Sign out
      </Button>
    </div>
  );
}

function MobileMenu({
  open,
  pathname,
  onClose,
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    document.body.style.overflow = 'hidden';

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/25 animate-fade-in"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-xl animate-fade-in"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pl-4 pr-2">
          <Wordmark />
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu" autoFocus>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks pathname={pathname} onNavigate={onClose} />
        </div>

        <UserBlock onAfterSignOut={onClose} />
      </aside>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: demoStatus } = useDemoStatus();

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const moreActive =
    isActive(pathname, '/import') || isActive(pathname, '/report');

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-surface lg:flex print:hidden">
        <div className="flex h-14 items-center border-b border-border px-5">
          <Wordmark />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted/80">
            Workspace
          </p>
          <NavLinks pathname={pathname} />
        </div>

        <UserBlock />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-border bg-surface px-3 lg:hidden print:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/overview" className="pl-1" aria-label="Reconcile home">
          <Wordmark />
        </Link>
      </header>

      <MobileMenu open={menuOpen} pathname={pathname} onClose={closeMenu} />

      <div className="flex min-h-screen flex-col lg:pl-60 print:pl-0">
        {demoStatus?.demoDataLoaded ? (
          <div
            data-testid="demo-dataset-banner"
            className="border-b border-warning-border bg-warning-bg px-4 py-1.5 text-center text-meta font-medium text-warning-text"
          >
            Demo dataset — synthetic financial data
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-page flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
        aria-label="Primary mobile"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[10px] leading-tight',
                  active
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-foreground-muted',
                )}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight',
              moreActive ? 'font-semibold text-foreground' : 'font-medium text-foreground-muted',
            )}
          >
            <Ellipsis className="h-4.5 w-4.5" aria-hidden />
            <span className="max-w-full truncate">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
