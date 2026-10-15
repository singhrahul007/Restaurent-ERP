import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { ShiftRepository } from "./shifts.repository.js";

export function createShiftService(shifts: ShiftRepository) {
  return {
    async getActiveShift(tenant: TenantContext, userId: string, branchId?: string) {
      return shifts.findActiveShift(tenant.organizationId, userId, branchId);
    },

    async listShifts(tenant: TenantContext, branchId: string) {
      if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
        throw new AppError("NOT_FOUND", "Branch not found", 404);
      }
      return shifts.listShifts(tenant.organizationId, branchId);
    },

    async openShift(
      tenant: TenantContext,
      userId: string,
      input: {
        branchId: string;
        openingFloatMinor: number;
        notes?: string;
      },
    ) {
      if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(input.branchId)) {
        throw new AppError("NOT_FOUND", "Branch not found", 404);
      }
      const existing = await shifts.findActiveShift(tenant.organizationId, userId, input.branchId);
      if (existing) {
        throw new AppError("CONFLICT", "An active shift is already open for this cashier", 409);
      }
      return shifts.openShift({
        organizationId: tenant.organizationId,
        branchId: input.branchId,
        cashierId: userId,
        openingFloatMinor: input.openingFloatMinor,
        notes: input.notes,
      });
    },

    async closeShift(
      tenant: TenantContext,
      userId: string,
      shiftId: string,
      input: {
        actualCashMinor: number;
        denominationCounts?: Record<string, number>;
        notes?: string;
      },
      hasManagePermission = false,
    ) {
      const shift = await shifts.findShiftById(tenant.organizationId, shiftId);
      if (!shift) {
        throw new AppError("NOT_FOUND", "Shift not found", 404);
      }
      if (shift.status === "CLOSED") {
        throw new AppError("CONFLICT", "Shift is already closed", 409);
      }
      if (shift.cashierId !== userId && !hasManagePermission) {
        throw new AppError("FORBIDDEN", "Forbidden", 403);
      }

      const { cashSalesMinor } = await shifts.calculateShiftSales(
        tenant.organizationId,
        shift.cashierId,
        shift.openedAt,
      );

      const expectedCashMinor = shift.openingFloatMinor + cashSalesMinor;
      const cashDiscrepancyMinor = input.actualCashMinor - expectedCashMinor;

      return shifts.closeShift({
        shiftId: shift.id,
        organizationId: tenant.organizationId,
        actualCashMinor: input.actualCashMinor,
        cashSalesMinor,
        expectedCashMinor,
        cashDiscrepancyMinor,
        denominationCountsJson: input.denominationCounts
          ? JSON.stringify(input.denominationCounts)
          : undefined,
        notes: input.notes,
      });
    },
  };
}

export type ShiftService = ReturnType<typeof createShiftService>;
