export type EmailMessage = {
  to: string;
  template: string;
  variables: Record<string, string>;
};

export type SmsMessage = {
  to: string;
  body: string;
};

export type WhatsAppMessage = {
  to: string;
  text: string;
};

export type EmailProvider = {
  sendTemplate(message: EmailMessage): Promise<void>;
};

export type SmsProvider = {
  send(message: SmsMessage): Promise<void>;
};

export type WhatsAppProvider = {
  sendSessionMessage(message: WhatsAppMessage): Promise<void>;
};
