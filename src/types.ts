export type LedgerAccountType =
  | 'PSP_CLEARING'        // Inbound customer payments awaiting settlement
  | 'MERCHANT_WALLET'     // Merchant / Restaurant payable balance
  | 'COURIER_WALLET'      // Courier / Rider payable balance
  | 'PLATFORM_REVENUE'    // Platform commissions, service fees, delivery markup
  | 'TAX_PAYABLE'         // Marketplace sales tax collected to remit to tax authority
  | 'CUSTOMER_WALLET'     // Customer refund / credit balance
  | 'PROMOTION_SUBSIDY';  // Marketing discount subsidy balance

export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface LedgerLine {
  accountType: LedgerAccountType;
  actorType?: 'MERCHANT' | 'COURIER' | 'CUSTOMER' | 'PLATFORM' | 'TAX_AUTHORITY';
  actorId?: string;
  actorName?: string;
  direction: LedgerDirection;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface Journal {
  id?: string;
  reference: string;
  currency: string;
  lines: LedgerLine[];
  timestamp?: Date;
}

export interface SplitOrderInput {
  orderId: string;
  currency: string;
  subTotal: number;
  deliveryFee?: number;
  tipAmount?: number;
  serviceFee?: number;
  smallOrderFee?: number;
  discount?: number;
  discountFunder?: 'MERCHANT' | 'PLATFORM';
  taxAmount?: number;
  isTaxInclusive?: boolean;
  taxLiabilityType?: 'MARKETPLACE' | 'MERCHANT';
  merchantCommissionRate: number; // e.g. 0.20 for 20%
  courierBasePay?: number;
  merchantId: string;
  merchantName?: string;
  courierId?: string;
  courierName?: string;
}

export interface DistributionResult {
  journal: Journal;
  splits: {
    grossCustomerPaid: number;
    merchantPay: number;
    courierPay: number;
    platformCommission: number;
    platformServiceFee: number;
    platformSmallOrderFee: number;
    platformDeliverySpread: number;
    taxLiability: number;
    totalPlatformEarnings: number;
  };
}
