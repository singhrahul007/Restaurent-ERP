import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { ReservationRepository } from "./reservations.repository.js";

export function createReservationService(reservations: ReservationRepository) {
  return {
    async listReservations(
      tenant: TenantContext,
      branchId: string,
      from?: string,
      to?: string,
    ) {
      if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
        throw new AppError("NOT_FOUND", "Branch not found", 404);
      }
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      return reservations.listReservations(tenant.organizationId, branchId, fromDate, toDate);
    },

    async createReservation(
      tenant: TenantContext,
      input: {
        branchId: string;
        guestName: string;
        guestPhone: string;
        partySize: number;
        reservationTime: string;
        tableId?: string | null;
        specialRequests?: string;
      },
    ) {
      if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(input.branchId)) {
        throw new AppError("NOT_FOUND", "Branch not found", 404);
      }
      return reservations.createReservation({
        organizationId: tenant.organizationId,
        branchId: input.branchId,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        partySize: input.partySize,
        reservationTime: new Date(input.reservationTime),
        tableId: input.tableId,
        specialRequests: input.specialRequests,
      });
    },

    async patchReservation(
      tenant: TenantContext,
      id: string,
      input: {
        status?: "CONFIRMED" | "WAITLISTED" | "SEATED" | "CANCELLED" | "NO_SHOW";
        tableId?: string | null;
        partySize?: number;
        reservationTime?: string;
        specialRequests?: string;
      },
    ) {
      const existing = await reservations.findReservationById(tenant.organizationId, id);
      if (!existing) {
        throw new AppError("NOT_FOUND", "Reservation not found", 404);
      }
      if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(existing.branchId)) {
        throw new AppError("FORBIDDEN", "Forbidden", 403);
      }
      const updated = await reservations.patchReservation(tenant.organizationId, id, {
        status: input.status,
        tableId: input.tableId,
        partySize: input.partySize,
        reservationTime: input.reservationTime ? new Date(input.reservationTime) : undefined,
        specialRequests: input.specialRequests,
      });
      return updated;
    },
  };
}

export type ReservationService = ReturnType<typeof createReservationService>;
