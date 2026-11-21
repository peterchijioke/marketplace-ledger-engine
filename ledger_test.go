package ledgerengine

import (
	"testing"
)

func TestDistributeOrderFunds(t *testing.T) {
	input := SplitOrderInput{
		OrderID:                "ORD-9876",
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
		MerchantCommissionRate: 0.20,
		CourierBasePay:         3.50,
		MerchantID:             "rest_123",
		MerchantName:           "Burger Kitchen",
		CourierID:              "rider_456",
		CourierName:            "Alex Rider",
	}

	result, err := DistributeOrderFunds(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Splits.GrossCustomerPaid != 63.62 {
		t.Errorf("expected GrossCustomerPaid 63.62, got %.2f", result.Splits.GrossCustomerPaid)
	}
	if result.Splits.PlatformCommission != 10.00 {
		t.Errorf("expected PlatformCommission 10.00, got %.2f", result.Splits.PlatformCommission)
	}
	if result.Splits.MerchantPay != 35.00 {
		t.Errorf("expected MerchantPay 35.00, got %.2f", result.Splits.MerchantPay)
	}
	if result.Splits.CourierPay != 7.50 {
		t.Errorf("expected CourierPay 7.50, got %.2f", result.Splits.CourierPay)
	}
	if result.Splits.TaxLiability != 4.12 {
		t.Errorf("expected TaxLiability 4.12, got %.2f", result.Splits.TaxLiability)
	}

	balance := VerifyJournalBalance(result.Journal.Lines)
	if !balance.Balanced {
		t.Errorf("journal is not balanced: variance = %.4f", balance.Variance)
	}
}

func TestNigerianTaxInclusiveOrder(t *testing.T) {
	input := SplitOrderInput{
		OrderID:                "ORD-NG-112",
		Currency:               "NGN",
		SubTotal:               10000.0,
		DeliveryFee:            1500.0,
		TipAmount:              500.0,
		ServiceFee:             500.0,
		IsTaxInclusive:         true,
		TaxAmount:              697.67,
		MerchantCommissionRate: 0.15,
		CourierBasePay:         1200.0,
		MerchantID:             "rest_lagos",
		CourierID:              "rider_lagos",
	}

	result, err := DistributeOrderFunds(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Splits.GrossCustomerPaid != 12500.0 {
		t.Errorf("expected GrossCustomerPaid 12500.0, got %.2f", result.Splits.GrossCustomerPaid)
	}
	if result.Splits.TaxLiability != 0.0 {
		t.Errorf("expected TaxLiability 0.0, got %.2f", result.Splits.TaxLiability)
	}
	if result.Splits.MerchantPay != 8500.0 {
		t.Errorf("expected MerchantPay 8500.0, got %.2f", result.Splits.MerchantPay)
	}

	balance := VerifyJournalBalance(result.Journal.Lines)
	if !balance.Balanced {
		t.Errorf("nigerian order journal not balanced: variance = %.4f", balance.Variance)
	}
}

func TestRefundReversalJournal(t *testing.T) {
	original := Journal{
		Reference: "ORD-001",
		Currency:  "USD",
	}

	refund, err := CreateRefundJournal(original, RefundOptions{
		RefundAmount: 15.00,
		Reason:       "Missing item",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(refund.Lines) != 2 {
		t.Errorf("expected 2 refund lines, got %d", len(refund.Lines))
	}

	balance := VerifyJournalBalance(refund.Lines)
	if !balance.Balanced {
		t.Errorf("refund journal not balanced: variance = %.4f", balance.Variance)
	}
}
