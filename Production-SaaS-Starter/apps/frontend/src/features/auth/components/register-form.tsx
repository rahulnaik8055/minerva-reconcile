'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { ApiError } from '@/lib/api';
import { registerSchema, type RegisterFormValues } from '../schemas/auth.schemas';
import { useAuth } from '../hooks/use-auth';

export function RegisterForm() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);

    try {
      await registerUser({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      toast.success('Welcome! Your account has been created successfully.');
      router.push('/dashboard');
      router.refresh();
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

      <FormField label="Full name" htmlFor="register-fullName" error={errors.fullName?.message}>
        <Input
          id="register-fullName"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          error={!!errors.fullName}
          {...register('fullName')}
        />
      </FormField>

      <FormField label="Email" htmlFor="register-email" error={errors.email?.message}>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={!!errors.email}
          {...register('email')}
        />
      </FormField>

      <FormField label="Password" htmlFor="register-password" error={errors.password?.message}>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={!!errors.password}
          {...register('password')}
        />
      </FormField>

      <FormField
        label="Confirm password"
        htmlFor="register-confirmPassword"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id="register-confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={!!errors.confirmPassword}
          {...register('confirmPassword')}
        />
      </FormField>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
}
