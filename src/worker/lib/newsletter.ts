export interface Mailer {
  sendWelcome(email: string, name: string): Promise<void>;
  sendMagicLink(email: string, link: string): Promise<void>;
}

export function createMailer(): Mailer {
  return { async sendWelcome() {}, async sendMagicLink() {} };
}
