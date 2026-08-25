import { describe, expect, it } from "vitest";
import { emptyPermissionSet, hasPermission } from "./permissions.js";

describe("hasPermission", () => {
  it("returns false for an empty set", () => {
    expect(hasPermission(emptyPermissionSet(), "orders.create")).toBe(false);
  });

  it("returns true only when the code is present", () => {
    const granted = new Set(["orders.view", "orders.create"]);
    expect(hasPermission(granted, "orders.create")).toBe(true);
    expect(hasPermission(granted, "orders.cancel")).toBe(false);
  });
});
