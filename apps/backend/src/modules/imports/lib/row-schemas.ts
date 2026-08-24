import { z } from 'zod';
import { settlementLineTypeEnum } from '../../../database/schema';
import { SETTLEMENT_TYPE_SYNONYMS } from './column-specs';
import {
  normalizeAmountToCents,
  normalizeCurrency,
  normalizeDate,
  normalizeReference,
  normalizeText,
  normalizeVendorName,
} from './normalize';

export type SettlementLineTypeValue = (typeof settlementLineTypeEnum.enumValues)[number];

const requiredDate = z.string().superRefine((value, ctx) => {
  if (!normalizeDate(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unrecognized date "${value}"` });
  }
}).transform((value) => normalizeDate(value) as Date);

const optionalDate = z.string().superRefine((value, ctx) => {
  if (value.trim() && !normalizeDate(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unrecognized date "${value}"` });
  }
}).transform((value) => (value.trim() ? (normalizeDate(value) as Date) : undefined));

const amountInCents = z.string().superRefine((value, ctx) => {
  if (normalizeAmountToCents(value) === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unrecognized amount "${value}"` });
  }
}).transform((value) => normalizeAmountToCents(value) as number);

const currencyWithDefault = z.string().superRefine((value, ctx) => {
  if (value.trim() && !normalizeCurrency(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unsupported currency code "${value.trim()}"`,
    });
  }
}).transform((value) => normalizeCurrency(value) ?? 'USD');

const requiredText = z
  .string()
  .transform(normalizeText)
  .pipe(z.string().min(1, 'This field is required'));

const optionalNormalizedVendor = z.string().transform((value) =>
  value.trim() ? normalizeVendorName(value) : undefined,
);

const optionalNormalizedReference = z.string().transform((value) =>
  value.trim() ? normalizeReference(value) : null,
);

const COLUMN_RENAMES: Record<string, string> = {
  amount: 'amountCents',
};

function rowSchemaWithColumnDefaults<T extends z.ZodRawShape>(
  shape: T,
): z.ZodEffects<z.ZodObject<T>, z.output<z.ZodObject<T>>, unknown> {
  return z.preprocess((raw) => {
    const input = typeof raw === 'object' && raw !== null ? { ...(raw as Record<string, unknown>) } : {};

    for (const [from, to] of Object.entries(COLUMN_RENAMES)) {
      if (input[from] !== undefined && input[to] === undefined) {
        input[to] = input[from];
      }

      delete input[from];
    }

    for (const key of Object.keys(shape)) {
      if (input[key] === undefined || input[key] === null) {
        input[key] = '';
      }
    }

    return input;
  }, z.object(shape));
}

export const bankRowSchema = rowSchemaWithColumnDefaults({
  postedAt: requiredDate,
  amountCents: amountInCents,
  currency: currencyWithDefault,
  description: requiredText,
  externalReference: optionalNormalizedReference,
  vendor: optionalNormalizedVendor,
});


export const ledgerRowSchema = rowSchemaWithColumnDefaults({
  postedAt: requiredDate,
  amountCents: amountInCents,
  currency: currencyWithDefault,
  accountCode: requiredText,
  accountName: z.string().transform(normalizeText),
  description: requiredText,
  externalReference: optionalNormalizedReference,
  vendor: optionalNormalizedVendor,
});


export const invoiceRowSchema = rowSchemaWithColumnDefaults({
  invoiceNumber: requiredText,
  issuedAt: requiredDate,
  dueAt: optionalDate,
  amountCents: amountInCents,
  currency: currencyWithDefault,
  vendor: requiredText,
  reference: optionalNormalizedReference,
});


export const settlementLineRowSchema = rowSchemaWithColumnDefaults({
  settlementReference: requiredText,
  settlementDate: requiredDate,
  provider: requiredText,
  currency: currencyWithDefault,
  type: z.string().superRefine((value, ctx) => {
    if (!resolveSettlementLineType(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown settlement line type "${value.trim()}"`,
      });
    }
  }).transform((value) => resolveSettlementLineType(value) as SettlementLineTypeValue),
  description: requiredText,
  amountCents: amountInCents,
  reference: optionalNormalizedReference,
});


function resolveSettlementLineType(value: string): SettlementLineTypeValue | undefined {
  const key = value.trim().toLowerCase();
  const synonym = SETTLEMENT_TYPE_SYNONYMS[key];

  if (synonym && (settlementLineTypeEnum.enumValues as readonly string[]).includes(synonym)) {
    return synonym as SettlementLineTypeValue;
  }

  return (settlementLineTypeEnum.enumValues as readonly string[]).includes(key)
    ? (key as SettlementLineTypeValue)
    : undefined;
}

export function formatRowIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(row)'}: ${issue.message}`)
    .join('; ');
}
