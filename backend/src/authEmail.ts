export type AuthEmailMessage =
  | {
      type: "VERIFY_EMAIL";
      to: string;
      name: string | null;
      token: string;
      expiresAt: number;
    }
  | {
      type: "PASSWORD_RESET";
      to: string;
      name: string | null;
      token: string;
      expiresAt: number;
    };

export interface AuthEmailSender {
  send(message: AuthEmailMessage): Promise<void>;
}

export class WebhookAuthEmailSender implements AuthEmailSender {
  constructor(
    private readonly webhookUrl: string,
    private readonly webhookToken: string
  ) {}

  async send(message: AuthEmailMessage): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.webhookToken}`
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Auth email webhook failed with HTTP ${response.status}.`);
    }
  }
}
