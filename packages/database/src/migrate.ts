import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres, { type Sql } from "postgres";

const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

loadDotenv({ path: resolve(repoRoot, ".env") });
loadDotenv({ path: resolve(packageRoot, ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write("DATABASE_URL is required\n");
  process.exit(1);
}

function sqlStatements(source: string): string[] {
  return source
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const withoutComments = part
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("--"));
      return withoutComments.length > 0;
    });
}

async function seedRbac(sql: Sql): Promise<void> {
  const seedPath = resolve(packageRoot, "seed/rbac.sql");
  const statements = sqlStatements(readFileSync(seedPath, "utf8"));
  for (const statement of statements) {
    await sql.unsafe(statement);
  }
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: resolve(packageRoot, "drizzle") });
await seedRbac(sql);
await enableRls(sql);
await seedPlatformAdmin(sql);
await sql.end();

async function enableRls(sql: Sql): Promise<void> {
  const source = readFileSync(resolve(packageRoot, "sql/enable-rls.sql"), "utf8");
  await sql.unsafe(source);
}

async function seedPlatformAdmin(sql: Sql): Promise<void> {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    return;
  }
  await sql`
    UPDATE users
    SET is_platform_admin = true, updated_at = now()
    WHERE lower(email) = ${email}
  `;
}
