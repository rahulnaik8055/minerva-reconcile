import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/features/auth/components/register-form';

export const metadata: Metadata = {
  title: 'Register | Reconcile',
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-serif text-title font-semibold tracking-tight text-foreground">
          Reconcile
        </p>

        <div className="space-y-8 rounded-md border border-border bg-surface p-6 sm:p-8">
          <div className="space-y-1.5 text-center">
            <h1 className="font-serif text-title font-semibold tracking-tight text-foreground">Create your account</h1>
            <p className="text-secondary text-foreground-muted">Set up your reconciliation workspace</p>
          </div>

          <RegisterForm />

          <p className="text-center text-secondary text-foreground-muted">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
