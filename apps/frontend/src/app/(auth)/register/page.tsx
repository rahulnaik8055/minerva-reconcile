'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSignUp } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import { Alert } from '@/components/ui/alert';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, errors } = useSignUp();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  function getErrorMessage(): string | null {
    if (error) return error;
    if (errors?.fields?.firstName?.message) return errors.fields.firstName.message;
    if (errors?.fields?.lastName?.message) return errors.fields.lastName.message;
    if (errors?.fields?.emailAddress?.message) return errors.fields.emailAddress.message;
    if (errors?.fields?.password?.message) return errors.fields.password.message;
    if (errors?.global?.[0]?.message) return errors.global[0].message;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (signUp.status === 'complete') {
        const { error: finalizeError } = await signUp.finalize();
        if (!finalizeError) window.location.href = '/overview';
        return;
      }

      if (signUp.unverifiedFields.includes('email_address')) {
        await signUp.verifications.sendEmailCode();
        setVerifying(true);
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signUp.verifications.verifyEmailCode({
        code: verificationCode,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (signUp.status === 'complete') {
        await signUp.finalize();
        window.location.href = '/overview';
      }
    } catch (err) {
      const message =
        (err as { errors?: { message: string }[] }).errors?.[0]?.message ??
        'Invalid verification code. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const displayError = getErrorMessage();
  const isLoading = loading;

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <p className="mb-6 text-center font-serif text-title font-semibold tracking-tight text-foreground">
            Reconcile
          </p>

          <div className="space-y-4 rounded-md border border-border bg-surface p-6 sm:p-8">
            <div className="space-y-1.5 text-center">
              <h1 className="font-serif text-title font-semibold tracking-tight text-foreground">
                Check your email
              </h1>
              <p className="text-secondary text-foreground-muted">
                We sent a verification code to <strong>{email}</strong>
              </p>
            </div>

            {displayError && <Alert>{displayError}</Alert>}

            <form onSubmit={handleVerify} className="space-y-4">
              <FormField label="Verification code" htmlFor="code">
                <Input
                  id="code"
                  placeholder="Enter the 6-digit code"
                  autoComplete="one-time-code"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </FormField>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {loading ? 'Verifying…' : 'Verify email'}
              </Button>
            </form>

            <p className="text-center text-secondary text-foreground-muted">
              <button
                type="button"
                onClick={() => {
                  setVerifying(false);
                  setVerificationCode('');
                  setError('');
                }}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Back to sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-serif text-title font-semibold tracking-tight text-foreground">
          Reconcile
        </p>

        <div className="space-y-4 rounded-md border border-border bg-surface p-6 sm:p-8">
          <div className="space-y-1.5 text-center">
            <h1 className="font-serif text-title font-semibold tracking-tight text-foreground">
              Create your account
            </h1>
            <p className="text-secondary text-foreground-muted">
              Set up your reconciliation workspace
            </p>
          </div>

          {displayError && <Alert>{displayError}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div id="clerk-captcha" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" htmlFor="firstName">
                <Input
                  id="firstName"
                  placeholder="Jane"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </FormField>

              <FormField label="Last name" htmlFor="lastName">
                <Input
                  id="lastName"
                  placeholder="Smith"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </FormField>
            </div>

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
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-secondary text-foreground-muted">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
