import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

export function createSql(databaseUrl: string): Sql {
  return postgres(databaseUrl, { max: 10 });
}

export function createDb(sql: Sql): Database {
  return drizzle(sql, { schema });
}

export function createDatabase(databaseUrl: string): {
  sql: Sql;
  db: Database;
} {
  const sql = createSql(databaseUrl);
  return { sql, db: createDb(sql) };
}

export async function pingDatabase(sql: Sql): Promise<void> {
  await sql`select 1`;
}
