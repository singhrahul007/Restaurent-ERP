import { z } from "zod";

export const nodeEnvSchema = z.enum(["development", "test", "production"]);

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  PLATFORM_ADMIN_EMAIL: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim().toLowerCase();
      return trimmed ? trimmed : undefined;
    }),
});

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  LOG_LEVEL: z.string().default("info"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
});

export const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  NEXT_PUBLIC_API_URL: z.string().default("http://localhost:3001"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
}

export function parseApiEnv(
  source: NodeJS.ProcessEnv = process.env,
): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid API environment: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseWorkerEnv(
  source: NodeJS.ProcessEnv = process.env,
): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid worker environment: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const result = webEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid web environment: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  try {
    return parseApiEnv(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid environment";
    process.stderr.write(`${message}\n`);
    process.exit(1);
    throw new Error(message);
  }
}

export function loadWorkerEnv(
  source: NodeJS.ProcessEnv = process.env,
): WorkerEnv {
  try {
    return parseWorkerEnv(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid environment";
    process.stderr.write(`${message}\n`);
    process.exit(1);
    throw new Error(message);
  }
}
