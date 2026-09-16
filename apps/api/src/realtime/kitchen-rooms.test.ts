import { describe, expect, it } from "vitest";
import { canJoinKitchenRoom, parseKitchenRoom } from "./kitchen-rooms.js";

describe("kitchen rooms", () => {
  it("only accepts kitchen:{branchId} rooms", () => {
    expect(parseKitchenRoom("kitchen:branch-a")).toBe("branch-a");
    expect(parseKitchenRoom("branch:branch-a")).toBeNull();
    expect(parseKitchenRoom("kitchen:")).toBeNull();
  });

  it("does not let a branch-scoped cook join another branch", () => {
    expect(
      canJoinKitchenRoom({ allowedBranchIds: ["branch-a"], branchId: "branch-a" }),
    ).toBe(true);
    expect(
      canJoinKitchenRoom({ allowedBranchIds: ["branch-a"], branchId: "branch-b" }),
    ).toBe(false);
  });

  it("lets unscoped members join a kitchen room", () => {
    expect(canJoinKitchenRoom({ allowedBranchIds: null, branchId: "branch-b" })).toBe(true);
  });
});
