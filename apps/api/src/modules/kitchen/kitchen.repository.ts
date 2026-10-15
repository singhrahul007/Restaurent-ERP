import { and, desc, eq, inArray } from "drizzle-orm";
import {
  diningTables,
  kitchenStations,
  kitchenTicketItems,
  kitchenTickets,
  orderItemModifiers,
  orderItems,
  orders,
  users,
  withOrganizationScope,
  type Database,
} from "@niva/database";

type OrgTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const ticketSelect = {
  id: kitchenTickets.id,
  organizationId: kitchenTickets.organizationId,
  restaurantId: kitchenTickets.restaurantId,
  branchId: kitchenTickets.branchId,
  orderId: kitchenTickets.orderId,
  status: kitchenTickets.status,
  orderType: kitchenTickets.orderType,
  tableCode: kitchenTickets.tableCode,
  createdAt: kitchenTickets.createdAt,
  updatedAt: kitchenTickets.updatedAt,
};

export async function insertKitchenTicketsForOrder(
  tx: OrgTx,
  input: { organizationId: string; orderId: string },
) {
  const [existing] = await tx
    .select({ id: kitchenTickets.id })
    .from(kitchenTickets)
    .where(
      and(
        eq(kitchenTickets.organizationId, input.organizationId),
        eq(kitchenTickets.orderId, input.orderId),
      ),
    )
    .limit(1);
  if (existing) {
    return existing;
  }

  const [order] = await tx
    .select({
      id: orders.id,
      restaurantId: orders.restaurantId,
      branchId: orders.branchId,
      tableId: orders.tableId,
      type: orders.type,
    })
    .from(orders)
    .where(
      and(eq(orders.id, input.orderId), eq(orders.organizationId, input.organizationId)),
    )
    .limit(1);
  if (!order) {
    return null;
  }

  let tableCode: string | null = null;
  if (order.tableId) {
    const [table] = await tx
      .select({ code: diningTables.code })
      .from(diningTables)
      .where(eq(diningTables.id, order.tableId))
      .limit(1);
    tableCode = table?.code ?? null;
  }

  const items = await tx
    .select({
      id: orderItems.id,
      itemName: orderItems.itemName,
      variantName: orderItems.variantName,
      qty: orderItems.qty,
    })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.organizationId, input.organizationId),
        eq(orderItems.orderId, input.orderId),
      ),
    );

  const itemIds = items.map((item) => item.id);
  const modifiers =
    itemIds.length === 0
      ? []
      : await tx
          .select({
            orderItemId: orderItemModifiers.orderItemId,
            name: orderItemModifiers.name,
          })
          .from(orderItemModifiers)
          .where(inArray(orderItemModifiers.orderItemId, itemIds));

  const [ticket] = await tx
    .insert(kitchenTickets)
    .values({
      organizationId: input.organizationId,
      restaurantId: order.restaurantId,
      branchId: order.branchId,
      orderId: order.id,
      status: "NEW",
      orderType: order.type,
      tableCode,
    })
    .returning({ id: kitchenTickets.id });
  if (!ticket) {
    throw new Error("KITCHEN_TICKET_INSERT_FAILED");
  }

  if (items.length > 0) {
    await tx.insert(kitchenTicketItems).values(
      items.map((item) => ({
        organizationId: input.organizationId,
        ticketId: ticket.id,
        orderItemId: item.id,
        name: item.itemName,
        variantName: item.variantName,
        qty: item.qty,
        modifiersJson: JSON.stringify(
          modifiers.filter((row) => row.orderItemId === item.id).map((row) => row.name),
        ),
        status: "PENDING" as const,
      })),
    );
  }

  return ticket;
}

export function createKitchenRepository(db: Database) {
  return {
    listByBranch(organizationId: string, branchId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(ticketSelect)
          .from(kitchenTickets)
          .where(
            and(
              eq(kitchenTickets.organizationId, organizationId),
              eq(kitchenTickets.branchId, branchId),
            ),
          )
          .orderBy(desc(kitchenTickets.createdAt)),
      );
    },

    findById(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(ticketSelect)
          .from(kitchenTickets)
          .where(and(eq(kitchenTickets.id, id), eq(kitchenTickets.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    findByOrder(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(ticketSelect)
          .from(kitchenTickets)
          .where(
            and(
              eq(kitchenTickets.organizationId, organizationId),
              eq(kitchenTickets.orderId, orderId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    listItems(organizationId: string, ticketIds: string[]) {
      if (ticketIds.length === 0) {
        return Promise.resolve([]);
      }
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: kitchenTicketItems.id,
            ticketId: kitchenTicketItems.ticketId,
            name: kitchenTicketItems.name,
            variantName: kitchenTicketItems.variantName,
            qty: kitchenTicketItems.qty,
            modifiersJson: kitchenTicketItems.modifiersJson,
            status: kitchenTicketItems.status,
            kitchenStationId: kitchenTicketItems.kitchenStationId,
            assignedCookId: kitchenTicketItems.assignedCookId,
            assignedCookName: users.email,
            claimedAt: kitchenTicketItems.claimedAt,
          })
          .from(kitchenTicketItems)
          .leftJoin(users, eq(kitchenTicketItems.assignedCookId, users.id))
          .where(
            and(
              eq(kitchenTicketItems.organizationId, organizationId),
              inArray(kitchenTicketItems.ticketId, ticketIds),
            ),
          ),
      );
    },

    findItem(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: kitchenTicketItems.id,
            ticketId: kitchenTicketItems.ticketId,
            status: kitchenTicketItems.status,
            assignedCookId: kitchenTicketItems.assignedCookId,
            kitchenStationId: kitchenTicketItems.kitchenStationId,
          })
          .from(kitchenTicketItems)
          .where(
            and(
              eq(kitchenTicketItems.id, id),
              eq(kitchenTicketItems.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    updateItem(
      organizationId: string,
      id: string,
      patch: {
        status?: "PENDING" | "IN_PROGRESS" | "READY";
        assignedCookId?: string | null;
        kitchenStationId?: string | null;
        claimedAt?: Date | null;
      },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(kitchenTicketItems)
          .set(patch)
          .where(
            and(
              eq(kitchenTicketItems.id, id),
              eq(kitchenTicketItems.organizationId, organizationId),
            ),
          )
          .returning({
            id: kitchenTicketItems.id,
            ticketId: kitchenTicketItems.ticketId,
            status: kitchenTicketItems.status,
            assignedCookId: kitchenTicketItems.assignedCookId,
            kitchenStationId: kitchenTicketItems.kitchenStationId,
            claimedAt: kitchenTicketItems.claimedAt,
          });
        return row ?? null;
      });
    },

    setItemStatus(organizationId: string, id: string, status: "PENDING" | "IN_PROGRESS" | "READY") {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(kitchenTicketItems)
          .set({ status })
          .where(
            and(
              eq(kitchenTicketItems.id, id),
              eq(kitchenTicketItems.organizationId, organizationId),
            ),
          )
          .returning({ id: kitchenTicketItems.id, ticketId: kitchenTicketItems.ticketId });
        return row ?? null;
      });
    },

    listStations(organizationId: string, branchId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select()
          .from(kitchenStations)
          .where(
            and(
              eq(kitchenStations.organizationId, organizationId),
              eq(kitchenStations.branchId, branchId),
            ),
          )
          .orderBy(kitchenStations.sortOrder),
      );
    },

    createStation(
      organizationId: string,
      restaurantId: string,
      branchId: string,
      input: { name: string; code: string; colorHex?: string; sortOrder?: number },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .insert(kitchenStations)
          .values({
            organizationId,
            restaurantId,
            branchId,
            name: input.name,
            code: input.code,
            colorHex: input.colorHex ?? "#f59e0b",
            sortOrder: input.sortOrder ?? 0,
          })
          .returning();
        return row;
      });
    },

    setTicketStatus(
      organizationId: string,
      id: string,
      status: "NEW" | "IN_PROGRESS" | "READY" | "CANCELLED",
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(kitchenTickets)
          .set({ status })
          .where(and(eq(kitchenTickets.id, id), eq(kitchenTickets.organizationId, organizationId)))
          .returning(ticketSelect);
        return row ?? null;
      });
    },

    listTicketsForOrder(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({ id: kitchenTickets.id, status: kitchenTickets.status })
          .from(kitchenTickets)
          .where(
            and(
              eq(kitchenTickets.organizationId, organizationId),
              eq(kitchenTickets.orderId, orderId),
            ),
          ),
      );
    },
  };
}

export type KitchenRepository = ReturnType<typeof createKitchenRepository>;
