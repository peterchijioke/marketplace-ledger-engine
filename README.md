# marketplace-ledger-engine

> **Fault-tolerant double-entry accounting and multi-split fund distribution engine for marketplaces, platforms, and fintechs.**  
> *Available in both **Go (Golang)** and **TypeScript / Node.js**.*

[![Go Reference](https://pkg.go.dev/badge/github.com/peterchijioke/marketplace-ledger-engine.svg)](https://pkg.go.dev/github.com/peterchijioke/marketplace-ledger-engine)
[![npm version](https://img.shields.io/npm/v/@peterchijioke/marketplace-ledger-engine.svg)](https://www.npmjs.com/package/@peterchijioke/marketplace-ledger-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Marketplace platforms (food delivery, ride-hailing, e-commerce, services) fail audits when they handle multi-party payouts using simple database updates (e.g. `vendor.balance += amount`).

`marketplace-ledger-engine` provides a mathematical double-entry accounting engine ensuring **$\sum \text{Debits} = \sum \text{Credits}$** across customers, merchants, couriers, platform commissions, service fees, promotions, and tax liabilities.

---

## Features

- ⚖️ **Mathematical Equilibrium Invariant**: Guaranteed zero floating-point drift (`Round2`). Refuses unbalanced journals.
- 🍕 **Multi-Party Splitter**: Splits order subtotal into Merchant Payout, Platform Commission, Courier Pay, Delivery Markup, Service Fees, and Tips.
- 🎯 **Promotion & Discount Subsidy**: Automatically handles who funds discounts (merchant vs. platform) without breaking ledger balance.
- 🏛️ **Tax Isolation**: Handles Marketplace Facilitator sales tax (`TAX_PAYABLE`), merchant tax pass-through, and tax-inclusive pricing (e.g., Nigerian 7.5% VAT).
- 🔄 **Idempotent Refund Journals**: Generates balanced partial or full refund reversal journals.
- 🚀 **Zero Dependencies**: Pure Go and pure TypeScript with zero third-party dependencies.

---

## Installation

### For Go (Golang)
```bash
go get github.com/peterchijioke/marketplace-ledger-engine
```

### For Node.js / TypeScript
```bash
npm install @peterchijioke/marketplace-ledger-engine
```

---

## Go (Golang) Quick Start

```go
package main

import (
	"fmt"
	"log"

	ledgerengine "github.com/peterchijioke/marketplace-ledger-engine"
)

func main() {
	result, err := ledgerengine.DistributeOrderFunds(ledgerengine.SplitOrderInput{
		OrderID:                "ORD-10923",
		Currency:               "USD",
		SubTotal:               50.00,
		DeliveryFee:            5.00,
		TipAmount:              4.00,
		ServiceFee:             3.50,
		SmallOrderFee:          2.00,
		Discount:               5.00,
		DiscountFunder:         "MERCHANT",
		TaxAmount:              4.12,
		IsTaxInclusive:         false,
		TaxLiabilityType:       "MARKETPLACE",
		MerchantCommissionRate: 0.20, // 20%
		CourierBasePay:         3.50,
		MerchantID:             "merchant_99",
		MerchantName:           "Burger Kitchen",
		CourierID:              "rider_42",
		CourierName:            "John Courier",
	})
	if err != nil {
		log.Fatalf("Ledger distribution error: %v", err)
	}

	fmt.Printf("Gross Customer Paid: $%.2f\n", result.Splits.GrossCustomerPaid) // $63.62
	fmt.Printf("Merchant Net Payout:  $%.2f\n", result.Splits.MerchantPay)       // $35.00
	fmt.Printf("Courier Payout:        $%.2f\n", result.Splits.CourierPay)        // $7.50
	fmt.Printf("Platform Commission:   $%.2f\n", result.Splits.PlatformCommission) // $10.00
	fmt.Printf("Tax Payable:           $%.2f\n", result.Splits.TaxLiability)       // $4.12

	// Verified balanced double-entry lines
	for _, line := range result.Journal.Lines {
		fmt.Printf("%-6s %-20s $%.2f (%s)\n", line.Direction, line.AccountType, line.Amount, line.Description)
	}
}
```

---

## TypeScript / Node.js Quick Start

```typescript
import { distributeOrderFunds, createRefundJournal } from '@peterchijioke/marketplace-ledger-engine';

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
  merchantCommissionRate: 0.20,
  courierBasePay: 3.50,
  merchantId: 'merchant_99',
  courierId: 'rider_42',
});

console.log(result.splits);
```

---

## License

MIT © [Peter Chukwu](https://github.com/peterchijioke)
