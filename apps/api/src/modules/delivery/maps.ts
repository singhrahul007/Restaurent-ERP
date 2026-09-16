import { createHash } from "node:crypto";

function hashToUnit(value: string, salt: string): number {
  const digest = createHash("sha256").update(`${salt}:${value}`).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

/** Deterministic fake coordinates. No billed geocoding API. */
export function mockGeocode(address: string): { lat: number; lng: number } {
  const lat = 8 + hashToUnit(address, "lat") * 29;
  const lng = 68 + hashToUnit(address, "lng") * 29;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
  };
}

export function mapsDeepLink(address: string): { google: string; apple: string } {
  const query = encodeURIComponent(address.trim());
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
    apple: `https://maps.apple.com/?q=${query}`,
  };
}
