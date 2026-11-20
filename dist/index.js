"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createRefundJournal: () => createRefundJournal,
  distributeOrderFunds: () => distributeOrderFunds,
  round2: () => round2,
  verifyJournalBalance: () => verifyJournalBalance
});
module.exports = __toCommonJS(index_exports);

// src/math.ts
function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}
function verifyJournalBalance(lines) {
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    const amt = round2(line.amount);
    if (line.direction === "DEBIT") {
      debits += amt;
    } else {
      credits += amt;
    }
  }
  debits = round2(debits);
  credits = round2(credits);
  const variance = round2(Math.abs(debits - credits));
  return {
    balanced: variance < 5e-3,
    // within 0.00 standard float margin
    totalDebits: debits,
    totalCredits: credits,
    variance
  };
}

// src/splitter.ts
function distributeOrderFunds(input) {
  const currency = input.currency.toUpperCase();
  const subTotal = round2(input.subTotal);
  const deliveryFee = round2(input.deliveryFee || 0);
  const tipAmount = round2(input.tipAmount || 0);
  const serviceFee = round2(input.serviceFee || 0);
  const smallOrderFee = round2(input.smallOrderFee || 0);
  const discount = round2(input.discount || 0);
  const courierBasePay = round2(input.courierBasePay || 0);
  const rawTax = round2(input.taxAmount || 0);
  const isTaxInclusive = Boolean(input.isTaxInclusive);
  const exclusiveTax = isTaxInclusive ? 0 : rawTax;
  const isSellerTax = input.taxLiabilityType === "MERCHANT";
  const grossCustomerPaid = round2(
    subTotal + deliveryFee + tipAmount + serviceFee + smallOrderFee + exclusiveTax - discount
  );
  const platformCommission = round2(subTotal * input.merchantCommissionRate);
  const merchantDiscountBurden = input.discountFunder === "PLATFORM" ? 0 : discount;
  const platformDiscountBurden = input.discountFunder === "PLATFORM" ? discount : 0;
  const merchantTaxPassThrough = exclusiveTax > 0 && isSellerTax ? exclusiveTax : 0;
  const merchantPay = round2(subTotal - platformCommission - merchantDiscountBurden + merchantTaxPassThrough);
  const hasCourier = Boolean(input.courierId);
  const courierPay = hasCourier ? round2(courierBasePay + tipAmount) : 0;
  const platformDeliverySpread = hasCourier ? round2(deliveryFee - courierBasePay) : deliveryFee;
  const uncreditedTip = hasCourier ? 0 : tipAmount;
  const platformTaxLiability = exclusiveTax > 0 && !isSellerTax ? exclusiveTax : 0;
  const lines = [];
  lines.push({
    accountType: "PSP_CLEARING",
    direction: "DEBIT",
    amount: grossCustomerPaid,
    currency,
    description: `Customer payment for order ${input.orderId}`,
    metadata: { orderId: input.orderId }
  });
  if (platformDiscountBurden > 0) {
    lines.push({
      accountType: "PROMOTION_SUBSIDY",
      direction: "DEBIT",
      amount: platformDiscountBurden,
      currency,
      description: `Platform funded promotion discount for order ${input.orderId}`
    });
  }
  if (merchantPay > 0) {
    lines.push({
      accountType: "MERCHANT_WALLET",
      actorType: "MERCHANT",
      actorId: input.merchantId,
      actorName: input.merchantName,
      direction: "CREDIT",
      amount: merchantPay,
      currency,
      description: `Merchant net earnings for order ${input.orderId}`
    });
  }
  if (courierPay > 0 && input.courierId) {
    lines.push({
      accountType: "COURIER_WALLET",
      actorType: "COURIER",
      actorId: input.courierId,
      actorName: input.courierName,
      direction: "CREDIT",
      amount: courierPay,
      currency,
      description: `Courier payout (Base + Tips) for order ${input.orderId}`
    });
  }
  if (platformCommission > 0) {
    lines.push({
      accountType: "PLATFORM_REVENUE",
      direction: "CREDIT",
      amount: platformCommission,
      currency,
      description: `Platform commission (${round2(input.merchantCommissionRate * 100)}%) on order ${input.orderId}`
    });
  }
  if (serviceFee > 0) {
    lines.push({
      accountType: "PLATFORM_REVENUE",
      direction: "CREDIT",
      amount: serviceFee,
      currency,
      description: `Customer service fee for order ${input.orderId}`
    });
  }
  if (smallOrderFee > 0) {
    lines.push({
      accountType: "PLATFORM_REVENUE",
      direction: "CREDIT",
      amount: smallOrderFee,
      currency,
      description: `Small order surcharge for order ${input.orderId}`
    });
  }
  if (platformDeliverySpread > 0) {
    lines.push({
      accountType: "PLATFORM_REVENUE",
      direction: "CREDIT",
      amount: platformDeliverySpread,
      currency,
      description: `Platform delivery margin for order ${input.orderId}`
    });
  }
  if (uncreditedTip > 0) {
    lines.push({
      accountType: "PLATFORM_REVENUE",
      direction: "CREDIT",
      amount: uncreditedTip,
      currency,
      description: `Unassigned tip absorbed for pickup order ${input.orderId}`
    });
  }
  if (platformTaxLiability > 0) {
    lines.push({
      accountType: "TAX_PAYABLE",
      actorType: "TAX_AUTHORITY",
      direction: "CREDIT",
      amount: platformTaxLiability,
      currency,
      description: `Marketplace sales tax collected for order ${input.orderId}`
    });
  }
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
      timestamp: /* @__PURE__ */ new Date()
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
      totalPlatformEarnings
    }
  };
}

// src/reversal.ts
function createRefundJournal(originalJournal, options) {
  const refundAmount = round2(options.refundAmount);
  if (refundAmount <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }
  const refundLines = [];
  const source = options.refundFrom || "MERCHANT";
  refundLines.push({
    accountType: source === "MERCHANT" ? "MERCHANT_WALLET" : "PLATFORM_REVENUE",
    direction: "DEBIT",
    amount: refundAmount,
    currency: originalJournal.currency,
    description: `Refund deduction: ${options.reason || "Customer refund"}`
  });
  refundLines.push({
    accountType: "CUSTOMER_WALLET",
    direction: "CREDIT",
    amount: refundAmount,
    currency: originalJournal.currency,
    description: `Customer refund credit: ${options.reason || "Refund"}`
  });
  const check = verifyJournalBalance(refundLines);
  if (!check.balanced) {
    throw new Error("Refund journal balance invariant failed");
  }
  return {
    reference: `REF-${originalJournal.reference}-${Date.now()}`,
    currency: originalJournal.currency,
    lines: refundLines,
    timestamp: /* @__PURE__ */ new Date()
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createRefundJournal,
  distributeOrderFunds,
  round2,
  verifyJournalBalance
});
//# sourceMappingURL=index.js.map