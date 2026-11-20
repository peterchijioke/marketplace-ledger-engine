type LedgerAccountType = 'PSP_CLEARING' | 'MERCHANT_WALLET' | 'COURIER_WALLET' | 'PLATFORM_REVENUE' | 'TAX_PAYABLE' | 'CUSTOMER_WALLET' | 'PROMOTION_SUBSIDY';
type LedgerDirection = 'DEBIT' | 'CREDIT';
interface LedgerLine {
    accountType: LedgerAccountType;
    actorType?: 'MERCHANT' | 'COURIER' | 'CUSTOMER' | 'PLATFORM' | 'TAX_AUTHORITY';
    actorId?: string;
    actorName?: string;
    direction: LedgerDirection;
    amount: number;
    currency: string;
    description: string;
    metadata?: Record<string, any>;
}
interface Journal {
    id?: string;
    reference: string;
    currency: string;
    lines: LedgerLine[];
    timestamp?: Date;
}
interface SplitOrderInput {
    orderId: string;
    currency: string;
    subTotal: number;
    deliveryFee?: number;
    tipAmount?: number;
    serviceFee?: number;
    smallOrderFee?: number;
    discount?: number;
    discountFunder?: 'MERCHANT' | 'PLATFORM';
    taxAmount?: number;
    isTaxInclusive?: boolean;
    taxLiabilityType?: 'MARKETPLACE' | 'MERCHANT';
    merchantCommissionRate: number;
    courierBasePay?: number;
    merchantId: string;
    merchantName?: string;
    courierId?: string;
    courierName?: string;
}
interface DistributionResult {
    journal: Journal;
    splits: {
        grossCustomerPaid: number;
        merchantPay: number;
        courierPay: number;
        platformCommission: number;
        platformServiceFee: number;
        platformSmallOrderFee: number;
        platformDeliverySpread: number;
        taxLiability: number;
        totalPlatformEarnings: number;
    };
}

/**
 * Rounds a number to exactly 2 decimal places to prevent floating-point drift.
 */
declare function round2(num: number): number;
/**
 * Validates the fundamental double-entry invariant:
 * Sum(Debits) === Sum(Credits)
 */
declare function verifyJournalBalance(lines: LedgerLine[]): {
    balanced: boolean;
    totalDebits: number;
    totalCredits: number;
    variance: number;
};

/**
 * Executes multi-party fund distribution for marketplace orders,
 * generating a perfectly balanced double-entry accounting journal.
 */
declare function distributeOrderFunds(input: SplitOrderInput): DistributionResult;

interface RefundOptions {
    refundAmount: number;
    reason?: string;
    refundFrom?: 'MERCHANT' | 'PLATFORM';
}
/**
 * Generates an idempotent reversal journal for full or partial refunds.
 */
declare function createRefundJournal(originalJournal: Journal, options: RefundOptions): Journal;

export { type DistributionResult, type Journal, type LedgerAccountType, type LedgerDirection, type LedgerLine, type RefundOptions, type SplitOrderInput, createRefundJournal, distributeOrderFunds, round2, verifyJournalBalance };
