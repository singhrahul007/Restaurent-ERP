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
