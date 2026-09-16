import { describe, expect, it, vi } from "vitest";
import {
  MockEmailProvider,
  MockSmsProvider,
  MockWhatsAppProvider,
  processNotificationJob,
} from "@niva/integrations";

describe("notification worker ports", () => {
  it("logs email and sms through mocks only", async () => {
    const log = vi.fn();
    await processNotificationJob(
      { channel: "sms", payload: { to: "+910000000000", body: "hi" } },
      {
        email: new MockEmailProvider(log),
        sms: new MockSmsProvider(log),
        whatsapp: new MockWhatsAppProvider(log),
      },
    );
    expect(log).toHaveBeenCalledWith({ channel: "sms", to: "+910000000000" }, "dev sms (not sent)");
  });
});
