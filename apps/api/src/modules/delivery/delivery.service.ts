import { generateNumericOtp, hashOtp, otpMatches } from "@niva/auth";
import { writeAudit, type Database } from "@niva/database";
import type { ApiEnv } from "@niva/config";
import type { AssignDeliveryBody, ConfirmDeliveryBody } from "@niva/validation";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import { emitUser } from "../../realtime/hub.js";
import { toPublicDelivery } from "./delivery.public.js";
import type { DeliveryRepository } from "./delivery.repository.js";

function assertBranch(tenant: TenantContext, branchId: string) {
  if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

function utcDayRange(isoDate?: string): { from: Date; to: Date } {
  const base = isoDate ? new Date(`${isoDate}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid date", 400);
  }
  const from = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}

export function createDeliveryService(
  deliveries: DeliveryRepository,
  db: Database,
  env: ApiEnv,
) {
  async function requireOwnAgent(tenant: TenantContext, userId: string) {
    const agent = await deliveries.findAgentByUser(tenant.organizationId, userId);
    if (!agent) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    return agent;
  }

  return {
    async setOnline(
      tenant: TenantContext,
      userId: string,
      online: boolean,
      context: { ip?: string | null; userAgent?: string | null },
    ) {
      const member = await deliveries.findMembershipUser(tenant.organizationId, userId);
      if (!member) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const agent = await deliveries.upsertAgentOnline({
        organizationId: tenant.organizationId,
        userId,
        online,
      });
      await writeAudit(db, {
        actorId: userId,
        organizationId: tenant.organizationId,
        action: "SETTINGS_CHANGED",
        resourceType: "delivery_agent",
        resourceId: agent.id,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { online },
      });
      return agent;
    },

    async me(tenant: TenantContext, userId: string) {
      const agent = await deliveries.findAgentByUser(tenant.organizationId, userId);
      return agent ?? { id: null, userId, online: false };
    },

    listAgents(tenant: TenantContext) {
      return deliveries.listAgents(tenant.organizationId);
    },

    async assign(
      tenant: TenantContext,
      actorId: string,
      body: AssignDeliveryBody,
    ) {
      const order = await deliveries.findOrder(tenant.organizationId, body.orderId);
      if (!order) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      assertBranch(tenant, order.branchId);
      if (order.type !== "DELIVERY") {
        throw new AppError("VALIDATION_ERROR", "Order is not a delivery order", 400);
      }
      if (order.status === "CANCELLED" || order.status === "COMPLETED") {
        throw new AppError("INVALID_STATE_TRANSITION", "Order cannot be assigned", 409);
      }
      const member = await deliveries.findMembershipUser(
        tenant.organizationId,
        body.agentUserId,
      );
      if (!member) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      let agent = await deliveries.findAgentByUser(tenant.organizationId, body.agentUserId);
      if (!agent) {
        agent = await deliveries.upsertAgentOnline({
          organizationId: tenant.organizationId,
          userId: body.agentUserId,
          online: false,
        });
      }
      const otp = generateNumericOtp();
      const otpHash = hashOtp(otp, env.JWT_ACCESS_SECRET, body.orderId);
      const codAmountMinor = body.codAmountMinor ?? 0;
      try {
        const row = await deliveries.insertDelivery({
          organizationId: tenant.organizationId,
          restaurantId: order.restaurantId,
          branchId: order.branchId,
          orderId: order.id,
          agentId: agent.id,
          otpHash,
          codAmountMinor,
          addressLine: body.addressLine,
          phone: body.phone,
          customerName: body.customerName,
          actorId,
        });
        emitUser(agent.userId, "delivery.assigned", {
          deliveryId: row.id,
          orderId: row.orderId,
        });
        return { ...toPublicDelivery(row), otp };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Delivery already assigned for this order", 409);
        }
        throw error;
      }
    },

    async get(tenant: TenantContext, userId: string, id: string, canManage: boolean) {
      const row = await deliveries.findById(tenant.organizationId, id);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      assertBranch(tenant, row.branchId);
      if (!canManage) {
        const agent = await requireOwnAgent(tenant, userId);
        if (row.agentId !== agent.id) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      return toPublicDelivery(row);
    },

    async listMine(tenant: TenantContext, userId: string) {
      const agent = await deliveries.findAgentByUser(tenant.organizationId, userId);
      if (!agent) {
        return [];
      }
      const rows = await deliveries.listForAgent(tenant.organizationId, agent.id);
      return rows.map(toPublicDelivery);
    },

    async pickup(tenant: TenantContext, userId: string, id: string, canManage: boolean) {
      const row = await deliveries.findById(tenant.organizationId, id);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      assertBranch(tenant, row.branchId);
      if (!canManage) {
        const agent = await requireOwnAgent(tenant, userId);
        if (row.agentId !== agent.id) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      if (row.status !== "ASSIGNED") {
        throw new AppError("INVALID_STATE_TRANSITION", "Delivery is not assigned", 409);
      }
      const updated = await deliveries.setStatus({
        organizationId: tenant.organizationId,
        id,
        fromStatus: "ASSIGNED",
        toStatus: "PICKED_UP",
        eventType: "PICKED_UP",
        actorId: userId,
      });
      if (!updated) {
        throw new AppError("INVALID_STATE_TRANSITION", "Delivery is not assigned", 409);
      }
      return toPublicDelivery(updated);
    },

    async confirm(
      tenant: TenantContext,
      userId: string,
      id: string,
      body: ConfirmDeliveryBody,
      canManage: boolean,
    ) {
      const row = await deliveries.findById(tenant.organizationId, id);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      assertBranch(tenant, row.branchId);
      if (!canManage) {
        const agent = await requireOwnAgent(tenant, userId);
        if (row.agentId !== agent.id) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      if (row.status !== "PICKED_UP") {
        throw new AppError("INVALID_STATE_TRANSITION", "Delivery is not picked up", 409);
      }
      if (!otpMatches(body.otp, env.JWT_ACCESS_SECRET, row.orderId, row.otpHash)) {
        throw new AppError("VALIDATION_ERROR", "Invalid OTP", 400);
      }
      const updated = await deliveries.setStatus({
        organizationId: tenant.organizationId,
        id,
        fromStatus: "PICKED_UP",
        toStatus: "DELIVERED",
        eventType: "DELIVERED",
        actorId: userId,
        codCollectedMinor: body.codCollectedMinor,
      });
      if (!updated) {
        throw new AppError("INVALID_STATE_TRANSITION", "Delivery is not picked up", 409);
      }
      return toPublicDelivery(updated);
    },

    async myEarnings(tenant: TenantContext, userId: string, date?: string) {
      const range = utcDayRange(date);
      const agent = await deliveries.findAgentByUser(tenant.organizationId, userId);
      if (!agent) {
        return {
          agentId: null as string | null,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          count: 0,
          codCollectedMinor: 0,
        };
      }
      const summary = await deliveries.earningsForAgent({
        organizationId: tenant.organizationId,
        agentId: agent.id,
        from: range.from,
        to: range.to,
      });
      return {
        agentId: agent.id,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        count: summary.count,
        codCollectedMinor: summary.codCollectedMinor,
      };
    },
  };
}
