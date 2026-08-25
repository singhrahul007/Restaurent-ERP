import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

/**
 * Sets `app.organization_id` for the current transaction (`SET LOCAL`).
 * Call at the start of every tenant write/read transaction.
 *
 * Example:
 * ```
 * await db.transaction(async (tx) => {
 *   await setLocalOrganizationId(tx, ctx.organizationId);
 *   await tx.insert(restaurants).values({ organizationId: ctx.organizationId, name });
 * });
 * ```
 */
export async function setLocalOrganizationId(
  tx: Pick<Database, "execute">,
  organizationId: string,
): Promise<void> {
  await tx.execute(
    sql`select set_config('app.organization_id', ${organizationId}, true)`,
  );
}

export async function withOrganizationScope<T>(
  db: Database,
  organizationId: string,
  work: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setLocalOrganizationId(tx, organizationId);
    return work(tx);
  });
}
