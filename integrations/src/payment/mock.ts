import { randomUUID } from "node:crypto";
import type {
  CapturePaymentInput,
  PaymentGateway,
  PaymentIntent,
  RefundPaymentInput,
  WebhookParseResult,
} from "@niva/types";

export class MockPaymentGateway implements PaymentGateway {
  readonly provider = "mock";

  async capture(input: CapturePaymentInput): Promise<PaymentIntent> {
    return {
      provider: this.provider,
      providerRef: `mock_${input.orderId}_${randomUUID()}`,
      amountMinor: input.amountMinor,
      status: "PAID",
    };
  }

  async refund(input: RefundPaymentInput): Promise<{ refundRef: string; amountMinor: number }> {
    return {
      refundRef: `mock_rf_${input.providerRef}_${randomUUID()}`,
      amountMinor: input.amountMinor,
    };
  }

  parseWebhook(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): WebhookParseResult {
    try {
      const body = JSON.parse(rawBody) as {
        event?: string;
        providerRef?: string;
        status?: string;
        organizationId?: string;
      };
      if (typeof body.providerRef !== "string" || body.providerRef.length === 0) {
        return { accepted: false, reason: "providerRef required" };
      }
      return {
        accepted: true,
        provider: this.provider,
        event: typeof body.event === "string" ? body.event : "payment.captured",
        providerRef: body.providerRef,
        status: typeof body.status === "string" ? body.status : "PAID",
        organizationId: typeof body.organizationId === "string" ? body.organizationId : undefined,
      };
    } catch {
      return { accepted: false, reason: "invalid json" };
    }
  }
}

/** Live PSP adapters are not wired. See docs/integration-architecture.md (T-1204). */
export function createPaymentGateway(): PaymentGateway {
  return new MockPaymentGateway();
}
