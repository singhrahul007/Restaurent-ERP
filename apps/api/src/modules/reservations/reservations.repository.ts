import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  diningTables,
  tableReservations,
  withOrganizationScope,
  type Database,
} from "@niva/database";

export type ReservationRow = typeof tableReservations.$inferSelect;

export function createReservationRepository(db: Database) {
  return {
    async listReservations(organizationId: string, branchId: string, from?: Date, to?: Date) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const conditions = [
          eq(tableReservations.organizationId, organizationId),
          eq(tableReservations.branchId, branchId),
        ];
        if (from) {
          conditions.push(gte(tableReservations.reservationTime, from));
        }
        if (to) {
          conditions.push(lte(tableReservations.reservationTime, to));
        }

        return tx
          .select({
            id: tableReservations.id,
            organizationId: tableReservations.organizationId,
            branchId: tableReservations.branchId,
            guestName: tableReservations.guestName,
            guestPhone: tableReservations.guestPhone,
            partySize: tableReservations.partySize,
            reservationTime: tableReservations.reservationTime,
            tableId: tableReservations.tableId,
            tableCode: diningTables.code,
            status: tableReservations.status,
            specialRequests: tableReservations.specialRequests,
            createdAt: tableReservations.createdAt,
            updatedAt: tableReservations.updatedAt,
          })
          .from(tableReservations)
          .leftJoin(diningTables, eq(tableReservations.tableId, diningTables.id))
          .where(and(...conditions))
          .orderBy(desc(tableReservations.reservationTime));
      });
    },

    async findReservationById(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [reservation] = await tx
          .select()
          .from(tableReservations)
          .where(
            and(
              eq(tableReservations.id, id),
              eq(tableReservations.organizationId, organizationId),
            ),
          )
          .limit(1);
        return reservation ?? null;
      });
    },

    async createReservation(input: {
      organizationId: string;
      branchId: string;
      guestName: string;
      guestPhone: string;
      partySize: number;
      reservationTime: Date;
      tableId?: string | null;
      status?: "CONFIRMED" | "WAITLISTED" | "SEATED" | "CANCELLED" | "NO_SHOW";
      specialRequests?: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [reservation] = await tx
          .insert(tableReservations)
          .values({
            organizationId: input.organizationId,
            branchId: input.branchId,
            guestName: input.guestName,
            guestPhone: input.guestPhone,
            partySize: input.partySize,
            reservationTime: input.reservationTime,
            tableId: input.tableId,
            status: input.status ?? "CONFIRMED",
            specialRequests: input.specialRequests,
          })
          .returning();
        return reservation;
      });
    },

    async patchReservation(
      organizationId: string,
      id: string,
      patch: {
        status?: "CONFIRMED" | "WAITLISTED" | "SEATED" | "CANCELLED" | "NO_SHOW";
        tableId?: string | null;
        partySize?: number;
        reservationTime?: Date;
        specialRequests?: string;
      },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [updated] = await tx
          .update(tableReservations)
          .set({
            ...patch,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tableReservations.id, id),
              eq(tableReservations.organizationId, organizationId),
            ),
          )
          .returning();
        return updated ?? null;
      });
    },
  };
}

export type ReservationRepository = ReturnType<typeof createReservationRepository>;

