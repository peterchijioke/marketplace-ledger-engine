package ledgerengine

import (
	"fmt"
	"strings"
	"time"
)

// DistributeOrderFunds executes multi-party fund distribution for marketplace orders,
// generating a mathematically balanced double-entry accounting journal.
func DistributeOrderFunds(input SplitOrderInput) (*DistributionResult, error) {
	currency := strings.ToUpper(input.Currency)
	subTotal := Round2(input.SubTotal)
	deliveryFee := Round2(input.DeliveryFee)
	tipAmount := Round2(input.TipAmount)
	serviceFee := Round2(input.ServiceFee)
	smallOrderFee := Round2(input.SmallOrderFee)
	discount := Round2(input.Discount)
	courierBasePay := Round2(input.CourierBasePay)

	// Tax calculations
	rawTax := Round2(input.TaxAmount)
	exclusiveTax := rawTax
	if input.IsTaxInclusive {
		exclusiveTax = 0.0
	}
	isSellerTax := input.TaxLiabilityType == "MERCHANT"

	// Gross amount charged to the customer at payment gateway
	grossCustomerPaid := Round2(
		subTotal + deliveryFee + tipAmount + serviceFee + smallOrderFee + exclusiveTax - discount,
	)

	// Commission & payouts
	platformCommission := Round2(subTotal * input.MerchantCommissionRate)

	merchantDiscountBurden := discount
	platformDiscountBurden := 0.0
	if input.DiscountFunder == "PLATFORM" {
		merchantDiscountBurden = 0.0
		platformDiscountBurden = discount
	}

	merchantTaxPassThrough := 0.0
	if exclusiveTax > 0 && isSellerTax {
		merchantTaxPassThrough = exclusiveTax
	}

	merchantPay := Round2(subTotal - platformCommission - merchantDiscountBurden + merchantTaxPassThrough)

	hasCourier := input.CourierID != ""
	courierPay := 0.0
	platformDeliverySpread := deliveryFee
	uncreditedTip := tipAmount

	if hasCourier {
		courierPay = Round2(courierBasePay + tipAmount)
		platformDeliverySpread = Round2(deliveryFee - courierBasePay)
		uncreditedTip = 0.0
	}

	platformTaxLiability := 0.0
	if exclusiveTax > 0 && !isSellerTax {
		platformTaxLiability = exclusiveTax
	}

	var lines []LedgerLine

	// 1. DEBIT PSP_CLEARING
	lines = append(lines, LedgerLine{
		AccountType: AccountPSPClearing,
		Direction:   DirectionDebit,
		Amount:      grossCustomerPaid,
		Currency:    currency,
		Description: fmt.Sprintf("Customer payment for order %s", input.OrderID),
		Metadata:    map[string]interface{}{"orderId": input.OrderID},
	})

	// Platform discount subsidy debit
	if platformDiscountBurden > 0 {
		lines = append(lines, LedgerLine{
			AccountType: AccountPromotionSubsidy,
			Direction:   DirectionDebit,
			Amount:      platformDiscountBurden,
			Currency:    currency,
			Description: fmt.Sprintf("Platform funded promotion discount for order %s", input.OrderID),
		})
	}

	// 2. CREDIT MERCHANT_WALLET
	if merchantPay > 0 {
		lines = append(lines, LedgerLine{
			AccountType: AccountMerchantWallet,
			ActorType:   ActorMerchant,
			ActorID:     input.MerchantID,
			ActorName:   input.MerchantName,
			Direction:   DirectionCredit,
			Amount:      merchantPay,
			Currency:    currency,
			Description: fmt.Sprintf("Merchant net earnings for order %s", input.OrderID),
		})
	}

	// 3. CREDIT COURIER_WALLET
	if courierPay > 0 && hasCourier {
		lines = append(lines, LedgerLine{
			AccountType: AccountCourierWallet,
			ActorType:   ActorCourier,
			ActorID:     input.CourierID,
			ActorName:   input.CourierName,
			Direction:   DirectionCredit,
			Amount:      courierPay,
			Currency:    currency,
			Description: fmt.Sprintf("Courier payout (Base + Tips) for order %s", input.OrderID),
		})
	}

	// 4. CREDIT PLATFORM_REVENUE
	if platformCommission > 0 {
		lines = append(lines, LedgerLine{
			AccountType: AccountPlatformRevenue,
			Direction:   DirectionCredit,
			Amount:      platformCommission,
			Currency:    currency,
			Description: fmt.Sprintf("Platform commission (%.0f%%) on order %s", input.MerchantCommissionRate*100, input.OrderID),
		})
	}

	if serviceFee > 0 {
		lines = append(lines, LedgerLine{
			AccountType: AccountPlatformRevenue,
			Direction:   DirectionCredit,
			Amount:      serviceFee,
			Currency:    currency,
			Description: fmt.Sprintf("Customer service fee for order %s", input.OrderID),
		})
	}

	if smallOrderFee > 0 {
		lines = append(lines, LedgerLine{
			AccountType: AccountPlatformRevenue,
			Direction:   DirectionCredit,
			Amount:      smallOrderFee,
			Currency:    currency,
			Description: fmt.Sprintf("Small order surcharge for order %s", input.OrderID),
		})
	}

	if platformDeliverySpread > 0 {
		lines = append(lines, LedgerLine{
			AccountType: AccountPlatformRevenue,
			Direction:   DirectionCredit,
			Amount:      platformDeliverySpread,
			Currency:    currency,
			Description: fmt.Sprintf("Platform delivery margin for order %s", input.OrderID),
		})
	}

	if uncreditedTip > 0 {
		lines = append(lines, LedgerLine{
			AccountType: AccountPlatformRevenue,
			Direction:   DirectionCredit,
			Amount:      uncreditedTip,
			Currency:    currency,
			Description: fmt.Sprintf("Unassigned tip absorbed for pickup order %s", input.OrderID),
		})
	}

	// 5. CREDIT TAX_PAYABLE
	if platformTaxLiability > 0 {
		lines = append(lines, LedgerLine{
			AccountType: AccountTaxPayable,
			ActorType:   ActorTaxAuthority,
			Direction:   DirectionCredit,
			Amount:      platformTaxLiability,
			Currency:    currency,
			Description: fmt.Sprintf("Marketplace sales tax collected for order %s", input.OrderID),
		})
	}

	// Check ledger equilibrium invariant
	balance := VerifyJournalBalance(lines)
	if !balance.Balanced {
		return nil, fmt.Errorf("ledger journal unbalanced for order %s: debits=%.2f, credits=%.2f, variance=%.2f",
			input.OrderID, balance.TotalDebits, balance.TotalCredits, balance.Variance)
	}

	totalPlatformEarnings := Round2(
		platformCommission + serviceFee + smallOrderFee + platformDeliverySpread + uncreditedTip - platformDiscountBurden,
	)

	return &DistributionResult{
		Journal: Journal{
			Reference: fmt.Sprintf("ORD-%s", input.OrderID),
			Currency:  currency,
			Lines:     lines,
			Timestamp: time.Now().UTC(),
		},
		Splits: SplitsSummary{
			GrossCustomerPaid:      grossCustomerPaid,
			MerchantPay:            merchantPay,
			CourierPay:             courierPay,
			PlatformCommission:     platformCommission,
			PlatformServiceFee:     serviceFee,
			PlatformSmallOrderFee:  smallOrderFee,
			PlatformDeliverySpread: platformDeliverySpread,
			TaxLiability:           platformTaxLiability,
			TotalPlatformEarnings:  totalPlatformEarnings,
		},
	}, nil
}
