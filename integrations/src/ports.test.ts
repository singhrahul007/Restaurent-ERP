import { describe, expect, it, vi } from "vitest";
import { MockPaymentGateway } from "./payment/mock.js";
import { MockFoodDeliveryChannel } from "./food-delivery/mock.js";
import { MockEmailProvider } from "./messaging/email-sms-mock.js";
import { MockWhatsAppProvider } from "./messaging/whatsapp-mock.js";
import { processNotificationJob } from "./notifications.js";
import { decryptSecret, encryptSecret, maskCredentialRecord } from "./secrets.js";

describe("integration ports", () => {
  it("encrypts credentials and masks keys without values", () => {
    const kek = "local-dev-integration-kek-min-32-chars";
    const cipher = encryptSecret(JSON.stringify({ secret: "rzp_test_secret" }), kek);
    expect(cipher).not.toContain("rzp_test_secret");
    expect(JSON.parse(decryptSecret(cipher, kek))).toEqual({ secret: "rzp_test_secret" });
    expect(maskCredentialRecord({ secret: "rzp_test_secret", keyId: "rzp_test" })).toEqual({
      keyId: true,
      secret: true,
    });
  });

  it("captures payments through the mock gateway", async () => {
    const gateway = new MockPaymentGateway();
    const intent = await gateway.capture({
      organizationId: "org",
      orderId: "order",
      amountMinor: 1000,
      currency: "INR",
      method: "CASH",
    });
    expect(intent.status).toBe("PAID");
    expect(intent.provider).toBe("mock");
  });

  it("normalizes a mock partner payload", () => {
    const channel = new MockFoodDeliveryChannel();
    const order = channel.ingestOrder({
      externalId: "ext-1",
      branchId: "11111111-1111-4111-8111-111111111111",
      items: [{ menuItemId: "22222222-2222-4222-8222-222222222222", qty: 1 }],
    });
    expect(order.source).toBe("partner:mock");
    expect(order.externalId).toBe("ext-1");
  });

  it("sends worker jobs only through messaging ports", async () => {
    const log = vi.fn();
    await processNotificationJob(
      { channel: "email", payload: { to: "a@example.com", template: "otp", variables: {} } },
      {
        email: new MockEmailProvider(log),
        sms: { send: async () => undefined },
        whatsapp: new MockWhatsAppProvider(log),
      },
    );
    expect(log).toHaveBeenCalledWith(
      { channel: "email", to: "a@example.com", template: "otp" },
      "dev email (not sent)",
    );
  });
});
