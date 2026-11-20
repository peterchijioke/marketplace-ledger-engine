import { LedgerLine } from './types';

/**
 * Rounds a number to exactly 2 decimal places to prevent floating-point drift.
 */
export function round2(num: number): number {
  return Math.round((Number(num) || 0) * 100) / 100;
}

/**
 * Validates the fundamental double-entry invariant:
 * Sum(Debits) === Sum(Credits)
 */
export function verifyJournalBalance(lines: LedgerLine[]): {
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
  variance: number;
} {
  let debits = 0;
  let credits = 0;

  for (const line of lines) {
    const amt = round2(line.amount);
    if (line.direction === 'DEBIT') {
      debits += amt;
    } else {
      credits += amt;
    }
  }

  debits = round2(debits);
  credits = round2(credits);
  const variance = round2(Math.abs(debits - credits));

  return {
    balanced: variance < 0.005, // within 0.00 standard float margin
    totalDebits: debits,
    totalCredits: credits,
    variance,
  };
}
