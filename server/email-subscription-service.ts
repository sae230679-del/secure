/**
 * Email Subscription Service
 * Supports Russian email services: SendPulse, Unisender, Dashamail
 */

import type { EmailServiceSettings } from "@shared/schema";

interface SendConfirmationResult {
  success: boolean;
  error?: string;
}

interface AddToListResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

// SendPulse API
class SendPulseProvider {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.apiKey,
        client_secret: this.apiSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`SendPulse auth failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  async sendEmail(to: string, subject: string, html: string, fromEmail: string, fromName: string): Promise<SendConfirmationResult> {
    try {
      const token = await this.getAccessToken();
      
      const response = await fetch("https://api.sendpulse.com/smtp/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: {
            html,
            subject,
            from: { name: fromName, email: fromEmail },
            to: [{ email: to }],
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async addToList(listId: string, email: string, name?: string): Promise<AddToListResult> {
    try {
      const token = await this.getAccessToken();
      
      const variables: Record<string, string> = {};
      if (name) variables.name = name;

      const response = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: [{ email, variables }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// Unisender API
class UnisenderProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(to: string, subject: string, html: string, fromEmail: string, fromName: string): Promise<SendConfirmationResult> {
    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        email: to,
        sender_name: fromName,
        sender_email: fromEmail,
        subject,
        body: html,
        list_id: "1",
      });

      const response = await fetch("https://api.unisender.com/ru/api/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const data = await response.json();
      
      if (data.error) {
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async addToList(listId: string, email: string, name?: string): Promise<AddToListResult> {
    try {
      const fields: Record<string, string> = { email };
      if (name) fields.Name = name;

      const params = new URLSearchParams({
        api_key: this.apiKey,
        list_ids: listId,
        fields: JSON.stringify(fields),
        double_optin: "0",
      });

      const response = await fetch("https://api.unisender.com/ru/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      return { success: true, externalId: data.result?.person_id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// Dashamail API
class DashamailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(to: string, subject: string, html: string, fromEmail: string, fromName: string): Promise<SendConfirmationResult> {
    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        method: "transactional.send",
        to,
        from_email: fromEmail,
        from_name: fromName,
        subject,
        html,
      });

      const response = await fetch("https://api.dashamail.com/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.response?.msg?.err_code !== 0) {
        return { success: false, error: data.response?.msg?.text || "Unknown error" };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async addToList(listId: string, email: string, name?: string): Promise<AddToListResult> {
    try {
      const merge: Record<string, string> = {};
      if (name) merge.Name = name;

      const params = new URLSearchParams({
        api_key: this.apiKey,
        method: "lists.add_member",
        list_id: listId,
        email,
        merge: JSON.stringify(merge),
        update: "1",
      });

      const response = await fetch("https://api.dashamail.com/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.response?.msg?.err_code !== 0) {
        return { success: false, error: data.response?.msg?.text || "Unknown error" };
      }

      return { success: true, externalId: data.response?.data?.member_id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export class EmailSubscriptionService {
  private settings: EmailServiceSettings | null = null;
  private provider: SendPulseProvider | UnisenderProvider | DashamailProvider | null = null;

  configure(settings: EmailServiceSettings) {
    this.settings = settings;

    if (!settings.isActive || settings.provider === "none") {
      this.provider = null;
      return;
    }

    switch (settings.provider) {
      case "sendpulse":
        if (settings.apiKey && settings.apiSecret) {
          this.provider = new SendPulseProvider(settings.apiKey, settings.apiSecret);
        }
        break;
      case "unisender":
        if (settings.apiKey) {
          this.provider = new UnisenderProvider(settings.apiKey);
        }
        break;
      case "dashamail":
        if (settings.apiKey) {
          this.provider = new DashamailProvider(settings.apiKey);
        }
        break;
    }
  }

  isConfigured(): boolean {
    return this.provider !== null && this.settings !== null && this.settings.isActive;
  }

  getDefaultConfirmationTemplate(confirmUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Подтверждение подписки</h2>
    <p>Вы подписались на рассылку SecureLex.ru.</p>
    <p>Для подтверждения подписки нажмите на кнопку ниже:</p>
    <p><a href="${confirmUrl}" class="button">Подтвердить подписку</a></p>
    <p>Или перейдите по ссылке: <a href="${confirmUrl}">${confirmUrl}</a></p>
    <div class="footer">
      <p>Если вы не подписывались на рассылку, проигнорируйте это письмо.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  getDefaultWelcomeTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Добро пожаловать!</h2>
    <p>Спасибо за подписку на рассылку SecureLex.ru!</p>
    <p>Вы будете получать:</p>
    <ul>
      <li>Новости в области защиты персональных данных</li>
      <li>Обновления законодательства</li>
      <li>Полезные советы по соответствию требованиям</li>
    </ul>
    <div class="footer">
      <p>Вы можете отписаться в любой момент, перейдя по ссылке в конце письма.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  async sendConfirmationEmail(email: string, confirmUrl: string): Promise<SendConfirmationResult> {
    if (!this.isConfigured() || !this.settings) {
      return { success: false, error: "Email service not configured" };
    }

    const template = this.settings.confirmationTemplate || this.getDefaultConfirmationTemplate(confirmUrl);
    const html = template.replace(/\{\{confirmUrl\}\}/g, confirmUrl);
    const subject = this.settings.confirmationSubject || "Подтвердите подписку на рассылку";

    return this.provider!.sendEmail(
      email,
      subject,
      html,
      this.settings.senderEmail || "noreply@securelex.ru",
      this.settings.senderName || "SecureLex"
    );
  }

  async sendWelcomeEmail(email: string): Promise<SendConfirmationResult> {
    if (!this.isConfigured() || !this.settings) {
      return { success: false, error: "Email service not configured" };
    }

    const html = this.settings.welcomeTemplate || this.getDefaultWelcomeTemplate();
    const subject = this.settings.welcomeSubject || "Добро пожаловать!";

    return this.provider!.sendEmail(
      email,
      subject,
      html,
      this.settings.senderEmail || "noreply@securelex.ru",
      this.settings.senderName || "SecureLex"
    );
  }

  async addSubscriberToList(email: string, name?: string): Promise<AddToListResult> {
    if (!this.isConfigured() || !this.settings || !this.settings.listId) {
      return { success: false, error: "Email service or list not configured" };
    }

    return this.provider!.addToList(this.settings.listId, email, name);
  }
}

export const emailSubscriptionService = new EmailSubscriptionService();
