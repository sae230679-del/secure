/**
 * Политика источников данных SecureLex
 * Разрешены ТОЛЬКО РФ-сервисы и локальные методы проверки
 */

export type IntegrationCategory = 
  | "payment" 
  | "ai" 
  | "registry" 
  | "technical" 
  | "email";

export interface AllowedIntegration {
  name: string;
  category: IntegrationCategory;
  description: string;
  isRussian: boolean;
}

export const ALLOWED_INTEGRATIONS: AllowedIntegration[] = [
  // Платежные системы (только РФ)
  { name: "yookassa", category: "payment", description: "YooKassa (ЮKassa)", isRussian: true },
  { name: "robokassa", category: "payment", description: "Robokassa", isRussian: true },
  { name: "cloudpayments", category: "payment", description: "CloudPayments", isRussian: true },
  { name: "mandarin", category: "payment", description: "Mandarin Pay", isRussian: true },
  
  // AI провайдеры
  { name: "gigachat", category: "ai", description: "GigaChat (Сбер)", isRussian: true },
  { name: "openai", category: "ai", description: "OpenAI (резервный)", isRussian: false },
  
  // Реестры и законы (официальные РФ источники)
  { name: "rkn", category: "registry", description: "Роскомнадзор (реестры)", isRussian: true },
  { name: "consultant", category: "registry", description: "КонсультантПлюс (тексты законов)", isRussian: true },
  { name: "garant", category: "registry", description: "Гарант (тексты законов)", isRussian: true },
  
  // Технические методы (локальные, без внешних API)
  { name: "dns", category: "technical", description: "DNS запросы (системный резолвер)", isRussian: true },
  { name: "whois", category: "technical", description: "WHOIS протокол (прямой)", isRussian: true },
  { name: "html_fetch", category: "technical", description: "Прямой fetch HTML страниц", isRussian: true },
  { name: "ssl_check", category: "technical", description: "TLS handshake проверка", isRussian: true },
  { name: "headers", category: "technical", description: "Анализ HTTP заголовков", isRussian: true },
  
  // Email сервисы (РФ)
  { name: "regru_smtp", category: "email", description: "REG.RU SMTP", isRussian: true },
  { name: "yandex_smtp", category: "email", description: "Yandex Mail SMTP", isRussian: true },
  { name: "mailru_smtp", category: "email", description: "Mail.ru SMTP", isRussian: true },
];

export const DENIED_INTEGRATIONS: string[] = [
  // Зарубежные оценочные API
  "google_pagespeed",
  "google_lighthouse",
  "google_safe_browsing",
  "moz_api",
  "ahrefs_api",
  "semrush_api",
  "wappalyzer_api",
  "builtwith_api",
  "similarweb_api",
  
  // Зарубежные GeoIP/ASN сервисы
  "maxmind_geoip",
  "ipinfo",
  "ipstack",
  "ipgeolocation",
  "ip2location",
  
  // Зарубежные speedtest/performance API
  "gtmetrix",
  "webpagetest",
  "pingdom",
  
  // Зарубежные SEO API
  "screaming_frog_api",
  "sitebulb_api",
];

export class SourcePolicyError extends Error {
  constructor(
    public integrationName: string,
    public reason: string
  ) {
    super(`[SOURCE POLICY] Интеграция "${integrationName}" запрещена: ${reason}`);
    this.name = "SourcePolicyError";
  }
}

export function assertAllowedIntegration(
  name: string, 
  context?: string
): AllowedIntegration {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  
  if (DENIED_INTEGRATIONS.includes(normalizedName)) {
    throw new SourcePolicyError(
      name,
      `Зарубежный сервис в denylist. Контекст: ${context || "не указан"}`
    );
  }
  
  const allowed = ALLOWED_INTEGRATIONS.find(
    (i) => i.name === normalizedName
  );
  
  if (!allowed) {
    throw new SourcePolicyError(
      name,
      `Интеграция не в allowlist. Добавьте в ALLOWED_INTEGRATIONS если это РФ-сервис. Контекст: ${context || "не указан"}`
    );
  }
  
  return allowed;
}

export function isIntegrationAllowed(name: string): boolean {
  try {
    assertAllowedIntegration(name);
    return true;
  } catch {
    return false;
  }
}

export function getAllowedIntegrationsByCategory(
  category: IntegrationCategory
): AllowedIntegration[] {
  return ALLOWED_INTEGRATIONS.filter((i) => i.category === category);
}

export function validatePaymentProvider(provider: string): void {
  const allowed = getAllowedIntegrationsByCategory("payment");
  const normalizedProvider = provider.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  
  if (!allowed.some((i) => i.name === normalizedProvider)) {
    throw new SourcePolicyError(
      provider,
      `Платёжная система не в списке разрешённых РФ-провайдеров: ${allowed.map(i => i.description).join(", ")}`
    );
  }
}
