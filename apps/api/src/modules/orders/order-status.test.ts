import { describe, expect, it } from "vitest";
import { AppError } from "../../lib/errors.js";
import { assertOrderTransition } from "./order-status.js";

describe("order state machine", () => {
  it("allows the happy path", () => {
    expect(() => assertOrderTransition("DRAFT", "CREATED")).not.toThrow();
    expect(() => assertOrderTransition("CREATED", "CONFIRMED")).not.toThrow();
    expect(() => assertOrderTransition("CONFIRMED", "PREPARING")).not.toThrow();
    expect(() => assertOrderTransition("PREPARING", "READY")).not.toThrow();
    expect(() => assertOrderTransition("READY", "SERVED")).not.toThrow();
    expect(() => assertOrderTransition("SERVED", "COMPLETED")).not.toThrow();
  });

  it("throws INVALID_STATE_TRANSITION for illegal moves", () => {
    try {
      assertOrderTransition("COMPLETED", "CANCELLED");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("INVALID_STATE_TRANSITION");
    }
    expect(() => assertOrderTransition("DRAFT", "COMPLETED")).toThrow(AppError);
    expect(() => assertOrderTransition("CANCELLED", "CREATED")).toThrow(AppError);
  });
});
