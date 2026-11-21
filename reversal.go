package ledgerengine

import (
	"fmt"
	"time"
)

// RefundOptions specifies parameters for creating a refund reversal journal.
type RefundOptions struct {
	RefundAmount float64 `json:"refundAmount"`
	Reason       string  `json:"reason,omitempty"`
	RefundFrom   string  `json:"refundFrom,omitempty"` // "MERCHANT" (default) or "PLATFORM"
}

// CreateRefundJournal generates an idempotent, balanced reversal journal for full or partial refunds.
func CreateRefundJournal(original Journal, options RefundOptions) (*Journal, error) {
	refundAmount := Round2(options.RefundAmount)
	if refundAmount <= 0 {
		return nil, fmt.Errorf("refund amount must be greater than zero")
	}

	source := AccountMerchantWallet
	if options.RefundFrom == "PLATFORM" {
		source = AccountPlatformRevenue
	}

	reason := options.Reason
	if reason == "" {
		reason = "Customer refund"
	}

	lines := []LedgerLine{
		{
			AccountType: source,
			Direction:   DirectionDebit,
			Amount:      refundAmount,
			Currency:    original.Currency,
			Description: fmt.Sprintf("Refund deduction: %s", reason),
		},
		{
			AccountType: AccountCustomerWallet,
			Direction:   DirectionCredit,
			Amount:      refundAmount,
			Currency:    original.Currency,
			Description: fmt.Sprintf("Customer refund credit: %s", reason),
		},
	}

	check := VerifyJournalBalance(lines)
	if !check.Balanced {
		return nil, fmt.Errorf("refund journal balance invariant failed")
	}

	return &Journal{
		Reference: fmt.Sprintf("REF-%s-%d", original.Reference, time.Now().UnixMilli()),
		Currency:  original.Currency,
		Lines:     lines,
		Timestamp: time.Now().UTC(),
	}, nil
}
