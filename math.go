package ledgerengine

import "math"

// Round2 rounds a float64 to exactly 2 decimal places to eliminate IEEE floating-point drift.
func Round2(val float64) float64 {
	return math.Round(val*100.0) / 100.0
}

// BalanceCheck contains the mathematical validation result of a journal.
type BalanceCheck struct {
	Balanced     bool    `json:"balanced"`
	TotalDebits  float64 `json:"totalDebits"`
	TotalCredits float64 `json:"totalCredits"`
	Variance     float64 `json:"variance"`
}

// VerifyJournalBalance ensures that Sum(Debits) === Sum(Credits).
func VerifyJournalBalance(lines []LedgerLine) BalanceCheck {
	var debits, credits float64

	for _, line := range lines {
		amt := Round2(line.Amount)
		if line.Direction == DirectionDebit {
			debits += amt
		} else {
			credits += amt
		}
	}

	debits = Round2(debits)
	credits = Round2(credits)
	variance := Round2(math.Abs(debits - credits))

	return BalanceCheck{
		Balanced:     variance < 0.005,
		TotalDebits:  debits,
		TotalCredits: credits,
		Variance:     variance,
	}
}
