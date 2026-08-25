import type { RouteHandlerMethod } from "fastify";
import { errorEnvelope } from "./envelope.js";
import { isAppError } from "./errors.js";

export function withAppErrors(handler: RouteHandlerMethod): RouteHandlerMethod {
  return async function wrapped(request, reply) {
    try {
      return await handler.call(this, request, reply);
    } catch (error) {
      if (isAppError(error)) {
        return reply
          .status(error.statusCode)
          .send(errorEnvelope(error.code, error.message));
      }
      throw error;
    }
  };
}
