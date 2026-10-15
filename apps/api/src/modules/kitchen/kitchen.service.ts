import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import { emitKitchen } from "../../realtime/hub.js";
import { assertOrderTransition } from "../orders/order-status.js";
import type { OrderRepository } from "../orders/orders.repository.js";
import { toPublicKitchenTicket, type PublicKitchenTicket } from "./kitchen.public.js";
import type { KitchenRepository } from "./kitchen.repository.js";

function assertBranch(tenant: TenantContext, branchId: string) {
  if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

const ITEM_STATUSES = ["PENDING", "IN_PROGRESS", "READY"] as const;
type ItemStatus = (typeof ITEM_STATUSES)[number];

export function createKitchenService(kitchen: KitchenRepository, orders: OrderRepository) {
  async function assembleTicket(
    tenant: TenantContext,
    ticket: NonNullable<Awaited<ReturnType<KitchenRepository["findById"]>>>,
  ): Promise<PublicKitchenTicket> {
    const items = await kitchen.listItems(tenant.organizationId, [ticket.id]);
    return toPublicKitchenTicket(ticket, items);
  }

  async function refreshTicketStatus(tenant: TenantContext, ticketId: string) {
    const ticket = await kitchen.findById(tenant.organizationId, ticketId);
    if (!ticket || ticket.status === "CANCELLED") {
      return ticket;
    }
    const items = await kitchen.listItems(tenant.organizationId, [ticketId]);
    if (items.length === 0) {
      return ticket;
    }
    const allReady = items.every((item) => item.status === "READY");
    const anyCooking = items.some((item) => item.status === "IN_PROGRESS" || item.status === "READY");
    let next = ticket.status;
    if (allReady) {
      next = "READY";
    } else if (anyCooking && ticket.status === "NEW") {
      next = "IN_PROGRESS";
    }
    if (next !== ticket.status) {
      return kitchen.setTicketStatus(tenant.organizationId, ticketId, next);
    }
    return ticket;
  }

  async function syncOrderReady(tenant: TenantContext, actorId: string, orderId: string) {
    const tickets = await kitchen.listTicketsForOrder(tenant.organizationId, orderId);
    if (tickets.length === 0 || tickets.some((ticket) => ticket.status !== "READY")) {
      return;
    }
    const order = await orders.findOrder(tenant.organizationId, orderId);
    if (!order || order.status !== "PREPARING") {
      return;
    }
    assertOrderTransition(order.status, "READY");
    await orders.transition({
      organizationId: tenant.organizationId,
      orderId,
      fromStatus: order.status,
      toStatus: "READY",
      actorId,
      outbox: {
        topic: "order.updated",
        payload: JSON.stringify({ orderId, status: "READY", branchId: order.branchId }),
      },
    });
  }

  return {
    async listByColumn(tenant: TenantContext, branchId: string) {
      assertBranch(tenant, branchId);
      const tickets = await kitchen.listByBranch(tenant.organizationId, branchId);
      const open = tickets.filter((ticket) => ticket.status !== "CANCELLED");
      const items = await kitchen.listItems(
        tenant.organizationId,
        open.map((ticket) => ticket.id),
      );
      const publicTickets = open.map((ticket) => toPublicKitchenTicket(ticket, items));
      return {
        columns: {
          NEW: publicTickets.filter((ticket) => ticket.status === "NEW"),
          IN_PROGRESS: publicTickets.filter((ticket) => ticket.status === "IN_PROGRESS"),
          READY: publicTickets.filter((ticket) => ticket.status === "READY"),
        },
      };
    },

    async patchItem(
      tenant: TenantContext,
      actorId: string,
      itemId: string,
      patch: {
        status?: string;
        assignedCookId?: string | null;
        kitchenStationId?: string | null;
      },
    ) {
      if (patch.status && !ITEM_STATUSES.includes(patch.status as ItemStatus)) {
        throw new AppError("VALIDATION_ERROR", "Invalid kitchen item status", 400);
      }
      const item = await kitchen.findItem(tenant.organizationId, itemId);
      if (!item) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const ticket = await kitchen.findById(tenant.organizationId, item.ticketId);
      if (!ticket) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      assertBranch(tenant, ticket.branchId);
      if (ticket.status === "CANCELLED") {
        throw new AppError("INVALID_STATE_TRANSITION", "Ticket is cancelled", 409);
      }

      const updates: {
        status?: ItemStatus;
        assignedCookId?: string | null;
        kitchenStationId?: string | null;
        claimedAt?: Date | null;
      } = {};

      if (patch.status !== undefined) {
        updates.status = patch.status as ItemStatus;
      }
      if (patch.assignedCookId !== undefined) {
        updates.assignedCookId = patch.assignedCookId;
        updates.claimedAt = patch.assignedCookId ? new Date() : null;
        // If claiming and still PENDING, automatically move to IN_PROGRESS
        if (patch.assignedCookId && (!patch.status || patch.status === "PENDING") && item.status === "PENDING") {
          updates.status = "IN_PROGRESS";
        }
      }
      if (patch.kitchenStationId !== undefined) {
        updates.kitchenStationId = patch.kitchenStationId;
      }

      await kitchen.updateItem(tenant.organizationId, itemId, updates);
      const updated = await refreshTicketStatus(tenant, ticket.id);
      if (updated?.status === "READY") {
        await syncOrderReady(tenant, actorId, ticket.orderId);
      }
      const latest = await kitchen.findById(tenant.organizationId, ticket.id);
      if (!latest) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const publicTicket = await assembleTicket(tenant, latest);
      emitKitchen(latest.branchId, "kitchen.ticket.updated", publicTicket);
      emitKitchen(latest.branchId, "kitchen:ticket_updated", publicTicket);
      return publicTicket;
    },

    async updateItemStatus(
      tenant: TenantContext,
      actorId: string,
      itemId: string,
      status: string,
    ) {
      return this.patchItem(tenant, actorId, itemId, { status });
    },

    async listStations(tenant: TenantContext, branchId: string) {
      assertBranch(tenant, branchId);
      return kitchen.listStations(tenant.organizationId, branchId);
    },

    async createStation(
      tenant: TenantContext,
      restaurantId: string,
      branchId: string,
      input: { name: string; code: string; colorHex?: string; sortOrder?: number },
    ) {
      assertBranch(tenant, branchId);
      return kitchen.createStation(tenant.organizationId, restaurantId, branchId, input);
    },

    async bumpTicket(tenant: TenantContext, actorId: string, ticketId: string) {
      const ticket = await kitchen.findById(tenant.organizationId, ticketId);
      if (!ticket) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      assertBranch(tenant, ticket.branchId);
      if (ticket.status === "CANCELLED") {
        throw new AppError("INVALID_STATE_TRANSITION", "Ticket is cancelled", 409);
      }
      const items = await kitchen.listItems(tenant.organizationId, [ticketId]);
      for (const item of items) {
        if (item.status !== "READY") {
          await kitchen.updateItem(tenant.organizationId, item.id, {
            status: "READY",
            assignedCookId: item.assignedCookId ?? actorId,
          });
        }
      }
      const updated = await kitchen.setTicketStatus(tenant.organizationId, ticketId, "READY");
      if (!updated) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      await syncOrderReady(tenant, actorId, ticket.orderId);
      const publicTicket = await assembleTicket(tenant, updated);
      emitKitchen(updated.branchId, "kitchen.ticket.updated", publicTicket);
      emitKitchen(updated.branchId, "kitchen:ticket_updated", publicTicket);
      return publicTicket;
    },
  };
}

export type KitchenService = ReturnType<typeof createKitchenService>;
