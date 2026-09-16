import { AppError } from "../../lib/errors.js";

export const ORDER_STATUSES = [
  "DRAFT",
  "CREATED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "HANDED_OVER",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const ALLOWED: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["CREATED", "CANCELLED"],
  CREATED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "HANDED_OVER", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  HANDED_OVER: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new AppError(
      "INVALID_STATE_TRANSITION",
      `Cannot transition order from ${from} to ${to}`,
      409,
    );
  }
}

export function canMutateItems(status: OrderStatus): boolean {
  return status === "DRAFT" || status === "CREATED";
}

export function isOpenOrderStatus(status: OrderStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}
