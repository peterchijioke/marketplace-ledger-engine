package ledgerengine

import "time"

// AccountType represents the functional category of a ledger account.
type AccountType string

const (
	AccountPSPClearing       AccountType = "PSP_CLEARING"
	AccountMerchantWallet    AccountType = "MERCHANT_WALLET"
	AccountCourierWallet     AccountType = "COURIER_WALLET"
	AccountPlatformRevenue   AccountType = "PLATFORM_REVENUE"
	AccountTaxPayable        AccountType = "TAX_PAYABLE"
	AccountCustomerWallet    AccountType = "CUSTOMER_WALLET"
	AccountPromotionSubsidy  AccountType = "PROMOTION_SUBSIDY"
)

// Direction represents a double-entry line direction (DEBIT or CREDIT).
type Direction string

const (
	DirectionDebit  Direction = "DEBIT"
	DirectionCredit Direction = "CREDIT"
)

// ActorType identifies the legal category of the account holder.
type ActorType string

const (
	ActorMerchant     ActorType = "MERCHANT"
	ActorCourier      ActorType = "COURIER"
	ActorCustomer     ActorType = "CUSTOMER"
	ActorPlatform     ActorType = "PLATFORM"
	ActorTaxAuthority ActorType = "TAX_AUTHORITY"
)

// LedgerLine represents a single journal entry row.
type LedgerLine struct {
	AccountType AccountType            `json:"accountType"`
	ActorType   ActorType              `json:"actorType,omitempty"`
	ActorID     string                 `json:"actorId,omitempty"`
	ActorName   string                 `json:"actorName,omitempty"`
	Direction   Direction              `json:"direction"`
	Amount      float64                `json:"amount"`
	Currency    string                 `json:"currency"`
	Description string                 `json:"description"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Journal represents a complete, balanced double-entry accounting transaction.
type Journal struct {
	ID        string       `json:"id,omitempty"`
	Reference string       `json:"reference"`
	Currency  string       `json:"currency"`
	Lines     []LedgerLine `json:"lines"`
	Timestamp time.Time    `json:"timestamp"`
}

// SplitOrderInput defines the incoming order financial parameters to distribute.
type SplitOrderInput struct {
	OrderID                string    `json:"orderId"`
	Currency               string    `json:"currency"`
	SubTotal               float64   `json:"subTotal"`
	DeliveryFee            float64   `json:"deliveryFee,omitempty"`
	TipAmount              float64   `json:"tipAmount,omitempty"`
	ServiceFee             float64   `json:"serviceFee,omitempty"`
	SmallOrderFee          float64   `json:"smallOrderFee,omitempty"`
	Discount               float64   `json:"discount,omitempty"`
	DiscountFunder         string    `json:"discountFunder,omitempty"` // "MERCHANT" or "PLATFORM"
	TaxAmount              float64   `json:"taxAmount,omitempty"`
	IsTaxInclusive         bool      `json:"isTaxInclusive,omitempty"`
	TaxLiabilityType       string    `json:"taxLiabilityType,omitempty"` // "MARKETPLACE" or "MERCHANT"
	MerchantCommissionRate float64   `json:"merchantCommissionRate"`     // e.g. 0.20 for 20%
	CourierBasePay         float64   `json:"courierBasePay,omitempty"`
	MerchantID             string    `json:"merchantId"`
	MerchantName           string    `json:"merchantName,omitempty"`
	CourierID              string    `json:"courierId,omitempty"`
	CourierName            string    `json:"courierName,omitempty"`
}

// SplitsSummary provides human-readable financial totals calculated by the engine.
type SplitsSummary struct {
	GrossCustomerPaid      float64 `json:"grossCustomerPaid"`
	MerchantPay            float64 `json:"merchantPay"`
	CourierPay             float64 `json:"courierPay"`
	PlatformCommission     float64 `json:"platformCommission"`
	PlatformServiceFee     float64 `json:"platformServiceFee"`
	PlatformSmallOrderFee  float64 `json:"platformSmallOrderFee"`
	PlatformDeliverySpread float64 `json:"platformDeliverySpread"`
	TaxLiability           float64 `json:"taxLiability"`
	TotalPlatformEarnings  float64 `json:"totalPlatformEarnings"`
}

// DistributionResult is returned after processing an order.
type DistributionResult struct {
	Journal Journal       `json:"journal"`
	Splits  SplitsSummary `json:"splits"`
}
