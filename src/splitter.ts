import { round2, verifyJournalBalance } from './math';
import { DistributionResult, LedgerLine, SplitOrderInput } from './types';

/**
 * Executes multi-party fund distribution for marketplace orders,
 * generating a perfectly balanced double-entry accounting journal.
 */
export function distributeOrderFunds(input: SplitOrderInput): DistributionResult {
  const currency = input.currency.toUpperCase();
  const subTotal = round2(input.subTotal);
  const deliveryFee = round2(input.deliveryFee || 0);
  const tipAmount = round2(input.tipAmount || 0);
  const serviceFee = round2(input.serviceFee || 0);
  const smallOrderFee = round2(input.smallOrderFee || 0);
  const discount = round2(input.discount || 0);
  const courierBasePay = round2(input.courierBasePay || 0);

  // Tax calculations
  const rawTax = round2(input.taxAmount || 0);
  const isTaxInclusive = Boolean(input.isTaxInclusive);
  const exclusiveTax = isTaxInclusive ? 0 : rawTax;
  const isSellerTax = input.taxLiabilityType === 'MERCHANT';

  // Gross amount charged to the customer at payment gateway
  const grossCustomerPaid = round2(
    subTotal + deliveryFee + tipAmount + serviceFee + smallOrderFee + exclusiveTax - discount
  );

  // Commission & payouts
  const platformCommission = round2(subTotal * input.merchantCommissionRate);
  
  // Promotion handling: if merchant funds the discount, it reduces their payout
  const merchantDiscountBurden = input.discountFunder === 'PLATFORM' ? 0 : discount;
  const platformDiscountBurden = input.discountFunder === 'PLATFORM' ? discount : 0;

  // Merchant payout = (Subtotal - Commission - MerchantDiscountBurden) + (Seller Tax Pass-through)
  const merchantTaxPassThrough = exclusiveTax > 0 && isSellerTax ? exclusiveTax : 0;
  const merchantPay = round2(subTotal - platformCommission - merchantDiscountBurden + merchantTaxPassThrough);

  // Courier payout = Base pay + 100% of tips
  const hasCourier = Boolean(input.courierId);
  const courierPay = hasCourier ? round2(courierBasePay + tipAmount) : 0;

  // Platform delivery margin
  const platformDeliverySpread = hasCourier ? round2(deliveryFee - courierBasePay) : deliveryFee;
  const uncreditedTip = hasCourier ? 0 : tipAmount;

  // Tax payable to government (marketplace liability)
  const platformTaxLiability = exclusiveTax > 0 && !isSellerTax ? exclusiveTax : 0;

  // Build Double-Entry Journal Lines
  const lines: LedgerLine[] = [];

  // 1. DEBIT PSP_CLEARING: The gross customer payment held in transit
  lines.push({
    accountType: 'PSP_CLEARING',
    direction: 'DEBIT',
    amount: grossCustomerPaid,
    currency,
    description: `Customer payment for order ${input.orderId}`,
    metadata: { orderId: input.orderId },
  });

  // If platform funded the discount, platform absorbs the shortfall as an additional DEBIT
  if (platformDiscountBurden > 0) {
    lines.push({
      accountType: 'PROMOTION_SUBSIDY',
      direction: 'DEBIT',
      amount: platformDiscountBurden,
      currency,
      description: `Platform funded promotion discount for order ${input.orderId}`,
    });
  }

  // 2. CREDIT MERCHANT_WALLET
  if (merchantPay > 0) {
    lines.push({
      accountType: 'MERCHANT_WALLET',
      actorType: 'MERCHANT',
      actorId: input.merchantId,
      actorName: input.merchantName,
      direction: 'CREDIT',
      amount: merchantPay,
      currency,
      description: `Merchant net earnings for order ${input.orderId}`,
    });
  }

  // 3. CREDIT COURIER_WALLET
  if (courierPay > 0 && input.courierId) {
    lines.push({
      accountType: 'COURIER_WALLET',
      actorType: 'COURIER',
      actorId: input.courierId,
      actorName: input.courierName,
      direction: 'CREDIT',
      amount: courierPay,
      currency,
      description: `Courier payout (Base + Tips) for order ${input.orderId}`,
    });
  }

  // 4. CREDIT PLATFORM_REVENUE (Commissions & Fees)
  if (platformCommission > 0) {
    lines.push({
      accountType: 'PLATFORM_REVENUE',
      direction: 'CREDIT',
      amount: platformCommission,
      currency,
      description: `Platform commission (${round2(input.merchantCommissionRate * 100)}%) on order ${input.orderId}`,
    });
  }

  if (serviceFee > 0) {
    lines.push({
      accountType: 'PLATFORM_REVENUE',
      direction: 'CREDIT',
      amount: serviceFee,
      currency,
      description: `Customer service fee for order ${input.orderId}`,
    });
  }

  if (smallOrderFee > 0) {
    lines.push({
      accountType: 'PLATFORM_REVENUE',
      direction: 'CREDIT',
      amount: smallOrderFee,
      currency,
      description: `Small order surcharge for order ${input.orderId}`,
    });
  }

  if (platformDeliverySpread > 0) {
    lines.push({
      accountType: 'PLATFORM_REVENUE',
      direction: 'CREDIT',
      amount: platformDeliverySpread,
      currency,
      description: `Platform delivery margin for order ${input.orderId}`,
    });
  }

  if (uncreditedTip > 0) {
    lines.push({
      accountType: 'PLATFORM_REVENUE',
      direction: 'CREDIT',
      amount: uncreditedTip,
      currency,
      description: `Unassigned tip absorbed for pickup order ${input.orderId}`,
    });
  }

  // 5. CREDIT TAX_PAYABLE (Marketplace Facilitator Tax)
  if (platformTaxLiability > 0) {
    lines.push({
      accountType: 'TAX_PAYABLE',
      actorType: 'TAX_AUTHORITY',
      direction: 'CREDIT',
      amount: platformTaxLiability,
      currency,
      description: `Marketplace sales tax collected for order ${input.orderId}`,
    });
  }

  // Assert mathematical balance
  const balanceCheck = verifyJournalBalance(lines);
  if (!balanceCheck.balanced) {
    throw new Error(
      `Ledger journal unbalanced for order ${input.orderId}! Debits: ${balanceCheck.totalDebits}, Credits: ${balanceCheck.totalCredits}, Variance: ${balanceCheck.variance}`
    );
  }

  const totalPlatformEarnings = round2(
    platformCommission + serviceFee + smallOrderFee + platformDeliverySpread + uncreditedTip - platformDiscountBurden
  );

  return {
    journal: {
      reference: `ORD-${input.orderId}`,
      currency,
      lines,
      timestamp: new Date(),
    },
    splits: {
      grossCustomerPaid,
      merchantPay,
      courierPay,
      platformCommission,
      platformServiceFee: serviceFee,
      platformSmallOrderFee: smallOrderFee,
      platformDeliverySpread,
      taxLiability: platformTaxLiability,
      totalPlatformEarnings,
    },
  };
}
