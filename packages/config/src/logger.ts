import { pino, type DestinationStream, type Logger } from "pino";

export const logRedactPaths = [
  "password",
  "authorization",
  "cookie",
  "*.password",
  "*.authorization",
  "*.cookie",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "body.password",
  "req.body.token",
  "body.token",
  "*.resetToken",
  "*.accessToken",
  "*.refreshToken",
];

export type CreateLoggerOptions = {
  name?: string;
  level?: string;
  destination?: DestinationStream;
};

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  return pino(
    {
      name: options.name,
      level: options.level ?? process.env.LOG_LEVEL ?? "info",
      redact: {
        paths: logRedactPaths,
        censor: "[Redacted]",
      },
    },
    options.destination,
  );
}
