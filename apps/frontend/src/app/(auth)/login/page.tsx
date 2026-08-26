'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import { Alert } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, errors } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function getErrorMessage(): string | null {
    if (error) return error;
    if (errors?.fields?.identifier?.message) return errors.fields.identifier.message;
    if (errors?.fields?.password?.message) return errors.fields.password.message;
    if (errors?.global?.[0]?.message) return errors.global[0].message;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize();
        if (!finalizeError) window.location.href = '/overview';
      }
    } catch (err) {
      const message =
        (err as { errors?: { message: string }[] }).errors?.[0]?.message ??
        'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const displayError = getErrorMessage();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-serif text-title font-semibold tracking-tight text-foreground">
          Matchbook
        </p>

        <div className="space-y-4 rounded-md border border-border bg-surface p-6 sm:p-8">
          <div className="space-y-1.5 text-center">
            <h1 className="font-serif text-title font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-secondary text-foreground-muted">
              Sign in to continue to your workspace
            </p>
          </div>

          {displayError && <Alert>{displayError}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div id="clerk-captcha" />
            <FormField label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-secondary text-foreground-muted">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
