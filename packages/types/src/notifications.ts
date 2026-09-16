import type { EmailMessage, SmsMessage, WhatsAppMessage } from "./messaging.js";

export type NotificationJob =
  | { channel: "email"; payload: EmailMessage }
  | { channel: "sms"; payload: SmsMessage }
  | { channel: "whatsapp"; payload: WhatsAppMessage };

export type NotificationPorts = {
  email: { sendTemplate(message: EmailMessage): Promise<void> };
  sms: { send(message: SmsMessage): Promise<void> };
  whatsapp: { sendSessionMessage(message: WhatsAppMessage): Promise<void> };
};
