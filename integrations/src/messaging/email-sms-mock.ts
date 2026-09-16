import type { EmailMessage, EmailProvider, SmsMessage, SmsProvider } from "@niva/types";

type LogFn = (bindings: Record<string, unknown>, message: string) => void;

export class MockEmailProvider implements EmailProvider {
  constructor(private readonly log: LogFn) {}

  async sendTemplate(message: EmailMessage): Promise<void> {
    this.log(
      { channel: "email", to: message.to, template: message.template },
      "dev email (not sent)",
    );
  }
}

export class MockSmsProvider implements SmsProvider {
  constructor(private readonly log: LogFn) {}

  async send(message: SmsMessage): Promise<void> {
    this.log({ channel: "sms", to: message.to }, "dev sms (not sent)");
  }
}
