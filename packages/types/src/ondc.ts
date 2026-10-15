export type BecknDomain = "ONDC:RET11" | "nic2004:52110";

export type BecknAction =
  | "search"
  | "on_search"
  | "select"
  | "on_select"
  | "init"
  | "on_init"
  | "confirm"
  | "on_confirm"
  | "status"
  | "on_status"
  | "track"
  | "on_track"
  | "cancel"
  | "on_cancel"
  | "update"
  | "on_update";

export interface BecknContext {
  domain: BecknDomain | string;
  country: string;
  city: string;
  action: BecknAction;
  core_version: string;
  bap_id: string;
  bap_uri: string;
  bpp_id?: string;
  bpp_uri?: string;
  transaction_id: string;
  message_id: string;
  timestamp: string;
  key?: string;
  ttl?: string;
}

export interface BecknAck {
  status: "ACK" | "NACK";
  tags?: Record<string, string>;
}

export interface BecknError {
  type?: "CONTEXT-ERROR" | "CORE-ERROR" | "DOMAIN-ERROR" | "POLICY-ERROR" | "JSON-SCHEMA-ERROR";
  code: string;
  path?: string;
  message: string;
}

export interface BecknResponse {
  context: BecknContext;
  message?: {
    ack: BecknAck;
  };
  error?: BecknError;
}

export interface BecknAuthHeaderComponents {
  keyId: string;
  algorithm: string;
  created: number;
  expires: number;
  headers: string;
  signature: string;
}

export interface OndcProviderConfig {
  subscriberId: string;
  subscriberUrl: string;
  uniqueKeyId: string;
  signingPrivateKey: string;
  signingPublicKey: string;
  encryptionPrivateKey?: string;
  encryptionPublicKey?: string;
  gatewayUrl?: string;
}

export interface BecknDescriptor {
  name: string;
  code?: string;
  symbol?: string;
  short_desc?: string;
  long_desc?: string;
  images?: string[];
}

export interface BecknPrice {
  currency: string;
  value: string;
  maximum_value?: string;
}

export interface BecknTag {
  code: string;
  list: Array<{ code: string; value: string }>;
}

export interface BecknItem {
  id: string;
  parent_item_id?: string;
  descriptor: BecknDescriptor;
  price: BecknPrice;
  category_id: string;
  fulfillment_id?: string;
  location_id?: string;
  matched?: boolean;
  related?: boolean;
  recommended?: boolean;
  tags?: BecknTag[];
  "@ondc/org/returnable"?: boolean;
  "@ondc/org/cancellable"?: boolean;
  "@ondc/org/return_window"?: string;
  "@ondc/org/seller_pickup_return"?: boolean;
  "@ondc/org/time_to_ship"?: string;
  "@ondc/org/available_on_cod"?: boolean;
  "@ondc/org/contact_details_consumer_care"?: string;
}

export interface BecknCategory {
  id: string;
  parent_category_id?: string;
  descriptor: BecknDescriptor;
  tags?: BecknTag[];
}

export interface BecknLocation {
  id: string;
  gps?: string;
  address?: {
    door?: string;
    name?: string;
    building?: string;
    street?: string;
    locality?: string;
    ward?: string;
    city?: string;
    state?: string;
    country?: string;
    area_code?: string;
  };
  time?: {
    days?: string;
    schedule?: {
      holidays?: string[];
      frequency?: string;
      times?: string[];
    };
    range?: {
      start?: string;
      end?: string;
    };
  };
}

export interface BecknProvider {
  id: string;
  descriptor: BecknDescriptor;
  locations?: BecknLocation[];
  categories?: BecknCategory[];
  items?: BecknItem[];
  fulfillments?: Array<{
    id: string;
    type: "Delivery" | "Pickup";
  }>;
  tags?: BecknTag[];
}

export interface BecknCatalog {
  "bpp/descriptor"?: BecknDescriptor;
  "bpp/categories"?: BecknCategory[];
  "bpp/fulfillments"?: Array<{
    id: string;
    type: string;
  }>;
  "bpp/providers"?: BecknProvider[];
}

export interface BecknOnSearchPayload {
  context: BecknContext;
  message: {
    catalog: BecknCatalog;
  };
}

