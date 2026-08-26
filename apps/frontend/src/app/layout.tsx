import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, Source_Serif_4 } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { ClerkTokenProvider } from '@/components/providers/clerk-token-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Reconcile',
  description: 'Evidence-first financial reconciliation workbench.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/login">
      <html lang="en" className={`${inter.variable} ${serif.variable}`}>
        <body className="font-sans">
          <QueryProvider>
            <ClerkTokenProvider>{children}</ClerkTokenProvider>
          </QueryProvider>
          <Toaster position="top-right" toastOptions={{ className: 'font-sans' }} />
        </body>
      </html>
    </ClerkProvider>
  );
}
