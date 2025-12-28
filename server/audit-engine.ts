import OpenAI from "openai";
import https from "https";
import http from "http";
import { URL } from "url";
import { checkHosting, type HostingCheckResult } from "./hosting-checker";
import type { BriefResults, BriefHighlight, HostingInfo } from "@shared/schema";
import { fetchRenderedPage } from "./playwright-fetcher";

const OPENAI_MODEL = "gpt-4o-mini";
const isProduction = process.env.NODE_ENV === "production";
const MAX_BYTES = 2 * 1024 * 1024; // 2MB response limit

// SSRF protection - block private/local IPs
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
];

function isPrivateIp(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const ipv4Match = lower.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (!ipv4Match) return false;
  return PRIVATE_IP_RANGES.some((re) => re.test(lower));
}

let cachedGigaChatToken: { token: string; expiresAt: number } | null = null;

async function getGigaChatAccessToken(): Promise<string | null> {
  const apiKey = process.env.GIGACHATAPIKEY;
  if (!apiKey) return null;

  if (cachedGigaChatToken && cachedGigaChatToken.expiresAt > Date.now()) {
    return cachedGigaChatToken.token;
  }

  return new Promise((resolve) => {
    const data = "scope=GIGACHAT_API_PERS";
    
    const options = {
      hostname: "ngw.devices.sberbank.ru",
      port: 443,
      path: "/api/v2/oauth",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "RqUID": crypto.randomUUID(),
        "Authorization": `Basic ${apiKey}`,
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          if (result.access_token) {
            cachedGigaChatToken = {
              token: result.access_token,
              expiresAt: Date.now() + (result.expires_at ? result.expires_at * 1000 - Date.now() - 60000 : 1800000),
            };
            resolve(result.access_token);
          } else {
            console.error("GigaChat auth failed:", body);
            resolve(null);
          }
        } catch (e) {
          console.error("GigaChat auth parse error:", e);
          resolve(null);
        }
      });
    });

    req.on("error", (e) => {
      console.error("GigaChat auth error:", e);
      resolve(null);
    });

    req.write(data);
    req.end();
  });
}

async function callGigaChat(systemPrompt: string, userPrompt: string): Promise<any> {
  const token = await getGigaChatAccessToken();
  if (!token) return null;

  return new Promise((resolve) => {
    const requestBody = JSON.stringify({
      model: "GigaChat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const options = {
      hostname: "gigachat.devices.sberbank.ru",
      port: 443,
      path: "/api/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          if (result.choices && result.choices[0]) {
            const content = result.choices[0].message?.content || "";
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve({ summary: content, recommendations: [], additional_issues: [] });
            }
          } else {
            console.error("GigaChat response error:", body);
            resolve(null);
          }
        } catch (e) {
          console.error("GigaChat parse error:", e);
          resolve(null);
        }
      });
    });

    req.on("error", (e) => {
      console.error("GigaChat request error:", e);
      resolve(null);
    });

    req.write(requestBody);
    req.end();
  });
}

import { getApiKey, getYandexConfig } from "./api-keys";

async function callYandexGpt(systemPrompt: string, userPrompt: string): Promise<any> {
  const iamToken = await getApiKey("yandex");
  const endpoint = process.env.YANDEX_GPT_ENDPOINT || "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
  const { modelUri, folderId } = await getYandexConfig();

  if (!iamToken) return null;

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(endpoint);
      
      const requestBody = JSON.stringify({
        modelUri: modelUri,
        completionOptions: {
          stream: false,
          temperature: 0.6,
          maxTokens: 2000,
        },
        messages: [
          { role: "system", text: systemPrompt },
          { role: "user", text: userPrompt },
        ],
      });

      // Determine folder ID: from config, or extract from modelUri
      const effectiveFolderId = folderId || modelUri.split("/")[2] || "";

      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${iamToken}`,
          "x-folder-id": effectiveFolderId,
        },
        rejectUnauthorized: true,
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
          try {
            const result = JSON.parse(body);
            if (result.result && result.result.alternatives && result.result.alternatives[0]) {
              const content = result.result.alternatives[0].message?.text || "";
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                resolve(JSON.parse(jsonMatch[0]));
              } else {
                resolve({ summary: content, recommendations: [], additional_issues: [] });
              }
            } else {
              console.error("YandexGPT response error:", body);
              resolve(null);
            }
          } catch (e) {
            console.error("YandexGPT parse error:", e);
            resolve(null);
          }
        });
      });

      req.on("error", (e) => {
        console.error("YandexGPT request error:", e);
        resolve(null);
      });

      req.write(requestBody);
      req.end();
    } catch (e) {
      console.error("YandexGPT call error:", e);
      resolve(null);
    }
  });
}

export interface LawBasisRef {
  law: "152" | "149";
  article: string;
  note?: string;
}

export interface AuditCheckResult {
  id: string;
  checkId?: string;
  name: string;
  category: string;
  status: "passed" | "warning" | "failed";
  description: string;
  details?: string;
  evidence?: string | string[];
  lawBasis?: LawBasisRef[];
  aggregationKey?: string;
  fixSteps?: string[];
}

export interface WebsiteData {
  url: string;
  html: string;
  statusCode: number;
  headers: Record<string, string>;
  sslInfo?: {
    valid: boolean;
    issuer?: string;
    expiresAt?: string;
    protocol?: string;
  };
  responseTime: number;
  error?: string;
}

export interface EvidenceItem {
  id: string;
  url?: string;
  textSnippet?: string;
  markers?: string[];
  rawStatus?: "passed" | "warning" | "failed";
  category?: string;
}

export interface EvidenceBundle {
  policy: EvidenceItem[];
  consent: EvidenceItem[];
  cookies: EvidenceItem[];
  contacts: EvidenceItem[];
  technical: EvidenceItem[];
}

export interface RknCheckResult {
  status: "passed" | "warning" | "failed" | "pending" | "not_checked";
  confidence: "high" | "medium" | "low" | "none";
  used: "inn" | "name" | "manual" | "none";
  query: { inn?: string; name?: string };
  details: string;
  needsCompanyDetails?: boolean;
  evidence?: {
    innFound?: string;
    nameFound?: string;
    urls?: string[];
  };
  // Результат реальной проверки реестра РКН
  registryCheck?: {
    isRegistered: boolean;
    companyName?: string;
    registrationNumber?: string;
    registrationDate?: string;
    error?: string;
  };
}

export interface AuditReport {
  url: string;
  checks: AuditCheckResult[];
  scorePercent: number;
  severity: "critical" | "high" | "medium" | "low" | "excellent";
  passedCount: number;
  warningCount: number;
  failedCount: number;
  totalCount: number;
  summary: string;
  recommendations: string[];
  processedAt: Date;
  rknCheck?: RknCheckResult;
  evidenceBundle?: EvidenceBundle;
  hostingCheck?: HostingCheckResult;
  briefResults?: BriefResults;
}

export type AuditAiMode = "gigachat_only" | "openai_only" | "hybrid" | "none" | "yandex_only" | "tri_hybrid";

export interface AuditOptions {
  level2?: boolean;
  aiMode?: AuditAiMode;
  onProgress?: (stage: number, checks: AuditCheckResult[]) => void;
}

function truncateSnippet(text: string, maxLen = 350): string {
  if (!text || text.length <= maxLen) return text;
  return text.substring(0, maxLen) + "...";
}

function buildEvidenceBundle(checks: AuditCheckResult[], url: string): EvidenceBundle {
  const bundle: EvidenceBundle = {
    policy: [],
    consent: [],
    cookies: [],
    contacts: [],
    technical: [],
  };

  const MAX_PER_GROUP = 10;
  let counters = { policy: 0, consent: 0, cookies: 0, contacts: 0, technical: 0 };

  for (const check of checks) {
    const evidenceStr = Array.isArray(check.evidence) 
      ? check.evidence.join("; ") 
      : (check.evidence || "");
    const item: EvidenceItem = {
      id: "",
      url: url,
      textSnippet: truncateSnippet(check.details || check.description),
      markers: evidenceStr ? [truncateSnippet(evidenceStr, 200)] : [],
      rawStatus: check.status,
      category: check.category,
    };

    const nameLower = check.name.toLowerCase();
    const catLower = check.category.toLowerCase();

    if (catLower === "fz152" || nameLower.includes("политик") || nameLower.includes("privacy") || nameLower.includes("конфиденциальност")) {
      if (counters.policy < MAX_PER_GROUP) {
        counters.policy++;
        item.id = `policy-${counters.policy}`;
        bundle.policy.push(item);
      }
    } else if (nameLower.includes("согласи") || nameLower.includes("consent") || nameLower.includes("пдн")) {
      if (counters.consent < MAX_PER_GROUP) {
        counters.consent++;
        item.id = `consent-${counters.consent}`;
        bundle.consent.push(item);
      }
    } else if (catLower === "cookies" || nameLower.includes("cookie") || nameLower.includes("куки")) {
      if (counters.cookies < MAX_PER_GROUP) {
        counters.cookies++;
        item.id = `cookies-${counters.cookies}`;
        bundle.cookies.push(item);
      }
    } else if (catLower === "fz149" || nameLower.includes("контакт") || nameLower.includes("реквизит") || nameLower.includes("инн") || nameLower.includes("огрн")) {
      if (counters.contacts < MAX_PER_GROUP) {
        counters.contacts++;
        item.id = `contacts-${counters.contacts}`;
        bundle.contacts.push(item);
      }
    } else if (catLower === "security" || catLower === "technical" || nameLower.includes("https") || nameLower.includes("header") || nameLower.includes("ssl")) {
      if (counters.technical < MAX_PER_GROUP) {
        counters.technical++;
        item.id = `technical-${counters.technical}`;
        bundle.technical.push(item);
      }
    }
  }

  return bundle;
}

function buildRknCheck(html: string, url: string): RknCheckResult {
  const innPattern = /инн\s*:?\s*(\d{10,12})/i;
  const namePattern = /ооо\s*["«]?([^"»]{2,50})["»]?|ип\s+([а-яёА-ЯЁ]+\s+[а-яёА-ЯЁ]+)/i;

  const innMatch = html.match(innPattern);
  const nameMatch = html.match(namePattern);

  const innFound = innMatch ? innMatch[1] : undefined;
  const nameFound = nameMatch ? (nameMatch[1] || nameMatch[2])?.trim() : undefined;

  if (innFound) {
    return {
      status: "pending",
      confidence: "high",
      used: "inn",
      query: { inn: innFound },
      details: `ИНН найден: ${innFound}. Требуется проверка в реестре РКН.`,
      evidence: {
        innFound,
        urls: [url],
      },
    };
  }

  if (nameFound) {
    return {
      status: "pending",
      confidence: "low",
      used: "name",
      query: { name: nameFound },
      details: `Название организации: ${nameFound}. ИНН не найден, точность низкая.`,
      needsCompanyDetails: true,
      evidence: {
        nameFound,
        urls: [url],
      },
    };
  }

  return {
    status: "not_checked",
    confidence: "none",
    used: "none",
    query: {},
    details: "ИНН и название организации не найдены на странице. Требуется ручной ввод данных.",
    needsCompanyDetails: true,
  };
}

export async function fetchWebsite(urlString: string, timeout = 15000): Promise<WebsiteData> {
  const startTime = Date.now();
  
  // Parse and validate URL first
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return {
      url: urlString,
      html: "",
      statusCode: 0,
      headers: {},
      responseTime: Date.now() - startTime,
      error: "Некорректный URL",
    };
  }

  // SSRF protection: block localhost and private IPs
  if (parsed.hostname === "localhost" || isPrivateIp(parsed.hostname)) {
    return {
      url: urlString,
      html: "",
      statusCode: 0,
      headers: {},
      responseTime: Date.now() - startTime,
      error: "Запрещён доступ к локальным/внутренним адресам",
    };
  }
  
  return new Promise((resolve) => {
    try {
      const isHttps = parsed.protocol === "https:";
      const lib = isHttps ? https : http;
      
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        timeout,
        headers: {
          "User-Agent": "SecureLex-Audit-Bot/1.0 (Website Compliance Checker)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
        rejectUnauthorized: isProduction,
      };

      const req = lib.request(options, (res) => {
        let html = "";
        let received = 0;
        const headers: Record<string, string> = {};
        
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === "string") {
            headers[key.toLowerCase()] = value;
          } else if (Array.isArray(value)) {
            headers[key.toLowerCase()] = value.join(", ");
          }
        }

        res.on("data", (chunk) => {
          received += Buffer.byteLength(chunk);
          if (received > MAX_BYTES) {
            res.destroy();
            return;
          }
          html += chunk.toString("utf8");
        });

        res.on("end", () => {
          const responseTime = Date.now() - startTime;
          
          let sslInfo: WebsiteData["sslInfo"] = undefined;
          if (isHttps && res.socket && (res.socket as any).getPeerCertificate) {
            try {
              const cert = (res.socket as any).getPeerCertificate();
              if (cert && cert.valid_to) {
                sslInfo = {
                  valid: true,
                  issuer: cert.issuer?.O || cert.issuer?.CN,
                  expiresAt: cert.valid_to,
                  protocol: (res.socket as any).getProtocol?.() || "TLS",
                };
              }
            } catch (e) {
              sslInfo = { valid: false };
            }
          } else if (isHttps) {
            sslInfo = { valid: true, protocol: "TLS" };
          }

          resolve({
            url: urlString,
            html,
            statusCode: res.statusCode || 0,
            headers,
            sslInfo,
            responseTime,
          });
        });
      });

      req.setTimeout(timeout, () => {
        req.destroy(new Error("Request timed out"));
      });

      req.on("error", (error) => {
        resolve({
          url: urlString,
          html: "",
          statusCode: 0,
          headers: {},
          responseTime: Date.now() - startTime,
          error: error.message,
        });
      });

      req.end();
    } catch (error: any) {
      resolve({
        url: urlString,
        html: "",
        statusCode: 0,
        headers: {},
        responseTime: Date.now() - startTime,
        error: error.message,
      });
    }
  });
}

function isSpaShell(html: string): boolean {
  if (!html || html.length < 500) return true;
  
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return false;
  
  const bodyContent = bodyMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  if (bodyContent.length < 100) return true;
  
  const spaIndicators = [
    /<div[^>]*id=["'](?:root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i,
    /<div[^>]*id=["'](?:root|app)["'][^>]*>[\s\n]*<\/div>/i,
  ];
  
  return spaIndicators.some(pattern => pattern.test(html));
}

export async function fetchWebsiteWithPlaywright(urlString: string, timeout = 30000): Promise<WebsiteData> {
  const startTime = Date.now();
  
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return {
      url: urlString,
      html: "",
      statusCode: 0,
      headers: {},
      responseTime: Date.now() - startTime,
      error: "Некорректный URL",
    };
  }

  if (parsed.hostname === "localhost" || isPrivateIp(parsed.hostname)) {
    return {
      url: urlString,
      html: "",
      statusCode: 0,
      headers: {},
      responseTime: Date.now() - startTime,
      error: "Запрещён доступ к локальным/внутренним адресам",
    };
  }
  
  try {
    console.log(`[Audit] Fetching with Playwright: ${urlString}`);
    const result = await fetchRenderedPage(urlString, timeout);
    
    if (result.error) {
      console.log(`[Audit] Playwright failed: ${result.error}, falling back to static fetch`);
      return fetchWebsite(urlString, 15000);
    }
    
    console.log(`[Audit] Playwright success, HTML length: ${result.html.length}`);
    
    return {
      url: urlString,
      html: result.html,
      statusCode: result.statusCode,
      headers: {},
      responseTime: Date.now() - startTime,
    };
  } catch (error: any) {
    console.log(`[Audit] Playwright exception: ${error.message}, falling back to static fetch`);
    return fetchWebsite(urlString, 15000);
  }
}

export async function fetchWebsiteSmart(urlString: string): Promise<WebsiteData> {
  const staticResult = await fetchWebsite(urlString, 15000);
  
  if (staticResult.error) {
    return staticResult;
  }
  
  if (isSpaShell(staticResult.html)) {
    console.log(`[Audit] Detected SPA shell for ${urlString}, trying Playwright...`);
    return fetchWebsiteWithPlaywright(urlString, 30000);
  }
  
  return staticResult;
}

function checkHttps(data: WebsiteData): AuditCheckResult {
  const isHttps = data.url.startsWith("https://");
  const evidence: string[] = [];
  
  if (isHttps) {
    evidence.push(`URL использует HTTPS: ${data.url}`);
    if (data.sslInfo?.protocol) evidence.push(`Протокол: ${data.sslInfo.protocol}`);
    if (data.sslInfo?.expiresAt) evidence.push(`Сертификат действителен до: ${data.sslInfo.expiresAt}`);
    if (data.sslInfo?.issuer) evidence.push(`Издатель: ${data.sslInfo.issuer}`);
  } else {
    evidence.push(`URL использует небезопасный HTTP: ${data.url}`);
    evidence.push("Данные передаются без шифрования");
  }

  return {
    id: "SEC-001",
    checkId: "SEC_HTTPS_NOT_ENFORCED",
    name: "HTTPS/SSL сертификат",
    category: "security",
    status: isHttps && data.statusCode > 0 ? "passed" : "failed",
    description: "Проверка безопасного HTTPS соединения",
    details: isHttps 
      ? `Сайт использует HTTPS${data.sslInfo?.protocol ? ` (${data.sslInfo.protocol})` : ""}`
      : "Сайт не использует HTTPS - данные передаются без шифрования",
    evidence,
    lawBasis: [{ law: "152", article: "ст. 19", note: "Меры по обеспечению безопасности ПДн при передаче" }],
    aggregationKey: "HTTPS_ENFORCEMENT",
    fixSteps: [
      "Настроить принудительный редирект HTTP → HTTPS",
      "Добавить HSTS заголовок",
      "Проверить, что все ресурсы загружаются по HTTPS",
    ],
  };
}

function checkSecurityHeaders(data: WebsiteData): AuditCheckResult[] {
  const results: AuditCheckResult[] = [];
  const lawBasis: LawBasisRef[] = [{ law: "152", article: "ст. 19", note: "Технические меры безопасности" }];
  
  const hstsHeader = data.headers["strict-transport-security"];
  results.push({
    id: "SEC-002",
    checkId: "SEC_HEADERS_HSTS_MISSING",
    name: "HSTS Header",
    category: "security",
    status: hstsHeader ? "passed" : "warning",
    description: "HTTP Strict Transport Security",
    details: hstsHeader 
      ? `HSTS настроен: ${hstsHeader.substring(0, 100)}`
      : "HSTS не настроен - браузер может использовать небезопасное HTTP соединение",
    evidence: hstsHeader 
      ? [`Заголовок strict-transport-security: ${hstsHeader}`]
      : ["Заголовок strict-transport-security отсутствует в ответе сервера"],
    lawBasis,
    aggregationKey: "SEC_HEADERS",
    fixSteps: ["Добавить заголовок Strict-Transport-Security: max-age=31536000; includeSubDomains"],
  });

  const cspHeader = data.headers["content-security-policy"];
  results.push({
    id: "SEC-003",
    checkId: "SEC_HEADERS_CSP_MISSING",
    name: "Content Security Policy",
    category: "security",
    status: cspHeader ? "passed" : "warning",
    description: "Политика безопасности контента",
    details: cspHeader 
      ? "CSP настроен для защиты от XSS и инъекций"
      : "CSP не настроен - сайт уязвим для XSS атак",
    evidence: cspHeader 
      ? [`Заголовок content-security-policy: ${cspHeader.substring(0, 200)}...`]
      : ["Заголовок content-security-policy отсутствует"],
    lawBasis,
    aggregationKey: "SEC_HEADERS",
    fixSteps: ["Настроить Content-Security-Policy заголовок", "Минимально: default-src 'self'"],
  });

  const xFrameOptions = data.headers["x-frame-options"];
  results.push({
    id: "SEC-004",
    checkId: "SEC_HEADERS_XFO_MISSING",
    name: "X-Frame-Options",
    category: "security",
    status: xFrameOptions ? "passed" : "warning",
    description: "Защита от clickjacking",
    details: xFrameOptions 
      ? `Защита от встраивания: ${xFrameOptions}`
      : "Защита от clickjacking не настроена",
    evidence: xFrameOptions 
      ? [`Заголовок x-frame-options: ${xFrameOptions}`]
      : ["Заголовок x-frame-options отсутствует"],
    lawBasis,
    aggregationKey: "SEC_HEADERS",
    fixSteps: ["Добавить заголовок X-Frame-Options: DENY или SAMEORIGIN"],
  });

  const xContentType = data.headers["x-content-type-options"];
  results.push({
    id: "SEC-005",
    checkId: "SEC_HEADERS_XCTO_MISSING",
    name: "X-Content-Type-Options",
    category: "security",
    status: xContentType === "nosniff" ? "passed" : "warning",
    description: "Защита от MIME sniffing",
    details: xContentType 
      ? "Защита от MIME sniffing активна"
      : "Защита от MIME sniffing не настроена",
    evidence: xContentType 
      ? [`Заголовок x-content-type-options: ${xContentType}`]
      : ["Заголовок x-content-type-options отсутствует"],
    lawBasis,
    aggregationKey: "SEC_HEADERS",
    fixSteps: ["Добавить заголовок X-Content-Type-Options: nosniff"],
  });

  const referrerPolicy = data.headers["referrer-policy"];
  results.push({
    id: "SEC-006",
    checkId: "SEC_HEADERS_REFERRER_MISSING",
    name: "Referrer-Policy",
    category: "security",
    status: referrerPolicy ? "passed" : "warning",
    description: "Контроль передачи Referer заголовка",
    details: referrerPolicy 
      ? `Referrer-Policy настроен: ${referrerPolicy}`
      : "Referrer-Policy не настроен - возможна утечка URL при переходах на внешние сайты",
    evidence: referrerPolicy 
      ? [`Заголовок referrer-policy: ${referrerPolicy}`]
      : ["Заголовок referrer-policy отсутствует"],
    lawBasis,
    aggregationKey: "SEC_HEADERS",
    fixSteps: ["Добавить заголовок Referrer-Policy: strict-origin-when-cross-origin"],
  });

  const permissionsPolicy = data.headers["permissions-policy"] || data.headers["feature-policy"];
  results.push({
    id: "SEC-007",
    checkId: "SEC_HEADERS_PERMISSIONS_MISSING",
    name: "Permissions-Policy",
    category: "security",
    status: permissionsPolicy ? "passed" : "warning",
    description: "Политика разрешений браузера",
    details: permissionsPolicy 
      ? "Permissions-Policy настроен для контроля функций браузера"
      : "Permissions-Policy не настроен - функции браузера (камера, геолокация) не ограничены",
    evidence: permissionsPolicy 
      ? [`Заголовок permissions-policy: ${permissionsPolicy.substring(0, 150)}...`]
      : ["Заголовок permissions-policy отсутствует"],
    lawBasis,
    aggregationKey: "SEC_HEADERS",
    fixSteps: ["Добавить заголовок Permissions-Policy для ограничения функций браузера"],
  });

  return results;
}

function checkPrivacyPolicy(html: string): AuditCheckResult {
  const evidence: string[] = [];
  
  const policyPatterns = [
    { pattern: /политик[аи|уыей]\s*конфиденциальности/i, name: "текст 'политика конфиденциальности'" },
    { pattern: /privacy\s*policy/i, name: "текст 'privacy policy'" },
    { pattern: /обработк[аиуеой]\s*персональных\s*данных/i, name: "текст 'обработка персональных данных'" },
    { pattern: /защит[аиуеой]\s*персональных\s*данных/i, name: "текст 'защита персональных данных'" },
    { pattern: /href\s*=\s*["'][^"']*privacy[^"']*["']/i, name: "ссылка с 'privacy' в URL" },
    { pattern: /href\s*=\s*["'][^"']*policy[^"']*["']/i, name: "ссылка с 'policy' в URL" },
    { pattern: /href\s*=\s*["'][^"']*конфиденциальност[^"']*["']/i, name: "ссылка с 'конфиденциальность' в URL" },
    { pattern: /href\s*=\s*["']\/privacy-policy["']/i, name: "ссылка '/privacy-policy'" },
    { pattern: /href\s*=\s*["']\/personal-data[^"']*["']/i, name: "ссылка '/personal-data'" },
    { pattern: /Политика\s+конфиденциальности/i, name: "текст 'Политика конфиденциальности'" },
  ];

  const foundPatterns: string[] = [];
  for (const { pattern, name } of policyPatterns) {
    if (pattern.test(html)) {
      foundPatterns.push(name);
    }
  }

  const hasPolicy = foundPatterns.length > 0;
  
  if (hasPolicy) {
    evidence.push(`Найдено: ${foundPatterns.join(", ")}`);
  } else {
    evidence.push("Не найдены ссылки или текст политики конфиденциальности");
    evidence.push("Проверены паттерны: /privacy, /policy, политика конфиденциальности");
  }
  
  return {
    id: "PDN-001",
    checkId: "LEGAL_PRIVACY_POLICY_MISSING",
    name: "Политика конфиденциальности",
    category: "fz152",
    status: hasPolicy ? "passed" : "failed",
    description: "Наличие и доступность политики конфиденциальности (ФЗ-152)",
    details: hasPolicy 
      ? "Ссылка на политику конфиденциальности найдена"
      : "Политика конфиденциальности не найдена на странице",
    evidence,
    lawBasis: [{ law: "152", article: "ст. 18.1", note: "Обязанность опубликовать политику обработки ПДн" }],
    aggregationKey: "PRIVACY_POLICY",
    fixSteps: [
      "Разместить политику конфиденциальности на сайте",
      "Добавить ссылку в подвал каждой страницы",
      "Включить все обязательные разделы по ст. 18.1 ФЗ-152",
    ],
  };
}

function checkConsentCheckbox(html: string): AuditCheckResult {
  const evidence: string[] = [];
  
  const consentPatterns = [
    { pattern: /согласи[еяюо]\s*(на\s*)?(обработку|передачу)/i, name: "'согласие на обработку'" },
    { pattern: /даю\s*согласие/i, name: "'даю согласие'" },
    { pattern: /принимаю\s*(условия|политику)/i, name: "'принимаю условия/политику'" },
    { pattern: /consent/i, name: "'consent'" },
    { pattern: /type\s*=\s*["']checkbox["'][^>]*согласи/i, name: "чекбокс с текстом согласия" },
  ];

  const formPatterns = [
    /<form[^>]*>/i,
    /<input[^>]*type\s*=\s*["'](text|email|tel|phone)["']/i,
  ];

  const hasForm = formPatterns.some(p => p.test(html));
  const foundConsent: string[] = [];
  
  for (const { pattern, name } of consentPatterns) {
    if (pattern.test(html)) {
      foundConsent.push(name);
    }
  }
  
  const hasConsent = foundConsent.length > 0;

  if (!hasForm) {
    evidence.push("Формы сбора данных не обнаружены на странице");
    return {
      id: "PDN-002",
      checkId: "PDN_CONSENT_CHECKBOX_MISSING",
      name: "Согласие на обработку ПДн",
      category: "fz152",
      status: "passed",
      description: "Проверка наличия чекбокса согласия в формах (ФЗ-152 ст.9)",
      details: "Формы сбора данных не обнаружены на странице",
      evidence,
      lawBasis: [
        { law: "152", article: "ст. 9", note: "Согласие субъекта ПДн" },
        { law: "152", article: "ст. 18", note: "Обязанности оператора при сборе ПДн" },
      ],
      aggregationKey: "PDN_CONSENT_FORMS",
    };
  }

  if (hasConsent) {
    evidence.push(`Обнаружены формы с данными: <form> или <input type="email/tel">`);
    evidence.push(`Найдены элементы согласия: ${foundConsent.join(", ")}`);
  } else {
    evidence.push(`Обнаружены формы сбора данных`);
    evidence.push(`Не найден чекбокс согласия или текст согласия рядом с формой`);
    evidence.push(`Проверенные паттерны: согласие на обработку, даю согласие, consent, checkbox`);
  }

  return {
    id: "PDN-002",
    checkId: "PDN_CONSENT_CHECKBOX_MISSING",
    name: "Согласие на обработку ПДн",
    category: "fz152",
    status: hasConsent ? "passed" : "failed",
    description: "Проверка наличия чекбокса согласия в формах (ФЗ-152 ст.9)",
    details: hasConsent 
      ? "Механизм получения согласия на обработку ПДн найден"
      : "В формах отсутствует явное согласие на обработку персональных данных",
    evidence,
    lawBasis: [
      { law: "152", article: "ст. 9", note: "Согласие субъекта ПДн" },
      { law: "152", article: "ст. 18", note: "Обязанности оператора при сборе ПДн" },
    ],
    aggregationKey: "PDN_CONSENT_FORMS",
    fixSteps: [
      "Добавить чекбокс согласия на обработку ПДн перед кнопкой отправки",
      "Текст согласия должен ссылаться на политику конфиденциальности",
      "Чекбокс не должен быть предзаполненным",
    ],
  };
}

function checkCookieBanner(html: string): AuditCheckResult {
  const evidence: string[] = [];
  
  const cookiePatterns = [
    { pattern: /cookie\s*banner/i, name: "'cookie banner'" },
    { pattern: /cookie\s*consent/i, name: "'cookie consent'" },
    { pattern: /accept\s*cookie/i, name: "'accept cookie'" },
    { pattern: /принять\s*cookie/i, name: "'принять cookie'" },
    { pattern: /использу[ео][тм]\s*cookie/i, name: "'используем cookie'" },
    { pattern: /мы\s*используем\s*cookie/i, name: "'мы используем cookie'" },
    { pattern: /файл[аов]*\s*cookie/i, name: "'файлы cookie'" },
    { pattern: /обработк[аиу]\s*cookie/i, name: "'обработка cookie'" },
    { pattern: /условия[ми]*\s*.*cookie/i, name: "'условия cookie'" },
    { pattern: /запретить\s*.*cookie/i, name: "'запретить cookie'" },
    { pattern: /соглас[а-я]*\s*.*cookie/i, name: "'согласие cookie'" },
    { pattern: /настрой[а-я]*\s*cookie/i, name: "'настройки cookie'" },
    { pattern: /политик[аи]\s*cookie/i, name: "'политика cookie'" },
    { pattern: /<[^>]*>Cookies<\/[^>]*>/i, name: "'Cookies заголовок'" },
    { pattern: /data-tilda-cookie/i, name: "'Tilda cookie system'" },
    { pattern: /cookiename/i, name: "'cookie popup'" },
    { pattern: /data-cookie-notice/i, name: "'cookie notice attribute'" },
    { pattern: /href\s*=\s*["']\/cookies-policy["']/i, name: "ссылка '/cookies-policy'" },
    { pattern: /Политика\s+cookies/i, name: "текст 'Политика cookies'" },
    { pattern: /используем\s+cookie/i, name: "'используем cookie'" },
  ];

  const foundPatterns: string[] = [];
  for (const { pattern, name } of cookiePatterns) {
    if (pattern.test(html)) {
      foundPatterns.push(name);
    }
  }
  
  const hasCookieBanner = foundPatterns.length > 0;

  if (hasCookieBanner) {
    evidence.push(`Найдено: ${foundPatterns.join(", ")}`);
  } else {
    evidence.push("Cookie-баннер или уведомление не обнаружено");
    evidence.push("Проверенные паттерны: cookie banner, cookie consent, accept cookie");
  }

  return {
    id: "COOK-001",
    checkId: "COOKIES_BANNER_MISSING",
    name: "Cookie-баннер",
    category: "cookies",
    status: hasCookieBanner ? "passed" : "warning",
    description: "Уведомление об использовании cookies",
    details: hasCookieBanner 
      ? "Cookie-баннер обнаружен"
      : "Cookie-баннер не обнаружен - возможно нарушение требований ФЗ-152",
    evidence,
    lawBasis: [
      { law: "152", article: "ст. 9", note: "Согласие на обработку ПДн при использовании идентификаторов" },
    ],
    aggregationKey: "COOKIES_CONSENT",
    fixSteps: [
      "Установить cookie-баннер с возможностью выбора категорий",
      "Не устанавливать аналитические/рекламные cookies до согласия",
      "Сохранять выбор пользователя",
    ],
  };
}

function checkContactInfo(html: string): AuditCheckResult {
  const evidence: string[] = [];
  
  const contactPatterns = [
    { pattern: /\+7\s*\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/, name: "телефон +7" },
    { pattern: /8\s*\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/, name: "телефон 8" },
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, name: "email" },
    { pattern: /контакт/i, name: "'контакты'" },
  ];

  const foundPatterns: string[] = [];
  for (const { pattern, name } of contactPatterns) {
    if (pattern.test(html)) {
      foundPatterns.push(name);
    }
  }

  const hasContacts = foundPatterns.length > 0;

  if (hasContacts) {
    evidence.push(`Найдено: ${foundPatterns.join(", ")}`);
  } else {
    evidence.push("Контактная информация не обнаружена");
    evidence.push("Проверенные паттерны: телефон, email, контакты");
  }

  return {
    id: "INF-001",
    checkId: "LEGAL_CONTACTS_MISSING",
    name: "Контактная информация",
    category: "fz149",
    status: hasContacts ? "passed" : "warning",
    description: "Наличие контактных данных оператора (ФЗ-149)",
    details: hasContacts 
      ? "Контактная информация найдена"
      : "Контактная информация не найдена на странице",
    evidence,
    lawBasis: [
      { law: "152", article: "ст. 18.1", note: "Публичная политика и сведения об операторе" },
      { law: "149", article: "ст. 10.1", note: "Обязанности владельца сайта" },
    ],
    aggregationKey: "LEGAL_CONTACTS",
    fixSteps: [
      "Разместить контактную информацию оператора (email, телефон, адрес)",
      "Указать ИНН/ОГРН организации",
      "Добавить страницу 'Контакты' с полными реквизитами",
    ],
  };
}

function checkCompanyRequisites(html: string): AuditCheckResult {
  const evidence: string[] = [];
  const requisitePatterns: { pattern: RegExp; name: string }[] = [
    { pattern: /инн\s*:?\s*\d{10,12}/i, name: "ИНН" },
    { pattern: /огрн\s*:?\s*\d{13,15}/i, name: "ОГРН" },
    { pattern: /кпп\s*:?\s*\d{9}/i, name: "КПП" },
    { pattern: /юридический\s*адрес/i, name: "юридический адрес" },
    { pattern: /ооо\s*["«]?[^"»]{2,50}["»]?/i, name: "название ООО" },
    { pattern: /ип\s+[а-яё]+/i, name: "ИП" },
  ];

  const foundPatterns: string[] = [];
  for (const { pattern, name } of requisitePatterns) {
    if (pattern.test(html)) {
      foundPatterns.push(name);
    }
  }

  const hasRequisites = foundPatterns.length > 0;

  if (hasRequisites) {
    evidence.push(`Найдено: ${foundPatterns.join(", ")}`);
  } else {
    evidence.push("Юридические реквизиты не обнаружены");
    evidence.push("Проверенные паттерны: ИНН, ОГРН, КПП, юридический адрес, ООО, ИП");
  }

  return {
    id: "INF-002",
    checkId: "LEGAL_REQUISITES_MISSING",
    name: "Реквизиты компании",
    category: "fz149",
    status: hasRequisites ? "passed" : "warning",
    description: "Наличие юридических реквизитов (ИНН, ОГРН)",
    details: hasRequisites 
      ? "Юридические реквизиты найдены"
      : "Юридические реквизиты (ИНН/ОГРН) не найдены",
    evidence,
    lawBasis: [
      { law: "149", article: "ст. 10.1", note: "Обязательная информация о владельце сайта" },
    ],
    aggregationKey: "LEGAL_REQUISITES",
    fixSteps: [
      "Разместить ИНН и ОГРН организации на странице контактов",
      "Указать полное наименование организации и юридический адрес",
    ],
  };
}

function checkTermsOfService(html: string): AuditCheckResult {
  const evidence: string[] = [];
  const termsPatterns: { pattern: RegExp; name: string }[] = [
    { pattern: /пользовательское\s*соглашение/i, name: "'пользовательское соглашение'" },
    { pattern: /terms\s*(of\s*)?service/i, name: "'terms of service'" },
    { pattern: /условия\s*использования/i, name: "'условия использования'" },
    { pattern: /правила\s*(пользования|сервиса)/i, name: "'правила сервиса'" },
    { pattern: /оферт[аыу]/i, name: "'оферта'" },
    { pattern: /договор\s*оферт/i, name: "'договор оферты'" },
  ];

  const foundPatterns: string[] = [];
  for (const { pattern, name } of termsPatterns) {
    if (pattern.test(html)) {
      foundPatterns.push(name);
    }
  }

  const hasTerms = foundPatterns.length > 0;

  if (hasTerms) {
    evidence.push(`Найдено: ${foundPatterns.join(", ")}`);
  } else {
    evidence.push("Пользовательское соглашение не обнаружено");
    evidence.push("Проверенные паттерны: пользовательское соглашение, terms of service, оферта");
  }

  return {
    id: "LEG-001",
    checkId: "LEGAL_TOS_MISSING",
    name: "Пользовательское соглашение",
    category: "legal",
    status: hasTerms ? "passed" : "warning",
    description: "Наличие условий использования сервиса",
    details: hasTerms 
      ? "Ссылка на пользовательское соглашение найдена"
      : "Пользовательское соглашение не найдено",
    evidence,
    lawBasis: [
      { law: "149", article: "ГК РФ ст. 437", note: "Публичная оферта" },
    ],
    aggregationKey: "LEGAL_TOS",
    fixSteps: [
      "Разместить пользовательское соглашение или публичную оферту",
      "Добавить ссылку в подвал сайта",
    ],
  };
}

function checkTrackers(html: string): AuditCheckResult[] {
  const results: AuditCheckResult[] = [];
  const lawBasis: LawBasisRef[] = [
    { law: "152", article: "ст. 9", note: "Согласие на обработку ПДн при использовании трекеров" },
  ];
  
  const gaPatterns = [
    { pattern: /google-analytics\.com/i, name: "google-analytics.com" },
    { pattern: /gtag\s*\(/i, name: "gtag()" },
    { pattern: /ga\s*\(\s*['"]create/i, name: "ga('create')" },
    { pattern: /GoogleAnalyticsObject/i, name: "GoogleAnalyticsObject" },
  ];
  
  const gaFound: string[] = [];
  for (const { pattern, name } of gaPatterns) {
    if (pattern.test(html)) {
      gaFound.push(name);
    }
  }

  if (gaFound.length > 0) {
    results.push({
      id: "COOK-002",
      checkId: "TRACKER_GA_FOUND",
      name: "Google Analytics",
      category: "cookies",
      status: "warning",
      description: "Использование Google Analytics",
      details: "Google Analytics обнаружен - требуется согласие пользователя по ФЗ-152",
      evidence: [`Найдены маркеры: ${gaFound.join(", ")}`],
      lawBasis,
      aggregationKey: "TRACKERS",
    });
  }

  const ymPatterns = [
    { pattern: /mc\.yandex\.ru/i, name: "mc.yandex.ru" },
    { pattern: /ym\s*\(\s*\d+/i, name: "ym(counter)" },
    { pattern: /yandex.*metrika/i, name: "yandex metrika" },
  ];
  
  const ymFound: string[] = [];
  for (const { pattern, name } of ymPatterns) {
    if (pattern.test(html)) {
      ymFound.push(name);
    }
  }

  if (ymFound.length > 0) {
    results.push({
      id: "COOK-003",
      checkId: "TRACKER_YM_FOUND",
      name: "Яндекс.Метрика",
      category: "cookies",
      status: "warning",
      description: "Использование Яндекс.Метрики",
      details: "Яндекс.Метрика обнаружена - рекомендуется получить согласие на трекинг",
      evidence: [`Найдены маркеры: ${ymFound.join(", ")}`],
      lawBasis,
      aggregationKey: "TRACKERS",
    });
  }

  const fbPatterns = [
    { pattern: /facebook\.net/i, name: "facebook.net" },
    { pattern: /fbq\s*\(/i, name: "fbq()" },
    { pattern: /fb-pixel/i, name: "fb-pixel" },
  ];
  
  const fbFound: string[] = [];
  for (const { pattern, name } of fbPatterns) {
    if (pattern.test(html)) {
      fbFound.push(name);
    }
  }

  if (fbFound.length > 0) {
    results.push({
      id: "COOK-004",
      checkId: "TRACKER_FB_FOUND",
      name: "Facebook Pixel",
      category: "cookies",
      status: "warning",
      description: "Использование Facebook Pixel",
      details: "Facebook Pixel обнаружен - требуется согласие пользователя",
      evidence: [`Найдены маркеры: ${fbFound.join(", ")}`],
      lawBasis,
      aggregationKey: "TRACKERS",
    });
  }

  return results;
}


function runLevel1Checks(data: WebsiteData): AuditCheckResult[] {
  const results: AuditCheckResult[] = [];
  
  if (data.error) {
    results.push({
      id: "ERR-001",
      name: "Доступность сайта",
      category: "technical",
      status: "failed",
      description: "Проверка доступности сайта",
      details: `Ошибка при загрузке: ${data.error}`,
    });
    return results;
  }

  results.push(checkHttps(data));
  results.push(...checkSecurityHeaders(data));
  results.push(checkPrivacyPolicy(data.html));
  results.push(checkConsentCheckbox(data.html));
  results.push(checkCookieBanner(data.html));
  results.push(checkContactInfo(data.html));
  results.push(checkCompanyRequisites(data.html));
  results.push(checkTermsOfService(data.html));
  results.push(...checkTrackers(data.html));

  return results;
}

async function runLevel2Analysis(
  url: string, 
  evidenceBundle: EvidenceBundle, 
  level1Results: AuditCheckResult[],
  aiMode: AuditAiMode = "gigachat_only"
): Promise<{ additionalChecks: AuditCheckResult[]; summary: string; recommendations: string[] }> {
  const openaiKey = process.env.OPENAIAPIKEY;
  const gigachatKey = process.env.GIGACHATAPIKEY;

  if (aiMode === "none") {
    return {
      additionalChecks: [],
      summary: "ИИ-анализ отключен",
      recommendations: [],
    };
  }

  const needsGigaChat = aiMode === "gigachat_only" || aiMode === "hybrid";
  const needsOpenAI = aiMode === "openai_only" || aiMode === "hybrid";

  if (needsGigaChat && !gigachatKey && needsOpenAI && !openaiKey) {
    return {
      additionalChecks: [],
      summary: "ИИ-анализ недоступен: не настроены API ключи",
      recommendations: ["Настройте OPENAIAPIKEY или GIGACHATAPIKEY для глубокого анализа"],
    };
  }

  if (aiMode === "gigachat_only" && !gigachatKey) {
    return {
      additionalChecks: [],
      summary: "GigaChat недоступен: не настроен GIGACHATAPIKEY",
      recommendations: ["Настройте GIGACHATAPIKEY для анализа"],
    };
  }

  if (aiMode === "openai_only" && !openaiKey) {
    return {
      additionalChecks: [],
      summary: "OpenAI недоступен: не настроен OPENAIAPIKEY",
      recommendations: ["Настройте OPENAIAPIKEY для анализа"],
    };
  }

  const failedChecks = level1Results.filter(r => r.status === "failed" || r.status === "warning");
  
  const evidenceJson = JSON.stringify(evidenceBundle, null, 2);

  const systemPrompt = `Ты - эксперт по соответствию сайтов требованиям ФЗ-152 (О персональных данных) и ФЗ-149 (Об информации).

Проанализируй HTML страницы и результаты автоматических проверок. Определи:
1. Есть ли нарушения законодательства о персональных данных
2. Соответствует ли сайт требованиям по cookies и согласию
3. Достаточна ли политика конфиденциальности

Ответь в JSON формате:
{
  "summary": "Краткое резюме соответствия сайта (2-3 предложения на русском)",
  "recommendations": ["Рекомендация 1", "Рекомендация 2", ...],
  "additional_issues": [
    {
      "id": "AI-001",
      "name": "Название проблемы",
      "status": "warning или failed",
      "details": "Описание проблемы"
    }
  ]
}`;

  const userPrompt = `URL сайта: ${url}

Результаты автоматических проверок:
${failedChecks.map(c => `- ${c.name}: ${c.status} - ${c.details}`).join("\n")}

Структурированные данные аудита (Evidence Bundle):
${evidenceJson}`;

  const parseAIResult = (result: any): { additionalChecks: AuditCheckResult[]; summary: string; recommendations: string[] } => {
    const additionalChecks: AuditCheckResult[] = (result.additional_issues || []).map((issue: any) => ({
      id: issue.id || `AI-${Date.now()}`,
      name: issue.name,
      category: "ai_analysis",
      status: issue.status === "failed" ? "failed" : "warning",
      description: "ИИ-анализ",
      details: issue.details,
    }));

    return {
      additionalChecks,
      summary: result.summary || "Анализ завершен",
      recommendations: result.recommendations || [],
    };
  };

  // Helper functions for AI calls
  const callOpenAI = async (): Promise<any | null> => {
    if (!openaiKey) return null;
    try {
      console.log("Using OpenAI for AI analysis");
      const openai = new OpenAI({ apiKey: openaiKey });
      
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    } catch (error: any) {
      console.error("OpenAI analysis error:", error);
      return null;
    }
  };

  const callGigaChatProvider = async (): Promise<any | null> => {
    if (!gigachatKey) return null;
    try {
      console.log("Using GigaChat for AI analysis");
      const result = await callGigaChat(systemPrompt, userPrompt);
      return result;
    } catch (error: any) {
      console.error("GigaChat analysis error:", error);
      return null;
    }
  };

  const yandexIamToken = process.env.YANDEX_IAM_TOKEN;
  
  const callYandexGptProvider = async (): Promise<any | null> => {
    if (!yandexIamToken) return null;
    try {
      console.log("Using YandexGPT for AI analysis");
      const result = await callYandexGpt(systemPrompt, userPrompt);
      return result;
    } catch (error: any) {
      console.error("YandexGPT analysis error:", error);
      return null;
    }
  };

  // Helper to evaluate response quality (count recommendations and issues)
  const evaluateResponse = (result: any): number => {
    if (!result) return 0;
    let score = 0;
    if (result.summary && result.summary.length > 20) score += 1;
    if (result.recommendations && result.recommendations.length > 0) score += result.recommendations.length;
    if (result.additional_issues && result.additional_issues.length > 0) score += result.additional_issues.length * 2;
    return score;
  };

  // Execute based on aiMode
  if (aiMode === "gigachat_only") {
    const result = await callGigaChatProvider();
    if (result) {
      return parseAIResult(result);
    }
  } else if (aiMode === "openai_only") {
    const result = await callOpenAI();
    if (result) {
      return parseAIResult(result);
    }
  } else if (aiMode === "hybrid") {
    // In hybrid mode, try OpenAI first (priority), then fallback to GigaChat
    let result = await callOpenAI();
    if (result) {
      console.log("Hybrid mode: OpenAI succeeded");
      return parseAIResult(result);
    }
    
    console.log("Hybrid mode: OpenAI failed, trying GigaChat");
    result = await callGigaChatProvider();
    if (result) {
      return parseAIResult(result);
    }
  } else if (aiMode === "yandex_only") {
    if (!yandexIamToken) {
      return {
        additionalChecks: [],
        summary: "YandexGPT недоступен: не настроен YANDEX_IAM_TOKEN",
        recommendations: ["Настройте YANDEX_IAM_TOKEN для анализа"],
      };
    }
    const result = await callYandexGptProvider();
    if (result) {
      return parseAIResult(result);
    }
  } else if (aiMode === "tri_hybrid") {
    // Call all three providers in parallel, pick best result
    console.log("Tri-hybrid mode: calling all AI providers in parallel");
    const results = await Promise.allSettled([
      callGigaChatProvider(),
      callOpenAI(),
      callYandexGptProvider(),
    ]);

    const validResults: { result: any; score: number; provider: string }[] = [];
    
    const providers = ["GigaChat", "OpenAI", "YandexGPT"];
    results.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value) {
        const score = evaluateResponse(r.value);
        validResults.push({ result: r.value, score, provider: providers[idx] });
      }
    });

    if (validResults.length > 0) {
      // Sort by score descending and pick best
      validResults.sort((a, b) => b.score - a.score);
      const best = validResults[0];
      console.log(`Tri-hybrid mode: selected ${best.provider} with score ${best.score}`);
      return parseAIResult(best.result);
    }
  }

  return {
    additionalChecks: [],
    summary: "Базовый анализ завершен. ИИ-анализ недоступен.",
    recommendations: failedChecks.length > 0 
      ? ["Устраните выявленные нарушения перед повторной проверкой"]
      : ["Сайт соответствует базовым требованиям"],
  };
}

function calculateScore(checks: AuditCheckResult[]): { 
  scorePercent: number; 
  severity: "critical" | "high" | "medium" | "low" | "excellent";
  passedCount: number;
  warningCount: number;
  failedCount: number;
  criticalCount: number;
} {
  const passedCount = checks.filter(c => c.status === "passed").length;
  const warningCount = checks.filter(c => c.status === "warning").length;
  const failedCount = checks.filter(c => c.status === "failed").length;
  const totalCount = checks.length;
  
  // Count critical errors (failed checks with critical severity indicators)
  const criticalCount = failedCount;

  // Base score calculation
  let score = 0;
  if (totalCount > 0) {
    score = Math.round(((passedCount * 1 + warningCount * 0.5) / totalCount) * 100);
    score = Math.max(0, Math.min(100, score));
  }

  // Apply critical error penalties:
  // 2+ critical errors -> score capped at 19 (very critical)
  // 1 critical error -> score capped at 39 (critical)
  if (criticalCount >= 2) {
    score = Math.min(score, 19);
  } else if (criticalCount === 1) {
    score = Math.min(score, 39);
  }

  // Determine severity level based on score:
  // 1-20: very critical (critical)
  // 20-40: critical (high)
  // 40-60: needs attention (medium)
  // 60-80: satisfactory (low)
  // 80-100: excellent (excellent)
  let severity: "critical" | "high" | "medium" | "low" | "excellent" = "excellent";
  if (score < 20) {
    severity = "critical";
  } else if (score < 40) {
    severity = "high";
  } else if (score < 60) {
    severity = "medium";
  } else if (score < 80) {
    severity = "low";
  } else {
    severity = "excellent";
  }

  return { scorePercent: score, severity, passedCount, warningCount, failedCount, criticalCount };
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname;
  } catch {
    return url.replace(/^(https?:\/\/)?/, "").split("/")[0];
  }
}

function buildBriefResults(
  url: string,
  checks: AuditCheckResult[],
  scores: { scorePercent: number; severity: "critical" | "high" | "medium" | "low" | "excellent"; passedCount: number; warningCount: number; failedCount: number; criticalCount?: number },
  hostingCheck: HostingCheckResult,
  rknCheck?: RknCheckResult
): BriefResults {
  const domain = extractDomain(url);
  
  const highlights: BriefHighlight[] = [];
  
  // Add hosting check as CRITICAL error if foreign
  if (hostingCheck.status === "foreign") {
    highlights.push({
      id: "HOSTING-001",
      title: "Иностранный хостинг",
      status: "fail",
      severity: "critical",
      summary: `Сайт размещён на иностранном хостинге (${hostingCheck.providerGuess || "зарубежный провайдер"})`,
      howToFixShort: "Перенести сайт на российский хостинг (Timeweb, Beget, REG.RU и др.)",
      law: [
        { act: "152-ФЗ", ref: "ст. 18 ч. 5 (Локализация ПДн граждан РФ на территории РФ)" },
      ],
    });
    scores.failedCount++;
    scores.scorePercent = Math.max(0, scores.scorePercent - 15);
  } else if (hostingCheck.status === "ru") {
    highlights.push({
      id: "HOSTING-001",
      title: "Российский хостинг",
      status: "ok",
      severity: "low",
      summary: `Сайт размещён на российском хостинге (${hostingCheck.providerGuess || "РФ"})`,
      howToFixShort: undefined,
      law: [
        { act: "152-ФЗ", ref: "ст. 18 ч. 5 (Локализация ПДн)" },
      ],
    });
  }
  
  // Add RKN registry check as CRITICAL error if not registered
  if (rknCheck?.registryCheck && !rknCheck.registryCheck.isRegistered && !rknCheck.registryCheck.error) {
    highlights.unshift({
      id: "RKN-001",
      title: "Не в реестре операторов РКН",
      status: "fail",
      severity: "critical",
      summary: `Организация с ИНН ${rknCheck.query.inn || "не указан"} не найдена в реестре операторов персональных данных Роскомнадзора`,
      howToFixShort: "Подать уведомление в Роскомнадзор о начале обработки персональных данных",
      law: [
        { act: "152-ФЗ", ref: "ст. 22 (Уведомление об обработке ПДн)" },
      ],
    });
    scores.failedCount++;
    scores.scorePercent = Math.max(0, scores.scorePercent - 20);
    scores.severity = "critical";
  } else if (rknCheck?.registryCheck?.isRegistered) {
    highlights.push({
      id: "RKN-001",
      title: "Регистрация в реестре РКН",
      status: "ok",
      severity: "low",
      summary: `Организация зарегистрирована в реестре операторов ПДн${rknCheck.registryCheck.registrationNumber ? ` (№${rknCheck.registryCheck.registrationNumber})` : ""}`,
      howToFixShort: undefined,
      law: [
        { act: "152-ФЗ", ref: "ст. 22 (Уведомление об обработке ПДн)" },
      ],
    });
    scores.passedCount++;
  }
  
  // Add regular checks
  const regularHighlights = checks.slice(0, 11).map(check => {
    let status: "ok" | "warn" | "fail" | "na" = "na";
    if (check.status === "passed") status = "ok";
    else if (check.status === "warning") status = "warn";
    else if (check.status === "failed") status = "fail";

    let severity: "critical" | "medium" | "low" | "info" = "info";
    if (check.status === "failed") severity = "critical";
    else if (check.status === "warning") severity = "medium";
    else severity = "low";

    const lawRefs = check.lawBasis?.map(lb => ({
      act: lb.law === "152" ? "152-ФЗ" : "149-ФЗ",
      ref: lb.article + (lb.note ? ` (${lb.note})` : ""),
    }));

    return {
      id: check.id || check.checkId || check.name.replace(/\s+/g, "_").toUpperCase(),
      title: check.name,
      status,
      severity,
      summary: check.description,
      howToFixShort: check.fixSteps?.[0],
      law: lawRefs,
    };
  });
  
  highlights.push(...regularHighlights);

  const hostingInfo: HostingInfo = {
    status: hostingCheck.status,
    confidence: hostingCheck.confidence,
    ips: hostingCheck.ips,
    providerGuess: hostingCheck.providerGuess,
    evidence: hostingCheck.evidence,
    ai: hostingCheck.ai,
  };
  
  // Adjust severity if hosting is foreign
  if (hostingCheck.status === "foreign") {
    scores.severity = "high";
  }

  return {
    version: "1.0",
    reportType: "express",
    generatedAt: new Date().toISOString(),
    site: { url, domain },
    score: {
      percent: scores.scorePercent,
      severity: scores.severity,
      totals: {
        checks: checks.length + (hostingCheck.status === "foreign" ? 1 : 0),
        ok: scores.passedCount + (hostingCheck.status === "ru" ? 1 : 0),
        warn: scores.warningCount,
        fail: scores.failedCount,
        na: 0,
      },
    },
    hosting: hostingInfo,
    highlights,
    cta: {
      fullReportPriceRub: 900,
      fullReportIncludes: [
        "Подробная карта нарушений по 152-ФЗ и 149-ФЗ",
        "Пошаговый план исправлений",
        "Раздел по рискам и возможной ответственности",
        "Приложения и ссылки на официальные источники",
      ],
    },
  };
}

export async function checkWebsiteExists(url: string): Promise<{ exists: boolean; error?: string }> {
  const data = await fetchWebsite(url, 10000);
  
  if (data.error) {
    if (data.error.includes("ENOTFOUND") || data.error.includes("getaddrinfo")) {
      return { exists: false, error: "Сайт не найден. Проверьте правильность адреса." };
    }
    if (data.error.includes("ECONNREFUSED")) {
      return { exists: false, error: "Сайт не отвечает. Возможно, сервер отключен." };
    }
    if (data.error.includes("timeout") || data.error.includes("Timeout")) {
      return { exists: false, error: "Превышено время ожидания ответа от сайта." };
    }
    if (data.error.includes("CERT") || data.error.includes("SSL")) {
      return { exists: true };
    }
    return { exists: false, error: `Ошибка подключения: ${data.error}` };
  }
  
  if (data.statusCode === 0) {
    return { exists: false, error: "Не удалось подключиться к сайту." };
  }
  
  // Any HTTP response (including 4xx/5xx) means the server exists and responded
  // We only fail if we couldn't connect at all
  return { exists: true };
}

export async function runAudit(
  url: string, 
  options: AuditOptions = {}
): Promise<AuditReport> {
  const { level2 = true, aiMode = "gigachat_only", onProgress } = options;

  onProgress?.(0, []);

  const existsCheck = await checkWebsiteExists(url);
  if (!existsCheck.exists) {
    throw new Error(existsCheck.error || "Сайт недоступен");
  }

  const websiteData = await fetchWebsiteSmart(url);
  
  onProgress?.(1, []);

  const level1Results = runLevel1Checks(websiteData);
  
  onProgress?.(2, level1Results);

  let rknCheck = buildRknCheck(websiteData.html, url);
  const evidenceBundle = buildEvidenceBundle(level1Results, url);

  // If INN was found, perform real RKN registry check
  if (rknCheck.query.inn) {
    try {
      const { checkRknRegistry } = await import("./rkn-parser");
      const registryResult = await checkRknRegistry(rknCheck.query.inn);
      
      rknCheck = {
        ...rknCheck,
        status: registryResult.isRegistered ? "passed" : "failed",
        details: registryResult.details,
        registryCheck: {
          isRegistered: registryResult.isRegistered,
          companyName: registryResult.companyName,
          registrationNumber: registryResult.registrationNumber,
          registrationDate: registryResult.registrationDate,
          error: registryResult.error,
        },
      };
      
      console.log(`[AUDIT] RKN registry check for INN ${rknCheck.query.inn}: ${registryResult.isRegistered ? "REGISTERED" : "NOT REGISTERED"}`);
    } catch (error) {
      console.error("[AUDIT] RKN registry check error:", error);
      rknCheck = {
        ...rknCheck,
        registryCheck: {
          isRegistered: false,
          error: "Не удалось проверить реестр РКН",
        },
      };
    }
  }

  let additionalChecks: AuditCheckResult[] = [];
  let summary = "";
  let recommendations: string[] = [];

  const hostingCheckPromise = checkHosting(url);

  if (level2) {
    onProgress?.(3, level1Results);
    
    const level2Results = await runLevel2Analysis(url, evidenceBundle, level1Results, aiMode);
    additionalChecks = level2Results.additionalChecks;
    summary = level2Results.summary;
    recommendations = level2Results.recommendations;
    
    onProgress?.(4, [...level1Results, ...additionalChecks]);
  }

  const allChecks = [...level1Results, ...additionalChecks];
  const scores = calculateScore(allChecks);

  const hostingCheck = await hostingCheckPromise;

  onProgress?.(5, allChecks);

  if (!summary) {
    const passedPct = Math.round((scores.passedCount / allChecks.length) * 100);
    summary = `Проверено ${allChecks.length} критериев. Пройдено ${scores.passedCount} (${passedPct}%), предупреждений ${scores.warningCount}, нарушений ${scores.failedCount}.`;
  }

  if (recommendations.length === 0) {
    if (scores.failedCount > 0) {
      recommendations.push("Устраните выявленные критические нарушения");
    }
    if (scores.warningCount > 0) {
      recommendations.push("Рекомендуется исправить предупреждения для повышения уровня соответствия");
    }
    if (scores.passedCount === allChecks.length) {
      recommendations.push("Отлично! Сайт соответствует проверенным требованиям");
    }
  }

  onProgress?.(6, allChecks);

  const briefResults = buildBriefResults(url, allChecks, scores, hostingCheck, rknCheck);

  return {
    url,
    checks: allChecks,
    scorePercent: scores.scorePercent,
    severity: scores.severity,
    passedCount: scores.passedCount,
    warningCount: scores.warningCount,
    failedCount: scores.failedCount,
    totalCount: allChecks.length,
    summary,
    recommendations,
    processedAt: new Date(),
    rknCheck,
    evidenceBundle,
    hostingCheck,
    briefResults,
  };
}

export async function runExpressAudit(
  url: string,
  onProgress?: (stage: number, passedCount: number, warningCount: number, failedCount: number) => void
): Promise<AuditReport> {
  const stages = [
    "Подключение к сайту",
    "Проверка SSL сертификата",
    "Анализ политик конфиденциальности",
    "Проверка cookie-баннера",
    "Анализ форм и согласий",
    "Проверка контактов и реквизитов",
    "Формирование отчета",
  ];

  let currentChecks: AuditCheckResult[] = [];
  
  const report = await runAudit(url, {
    level2: false,
    onProgress: (stage, checks) => {
      currentChecks = checks;
      const passed = checks.filter(c => c.status === "passed").length;
      const warnings = checks.filter(c => c.status === "warning").length;
      const failed = checks.filter(c => c.status === "failed").length;
      onProgress?.(stage, passed, warnings, failed);
    },
  });

  return report;
}

// ==================== DEBUG AUDIT WITH CRAWLER ====================

interface PageInfo {
  url: string;
  status: number;
  bytes: number;
  error?: string;
  discoveredFrom?: "sitemap" | "links" | "start";
}

interface CheckEvidence {
  urls: string[];
  markers: string[];
}

interface DebugCheckResult {
  name: string;
  status: "passed" | "warning" | "failed";
  details: string;
  evidence: CheckEvidence;
}

interface RknData {
  innFound: string | null;
  ogrnFound: string | null;
  nameFound: string | null;
  needsCompanyDetails: boolean;
  confidence: "high" | "medium" | "low" | "none";
}

interface DebugAuditResult {
  pages: PageInfo[];
  checks: DebugCheckResult[];
  rkn: RknData;
  debug: {
    pagesCrawled: number;
    pagesFailed: number;
    timeMs: number;
    topErrors: string[];
  };
}

function extractInternalLinks(html: string, baseUrl: URL): string[] {
  const linkPattern = /href\s*=\s*["']([^"'#]+)["']/gi;
  const links: Set<string> = new Set();
  let match;
  
  while ((match = linkPattern.exec(html)) !== null) {
    try {
      const href = match[1];
      if (href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      
      let fullUrl: URL;
      if (href.startsWith("http://") || href.startsWith("https://")) {
        fullUrl = new URL(href);
      } else if (href.startsWith("/")) {
        fullUrl = new URL(href, baseUrl.origin);
      } else {
        fullUrl = new URL(href, baseUrl.href);
      }
      
      if (fullUrl.hostname === baseUrl.hostname) {
        links.add(fullUrl.origin + fullUrl.pathname);
      }
    } catch {}
  }
  
  return Array.from(links).slice(0, 50);
}

async function fetchSitemap(baseUrl: URL): Promise<string[]> {
  const sitemapUrls = [
    `${baseUrl.origin}/sitemap.xml`,
    `${baseUrl.origin}/sitemap_index.xml`,
  ];
  
  for (const sitemapUrl of sitemapUrls) {
    try {
      const data = await fetchWebsite(sitemapUrl, 5000);
      if (data.statusCode === 200 && data.html) {
        const urlMatches = data.html.match(/<loc>([^<]+)<\/loc>/gi) || [];
        return urlMatches
          .map(m => m.replace(/<\/?loc>/gi, ""))
          .filter(u => u.startsWith("http"))
          .slice(0, 30);
      }
    } catch {}
  }
  return [];
}

function checkPrivacyPolicyWithEvidence(html: string, url: string): DebugCheckResult {
  const patterns: { pattern: RegExp; label: string }[] = [
    { pattern: /политик[аи|уыей]\s*конфиденциальности/i, label: "политика конфиденциальности" },
    { pattern: /privacy\s*policy/i, label: "privacy policy" },
    { pattern: /обработк[аиуеой]\s*персональных\s*данных/i, label: "обработка ПДн" },
    { pattern: /защит[аиуеой]\s*персональных\s*данных/i, label: "защита ПДн" },
    { pattern: /href\s*=\s*["'][^"']*privacy[^"']*["']/i, label: "ссылка /privacy" },
    { pattern: /href\s*=\s*["'][^"']*policy[^"']*["']/i, label: "ссылка /policy" },
    { pattern: /href\s*=\s*["'][^"']*конфиденциальност[^"']*["']/i, label: "ссылка конфиденциальность" },
  ];

  const foundMarkers: string[] = [];
  for (const { pattern, label } of patterns) {
    if (pattern.test(html)) {
      foundMarkers.push(label);
    }
  }

  return {
    name: "Политика ПДн",
    status: foundMarkers.length > 0 ? "passed" : "failed",
    details: foundMarkers.length > 0 
      ? `Найдены маркеры: ${foundMarkers.join(", ")}`
      : "Маркеры политики ПДн не найдены. Искались: политика конфиденциальности, privacy policy, обработка ПДн, ссылки /privacy, /policy",
    evidence: {
      urls: [url],
      markers: foundMarkers,
    },
  };
}

function checkConsentWithEvidence(html: string, url: string): DebugCheckResult {
  const formPatterns = [/<form[^>]*>/i, /<input[^>]*type\s*=\s*["'](email|tel|phone|text)["']/i];
  const consentPatterns: { pattern: RegExp; label: string }[] = [
    { pattern: /согласи[еяюо]\s*(на\s*)?(обработку|передачу)/i, label: "согласие на обработку" },
    { pattern: /даю\s*согласие/i, label: "даю согласие" },
    { pattern: /принимаю\s*(условия|политику)/i, label: "принимаю условия" },
    { pattern: /type\s*=\s*["']checkbox["'][^>]*согласи/i, label: "checkbox согласие" },
    { pattern: /персональных?\s*данных?/i, label: "персональные данные" },
  ];

  const hasForm = formPatterns.some(p => p.test(html));
  const foundMarkers: string[] = [];
  
  for (const { pattern, label } of consentPatterns) {
    if (pattern.test(html)) {
      foundMarkers.push(label);
    }
  }

  if (!hasForm) {
    return {
      name: "Согласие в формах",
      status: "passed",
      details: "Формы с email/phone/name не обнаружены на странице",
      evidence: { urls: [url], markers: ["нет форм"] },
    };
  }

  return {
    name: "Согласие в формах",
    status: foundMarkers.length > 0 ? "passed" : "failed",
    details: foundMarkers.length > 0
      ? `Найдены маркеры согласия рядом с формами: ${foundMarkers.join(", ")}`
      : "Формы найдены, но маркеры согласия (согласие/персональн) не обнаружены",
    evidence: {
      urls: [url],
      markers: hasForm ? (foundMarkers.length > 0 ? foundMarkers : ["форма без согласия"]) : [],
    },
  };
}

function checkCookieBannerWithEvidence(html: string, url: string): DebugCheckResult {
  const patterns: { pattern: RegExp; label: string }[] = [
    { pattern: /cookie\s*banner/i, label: "cookie banner class/id" },
    { pattern: /cookie\s*consent/i, label: "cookie consent" },
    { pattern: /accept.*cookie|принять.*cookie/i, label: "accept cookie" },
    { pattern: /использу[ео][тм]\s*cookie/i, label: "используем cookie" },
    { pattern: /мы\s*используем\s*cookie/i, label: "мы используем cookie" },
    { pattern: /файл[аов]*\s*cookie/i, label: "файлы cookie" },
    { pattern: /обработк[аиу]\s*cookie/i, label: "обработка cookie" },
    { pattern: /условия[ми]*\s*.*cookie/i, label: "условия cookie" },
    { pattern: /запретить\s*.*cookie/i, label: "запретить cookie" },
    { pattern: /соглас[а-я]*\s*.*cookie/i, label: "согласие cookie" },
    { pattern: /настрой[а-я]*\s*cookie/i, label: "настройки cookie" },
    { pattern: /политик[аи]\s*cookie/i, label: "политика cookie" },
    { pattern: /<[^>]*>Cookies<\/[^>]*>/i, label: "Cookies заголовок" },
    { pattern: /data-tilda-cookie/i, label: "Tilda cookie system" },
    { pattern: /cookiename/i, label: "cookie popup" },
  ];

  const foundMarkers: string[] = [];
  for (const { pattern, label } of patterns) {
    if (pattern.test(html)) {
      foundMarkers.push(label);
    }
  }

  const jsIndicators = /setCookie|getCookie|cookieConsent|gdpr|gtag.*consent/i.test(html);
  
  let status: "passed" | "warning" | "failed" = "warning";
  let details = "";
  
  if (foundMarkers.length > 0) {
    status = "passed";
    details = `Cookie-баннер обнаружен: ${foundMarkers.join(", ")}`;
  } else if (jsIndicators) {
    status = "warning";
    details = "Возможен JS-баннер (найдены JS-сигналы), но статический HTML не содержит явных маркеров";
    foundMarkers.push("JS indicators present");
  } else {
    status = "warning";
    details = "Cookie-баннер не обнаружен в статическом HTML. Возможно рендерится через JS";
  }

  return {
    name: "Cookie баннер",
    status,
    details,
    evidence: { urls: [url], markers: foundMarkers },
  };
}

function checkContactsWithEvidence(html: string, url: string): DebugCheckResult {
  const foundMarkers: string[] = [];
  
  const phoneMatch = html.match(/\+7\s*\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
  if (phoneMatch) foundMarkers.push(`телефон: ${phoneMatch[0]}`);
  
  const phone8Match = html.match(/8\s*\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
  if (phone8Match && !phoneMatch) foundMarkers.push(`телефон: ${phone8Match[0]}`);
  
  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) foundMarkers.push(`email: ${emailMatch[0]}`);
  
  if (/контакт|связаться|обратная\s*связь/i.test(html)) {
    foundMarkers.push("раздел контактов");
  }

  return {
    name: "Контакты/реквизиты",
    status: foundMarkers.length > 0 ? "passed" : "warning",
    details: foundMarkers.length > 0
      ? `Найдено: ${foundMarkers.join("; ")}`
      : "Контактная информация (email/телефон/адрес) не найдена",
    evidence: { urls: [url], markers: foundMarkers },
  };
}

function extractRknData(html: string): RknData {
  const innMatch = html.match(/инн\s*:?\s*(\d{10,12})/i);
  const ogrnMatch = html.match(/огрн\s*:?\s*(\d{13,15})/i);
  
  let nameFound: string | null = null;
  const oooMatch = html.match(/ооо\s*["«]([^"»]{2,50})["»]/i);
  const ipMatch = html.match(/ип\s+([а-яё]+\s+[а-яё]+\s*[а-яё]*)/i);
  
  if (oooMatch) nameFound = `ООО "${oooMatch[1]}"`;
  else if (ipMatch) nameFound = `ИП ${ipMatch[1]}`;

  const innFound = innMatch ? innMatch[1] : null;
  const ogrnFound = ogrnMatch ? ogrnMatch[1] : null;
  
  let confidence: "high" | "medium" | "low" | "none" = "none";
  if (innFound && ogrnFound && nameFound) confidence = "high";
  else if (innFound || ogrnFound) confidence = "medium";
  else if (nameFound) confidence = "low";

  return {
    innFound,
    ogrnFound,
    nameFound,
    needsCompanyDetails: !innFound && !ogrnFound,
    confidence,
  };
}

export async function runDebugAudit(
  url: string,
  options: { maxPages?: number; depthLimit?: number; timeoutMs?: number } = {}
): Promise<DebugAuditResult> {
  const startTime = Date.now();
  const { maxPages = 30, depthLimit = 2, timeoutMs = 20000 } = options;
  
  const pages: PageInfo[] = [];
  const errors: string[] = [];
  const visited = new Set<string>();
  const allHtml: string[] = [];
  
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      pages: [{ url, status: 0, bytes: 0, error: "Invalid URL" }],
      checks: [],
      rkn: { innFound: null, ogrnFound: null, nameFound: null, needsCompanyDetails: true, confidence: "none" },
      debug: { pagesCrawled: 0, pagesFailed: 1, timeMs: Date.now() - startTime, topErrors: ["Invalid URL"] },
    };
  }

  // Try sitemap first
  const sitemapUrls = await fetchSitemap(parsed);
  const urlsToCrawl: { url: string; source: "sitemap" | "links" | "start" }[] = [];
  
  if (sitemapUrls.length > 0) {
    sitemapUrls.slice(0, maxPages).forEach(u => urlsToCrawl.push({ url: u, source: "sitemap" }));
  } else {
    urlsToCrawl.push({ url, source: "start" });
  }

  // Crawl pages
  for (const item of urlsToCrawl) {
    if (visited.has(item.url)) continue;
    if (pages.length >= maxPages) break;
    if (Date.now() - startTime > timeoutMs) {
      errors.push("Timeout exceeded");
      break;
    }
    
    visited.add(item.url);
    const data = await fetchWebsite(item.url, 8000);
    
    pages.push({
      url: item.url,
      status: data.statusCode,
      bytes: data.html.length,
      error: data.error,
      discoveredFrom: item.source,
    });

    if (data.error) {
      errors.push(`${item.url}: ${data.error}`);
    } else if (data.html) {
      allHtml.push(data.html);
      
      // Extract links from first page if no sitemap
      if (item.source === "start" && sitemapUrls.length === 0) {
        const links = extractInternalLinks(data.html, parsed);
        links.slice(0, maxPages - 1).forEach(link => {
          if (!visited.has(link)) {
            urlsToCrawl.push({ url: link, source: "links" });
          }
        });
      }
    }
  }

  // Combine all HTML for checks
  const combinedHtml = allHtml.join("\n");
  const mainUrl = pages[0]?.url || url;

  // Run checks with evidence
  const checks: DebugCheckResult[] = [
    checkPrivacyPolicyWithEvidence(combinedHtml, mainUrl),
    checkConsentWithEvidence(combinedHtml, mainUrl),
    checkCookieBannerWithEvidence(combinedHtml, mainUrl),
    checkContactsWithEvidence(combinedHtml, mainUrl),
  ];

  // Extract RKN data
  const rkn = extractRknData(combinedHtml);

  return {
    pages,
    checks,
    rkn,
    debug: {
      pagesCrawled: pages.filter(p => !p.error).length,
      pagesFailed: pages.filter(p => p.error).length,
      timeMs: Date.now() - startTime,
      topErrors: errors.slice(0, 5),
    },
  };
}
