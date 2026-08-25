import { describe, expect, it } from "vitest";
import { authorizeSocketHandshake } from "./socket.js";

describe("authorizeSocketHandshake", () => {
  it("rejects missing tokens", () => {
    expect(() => authorizeSocketHandshake({ auth: {} })).toThrow("UNAUTHORIZED");
  });

  it("rejects tokens until session validation exists", () => {
    expect(() =>
      authorizeSocketHandshake({ auth: { token: "placeholder" } }),
    ).toThrow("UNAUTHORIZED");
  });
});
