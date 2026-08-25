import type { FastifySchema } from "fastify";

export const authTag = "auth";

const metaSchema = {
  type: "object",
  properties: {
    requestId: { type: "string" },
  },
};

const errorEnvelopeSchema = {
  type: "object",
  required: ["success", "error"],
  properties: {
    success: { type: "boolean", enum: [false] },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};

const userSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" },
    status: {
      type: "string",
      enum: ["PENDING_VERIFICATION", "ACTIVE", "DISABLED"],
    },
  },
};

export const registerBodyOpenApi = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email", maxLength: 320 },
    password: { type: "string", minLength: 8, maxLength: 256, format: "password" },
    phone: { type: "string", maxLength: 32 },
  },
};

export const loginBodyOpenApi = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email", maxLength: 320 },
    password: { type: "string", minLength: 8, maxLength: 256, format: "password" },
  },
};

export const forgotPasswordBodyOpenApi = {
  type: "object",
  required: ["email"],
  properties: {
    email: { type: "string", format: "email", maxLength: 320 },
  },
};

export const resetPasswordBodyOpenApi = {
  type: "object",
  required: ["token", "password"],
  properties: {
    token: { type: "string", minLength: 1, maxLength: 128 },
    password: { type: "string", minLength: 8, maxLength: 256, format: "password" },
  },
};

export const registerSchema: FastifySchema = {
  tags: [authTag],
  summary: "Register a user",
  body: registerBodyOpenApi,
  response: {
    201: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: userSchema,
        meta: metaSchema,
      },
    },
    400: errorEnvelopeSchema,
    409: errorEnvelopeSchema,
  },
};

export const loginSchema: FastifySchema = {
  tags: [authTag],
  summary: "Log in and set httpOnly cookies",
  body: loginBodyOpenApi,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: { user: userSchema },
        },
        meta: metaSchema,
      },
    },
    400: errorEnvelopeSchema,
    401: errorEnvelopeSchema,
  },
};

export const refreshSchema: FastifySchema = {
  tags: [authTag],
  summary: "Rotate the refresh cookie",
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: { ok: { type: "boolean" } },
        },
        meta: metaSchema,
      },
    },
    401: errorEnvelopeSchema,
  },
};

export const logoutSchema: FastifySchema = {
  tags: [authTag],
  summary: "Revoke the current session",
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: { ok: { type: "boolean" } },
        },
        meta: metaSchema,
      },
    },
  },
};

export const logoutAllSchema: FastifySchema = {
  tags: [authTag],
  summary: "Revoke every session for the user",
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: { ok: { type: "boolean" } },
        },
        meta: metaSchema,
      },
    },
  },
};

export const forgotPasswordSchema: FastifySchema = {
  tags: [authTag],
  summary: "Request a password reset",
  body: forgotPasswordBodyOpenApi,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            resetToken: { type: "string" },
          },
        },
        meta: metaSchema,
      },
    },
    400: errorEnvelopeSchema,
  },
};

export const resetPasswordSchema: FastifySchema = {
  tags: [authTag],
  summary: "Set a new password with a reset token",
  body: resetPasswordBodyOpenApi,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: { ok: { type: "boolean" } },
        },
        meta: metaSchema,
      },
    },
    400: errorEnvelopeSchema,
  },
};

export const meSchema: FastifySchema = {
  tags: [authTag],
  summary: "Current user, memberships, and permissions",
  security: [{ accessCookie: [] }],
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            user: userSchema,
            memberships: { type: "array", items: { type: "object" } },
            permissions: { type: "array", items: { type: "string" } },
          },
        },
        meta: metaSchema,
      },
    },
    401: errorEnvelopeSchema,
  },
};
