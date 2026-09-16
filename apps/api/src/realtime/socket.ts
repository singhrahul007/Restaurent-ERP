import type { Server as HttpServer } from "node:http";
import { Server as SocketIoServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Redis } from "ioredis";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { ACCESS_COOKIE, verifyAccessToken } from "../modules/auth/auth.cookies.js";
import { createAuthRepository } from "../modules/auth/auth.repository.js";
import { createTenancyRepository } from "../modules/tenancy/tenancy.repository.js";
import { setKitchenEmitter } from "./hub.js";
import {
  canJoinKitchenRoom,
  parseCookie,
  parseKitchenRoom,
} from "./kitchen-rooms.js";

export async function authorizeSocketHandshake(
  handshake: { auth?: { token?: unknown }; headers: { cookie?: string } },
  env: ApiEnv,
): Promise<{ userId: string }> {
  const token =
    (typeof handshake.auth?.token === "string" ? handshake.auth.token : undefined) ??
    parseCookie(handshake.headers.cookie, ACCESS_COOKIE);
  const verified = await verifyAccessToken(env, token);
  if (!verified.ok) {
    throw new Error("UNAUTHORIZED");
  }
  return { userId: verified.userId };
}

export async function attachSocketIo(
  httpServer: HttpServer,
  redis: Redis,
  options: { env: ApiEnv; db: Database },
): Promise<{ io: SocketIoServer; close: () => void }> {
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  const origins = options.env.CORS_ORIGINS.split(",").map((item) => item.trim());

  const io = new SocketIoServer(httpServer, {
    cors: { origin: origins, credentials: true },
  });

  io.adapter(createAdapter(pubClient, subClient));
  setKitchenEmitter(io);

  const auth = createAuthRepository(options.db);
  const tenancy = createTenancyRepository(options.db);

  io.use((socket, next) => {
    void authorizeSocketHandshake(socket.handshake, options.env)
      .then(async ({ userId }) => {
        const user = await auth.findUserById(userId);
        if (!user || user.status === "DISABLED") {
          next(new Error("UNAUTHORIZED"));
          return;
        }
        socket.data.userId = userId;
        socket.data.isPlatformAdmin = user.isPlatformAdmin;
        next();
      })
      .catch(() => next(new Error("UNAUTHORIZED")));
  });

  io.on("connection", (socket) => {
    socket.on(
      "join",
      (room: string, ack?: (error?: string) => void) => {
        void (async () => {
          const branchId = parseKitchenRoom(room);
          if (!branchId) {
            ack?.("FORBIDDEN");
            return;
          }
          const userId = socket.data.userId as string | undefined;
          if (!userId) {
            ack?.("UNAUTHORIZED");
            return;
          }
          const memberships = await tenancy.listMemberships(userId);
          const organizationId =
            typeof socket.handshake.auth?.organizationId === "string"
              ? socket.handshake.auth.organizationId
              : memberships[0]?.organizationId;
          const membership = memberships.find((row) => row.organizationId === organizationId);
          if (!membership) {
            ack?.("FORBIDDEN");
            return;
          }
          const permissions = await tenancy.loadPermissionCodes(
            userId,
            organizationId,
            Boolean(socket.data.isPlatformAdmin),
          );
          if (!permissions.has("kitchen.view")) {
            ack?.("FORBIDDEN");
            return;
          }
          const assigned = await tenancy.listAssignedBranchIds(membership.id);
          const allowedBranchIds = assigned.length > 0 ? assigned : null;
          if (!canJoinKitchenRoom({ allowedBranchIds, branchId })) {
            ack?.("FORBIDDEN");
            return;
          }
          await socket.join(room);
          ack?.();
        })();
      },
    );
  });

  return {
    io,
    close: () => {
      setKitchenEmitter(undefined);
      io.close();
      pubClient.disconnect();
      subClient.disconnect();
    },
  };
}
