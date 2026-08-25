'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { ApiError } from '@/lib/api';
import { loginSchema, type LoginFormValues } from '../schemas/auth.schemas';
import { useAuth } from '../hooks/use-auth';

export function LoginForm() {
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);

    try {
      await login(values);
      window.location.href = '/overview';
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'An unexpected error occurred. Please try again.',
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}

      <FormField label="Email" htmlFor="login-email" error={errors.email?.message}>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={!!errors.email}
          {...register('email')}
        />
      </FormField>

      <FormField label="Password" htmlFor="login-password" error={errors.password?.message}>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={!!errors.password}
          {...register('password')}
        />
      </FormField>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
