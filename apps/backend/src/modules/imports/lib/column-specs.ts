export const BANK_COLUMN_ALIASES = {
  postedAt: ['date', 'transaction date', 'posted date', 'posting date', 'value date'],
  amount: ['amount', 'transaction amount', 'amt', 'amount value'],
  currency: ['currency', 'currency code', 'curr'],
  description: ['description', 'memo', 'details', 'detail', 'narrative', 'transaction description'],
  externalReference: [
    'reference',
    'ref',
    'reference number',
    'ref number',
    'transaction id',
    'transaction reference',
    'check number',
    'cheque number',
  ],
  vendor: ['vendor', 'payee', 'counterparty', 'merchant', 'name'],
} as const;

export const BANK_REQUIRED_COLUMNS: Array<keyof typeof BANK_COLUMN_ALIASES> = [
  'postedAt',
  'amount',
  'description',
];

export const LEDGER_COLUMN_ALIASES = {
  postedAt: ['date', 'entry date', 'posting date', 'transaction date', 'journal date'],
  amount: ['amount', 'entry amount', 'amount value'],
  currency: ['currency', 'currency code'],
  description: ['description', 'memo', 'details', 'narrative', 'line description'],
  externalReference: ['reference', 'ref', 'reference number', 'journal ref', 'entry reference', 'voucher number'],
  vendor: ['vendor', 'counterparty', 'payee', 'merchant'],
  accountCode: ['account code', 'account', 'account id', 'gl code', 'account number'],
  accountName: ['account name', 'account title', 'gl account name', 'account description'],
} as const;

export const LEDGER_REQUIRED_COLUMNS: Array<keyof typeof LEDGER_COLUMN_ALIASES> = [
  'postedAt',
  'amount',
  'accountCode',
];

export const INVOICE_COLUMN_ALIASES = {
  invoiceNumber: [
    'invoice number',
    'invoice no',
    'invoice #',
    'invoice',
    'number',
    'doc number',
    'document number',
  ],
  issuedAt: ['issue date', 'issued date', 'invoice date', 'date'],
  dueAt: ['due date', 'payment due date', 'due'],
  amount: ['amount', 'total', 'invoice amount', 'total amount', 'gross amount'],
  currency: ['currency', 'currency code'],
  vendor: ['vendor', 'supplier', 'issuer', 'billed by', 'merchant'],
  reference: ['reference', 'po number', 'purchase order', 'order reference', 'external reference'],
} as const;

export const INVOICE_REQUIRED_COLUMNS: Array<keyof typeof INVOICE_COLUMN_ALIASES> = [
  'invoiceNumber',
  'issuedAt',
  'amount',
  'vendor',
];

export const SETTLEMENT_COLUMN_ALIASES = {
  settlementReference: [
    'settlement reference',
    'settlement id',
    'payout id',
    'payout reference',
    'settlement number',
  ],
  settlementDate: ['settlement date', 'payout date', 'date'],
  provider: ['provider', 'processor', 'platform', 'gateway'],
  currency: ['currency', 'currency code'],
  type: ['type', 'line type', 'entry type', 'record type'],
  description: ['description', 'details', 'memo', 'narrative'],
  amount: ['amount', 'line amount'],
  reference: ['reference', 'source id', 'payment reference', 'transaction reference', 'ref'],
} as const;

export const SETTLEMENT_REQUIRED_COLUMNS: Array<keyof typeof SETTLEMENT_COLUMN_ALIASES> = [
  'settlementReference',
  'settlementDate',
  'provider',
  'type',
  'amount',
];

export const SETTLEMENT_TYPE_SYNONYMS: Record<string, string> = {
  sales: 'sale',
  sale: 'sale',
  fee: 'fee',
  fees: 'fee',
  charge: 'fee',
  charges: 'fee',
  refund: 'refund',
  refunds: 'refund',
  deduction: 'deduction',
  deductions: 'deduction',
  adjustment: 'adjustment',
  adjustments: 'adjustment',
  reserve: 'reserve',
  other: 'other',
};
