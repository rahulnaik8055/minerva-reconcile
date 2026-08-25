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

// ---------- 14 bank transactions ----------
// Each row exists to demonstrate one specific engine behavior.
// All dates within August 2026 for coherent Report-page totals.

export const DEMO_BANK_ROWS: DemoBankRow[] = [
  // 1. Clean exact match — rent payment ($6,500)
  {
    postedAt: '2026-08-04',
    amountCents: 650_000,
    currency: 'USD',
    vendor: 'Halloway Property Group',
    description: 'Payment Halloway Property Group August rent',
    externalReference: 'RENT-AUG',
  },
  // 2. Clean exact match — software subscription ($2,400)
  {
    postedAt: '2026-08-05',
    amountCents: 240_000,
    currency: 'USD',
    vendor: 'CloudServ Inc',
    description: 'ACH debit CloudServ Inc monthly subscription',
    externalReference: 'CS-2025',
  },
  // 3. Fuzzy vendor match — "RIO GRANDE OFFC SUPPLY" vs "RIO GRANDE OFFICE SUPPLY" ($325)
  {
    postedAt: '2026-08-06',
    amountCents: 32_500,
    currency: 'USD',
    vendor: 'RIO GRANDE OFFC SUPPLY',
    description: 'Card purchase RIO GRANDE OFFC SUPPLY',
    externalReference: 'RG-881',
  },
  // 4. Reference format mismatch — bank "3152-B" vs invoice "INV-3152" ($332)
  {
    postedAt: '2026-08-07',
    amountCents: 33_200,
    currency: 'USD',
    vendor: 'Tidewater Charters',
    description: 'Payment Tidewater Charters boat rental',
    externalReference: '3152-B',
  },
  // 5. Near-exact amount — bank $100, ledger $99 ($1 off, within tolerance)
  {
    postedAt: '2026-08-08',
    amountCents: 10_000,
    currency: 'USD',
    vendor: 'Netgear Solutions',
    description: 'Card purchase Netgear Solutions',
    externalReference: 'INV-2087',
  },
  // 6. Ambiguous match — two ledger entries score identically for this bank row ($500)
  {
    postedAt: '2026-08-11',
    amountCents: 50_000,
    currency: 'USD',
    vendor: 'PARKVIEW STATIONERY',
    description: 'ACH debit PARKVIEW STATIONERY supplies',
    externalReference: 'VND-4410',
  },
  // 7. Unmatched transaction — no matching record anywhere ($47.50)
  {
    postedAt: '2026-08-12',
    amountCents: 4_750,
    currency: 'USD',
    vendor: 'Blue Bottle Coffee',
    description: 'Card purchase Blue Bottle Coffee',
    externalReference: '',
  },
  // 8. Settlement — clean payout, net $4,600 matches bank deposit ($4,600)
  {
    postedAt: '2026-08-25',
    amountCents: 460_000,
    currency: 'USD',
    vendor: 'Brightpay',
    description: 'Brightpay payout SET-2026-0825',
    externalReference: 'SET-2026-0825',
  },
  // 9. Unmatched transaction — no matching record anywhere ($89)
  {
    postedAt: '2026-08-14',
    amountCents: 8_900,
    currency: 'USD',
    vendor: 'Verdant Market',
    description: 'Card purchase Verdant Market groceries',
    externalReference: '',
  },
  // 10. Currency mismatch — EUR ledger entry cannot match this USD bank row ($2,100)
  {
    postedAt: '2026-08-13',
    amountCents: 210_000,
    currency: 'USD',
    vendor: 'Folio Books',
    description: 'ACH debit Folio Books wholesale order',
    externalReference: 'FB-442',
  },
  // 11. Date outside tolerance — 7 days apart, still surfaces but lower score ($5,200)
  {
    postedAt: '2026-08-10',
    amountCents: 520_000,
    currency: 'USD',
    vendor: 'Greenfield Consulting',
    description: 'Payment Greenfield Consulting audit engagement',
    externalReference: 'GC-5500',
  },
  // 12. Clean exact match ($1,500)
  {
    postedAt: '2026-08-18',
    amountCents: 150_000,
    currency: 'USD',
    vendor: 'Crestview Legal',
    description: 'Payment Crestview Legal retainer August',
    externalReference: 'CL-901',
  },
  // 13. Settlement — exception payout, bank deposited $95 less than expected net ($3,850 vs $4,800)
  {
    postedAt: '2026-08-29',
    amountCents: 385_000,
    currency: 'USD',
    vendor: 'Brightpay',
    description: 'Brightpay payout SET-2026-0829',
    externalReference: 'SET-2026-0829',
  },
  // 14. Clean exact match ($780)
  {
    postedAt: '2026-08-20',
    amountCents: 78_000,
    currency: 'USD',
    vendor: 'Fernbrook IT Services',
    description: 'Payment Fernbrook IT Services support',
    externalReference: 'FB-301',
  },
];

// ---------- 10 ledger entries ----------
// Items 1-2: exact matches, 3: fuzzy vendor, 5: amount tolerance,
// 6a+6b: ambiguous pair, 10: EUR (currency mismatch), 11: date outside window,
// 12+14: exact matches

export const DEMO_LEDGER_ROWS: DemoLedgerRow[] = [
  // 1. Exact match — rent
  {
    postedAt: '2026-08-04',
    amountCents: 650_000,
    currency: 'USD',
    accountCode: '6305',
    accountName: 'Rent',
    description: 'Halloway Property Group August rent',
    vendor: 'Halloway Property Group',
    externalReference: 'RENT-AUG',
  },
  // 2. Exact match — software subscription
  {
    postedAt: '2026-08-05',
    amountCents: 240_000,
    currency: 'USD',
    accountCode: '6110',
    accountName: 'Software Subscriptions',
    description: 'CloudServ Inc monthly subscription',
    vendor: 'CloudServ Inc',
    externalReference: 'CS-2025',
  },
  // 3. Fuzzy vendor match — full name "Rio Grande Office Supply" vs bank's abbreviated form
  {
    postedAt: '2026-08-06',
    amountCents: 32_500,
    currency: 'USD',
    accountCode: '6410',
    accountName: 'Office Supplies',
    description: 'Rio Grande Office Supply restock',
    vendor: 'Rio Grande Office Supply',
    externalReference: 'RG-881',
  },
  // 5. Near-exact amount — $1 less than bank ($99 vs $100, within tolerance)
  {
    postedAt: '2026-08-08',
    amountCents: 9_900,
    currency: 'USD',
    accountCode: '6110',
    accountName: 'Software Subscriptions',
    description: 'Netgear Solutions license renewal',
    vendor: 'Netgear Solutions',
    externalReference: 'INV-2087',
  },
  // 6a. Ambiguous candidate A for bank-6
  {
    postedAt: '2026-08-11',
    amountCents: 50_000,
    currency: 'USD',
    accountCode: '6410',
    accountName: 'Office Supplies',
    description: 'Parkview Stationery bulk order',
    vendor: 'Parkview Stationery',
    externalReference: 'PS-BULK',
  },
  // 6b. Ambiguous candidate B for bank-6
  {
    postedAt: '2026-08-11',
    amountCents: 50_000,
    currency: 'USD',
    accountCode: '6410',
    accountName: 'Office Supplies',
    description: 'Parkview Stationery monthly restock',
    vendor: 'Parkview Stationery',
    externalReference: 'VND-9999',
  },
  // 10. Currency mismatch — EUR entry, same numeric amount, different currency
  {
    postedAt: '2026-08-13',
    amountCents: 210_000,
    currency: 'EUR',
    accountCode: '5120',
    accountName: 'Books & Publications',
    description: 'Folio Books wholesale order',
    vendor: 'Folio Books',
    externalReference: 'FB-442',
  },
  // 11. Date outside tolerance — 7 days after bank posting (outside 5-day window)
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
  // 12. Exact match
  {
    postedAt: '2026-08-18',
    amountCents: 150_000,
    currency: 'USD',
    accountCode: '6610',
    accountName: 'Legal Fees',
    description: 'Crestview Legal retainer August',
    vendor: 'Crestview Legal',
    externalReference: 'CL-901',
  },
  // 14. Exact match
  {
    postedAt: '2026-08-20',
    amountCents: 78_000,
    currency: 'USD',
    accountCode: '6110',
    accountName: 'Software Subscriptions',
    description: 'Fernbrook IT Services support',
    vendor: 'Fernbrook IT Services',
    externalReference: 'FB-301',
  },
];

// ---------- 2 invoices ----------
// Item 4: reference format mismatch (bank "3152-B" vs invoice "INV-3152")

export const DEMO_INVOICE_ROWS: DemoInvoiceRow[] = [
  {
    invoiceNumber: 'INV-3152',
    issuedAt: '2026-08-05',
    dueAt: '2026-09-04',
    amountCents: 33_200,
    currency: 'USD',
    vendor: 'Tidewater Charters',
    reference: '',
  },
  {
    invoiceNumber: 'INV-102',
    issuedAt: '2026-08-10',
    dueAt: '2026-09-09',
    amountCents: 210_000,
    currency: 'EUR',
    vendor: 'Folio Books',
    reference: '',
  },
];

// ---------- 7 settlement lines across 2 settlements ----------
// Settlement 1 (SET-2026-0825): clean — net $4,600.00 = bank deposit
//   sale 400000 + sale 80000 - fee 15000 - refund 5000 + deduction 0 = 460000
// Settlement 2 (SET-2026-0829): exception — expected net $4,800.00 but bank deposited $3,850.00
//   sale 500000 - fee 20000 = 480000 expected. Bank = 385000. Variance = -95000 ($950.00).

export const DEMO_SETTLEMENT_LINES: DemoSettlementLineRow[] = [
  // --- Settlement 1: clean exact match ---
  {
    settlementReference: 'SET-2026-0825',
    settlementDate: '2026-08-25',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 4601',
    amountCents: 400_000,
    reference: 'INV-101',
  },
  {
    settlementReference: 'SET-2026-0825',
    settlementDate: '2026-08-25',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 4602',
    amountCents: 80_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0825',
    settlementDate: '2026-08-25',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'fee',
    description: 'Brightpay processing fees',
    amountCents: -15_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0825',
    settlementDate: '2026-08-25',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'refund',
    description: 'Customer refund processed',
    amountCents: -5_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0825',
    settlementDate: '2026-08-25',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'deduction',
    description: 'Chargeback reserve holdback',
    amountCents: 0,
    reference: '',
  },
  // --- Settlement 2: exception — bank deposited $950 less than expected net ---
  {
    settlementReference: 'SET-2026-0829',
    settlementDate: '2026-08-29',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 4701',
    amountCents: 500_000,
    reference: 'INV-100',
  },
  {
    settlementReference: 'SET-2026-0829',
    settlementDate: '2026-08-29',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'fee',
    description: 'Brightpay processing fees',
    amountCents: -20_000,
    reference: '',
  },
];
