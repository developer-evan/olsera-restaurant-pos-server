export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  EWALLET = 'ewallet',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
}

export const PAYABLE_ORDER_STATUSES = ['open', 'ready'] as const;
