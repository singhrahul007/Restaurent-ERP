const databaseUrl = process.env.DATABASE_URL;
const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
if (!databaseUrl || !email) {
  process.stderr.write("DATABASE_URL and PLATFORM_ADMIN_EMAIL are required\n");
  process.exit(1);
}

const { default: postgres } = await import("postgres");
const sql = postgres(databaseUrl, { max: 1 });
const updated = await sql`
  UPDATE users
  SET is_platform_admin = true, updated_at = now()
  WHERE lower(email) = ${email}
  RETURNING id, email
`;
await sql.end();
if (updated.length === 0) {
  process.stderr.write(`No user for ${email}\n`);
  process.exit(1);
}
process.stdout.write(`Granted is_platform_admin to ${updated[0]?.email}\n`);
