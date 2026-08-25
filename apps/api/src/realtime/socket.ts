import type { Server as HttpServer } from "node:http";
import { Server as SocketIoServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Redis } from "ioredis";

export function authorizeSocketHandshake(handshake: {
  auth?: { token?: unknown };
}): void {
  const token = handshake.auth?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("UNAUTHORIZED");
  }
  // Session validation lands in Phase 1. Do not trust client-supplied tokens yet.
  throw new Error("UNAUTHORIZED");
}

export async function attachSocketIo(
  httpServer: HttpServer,
  redis: Redis,
): Promise<{ io: SocketIoServer; close: () => void }> {
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  const io = new SocketIoServer(httpServer, {
    cors: { origin: false },
  });

  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    try {
      authorizeSocketHandshake(socket.handshake);
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join", (_room: string, ack?: (error: string) => void) => {
      ack?.("FORBIDDEN");
    });
  });

  return {
    io,
    close: () => {
      io.close();
      pubClient.disconnect();
      subClient.disconnect();
    },
  };
}
