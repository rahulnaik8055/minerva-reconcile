import type { SettlementExpectation, SettlementLineInput, SettlementLineType } from './types';

const GROSS_TYPES: readonly SettlementLineType[] = ['sale'];
const FEE_TYPES: readonly SettlementLineType[] = ['fee'];
const REFUND_TYPES: readonly SettlementLineType[] = ['refund'];
const DEDUCTION_TYPES: readonly SettlementLineType[] = ['deduction'];
const ADJUSTMENT_TYPES: readonly SettlementLineType[] = ['adjustment', 'reserve', 'other'];

function sumOfType(lines: SettlementLineInput[], types: readonly SettlementLineType[]): number {
  return lines
    .filter((line) => types.includes(line.type))
    .reduce((total, line) => total + line.amountCents, 0);
}

export function computeSettlementExpectation(
  lines: SettlementLineInput[],
): SettlementExpectation {
  const grossCents = sumOfType(lines, GROSS_TYPES);
  const feesCents = sumOfType(lines, FEE_TYPES);
  const refundsCents = sumOfType(lines, REFUND_TYPES);
  const deductionsCents = sumOfType(lines, DEDUCTION_TYPES);
  const adjustmentsCents = sumOfType(lines, ADJUSTMENT_TYPES);

  return {
    grossCents,
    feesCents,
    refundsCents,
    deductionsCents,
    adjustmentsCents,
    expectedNetCents:
      grossCents + feesCents + refundsCents + deductionsCents + adjustmentsCents,
    lineCount: lines.length,
  };
}
