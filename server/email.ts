import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface AuditCompletedData {
  userName: string;
  websiteUrl: string;
  auditId: number;
  scorePercent: number;
  severity: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  totalCount: number;
}

interface PaymentConfirmationData {
  userName: string;
  packageName: string;
  amount: number;
  transactionId: string;
  websiteUrl: string;
}

interface ContractStatusData {
  userName: string;
  contractId: number;
  status: string;
  websiteUrl: string;
  signMethod: string;
}

interface ReferralEarningsData {
  userName: string;
  referredUserEmail: string;
  earnedAmount: number;
  totalEarnings: number;
}

interface EmailVerificationData {
  userName: string;
  verificationLink: string;
}

interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  replyTo?: string;
}

export interface SmtpStatus {
  configured: boolean;
  enabled: boolean;
  hasPassword: boolean;
  reason?: string;
}

let cachedTransporter: Transporter | null = null;
let cachedSettings: SmtpSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getSmtpSettings(): Promise<SmtpSettings | null> {
  try {
    const { storage } = await import("./storage");
    const settings = await storage.getSystemSettings();
    
    const smtpEnabled = settings.find(s => s.key === "smtp_enabled")?.value;
    const smtpHost = settings.find(s => s.key === "smtp_host")?.value;
    const smtpPort = settings.find(s => s.key === "smtp_port")?.value;
    const smtpSecure = settings.find(s => s.key === "smtp_secure")?.value;
    const smtpRequireTls = settings.find(s => s.key === "smtp_require_tls")?.value;
    const smtpUser = settings.find(s => s.key === "smtp_user")?.value;
    const smtpFrom = settings.find(s => s.key === "smtp_from")?.value;
    const smtpFromName = settings.find(s => s.key === "smtp_from_name")?.value;
    const smtpReplyTo = settings.find(s => s.key === "smtp_reply_to")?.value;
    
    // Check if SMTP is enabled
    if (smtpEnabled === "false") {
      return null;
    }
    
    // SMTP password from DB (secure storage) or env fallback
    const smtpPass = settings.find(s => s.key === "smtp_pass")?.value;
    const pass = smtpPass || process.env.SMTP_PASSWORD || "";
    
    // Default values for REG.RU
    const host = smtpHost || "smtp.reg.ru";
    const port = parseInt(smtpPort || "587");
    const secure = smtpSecure === "true"; // Default false for port 587 with STARTTLS
    const requireTls = smtpRequireTls !== "false"; // Default true for port 587 STARTTLS
    const user = smtpUser || "support@securelex.ru";
    const from = smtpFrom || "support@securelex.ru";
    const fromName = smtpFromName || "SecureLex";
    const replyTo = smtpReplyTo || undefined;
    
    if (!user || !pass) {
      console.log("[SMTP] Missing user or SMTP_PASSWORD secret");
      return null;
    }
    
    return { host, port, secure, requireTls, user, pass, from, fromName, replyTo };
  } catch (error) {
    console.error("[SMTP] Failed to get settings:", error);
    return null;
  }
}

export async function getSmtpStatus(): Promise<SmtpStatus> {
  try {
    const { storage } = await import("./storage");
    const settings = await storage.getSystemSettings();
    
    const smtpEnabled = settings.find(s => s.key === "smtp_enabled")?.value !== "false";
    const smtpHost = settings.find(s => s.key === "smtp_host")?.value;
    const smtpUser = settings.find(s => s.key === "smtp_user")?.value;
    const smtpPass = settings.find(s => s.key === "smtp_pass")?.value;
    const hasPassword = !!(smtpPass || process.env.SMTP_PASSWORD);
    
    if (!smtpEnabled) {
      return { configured: false, enabled: false, hasPassword, reason: "SMTP disabled" };
    }
    
    if (!smtpHost || !smtpUser) {
      return { configured: false, enabled: true, hasPassword, reason: "Missing host or user" };
    }
    
    if (!hasPassword) {
      return { configured: false, enabled: true, hasPassword, reason: "Missing SMTP_PASSWORD secret" };
    }
    
    return { configured: true, enabled: true, hasPassword };
  } catch (error) {
    return { configured: false, enabled: false, hasPassword: false, reason: String(error) };
  }
}

async function getTransporter(): Promise<Transporter | null> {
  const settings = await getSmtpSettings();
  
  if (!settings) {
    return null;
  }
  
  const now = Date.now();
  
  // Check if cached transporter is still valid (settings unchanged and not expired)
  if (cachedSettings && cachedTransporter && (now - cacheTimestamp) < CACHE_TTL_MS) {
    if (
      cachedSettings.host === settings.host &&
      cachedSettings.port === settings.port &&
      cachedSettings.user === settings.user &&
      cachedSettings.secure === settings.secure
    ) {
      return cachedTransporter;
    }
  }
  
  // Create new transporter with proper TLS handling
  const transportConfig: any = {
    host: settings.host,
    port: settings.port,
    secure: settings.secure, // true for 465, false for 587
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
  };
  
  // For port 587 with STARTTLS
  if (!settings.secure && settings.requireTls) {
    transportConfig.requireTLS = true;
  }
  
  cachedTransporter = nodemailer.createTransport(transportConfig);
  cachedSettings = settings;
  cacheTimestamp = now;
  
  return cachedTransporter;
}

export function invalidateSmtpCache(): void {
  cachedTransporter = null;
  cachedSettings = null;
  cacheTimestamp = 0;
}

const siteName = "SecureLex.ru";
const siteUrl = process.env.SITE_URL || "https://securelex.ru";

function getBaseEmailTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #1a1a2e; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .content { padding: 32px 24px; }
    .footer { background-color: #f5f5f5; padding: 24px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .status-green { background-color: #dcfce7; color: #166534; }
    .status-yellow { background-color: #fef3c7; color: #92400e; }
    .status-red { background-color: #fee2e2; color: #991b1b; }
    .stats-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .stats-table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    .stats-table td:first-child { color: #6b7280; }
    .stats-table td:last-child { font-weight: 500; text-align: right; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${siteName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Это автоматическое уведомление от ${siteName}</p>
      <p>${siteUrl}</p>
      <p>Если вы не регистрировались на нашем сайте, проигнорируйте это письмо.</p>
    </div>
  </div>
</body>
</html>`;
}

function getSeverityBadge(severity: string): string {
  const severityMap: Record<string, { class: string; text: string }> = {
    low: { class: "status-green", text: "Низкий риск" },
    medium: { class: "status-yellow", text: "Средний риск" },
    high: { class: "status-red", text: "Высокий риск" },
  };
  const s = severityMap[severity] || severityMap.medium;
  return `<span class="status-badge ${s.class}">${s.text}</span>`;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = await getTransporter();
  const settings = await getSmtpSettings();
  
  if (!transporter || !settings) {
    console.log("Email not configured, skipping:", options.subject);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `${siteName} <${settings.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    console.log("Email sent successfully to:", options.to);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendAuditCompletedEmail(email: string, data: AuditCompletedData): Promise<boolean> {
  const content = `
    <h2>Аудит сайта завершен</h2>
    <p>Здравствуйте, ${data.userName}!</p>
    <p>Аудит вашего сайта <strong>${data.websiteUrl}</strong> успешно завершен.</p>
    
    <h3>Результаты аудита</h3>
    <table class="stats-table">
      <tr>
        <td>Общий балл соответствия</td>
        <td>${data.scorePercent}%</td>
      </tr>
      <tr>
        <td>Уровень риска</td>
        <td>${getSeverityBadge(data.severity)}</td>
      </tr>
      <tr>
        <td>Пройдено проверок</td>
        <td style="color: #16a34a;">${data.passedCount} из ${data.totalCount}</td>
      </tr>
      <tr>
        <td>Предупреждения</td>
        <td style="color: #ca8a04;">${data.warningCount}</td>
      </tr>
      <tr>
        <td>Ошибки</td>
        <td style="color: #dc2626;">${data.failedCount}</td>
      </tr>
    </table>
    
    <p style="margin-top: 24px;">
      <a href="${siteUrl}/audits/${data.auditId}" class="button">Посмотреть детальный отчет</a>
    </p>
    
    <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
      Рекомендуем исправить выявленные нарушения для полного соответствия требованиям ФЗ-152 и ФЗ-149.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Аудит сайта ${data.websiteUrl} завершен - ${siteName}`,
    html: getBaseEmailTemplate(content, "Аудит завершен"),
  });
}

export async function sendPaymentConfirmationEmail(email: string, data: PaymentConfirmationData): Promise<boolean> {
  const content = `
    <h2>Оплата получена</h2>
    <p>Здравствуйте, ${data.userName}!</p>
    <p>Благодарим вас за оплату! Ваш платеж успешно обработан.</p>
    
    <h3>Детали платежа</h3>
    <table class="stats-table">
      <tr>
        <td>Пакет услуг</td>
        <td>${data.packageName}</td>
      </tr>
      <tr>
        <td>Сумма</td>
        <td>${data.amount.toLocaleString("ru-RU")} руб.</td>
      </tr>
      <tr>
        <td>Номер транзакции</td>
        <td>${data.transactionId}</td>
      </tr>
      <tr>
        <td>Сайт</td>
        <td>${data.websiteUrl}</td>
      </tr>
    </table>
    
    <p style="margin-top: 24px;">
      <a href="${siteUrl}/dashboard" class="button">Перейти в личный кабинет</a>
    </p>
    
    <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
      Аудит вашего сайта начнется автоматически после подтверждения платежа.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Платеж подтвержден - ${siteName}`,
    html: getBaseEmailTemplate(content, "Оплата получена"),
  });
}

export async function sendContractStatusEmail(email: string, data: ContractStatusData): Promise<boolean> {
  const statusMessages: Record<string, string> = {
    pending: "ожидает подписания",
    signed: "успешно подписан",
    approved: "утвержден администратором",
    rejected: "отклонен",
  };

  const statusText = statusMessages[data.status] || data.status;
  
  const content = `
    <h2>Изменение статуса договора</h2>
    <p>Здравствуйте, ${data.userName}!</p>
    <p>Статус вашего договора изменен.</p>
    
    <h3>Информация о договоре</h3>
    <table class="stats-table">
      <tr>
        <td>Номер договора</td>
        <td>#${data.contractId}</td>
      </tr>
      <tr>
        <td>Сайт</td>
        <td>${data.websiteUrl}</td>
      </tr>
      <tr>
        <td>Способ подписания</td>
        <td>${data.signMethod === "digital" ? "Цифровая подпись" : data.signMethod === "email" ? "Email подтверждение" : "Ручное утверждение"}</td>
      </tr>
      <tr>
        <td>Текущий статус</td>
        <td><strong>${statusText}</strong></td>
      </tr>
    </table>
    
    <p style="margin-top: 24px;">
      <a href="${siteUrl}/dashboard" class="button">Перейти в личный кабинет</a>
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Договор ${statusText} - ${siteName}`,
    html: getBaseEmailTemplate(content, "Статус договора"),
  });
}

export async function sendReferralEarningsEmail(email: string, data: ReferralEarningsData): Promise<boolean> {
  const content = `
    <h2>Новое начисление по реферальной программе</h2>
    <p>Здравствуйте, ${data.userName}!</p>
    <p>Поздравляем! Вы получили вознаграждение по реферальной программе.</p>
    
    <h3>Детали начисления</h3>
    <table class="stats-table">
      <tr>
        <td>Приглашенный пользователь</td>
        <td>${data.referredUserEmail}</td>
      </tr>
      <tr>
        <td>Сумма начисления</td>
        <td style="color: #16a34a; font-weight: bold;">+${data.earnedAmount.toLocaleString("ru-RU")} руб.</td>
      </tr>
      <tr>
        <td>Общий баланс</td>
        <td>${data.totalEarnings.toLocaleString("ru-RU")} руб.</td>
      </tr>
    </table>
    
    <p style="margin-top: 24px;">
      <a href="${siteUrl}/referral" class="button">Перейти к реферальной программе</a>
    </p>
    
    <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
      Продолжайте приглашать друзей и коллег, чтобы получать больше вознаграждений!
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Новое начисление: +${data.earnedAmount} руб. - ${siteName}`,
    html: getBaseEmailTemplate(content, "Реферальное вознаграждение"),
  });
}

export async function sendEmailVerificationEmail(email: string, data: EmailVerificationData): Promise<boolean> {
  const content = `
    <h2>Подтверждение email адреса</h2>
    <p>Здравствуйте, ${data.userName}!</p>
    <p>Благодарим вас за регистрацию на ${siteName}!</p>
    <p>Для завершения регистрации подтвердите ваш email адрес, нажав на кнопку ниже:</p>
    
    <p style="margin: 32px 0; text-align: center;">
      <a href="${data.verificationLink}" class="button">Подтвердить email</a>
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">
      Если кнопка не работает, скопируйте и вставьте следующую ссылку в браузер:
    </p>
    <p style="word-break: break-all; font-size: 12px; color: #4f46e5;">
      ${data.verificationLink}
    </p>
    
    <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
      Ссылка действительна в течение 24 часов.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Подтверждение email - ${siteName}`,
    html: getBaseEmailTemplate(content, "Подтверждение email"),
  });
}

export async function sendContractSigningEmail(email: string, signLink: string, userName: string): Promise<boolean> {
  const content = `
    <h2>Подписание договора</h2>
    <p>Здравствуйте, ${userName}!</p>
    <p>Для подписания договора нажмите на кнопку ниже:</p>
    
    <p style="margin: 32px 0; text-align: center;">
      <a href="${signLink}" class="button">Подписать договор</a>
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">
      Если кнопка не работает, скопируйте и вставьте следующую ссылку в браузер:
    </p>
    <p style="word-break: break-all; font-size: 12px; color: #4f46e5;">
      ${signLink}
    </p>
    
    <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
      Ссылка действительна в течение 7 дней.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Подписание договора - ${siteName}`,
    html: getBaseEmailTemplate(content, "Подписание договора"),
  });
}

export async function sendPasswordResetEmail(email: string, resetLink: string, userName: string): Promise<boolean> {
  const content = `
    <h2>Сброс пароля</h2>
    <p>Здравствуйте, ${userName}!</p>
    <p>Вы запросили сброс пароля для вашей учетной записи на ${siteName}.</p>
    <p>Для создания нового пароля нажмите на кнопку ниже:</p>
    
    <p style="margin: 32px 0; text-align: center;">
      <a href="${resetLink}" class="button">Сбросить пароль</a>
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">
      Если кнопка не работает, скопируйте и вставьте следующую ссылку в браузер:
    </p>
    <p style="word-break: break-all; font-size: 12px; color: #4f46e5;">
      ${resetLink}
    </p>
    
    <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
      Ссылка действительна в течение 1 часа. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Сброс пароля - ${siteName}`,
    html: getBaseEmailTemplate(content, "Сброс пароля"),
  });
}

export async function sendLoginOtpEmail(email: string, code: string, userName: string): Promise<boolean> {
  const content = `
    <h2>Код подтверждения входа</h2>
    <p>Здравствуйте, ${userName}!</p>
    <p>Для завершения входа в вашу учетную запись на ${siteName} введите код подтверждения:</p>
    
    <div style="margin: 32px 0; text-align: center;">
      <div style="display: inline-block; background-color: #f3f4f6; padding: 16px 32px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">
        ${code}
      </div>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      Код действителен в течение 5 минут.
    </p>
    
    <p style="margin-top: 24px; color: #dc2626; font-size: 14px;">
      Если вы не запрашивали вход, игнорируйте это письмо. Это может означать, что кто-то пытается получить доступ к вашему аккаунту.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Код подтверждения: ${code} - ${siteName}`,
    html: getBaseEmailTemplate(content, "Код подтверждения входа"),
  });
}

export async function isEmailConfigured(): Promise<boolean> {
  const settings = await getSmtpSettings();
  return settings !== null;
}
