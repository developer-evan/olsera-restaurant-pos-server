export enum OrderStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  IN_KITCHEN = 'in_kitchen',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.OPEN, OrderStatus.CANCELLED],
  [OrderStatus.OPEN]: [OrderStatus.IN_KITCHEN, OrderStatus.CANCELLED],
  [OrderStatus.IN_KITCHEN]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export const ORDER_ITEM_EDITABLE_STATUSES: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.OPEN,
];
