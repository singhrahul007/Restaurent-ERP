import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  deliveryAgents,
  deliveries,
  deliveryEvents,
  memberships,
  orders,
  withOrganizationScope,
  type Database,
} from "@niva/database";

const deliverySelect = {
  id: deliveries.id,
  organizationId: deliveries.organizationId,
  restaurantId: deliveries.restaurantId,
  branchId: deliveries.branchId,
  orderId: deliveries.orderId,
  agentId: deliveries.agentId,
  status: deliveries.status,
  otpHash: deliveries.otpHash,
  codAmountMinor: deliveries.codAmountMinor,
  codCollectedMinor: deliveries.codCollectedMinor,
  addressLine: deliveries.addressLine,
  phone: deliveries.phone,
  customerName: deliveries.customerName,
  deliveredAt: deliveries.deliveredAt,
  createdAt: deliveries.createdAt,
};

export function createDeliveryRepository(db: Database) {
  return {
    findMembershipUser(organizationId: string, userId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({ id: memberships.id, userId: memberships.userId })
          .from(memberships)
          .where(
            and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    findAgentByUser(organizationId: string, userId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: deliveryAgents.id,
            userId: deliveryAgents.userId,
            online: deliveryAgents.online,
          })
          .from(deliveryAgents)
          .where(
            and(
              eq(deliveryAgents.organizationId, organizationId),
              eq(deliveryAgents.userId, userId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    findAgentById(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: deliveryAgents.id,
            userId: deliveryAgents.userId,
            online: deliveryAgents.online,
          })
          .from(deliveryAgents)
          .where(and(eq(deliveryAgents.id, id), eq(deliveryAgents.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    upsertAgentOnline(input: { organizationId: string; userId: string; online: boolean }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [existing] = await tx
          .select({ id: deliveryAgents.id })
          .from(deliveryAgents)
          .where(
            and(
              eq(deliveryAgents.organizationId, input.organizationId),
              eq(deliveryAgents.userId, input.userId),
            ),
          )
          .limit(1);
        if (existing) {
          const [row] = await tx
            .update(deliveryAgents)
            .set({ online: input.online })
            .where(eq(deliveryAgents.id, existing.id))
            .returning({
              id: deliveryAgents.id,
              userId: deliveryAgents.userId,
              online: deliveryAgents.online,
            });
          return row!;
        }
        const [row] = await tx
          .insert(deliveryAgents)
          .values({
            organizationId: input.organizationId,
            userId: input.userId,
            online: input.online,
          })
          .returning({
            id: deliveryAgents.id,
            userId: deliveryAgents.userId,
            online: deliveryAgents.online,
          });
        if (!row) {
          throw new Error("DELIVERY_AGENT_INSERT_FAILED");
        }
        return row;
      });
    },

    listAgents(organizationId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: deliveryAgents.id,
            userId: deliveryAgents.userId,
            online: deliveryAgents.online,
          })
          .from(deliveryAgents)
          .where(eq(deliveryAgents.organizationId, organizationId)),
      );
    },

    findOrder(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: orders.id,
            type: orders.type,
            status: orders.status,
            restaurantId: orders.restaurantId,
            branchId: orders.branchId,
            totalMinor: orders.totalMinor,
          })
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    insertDelivery(input: {
      organizationId: string;
      restaurantId: string;
      branchId: string;
      orderId: string;
      agentId: string;
      otpHash: string;
      codAmountMinor: number;
      addressLine: string;
      phone?: string;
      customerName?: string;
      actorId: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(deliveries)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            orderId: input.orderId,
            orderType: "DELIVERY",
            agentId: input.agentId,
            status: "ASSIGNED",
            otpHash: input.otpHash,
            codAmountMinor: input.codAmountMinor,
            addressLine: input.addressLine,
            phone: input.phone,
            customerName: input.customerName,
          })
          .returning(deliverySelect);
        if (!row) {
          throw new Error("DELIVERY_INSERT_FAILED");
        }
        await tx.insert(deliveryEvents).values({
          organizationId: input.organizationId,
          deliveryId: row.id,
          type: "ASSIGNED",
          actorId: input.actorId,
        });
        return row;
      });
    },

    findById(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(deliverySelect)
          .from(deliveries)
          .where(and(eq(deliveries.id, id), eq(deliveries.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    findByOrder(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(deliverySelect)
          .from(deliveries)
          .where(
            and(eq(deliveries.orderId, orderId), eq(deliveries.organizationId, organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    listForAgent(organizationId: string, agentId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(deliverySelect)
          .from(deliveries)
          .where(
            and(
              eq(deliveries.organizationId, organizationId),
              eq(deliveries.agentId, agentId),
              sql`${deliveries.status} <> 'CANCELLED'`,
            ),
          )
          .orderBy(desc(deliveries.createdAt)),
      );
    },

    setStatus(input: {
      organizationId: string;
      id: string;
      fromStatus: "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "CANCELLED";
      toStatus: "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "CANCELLED";
      eventType: "PICKED_UP" | "DELIVERED" | "COD_RECORDED" | "CANCELLED";
      actorId: string;
      codCollectedMinor?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .update(deliveries)
          .set({
            status: input.toStatus,
            ...(input.toStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
            ...(input.codCollectedMinor != null
              ? { codCollectedMinor: input.codCollectedMinor }
              : {}),
          })
          .where(
            and(
              eq(deliveries.id, input.id),
              eq(deliveries.organizationId, input.organizationId),
              eq(deliveries.status, input.fromStatus),
            ),
          )
          .returning(deliverySelect);
        if (!row) {
          return null;
        }
        await tx.insert(deliveryEvents).values({
          organizationId: input.organizationId,
          deliveryId: row.id,
          type: input.eventType,
          actorId: input.actorId,
        });
        if (input.codCollectedMinor != null && input.toStatus === "DELIVERED") {
          await tx.insert(deliveryEvents).values({
            organizationId: input.organizationId,
            deliveryId: row.id,
            type: "COD_RECORDED",
            actorId: input.actorId,
          });
        }
        return row;
      });
    },

    earningsForAgent(input: {
      organizationId: string;
      agentId: string;
      from: Date;
      to: Date;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .select({
            count: sql<number>`count(*)::int`,
            codCollectedMinor: sql<number>`coalesce(sum(${deliveries.codCollectedMinor}), 0)::bigint`,
          })
          .from(deliveries)
          .where(
            and(
              eq(deliveries.organizationId, input.organizationId),
              eq(deliveries.agentId, input.agentId),
              eq(deliveries.status, "DELIVERED"),
              gte(deliveries.deliveredAt, input.from),
              lt(deliveries.deliveredAt, input.to),
            ),
          );
        return {
          count: Number(row?.count ?? 0),
          codCollectedMinor: Number(row?.codCollectedMinor ?? 0),
        };
      });
    },
  };
}

export type DeliveryRepository = ReturnType<typeof createDeliveryRepository>;
