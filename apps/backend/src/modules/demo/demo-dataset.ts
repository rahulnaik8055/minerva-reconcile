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

export const DEMO_BANK_ROWS: DemoBankRow[] = [
  {
    postedAt: '2026-08-04',
    amountCents: 98_000,
    currency: 'USD',
    vendor: 'Fernbrook IT Services',
    description: 'Payment Fernbrook IT Services monthly support',
    externalReference: 'FB-90211',
  },
  {
    postedAt: '2026-08-05',
    amountCents: 124_000,
    currency: 'USD',
    vendor: 'Amazon Web Services',
    description: 'AWS cloud services August usage',
    externalReference: 'INV-2087',
  },
  {
    postedAt: '2026-08-05',
    amountCents: 14_500,
    currency: 'USD',
    vendor: 'Granite Peak Parking',
    description: 'Payment Granite Peak Parking monthly pass',
    externalReference: 'GPP-558',
  },
  {
    postedAt: '2026-08-06',
    amountCents: 74_260,
    currency: 'USD',
    vendor: 'Orchard Lane Catering',
    description: 'Payment Orchard Lane Catering team offsite',
    externalReference: 'CAT-7712',
  },
  {
    postedAt: '2026-08-07',
    amountCents: 61_550,
    currency: 'USD',
    vendor: 'AMZN WEB SERVICES',
    description: 'Card purchase AMZN WEB SERVICES overage',
    externalReference: 'AWS-USG-77531',
  },
  {
    postedAt: '2026-08-08',
    amountCents: 110_000,
    currency: 'USD',
    vendor: 'Larkspur Insurance',
    description: 'Payment Larkspur Insurance premium August',
    externalReference: 'INV-2114',
  },
  {
    postedAt: '2026-08-10',
    amountCents: 85_000,
    currency: 'USD',
    vendor: 'Stripe',
    description: 'Stripe payout received',
    externalReference: 'STRP-PAYOUT-4411',
  },
  {
    postedAt: '2026-08-11',
    amountCents: 215_000,
    currency: 'USD',
    vendor: 'Solstice Marketing',
    description: 'Payment Solstice Marketing campaign invoice',
    externalReference: 'SM-1187',
  },
  {
    postedAt: '2026-08-12',
    amountCents: 21_240,
    currency: 'USD',
    vendor: 'Cedar Grove Office Supply',
    description: 'Card purchase Cedar Grove Office Supply',
    externalReference: '',
  },
  {
    postedAt: '2026-08-13',
    amountCents: 8_999,
    currency: 'USD',
    vendor: 'Halcyon Print Studio',
    description: 'Card purchase Halcyon Print Studio',
    externalReference: '',
  },
  {
    postedAt: '2026-08-14',
    amountCents: 230_000,
    currency: 'USD',
    vendor: 'Cloudpeak Analytics',
    description: 'ACH debit Cloudpeak Analytics subscription',
    externalReference: '',
  },
  {
    postedAt: '2026-08-17',
    amountCents: 56_000,
    currency: 'USD',
    vendor: 'Pinehurst Training',
    description: 'Payment Pinehurst Training workshop',
    externalReference: 'PH-664',
  },
  {
    postedAt: '2026-08-18',
    amountCents: 1_250_000,
    currency: 'USD',
    vendor: 'Brightpay',
    description: 'Brightpay payout SET-2026-0818',
    externalReference: 'SET-2026-0818',
  },
  {
    postedAt: '2026-08-19',
    amountCents: 6_425,
    currency: 'USD',
    vendor: 'Meridian Couriers',
    description: 'Card purchase Meridian Couriers',
    externalReference: '',
  },
  {
    postedAt: '2026-08-21',
    amountCents: 31_075,
    currency: 'USD',
    vendor: 'Ravenscourt Utilities',
    description: 'Payment Ravenscourt Utilities invoice UT-33017',
    externalReference: 'UT-33017',
  },
  {
    postedAt: '2026-08-21',
    amountCents: 31_075,
    currency: 'USD',
    vendor: 'Ravenscourt Utilities',
    description: 'Payment Ravenscourt Utilities retry charge',
    externalReference: '',
  },
  {
    postedAt: '2026-08-22',
    amountCents: 96_420,
    currency: 'USD',
    vendor: 'Brightpay',
    description: 'Brightpay payout SET-2026-0822',
    externalReference: 'SET-2026-0822',
  },
];

export const DEMO_LEDGER_ROWS: DemoLedgerRow[] = [
  {
    postedAt: '2026-08-01',
    amountCents: 650_000,
    currency: 'USD',
    accountCode: '6305',
    accountName: 'Rent',
    description: 'Halloway Property Group August rent',
    vendor: 'Halloway Property Group',
    externalReference: 'RENT-AUG',
  },
  {
    postedAt: '2026-08-04',
    amountCents: 98_000,
    currency: 'USD',
    accountCode: '6110',
    accountName: 'Software Subscriptions',
    description: 'Fernbrook IT Services support retainer',
    vendor: 'Fernbrook IT Services',
    externalReference: 'FB-90211',
  },
  {
    postedAt: '2026-08-05',
    amountCents: 124_000,
    currency: 'USD',
    accountCode: '6210',
    accountName: 'Cloud Hosting',
    description: 'Amazon Web Services usage August',
    vendor: 'Amazon Web Services',
    externalReference: 'INV-2087',
  },
  {
    postedAt: '2026-08-05',
    amountCents: 14_500,
    currency: 'USD',
    accountCode: '6520',
    accountName: 'Parking',
    description: 'Granite Peak Parking monthly pass',
    vendor: 'Granite Peak Parking',
    externalReference: 'GPP-558',
  },
  {
    postedAt: '2026-08-07',
    amountCents: 61_550,
    currency: 'USD',
    accountCode: '6210',
    accountName: 'Cloud Hosting',
    description: 'Amazon Web Services usage overage',
    vendor: 'Amazon Web Services',
    externalReference: 'AWS-USG-77531',
  },
  {
    postedAt: '2026-08-08',
    amountCents: 98_500,
    currency: 'USD',
    accountCode: '6740',
    accountName: 'Insurance',
    description: 'Larkspur Insurance premium payable',
    vendor: 'Larkspur Insurance',
    externalReference: 'INV-2114',
  },
  {
    postedAt: '2026-08-09',
    amountCents: 42_750,
    currency: 'USD',
    accountCode: '6610',
    accountName: 'Software Subscriptions',
    description: 'Tessellate Design seat expansion',
    vendor: 'Tessellate Design',
    externalReference: 'TD-8842',
  },
  {
    postedAt: '2026-08-11',
    amountCents: 215_000,
    currency: 'USD',
    accountCode: '7410',
    accountName: 'Marketing',
    description: 'Solstice Marketing campaign spend',
    vendor: 'Solstice Marketing',
    externalReference: 'SM-1187',
  },
  {
    postedAt: '2026-08-12',
    amountCents: 85_000,
    currency: 'USD',
    accountCode: '6310',
    accountName: 'Payment Processing',
    description: 'Stripe payout reconciliation',
    vendor: 'Stripe',
    externalReference: 'STRP-PAYOUT-4411',
  },
  {
    postedAt: '2026-08-13',
    amountCents: 230_000,
    currency: 'USD',
    accountCode: '5240',
    accountName: 'Data Services',
    description: 'Cloudpeak Analytics subscription August',
    vendor: 'Cloudpeak Analytics',
    externalReference: 'LP-9918',
  },
  {
    postedAt: '2026-08-15',
    amountCents: 230_000,
    currency: 'USD',
    accountCode: '5240',
    accountName: 'Data Services',
    description: 'Cloudpeak Analytics subscription rebooking',
    vendor: 'Cloudpeak Analytics',
    externalReference: 'LP-9931',
  },
  {
    postedAt: '2026-08-15',
    amountCents: 74_260,
    currency: 'USD',
    accountCode: '6820',
    accountName: 'Catering',
    description: 'Orchard Lane Catering offsite late posting',
    vendor: 'Orchard Lane Catering',
    externalReference: 'CAT-7712',
  },
  {
    postedAt: '2026-08-17',
    amountCents: 56_000,
    currency: 'USD',
    accountCode: '6910',
    accountName: 'Training',
    description: 'Pinehurst Training workshop fees',
    vendor: 'Pinehurst Training',
    externalReference: 'PH-664',
  },
  {
    postedAt: '2026-08-21',
    amountCents: 31_075,
    currency: 'USD',
    accountCode: '6410',
    accountName: 'Utilities',
    description: 'Ravenscourt Utilities invoice',
    vendor: 'Ravenscourt Utilities',
    externalReference: 'UT-33017',
  },
  {
    postedAt: '2026-08-28',
    amountCents: 1_840_000,
    currency: 'USD',
    accountCode: '6010',
    accountName: 'Payroll',
    description: 'Beacon Ridge Payroll second half August',
    vendor: 'Beacon Ridge Payroll',
    externalReference: 'PR-AUG-B',
  },
];

export const DEMO_INVOICE_ROWS: DemoInvoiceRow[] = [
  {
    invoiceNumber: 'INV-2201',
    issuedAt: '2026-08-02',
    dueAt: '2026-09-01',
    amountCents: 830_000,
    currency: 'USD',
    vendor: 'Kestrel Home Goods',
    reference: '',
  },
  {
    invoiceNumber: 'INV-2202',
    issuedAt: '2026-08-04',
    dueAt: '2026-09-03',
    amountCents: 690_000,
    currency: 'USD',
    vendor: 'Cedar & Slate Co',
    reference: '',
  },
  {
    invoiceNumber: 'INV-3150',
    issuedAt: '2026-08-06',
    dueAt: '2026-09-05',
    amountCents: 540_000,
    currency: 'USD',
    vendor: 'Juniper Labs',
    reference: '',
  },
  {
    invoiceNumber: 'INV-3151',
    issuedAt: '2026-08-10',
    dueAt: '2026-09-09',
    amountCents: 127_500,
    currency: 'USD',
    vendor: 'Harbor Lane Cafe',
    reference: '',
  },
  {
    invoiceNumber: 'INV-3152',
    issuedAt: '2026-08-12',
    dueAt: '2026-09-11',
    amountCents: 332_000,
    currency: 'USD',
    vendor: 'Tidewater Charters',
    reference: '',
  },
];

export const DEMO_SETTLEMENT_LINES: DemoSettlementLineRow[] = [
  {
    settlementReference: 'SET-2026-0818',
    settlementDate: '2026-08-18',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 4411',
    amountCents: 830_000,
    reference: 'INV-2201',
  },
  {
    settlementReference: 'SET-2026-0818',
    settlementDate: '2026-08-18',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 4412',
    amountCents: 690_000,
    reference: 'INV-2202',
  },
  {
    settlementReference: 'SET-2026-0818',
    settlementDate: '2026-08-18',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'fee',
    description: 'Brightpay processing fees',
    amountCents: -142_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0818',
    settlementDate: '2026-08-18',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'refund',
    description: 'Customer refunds processed',
    amountCents: -68_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0818',
    settlementDate: '2026-08-18',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'deduction',
    description: 'Chargeback reserve deduction',
    amountCents: -30_000,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0818',
    settlementDate: '2026-08-18',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'adjustment',
    description: 'Miscellaneous adjustments',
    amountCents: 0,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0822',
    settlementDate: '2026-08-22',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 4455',
    amountCents: 96_420,
    reference: 'INV-2499',
  },
  {
    settlementReference: 'SET-2026-0824',
    settlementDate: '2026-08-24',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'sale',
    description: 'Card sales batch 4470',
    amountCents: 218_750,
    reference: '',
  },
  {
    settlementReference: 'SET-2026-0824',
    settlementDate: '2026-08-24',
    provider: 'Brightpay',
    currency: 'USD',
    type: 'fee',
    description: 'Brightpay processing fees',
    amountCents: -6_420,
    reference: '',
  },
];
