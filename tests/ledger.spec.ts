import { distributeOrderFunds } from '../src/splitter';
import { createRefundJournal } from '../src/reversal';
import { verifyJournalBalance } from '../src/math';

describe('Marketplace Ledger Engine', () => {
  it('distributes order funds and produces an invariant-balanced journal', () => {
    const result = distributeOrderFunds({
      orderId: 'ORD-9876',
      currency: 'USD',
      subTotal: 50.00,
      deliveryFee: 5.00,
      tipAmount: 4.00,
      serviceFee: 3.50,
      smallOrderFee: 2.00,
      discount: 5.00,
      discountFunder: 'MERCHANT',
      taxAmount: 4.12,
      isTaxInclusive: false,
      taxLiabilityType: 'MARKETPLACE',
      merchantCommissionRate: 0.20, // 20% = $10.00
      courierBasePay: 3.50,
      merchantId: 'rest_123',
      merchantName: 'Burger Kitchen',
      courierId: 'rider_456',
      courierName: 'Alex Rider',
    });

    const { splits, journal } = result;

    // Gross paid by customer: 50 + 5 + 4 + 3.50 + 2 + 4.12 - 5 = 63.62
    expect(splits.grossCustomerPaid).toBe(63.62);

    // Commission: 50 * 0.20 = 10.00
    expect(splits.platformCommission).toBe(10.00);

    // Merchant pay: 50 - 10 (commission) - 5 (discount) = 35.00
    expect(splits.merchantPay).toBe(35.00);

    // Courier pay: 3.50 (base) + 4.00 (tip) = 7.50
    expect(splits.courierPay).toBe(7.50);

    // Platform tax liability: 4.12
    expect(splits.taxLiability).toBe(4.12);

    // Platform delivery spread: 5.00 - 3.50 = 1.50
    expect(splits.platformDeliverySpread).toBe(1.50);

    // Ensure the journal is 100% mathematically balanced (Debits === Credits)
    const balance = verifyJournalBalance(journal.lines);
    expect(balance.balanced).toBe(true);
    expect(balance.totalDebits).toBe(63.62);
    expect(balance.totalCredits).toBe(63.62);
  });

  it('handles Nigerian tax-inclusive order correctly (exclusiveTax = 0)', () => {
    const result = distributeOrderFunds({
      orderId: 'ORD-NG-112',
      currency: 'NGN',
      subTotal: 10000,
      deliveryFee: 1500,
      tipAmount: 500,
      serviceFee: 500,
      isTaxInclusive: true,
      taxAmount: 697.67, // Embedded VAT (informational)
      merchantCommissionRate: 0.15, // 15% = 1500
      courierBasePay: 1200,
      merchantId: 'rest_lagos',
      courierId: 'rider_lagos',
    });

    // Customer pays Subtotal (10,000) + Delivery (1,500) + Tip (500) + Service (500) = 12,500
    expect(result.splits.grossCustomerPaid).toBe(12500);
    expect(result.splits.taxLiability).toBe(0); // Zero exclusive tax liability added to checkout
    expect(result.splits.merchantPay).toBe(8500); // 10,000 - 1,500 commission

    const balance = verifyJournalBalance(result.journal.lines);
    expect(balance.balanced).toBe(true);
  });

  it('creates a balanced refund reversal journal', () => {
    const result = distributeOrderFunds({
      orderId: 'ORD-001',
      currency: 'USD',
      subTotal: 30,
      merchantCommissionRate: 0.10,
      merchantId: 'm1',
    });

    const refund = createRefundJournal(result.journal, {
      refundAmount: 15.00,
      reason: 'Item missing',
    });

    expect(refund.lines).toHaveLength(2);
    expect(verifyJournalBalance(refund.lines).balanced).toBe(true);
  });
});
