export type PaymentIntent = {
  provider: string;
  providerRef: string;
  amountMinor: number;
  status: "PENDING" | "PAID" | "FAILED";
};

export type CapturePaymentInput = {
  organizationId: string;
  orderId: string;
  amountMinor: number;
  currency: "INR";
  method: string;
};

export type RefundPaymentInput = {
  organizationId: string;
  providerRef: string;
  amountMinor: number;
};

export type WebhookParseResult =
  | {
      accepted: true;
      provider: string;
      event: string;
      providerRef: string;
      status: string;
      organizationId?: string;
    }
  | { accepted: false; reason: string };

export type PaymentGateway = {
  provider: string;
  capture(input: CapturePaymentInput): Promise<PaymentIntent>;
  refund(input: RefundPaymentInput): Promise<{ refundRef: string; amountMinor: number }>;
  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookParseResult;
};
