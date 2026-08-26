export interface DemoBankRow {
  postedAt: string;
  amountCents: number;
  currency: string;
  vendor: string;
  description: string;
  externalReference: string;
}

export interface DemoLedgerRow {
  postedAt: string;
  amountCents: number;
  currency: string;
  accountCode: string;
  accountName: string;
  description: string;
  vendor: string;
  externalReference: string;
}

export interface DemoInvoiceRow {
  invoiceNumber: string;
  issuedAt: string;
  dueAt: string;
  amountCents: number;
  currency: string;
  vendor: string;
  reference: string;
}

export interface DemoSettlementLineRow {
  settlementReference: string;
  settlementDate: string;
  provider: string;
  currency: string;
  type: 'sale' | 'fee' | 'refund' | 'deduction' | 'adjustment';
  description: string;
  amountCents: number;
  reference: string;
}

// ---------- 10 bank transactions ----------
// Each row exists to demonstrate one specific engine behavior.
// All dates within August 2026 for coherent Report-page totals.

export const DEMO_BANK_ROWS: DemoBankRow[] = [
  // 1. Clean exact match — rent payment ($650)
  {
    postedAt: '2026-08-04',
    amountCents: 65_000,
    currency: 'USD',
    vendor: 'Halloway Property Group',
    description: 'Payment Halloway Property Group August rent',
    externalReference: 'RENT-001',
  },
  // 2. Clean exact match — software subscription ($240)
  {
    postedAt: '2026-08-05',
    amountCents: 24_000,
    currency: 'USD',
    vendor: 'CloudServ Inc',
    description: 'ACH debit CloudServ Inc monthly subscription',
    externalReference: 'CS-2024',
  },
  // 3. Fuzzy vendor match — "AMZN WEB SERVICES" vs "Amazon Web Services" ($320)
  {
    postedAt: '2026-08-06',
    amountCents: 32_000,
    currency: 'USD',
    vendor: 'AMZN WEB SERVICES',
    description: 'AWS monthly infrastructure charge',
    externalReference: 'AWS-001',
  },
  // 4. Reference format mismatch — bank "3152-B" vs invoice "INV-3152" ($150)
  {
    postedAt: '2026-08-07',
    amountCents: 15_000,
    currency: 'USD',
    vendor: 'Midwest Printing Co',
    description: 'Printing services Midwest Printing',
    externalReference: '3152-B',
  },
  // 5. Ambiguous match — two ledger entries score identically ($500)
  {
    postedAt: '2026-08-08',
    amountCents: 50_000,
    currency: 'USD',
    vendor: 'PARKVIEW STATIONERY',
    description: 'ACH debit PARKVIEW STATIONERY supplies',
    externalReference: '',
  },
  // 6. Clean settlement — net $4,600 matches bank deposit ($4,600)
  {
    postedAt: '2026-08-15',
    amountCents: 460_000,
    currency: 'USD',
    vendor: 'Stripe',
    description: 'Stripe payout SET-2026-0815',
    externalReference: 'SET-2026-0815',
  },
  // 7. Settlement exception — bank deposited $95 less than expected net ($3,050 vs $3,145)
  {
    postedAt: '2026-08-20',
    amountCents: 305_000,
    currency: 'USD',
    vendor: 'Stripe',
    description: 'Stripe payout SET-2026-0820',
    externalReference: 'SET-2026-0820',
  },
  // 8. Unmatched transaction — no corresponding record anywhere ($89)
  {
    postedAt: '2026-08-12',
    amountCents: 8_900,
    currency: 'USD',
    vendor: 'Verdant Market',
    description: 'Card purchase Verdant Market groceries',
    externalReference: '',
  },
  // 9. Currency mismatch — EUR candidate excluded by currenciesCompatible ($2,100)
  {
    postedAt: '2026-08-13',
    amountCents: 210_000,
    currency: 'USD',
    vendor: 'Folio Books',
    description: 'ACH debit Folio Books wholesale order',
    externalReference: 'FB-442',
  },
  // 10. Date outside tolerance — 7 days apart, lower score ($5,200)
  {
    postedAt: '2026-08-10',
    amountCents: 520_000,
    currency: 'USD',
    vendor: 'Greenfield Consulting',
    description: 'Payment Greenfield Consulting audit engagement',
    externalReference: 'GC-5500',
  },
];

// ---------- 6 ledger entries ----------
// 1+2: exact matches, 3: fuzzy vendor, 5a+5b: ambiguous pair, 10: date outside window

export const DEMO_LEDGER_ROWS: DemoLedgerRow[] = [
  // 1. Exact match — rent
  {
    postedAt: '2026-08-04',
    amountCents: 65_000,
    currency: 'USD',
    accountCode: '6305',
    accountName: 'Rent',
    description: 'Halloway Property Group August rent',
    vendor: 'Halloway Property Group',
    externalReference: 'RENT-001',
  },
  // 2. Exact match — software subscription
  {
    postedAt: '2026-08-05',
    amountCents: 24_000,
    currency: 'USD',
    accountCode: '6110',
    accountName: 'Software Subscriptions',
    description: 'CloudServ Inc monthly subscription',
    vendor: 'CloudServ Inc',
    externalReference: 'CS-2024',
  },
  // 3. Fuzzy vendor match — full name "Amazon Web Services" vs bank's abbreviated form
  {
    postedAt: '2026-08-06',
    amountCents: 32_000,
    currency: 'USD',
    accountCode: '6110',
    accountName: 'Cloud Infrastructure',
    description: 'Amazon Web Services hosting',
    vendor: 'Amazon Web Services',
    externalReference: 'AWS-001',
  },
  // 5a. Ambiguous candidate A
  {
    postedAt: '2026-08-08',
    amountCents: 50_000,
    currency: 'USD',
    accountCode: '6410',
    accountName: 'Office Supplies',
    description: 'Parkview Stationery bulk order',
    vendor: 'Parkview Stationery',
    externalReference: 'PS-BULK',
  },
  // 5b. Ambiguous candidate B
  {
    postedAt: '2026-08-08',
    amountCents: 50_000,
    currency: 'USD',
    accountCode: '6410',
    accountName: 'Office Supplies',
    description: 'Parkview Stationery monthly restock',
    vendor: 'Parkview Stationery',
    externalReference: 'PS-MONTH',
  },
  // 10. Date outside tolerance — 7 days after bank posting (outside 5-day window)
  {
    postedAt: '2026-08-17',
    amountCents: 520_000,
    currency: 'USD',
    accountCode: '7110',
    accountName: 'Professional Services',
    description: 'Greenfield Consulting audit engagement',
    vendor: 'Greenfield Consulting',
    externalReference: 'GC-5500',
  },
];

// ---------- 2 invoices ----------
// Item 4: reference format mismatch, Item 9: currency mismatch candidate

export const DEMO_INVOICE_ROWS: DemoInvoiceRow[] = [
  // 4. Reference format mismatch — bank "3152-B" vs invoice ref "INV-3152"
  {
    invoiceNumber: 'INV-3152',
    issuedAt: '2026-08-07',
    dueAt: '2026-09-06',
    amountCents: 15_000,
    currency: 'USD',
    vendor: 'Midwest Printing Co',
    reference: 'INV-3152',
  },
  // 9. Currency mismatch — EUR, same numeric amount as bank row 9
  {
    invoiceNumber: 'INV-442',
    issuedAt: '2026-08-13',
    dueAt: '2026-09-12',
    amountCents: 210_000,
    currency: 'EUR',
    vendor: 'Folio Books',
    reference: 'FB-442',
  },
];

// ---------- 6 settlement lines across 2 settlements ----------
// Settlement 1 (SET-2026-0815): clean — net $4,600.00 = bank deposit
//   sale 500000 - fee 25000 - refund 15000 + deduction 0 = 460000
// Settlement 2 (SET-2026-0820): exception — expected net $3,145.00 but bank deposited $3,050.00
//   sale 350000 - fee 35500 = 314500 expected. Bank = 305000. Variance = -9500 ($95.00).

export const DEMO_SETTLEMENT_LINES: DemoSettlementLineRow[] = [
  // --- Settlement 1: clean exact match ---
  {
    settlementReference: 'SET-2026-0815',
    settlementDate: '2026-08-15',
    provider: 'Stripe',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 8101',
    amountCents: 500_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0815',
    settlementDate: '2026-08-15',
    provider: 'Stripe',
    currency: 'USD',
    type: 'fee',
    description: 'Stripe processing fees',
    amountCents: -25_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0815',
    settlementDate: '2026-08-15',
    provider: 'Stripe',
    currency: 'USD',
    type: 'refund',
    description: 'Customer refund processed',
    amountCents: -15_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0815',
    settlementDate: '2026-08-15',
    provider: 'Stripe',
    currency: 'USD',
    type: 'deduction',
    description: 'Chargeback reserve holdback',
    amountCents: 0,
    reference: '',
  },
  // --- Settlement 2: exception — bank deposited $95 less than expected net ---
  {
    settlementReference: 'SET-2026-0820',
    settlementDate: '2026-08-20',
    provider: 'Stripe',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 8201',
    amountCents: 350_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0820',
    settlementDate: '2026-08-20',
    provider: 'Stripe',
    currency: 'USD',
    type: 'fee',
    description: 'Stripe processing fees',
    amountCents: -35_500,
    reference: '',
  },
];
