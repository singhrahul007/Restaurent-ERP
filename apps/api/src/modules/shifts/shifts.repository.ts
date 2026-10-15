import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  payments,
  posShifts,
  withOrganizationScope,
  type Database,
} from "@niva/database";

export type ShiftRow = typeof posShifts.$inferSelect;

export function createShiftRepository(db: Database) {
  return {
    async findActiveShift(organizationId: string, cashierId: string, branchId?: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const conditions = [
          eq(posShifts.organizationId, organizationId),
          eq(posShifts.cashierId, cashierId),
          eq(posShifts.status, "OPEN"),
        ];
        if (branchId) {
          conditions.push(eq(posShifts.branchId, branchId));
        }
        const [shift] = await tx
          .select()
          .from(posShifts)
          .where(and(...conditions))
          .limit(1);
        return shift ?? null;
      });
    },

    async findShiftById(organizationId: string, shiftId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [shift] = await tx
          .select()
          .from(posShifts)
          .where(and(eq(posShifts.id, shiftId), eq(posShifts.organizationId, organizationId)))
          .limit(1);
        return shift ?? null;
      });
    },

    async listShifts(organizationId: string, branchId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        return tx
          .select()
          .from(posShifts)
          .where(
            and(eq(posShifts.organizationId, organizationId), eq(posShifts.branchId, branchId)),
          )
          .orderBy(desc(posShifts.openedAt));
      });
    },

    async openShift(input: {
      organizationId: string;
      branchId: string;
      cashierId: string;
      openingFloatMinor: number;
      notes?: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [shift] = await tx
          .insert(posShifts)
          .values({
            organizationId: input.organizationId,
            branchId: input.branchId,
            cashierId: input.cashierId,
            status: "OPEN",
            openingFloatMinor: input.openingFloatMinor,
            expectedCashMinor: input.openingFloatMinor,
            notes: input.notes,
          })
          .returning();
        return shift;
      });
    },

    async calculateShiftSales(organizationId: string, cashierId: string, openedAt: Date) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [totals] = await tx
          .select({
            cashSales: sql<number>`coalesce(sum(case when ${payments.method} = 'CASH' then ${payments.amountMinor} else 0 end), 0)::bigint`,
          })
          .from(payments)
          .where(
            and(
              eq(payments.organizationId, organizationId),
              eq(payments.createdBy, cashierId),
              eq(payments.status, "PAID"),
              gte(payments.createdAt, openedAt),
            ),
          );

        return {
          cashSalesMinor: Number(totals?.cashSales ?? 0),
        };
      });
    },

    async closeShift(input: {
      shiftId: string;
      organizationId: string;
      actualCashMinor: number;
      cashSalesMinor: number;
      expectedCashMinor: number;
      cashDiscrepancyMinor: number;
      denominationCountsJson?: string;
      notes?: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [closed] = await tx
          .update(posShifts)
          .set({
            status: "CLOSED",
            actualCashMinor: input.actualCashMinor,
            cashSalesMinor: input.cashSalesMinor,
            expectedCashMinor: input.expectedCashMinor,
            cashDiscrepancyMinor: input.cashDiscrepancyMinor,
            denominationCountsJson: input.denominationCountsJson,
            notes: input.notes,
            closedAt: new Date(),
          })
          .where(
            and(
              eq(posShifts.id, input.shiftId),
              eq(posShifts.organizationId, input.organizationId),
            ),
          )
          .returning();
        return closed;
      });
    },
  };
}

export type ShiftRepository = ReturnType<typeof createShiftRepository>;
