import type { WhatsAppMessage, WhatsAppProvider } from "@niva/types";

type LogFn = (bindings: Record<string, unknown>, message: string) => void;

export class MockWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly log: LogFn) {}

  async sendSessionMessage(message: WhatsAppMessage): Promise<void> {
    this.log({ channel: "whatsapp", to: message.to }, "dev whatsapp (not sent)");
  }
}
