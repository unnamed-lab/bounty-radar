export interface PayoutRecord {
  source: string;
  title: string;
  url: string;
  winner?: string; // handle / wallet / name if available
  amountText?: string;
  closedAt?: string;
}

export interface PayoutSource {
  readonly name: string;
  fetchPayouts(): Promise<PayoutRecord[]>;
}

export const PAYOUT_SOURCES = Symbol('PAYOUT_SOURCES');
