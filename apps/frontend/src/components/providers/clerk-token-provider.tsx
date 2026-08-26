'use client';

import { useLayoutEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { setTokenProvider } from '@/lib/api';

export function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  useLayoutEffect(() => {
    setTokenProvider(getToken);
  }, [getToken]);

  if (!isLoaded) {
    return null;
  }

  return <>{children}</>;
}
