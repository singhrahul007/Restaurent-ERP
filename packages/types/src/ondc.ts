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

export interface BecknQuoteBreakupItem {
  "@ondc/org/item_id": string;
  "@ondc/org/item_quantity"?: {
    count: number;
  };
  title: string;
  "@ondc/org/title_type": "item" | "delivery" | "packing" | "tax" | "discount" | "misc";
  price: BecknPrice;
  item?: {
    price: BecknPrice;
  };
}

export interface BecknQuote {
  price: BecknPrice;
  breakup: BecknQuoteBreakupItem[];
  ttl?: string;
}

export interface BecknBilling {
  name: string;
  phone: string;
  email?: string;
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
  tax_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BecknFulfillment {
  id: string;
  type: string;
  tracking?: boolean;
  end?: {
    location?: BecknLocation;
    contact?: {
      phone: string;
      email?: string;
    };
  };
}

export interface BecknOrderPayment {
  uri?: string;
  tl_method?: string;
  params?: Record<string, string>;
  type: "ON-ORDER" | "PRE-FULFILLMENT" | "ON-FULFILLMENT" | "POST-FULFILLMENT";
  status: "PAID" | "NOT-PAID";
  collected_by: "BAP" | "BPP";
  "@ondc/org/buyer_app_finder_fee_type"?: string;
  "@ondc/org/buyer_app_finder_fee_amount"?: string;
}

export interface BecknOrder {
  id?: string;
  state?: string;
  provider?: {
    id: string;
    locations?: Array<{ id: string }>;
  };
  items: Array<{
    id: string;
    quantity: {
      count: number;
    };
    parent_item_id?: string;
    fulfillment_id?: string;
  }>;
  billing?: BecknBilling;
  fulfillments?: BecknFulfillment[];
  quote?: BecknQuote;
  payment?: BecknOrderPayment;
  created_at?: string;
  updated_at?: string;
}

export interface BecknOnSelectPayload {
  context: BecknContext;
  message: {
    order: {
      provider: {
        id: string;
      };
      items: BecknOrder["items"];
      quote: BecknQuote;
      fulfillments?: BecknFulfillment[];
    };
  };
}

export interface BecknOnInitPayload {
  context: BecknContext;
  message: {
    order: {
      provider: {
        id: string;
      };
      provider_location?: {
        id: string;
      };
      items: BecknOrder["items"];
      billing: BecknBilling;
      fulfillments: BecknFulfillment[];
      quote: BecknQuote;
      payment?: BecknOrderPayment;
    };
  };
}

export interface BecknOnConfirmPayload {
  context: BecknContext;
  message: {
    order: BecknOrder;
  };
}

