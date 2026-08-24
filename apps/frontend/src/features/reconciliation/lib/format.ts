export function formatCents(amountCents: number | null | undefined, currency = 'USD'): string {
  const value = (amountCents ?? 0) / 100;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedCents(
  amountCents: number | null | undefined,
  currency = 'USD',
): string {
  if (amountCents === null || amountCents === undefined) {
    return '—';
  }

  const sign = amountCents > 0 ? '+' : '';
  return sign + formatCents(amountCents, currency);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }

  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }

  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPercent(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return '—';
  }

  return `${Math.round(score * 100)}%`;
}

export function shortenHash(hash: string, length = 10): string {
  if (hash.length <= length) {
    return hash;
  }

  return `${hash.slice(0, length)}…`;
}
