# marketplace-ledger-engine

> **Fault-tolerant double-entry accounting and multi-split fund distribution engine for marketplaces, platforms, and fintechs.**

[![npm version](https://img.shields.io/npm/v/marketplace-ledger-engine.svg)](https://www.npmjs.com/package/marketplace-ledger-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Marketplace platforms (food delivery, ride-hailing, e-commerce, services) fail audits when they handle multi-party payouts using simple database updates (e.g. `vendor.balance += amount`). 

`marketplace-ledger-engine` provides a mathematical double-entry accounting engine ensuring **$\sum \text{Debits} = \sum \text{Credits}$** across customers, merchants, couriers, platform commissions, service fees, promotions, and tax liabilities.

---

## Features

- ⚖️ **Mathematical Equilibrium Invariant**: Guaranteed zero floating-point drift (`round2`). Refuses unbalanced journals.
- 🍕 **Multi-Party Splitter**: Splits order subtotal into Merchant Payout, Platform Commission, Courier Pay, Delivery Markup, Service Fees, and Tips.
- 🎯 **Promotion & Discount Subsidy**: Automatically handles who funds discounts (merchant vs. platform) without breaking ledger balance.
- 🏛️ **Tax Isolation**: Handles Marketplace Facilitator sales tax (`TAX_PAYABLE`), merchant tax pass-through, and tax-inclusive pricing (e.g., VAT markets).
- 🔄 **Idempotent Refund Journals**: Generates balanced partial or full refund reversal journals.

---

## Installation

```bash
npm install marketplace-ledger-engine
```

---

## Quick Start

### 1. Distribute Funds on Order Checkout
```typescript
import { distributeOrderFunds } from 'marketplace-ledger-engine';

const result = distributeOrderFunds({
  orderId: 'ORD-10923',
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
  merchantCommissionRate: 0.20, // 20%
  courierBasePay: 3.50,
  merchantId: 'merchant_99',
  merchantName: 'Burger Kitchen',
  courierId: 'rider_42',
  courierName: 'John Courier',
});

console.log(result.splits);
// {
//   grossCustomerPaid: 63.62,
//   merchantPay: 35.00,
//   courierPay: 7.50,
//   platformCommission: 10.00,
//   platformServiceFee: 3.50,
//   platformSmallOrderFee: 2.00,
//   platformDeliverySpread: 1.50,
//   taxLiability: 4.12,
//   totalPlatformEarnings: 17.00
// }

console.log(result.journal.lines);
// Balanced Double-Entry Journal Lines:
// DEBIT  PSP_CLEARING        $63.62
// CREDIT MERCHANT_WALLET     $35.00
// CREDIT COURIER_WALLET      $7.50
// CREDIT PLATFORM_REVENUE    $10.00 (Commission)
// CREDIT PLATFORM_REVENUE    $3.50  (Service fee)
// CREDIT PLATFORM_REVENUE    $2.00  (Small order fee)
// CREDIT PLATFORM_REVENUE    $1.50  (Delivery spread)
// CREDIT TAX_PAYABLE         $4.12  (Marketplace sales tax)
```

### 2. Create a Balanced Refund Journal
```typescript
import { createRefundJournal } from 'marketplace-ledger-engine';

const refundJournal = createRefundJournal(result.journal, {
  refundAmount: 15.00,
  reason: 'Customer cancelled item',
  refundFrom: 'MERCHANT',
});

console.log(refundJournal.lines);
// DEBIT  MERCHANT_WALLET     $15.00
// CREDIT CUSTOMER_WALLET     $15.00
```

---

## License

MIT © [Peter Chukwu](https://github.com/petechukwu)
