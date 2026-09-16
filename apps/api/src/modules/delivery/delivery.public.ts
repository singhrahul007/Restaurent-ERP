import { mapsDeepLink, mockGeocode } from "./maps.js";

export type PublicDelivery = {
  id: string;
  orderId: string;
  status: string;
  agentId: string;
  addressLine: string;
  phone: string | null;
  customerName: string | null;
  codAmountMinor: number;
  codCollectedMinor: number | null;
  maps: { google: string; apple: string };
  geocode: { lat: number; lng: number };
  createdAt: Date;
  deliveredAt: Date | null;
};

export function toPublicDelivery(row: {
  id: string;
  orderId: string;
  status: string;
  agentId: string;
  addressLine: string;
  phone: string | null;
  customerName: string | null;
  codAmountMinor: number;
  codCollectedMinor: number | null;
  createdAt: Date;
  deliveredAt: Date | null;
  otpHash?: string;
}): PublicDelivery {
  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status,
    agentId: row.agentId,
    addressLine: row.addressLine,
    phone: row.phone,
    customerName: row.customerName,
    codAmountMinor: row.codAmountMinor,
    codCollectedMinor: row.codCollectedMinor,
    maps: mapsDeepLink(row.addressLine),
    geocode: mockGeocode(row.addressLine),
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
  };
}

export function deliveryPayloadHasOtp(value: unknown): boolean {
  const json = JSON.stringify(value);
  return /otpHash|"otp"|otp_hash/i.test(json);
}
