import { describe, expect, it } from "vitest";
import {
  PERMISSION_CODES,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  isPermissionCode,
} from "./catalog.js";

describe("permission catalog", () => {
  it("has unique permission codes", () => {
    expect(new Set(PERMISSION_CODES).size).toBe(PERMISSION_CODES.length);
  });

  it("only maps system roles to catalog permissions", () => {
    for (const slug of SYSTEM_ROLE_SLUGS) {
      for (const code of SYSTEM_ROLE_PERMISSIONS[slug]) {
        expect(isPermissionCode(code)).toBe(true);
      }
    }
  });

  it("does not grant platform.manage to restaurant roles", () => {
    for (const slug of SYSTEM_ROLE_SLUGS) {
      if (slug === "SUPER_ADMIN") {
        expect(SYSTEM_ROLE_PERMISSIONS[slug]).toContain("platform.manage");
        continue;
      }
      expect(SYSTEM_ROLE_PERMISSIONS[slug]).not.toContain("platform.manage");
    }
  });
});
