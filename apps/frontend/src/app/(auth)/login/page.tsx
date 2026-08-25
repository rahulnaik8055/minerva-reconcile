import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Login | Reconcile',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-serif text-title font-semibold tracking-tight text-foreground">
          Reconcile
        </p>

        <div className="space-y-8 rounded-md border border-border bg-surface p-6 sm:p-8">
          <div className="space-y-1.5 text-center">
            <h1 className="font-serif text-title font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-secondary text-foreground-muted">Sign in to continue to your workspace</p>
          </div>

          <LoginForm />

          <p className="text-center text-secondary text-foreground-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-primary underline-offset-2 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
