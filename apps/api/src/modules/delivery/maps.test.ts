import { describe, expect, it } from "vitest";
import { mapsDeepLink, mockGeocode } from "./maps.js";

describe("maps adapter stub", () => {
  it("builds deeplinks and a deterministic mock geocode without a Maps API", () => {
    const address = "12 MG Road, Bengaluru";
    const first = mockGeocode(address);
    const second = mockGeocode(address);
    expect(first).toEqual(second);
    expect(Number.isInteger(Math.round(first.lat * 1e6))).toBe(true);
    const links = mapsDeepLink(address);
    expect(links.google).toContain("google.com/maps");
    expect(links.apple).toContain("maps.apple.com");
    expect(links.google).toContain(encodeURIComponent(address));
  });
});
