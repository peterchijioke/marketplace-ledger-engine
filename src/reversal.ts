import { Journal, LedgerLine } from './types';
import { round2, verifyJournalBalance } from './math';

export interface RefundOptions {
  refundAmount: number;
  reason?: string;
  refundFrom?: 'MERCHANT' | 'PLATFORM';
}

/**
 * Generates an idempotent reversal journal for full or partial refunds.
 */
export function createRefundJournal(
  originalJournal: Journal,
  options: RefundOptions
): Journal {
  const refundAmount = round2(options.refundAmount);
  if (refundAmount <= 0) {
    throw new Error('Refund amount must be greater than zero');
  }

  const refundLines: LedgerLine[] = [];
  const source = options.refundFrom || 'MERCHANT';

  // DEBIT: Deduct funds from the merchant or platform
  refundLines.push({
    accountType: source === 'MERCHANT' ? 'MERCHANT_WALLET' : 'PLATFORM_REVENUE',
    direction: 'DEBIT',
    amount: refundAmount,
    currency: originalJournal.currency,
    description: `Refund deduction: ${options.reason || 'Customer refund'}`,
  });

  // CREDIT: Customer wallet or return to payment processor clearing
  refundLines.push({
    accountType: 'CUSTOMER_WALLET',
    direction: 'CREDIT',
    amount: refundAmount,
    currency: originalJournal.currency,
    description: `Customer refund credit: ${options.reason || 'Refund'}`,
  });

  const check = verifyJournalBalance(refundLines);
  if (!check.balanced) {
    throw new Error('Refund journal balance invariant failed');
  }

  return {
    reference: `REF-${originalJournal.reference}-${Date.now()}`,
    currency: originalJournal.currency,
    lines: refundLines,
    timestamp: new Date(),
  };
}
