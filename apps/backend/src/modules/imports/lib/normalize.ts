const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeText(value: string): string {
  return collapseWhitespace(value);
}

export function normalizeDate(input: string): Date | undefined {
  const value = input.trim();

  if (!value) {
    return undefined;
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(value);
  if (iso) {
    return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const isoSlash = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(value);
  if (isoSlash) {
    return buildDate(Number(isoSlash[1]), Number(isoSlash[2]), Number(isoSlash[3]));
  }

  const usSlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (usSlash) {
    return buildDate(Number(usSlash[3]), Number(usSlash[1]), Number(usSlash[2]));
  }

  const euDot = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (euDot) {
    return buildDate(Number(euDot[3]), Number(euDot[2]), Number(euDot[1]));
  }

  const dayMonthYear = /^(\d{1,2}) ([A-Za-z]{3,9})\.?,? (\d{4})$/.exec(value);
  if (dayMonthYear) {
    return buildDate(Number(dayMonthYear[3]), monthIndex(dayMonthYear[2]), Number(dayMonthYear[1]));
  }

  const monthDayYear = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(value);
  if (monthDayYear) {
    return buildDate(Number(monthDayYear[3]), monthIndex(monthDayYear[1]), Number(monthDayYear[2]));
  }

  return undefined;
}

function monthIndex(name: string): number | undefined {
  return MONTH_INDEX[name.trim().toLowerCase().slice(0, 3)];
}

function buildDate(year: number, month: number | undefined, day: number): Date | undefined {
  if (month === undefined || month < 1 || month > 12 || day < 1) {
    return undefined;
  }

  const monthIndex = month - 1;
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date;
}

export function normalizeAmountToCents(input: string): number | undefined {
  let value = input.trim();

  if (!value) {
    return undefined;
  }

  let negative = false;

  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1).trim();
  }

  value = value.replace(/[$€£¥]/g, '').replace(/\s/g, '');

  if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith('+')) {
    value = value.slice(1);
  }

  if (!/^[\d.,]+$/.test(value)) {
    return undefined;
  }

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    value =
      lastComma > lastDot ? value.replace(/\./g, '').replace(/,/g, '.') : value.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = value.split(',');
    const lastPart = parts[parts.length - 1] ?? '';
    value =
      parts.length === 2 && lastPart.length <= 2
        ? `${parts[0]}.${lastPart}`
        : value.replace(/,/g, '');
  }

  if (!/^\d*(\.\d*)?$/.test(value)) {
    return undefined;
  }

  const [integerRaw = '', fractionRaw = ''] = value.split('.');
  const integerPart = integerRaw === '' ? '0' : integerRaw;

  if (integerPart.length > 13) {
    return undefined;
  }

  const fraction = (fractionRaw + '00').slice(0, 2);
  let cents = Number(integerPart) * 100 + Number(fraction);

  if (fractionRaw.length > 2 && Number(fractionRaw[2]) >= 5) {
    cents += 1;
  }

  return negative ? -cents : cents;
}

export function normalizeCurrency(input: string | undefined): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  const value = input.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(value) ? value : undefined;
}

const LEGAL_SUFFIX_PATTERN = /\s+(inc|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|bv|nv|sa|ag|pty|group|holdings)\.?$/i;

export function normalizeVendorName(input: string): string {
  let value = collapseWhitespace(input)
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/^[^A-Z0-9]+|[^A-Z0-9.]+$/g, '');

  let previous = value;

  do {
    previous = value;
    value = value.replace(LEGAL_SUFFIX_PATTERN, '').trim();
  } while (value !== previous);

  return collapseWhitespace(value.replace(/[.,]+$/, ''));
}

export function normalizeReference(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
