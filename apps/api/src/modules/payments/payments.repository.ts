import { and, eq } from "drizzle-orm";
import { payments, refunds, withOrganizationScope, type Database } from "@niva/database";

export function createPaymentRepository(db: Database) {
  return {
    insertPayment(input: {
      organizationId: string;
      orderId: string;
      amountMinor: number;
      method: "CASH";
      createdBy: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(payments)
          .values({
            organizationId: input.organizationId,
            orderId: input.orderId,
            amountMinor: input.amountMinor,
            method: input.method,
            status: "PAID",
            createdBy: input.createdBy,
          })
          .returning({
            id: payments.id,
            orderId: payments.orderId,
            amountMinor: payments.amountMinor,
            status: payments.status,
            method: payments.method,
            createdAt: payments.createdAt,
          });
        if (!row) {
          throw new Error("PAYMENT_INSERT_FAILED");
        }
        return row;
      });
    },

    listByOrder(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: payments.id,
            orderId: payments.orderId,
            amountMinor: payments.amountMinor,
            status: payments.status,
            method: payments.method,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .where(
            and(eq(payments.organizationId, organizationId), eq(payments.orderId, orderId)),
          ),
      );
    },

    findPayment(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: payments.id,
            orderId: payments.orderId,
            amountMinor: payments.amountMinor,
            status: payments.status,
            method: payments.method,
          })
          .from(payments)
          .where(and(eq(payments.id, id), eq(payments.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    async sumsForOrder(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const payRows = await tx
          .select({
            id: payments.id,
            amountMinor: payments.amountMinor,
            status: payments.status,
          })
          .from(payments)
          .where(
            and(eq(payments.organizationId, organizationId), eq(payments.orderId, orderId)),
          );
        const capturedMinor = payRows
          .filter((row) => row.status !== "FAILED")
          .reduce((sum, row) => sum + row.amountMinor, 0);
        const paymentIds = payRows.map((row) => row.id);
        const refundRows =
          paymentIds.length === 0
            ? []
            : await tx
                .select({
                  paymentId: refunds.paymentId,
                  amountMinor: refunds.amountMinor,
                })
                .from(refunds)
                .where(eq(refunds.organizationId, organizationId));
        const idSet = new Set(paymentIds);
        const refundedMinor = refundRows
          .filter((row) => idSet.has(row.paymentId))
          .reduce((sum, row) => sum + row.amountMinor, 0);
        return { capturedMinor, refundedMinor, netPaidMinor: capturedMinor - refundedMinor };
      });
    },

    listRefunds(organizationId: string, paymentId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: refunds.id,
            paymentId: refunds.paymentId,
            amountMinor: refunds.amountMinor,
            reason: refunds.reason,
            createdAt: refunds.createdAt,
          })
          .from(refunds)
          .where(
            and(eq(refunds.organizationId, organizationId), eq(refunds.paymentId, paymentId)),
          ),
      );
    },

    insertRefund(input: {
      organizationId: string;
      paymentId: string;
      amountMinor: number;
      reason?: string;
      createdBy: string;
      nextStatus: "REFUNDED" | "PARTIALLY_REFUNDED";
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(refunds)
          .values({
            organizationId: input.organizationId,
            paymentId: input.paymentId,
            amountMinor: input.amountMinor,
            reason: input.reason,
            createdBy: input.createdBy,
          })
          .returning({
            id: refunds.id,
            paymentId: refunds.paymentId,
            amountMinor: refunds.amountMinor,
            reason: refunds.reason,
          });
        await tx
          .update(payments)
          .set({ status: input.nextStatus })
          .where(eq(payments.id, input.paymentId));
        if (!row) {
          throw new Error("REFUND_INSERT_FAILED");
        }
        return row;
      });
    },
  };
}

export type PaymentRepository = ReturnType<typeof createPaymentRepository>;
