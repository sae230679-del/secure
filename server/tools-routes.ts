/**
 * Роутер для 10 платных инструментов /tools
 * Цена: 10₽ за генерацию (кроме бесплатного справочника хостингов)
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { checkDnsWhoisOwnership } from "./checks/dnsWhoisOwnership";
import { validateConsent152, generateConsentText, generateCheckboxHtml, generateConsentJs, type ConsentInput } from "./legal/consent152Validator";
import { runInfo149Checks } from "./legal/info149Checks";
import { checkHosting, checkHostingLayer1 } from "./hosting-checker";
import https from "https";
import http from "http";
import dns from "dns";
import { promisify } from "util";
import tls from "tls";

const dnsResolve4 = promisify(dns.resolve4);

export const toolsRouter = Router();

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

interface ToolUsageRecord {
  toolKey: string;
  userId: number | null;
  sessionId: string | null;
  inputData: any;
  outputData: any;
  isPaid: boolean;
}

async function logToolUsage(record: ToolUsageRecord): Promise<void> {
  try {
    await storage.logToolUsage(record);
  } catch (e) {
    console.warn("[TOOLS] Failed to log usage:", e);
  }
}

function normalizeUrl(input: string): string {
  let url = input.trim().toLowerCase();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url.replace(/\/$/, "");
}

function extractDomain(input: string): string {
  try {
    const url = new URL(normalizeUrl(input));
    return url.hostname;
  } catch {
    return input.replace(/^(https?:\/\/)?/, "").split("/")[0];
  }
}

async function fetchHtml(url: string, timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;
    
    const req = client.get(url, {
      timeout,
      headers: {
        "User-Agent": "SecureLex-Bot/1.0 (compliance-check)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8"
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHtml(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// ============================================
// Tool 1: Privacy Policy Generator
// ============================================
const privacyGeneratorSchema = z.object({
  operatorName: z.string().min(3, "Укажите наименование организации"),
  operatorInn: z.string().optional(),
  operatorAddress: z.string().min(10, "Укажите полный адрес"),
  operatorEmail: z.string().email("Укажите корректный email"),
  websiteUrl: z.string().url("Укажите URL сайта"),
  pdnTypes: z.array(z.string()).min(1, "Укажите типы ПДн"),
  purposes: z.array(z.string()).min(1, "Укажите цели обработки"),
  thirdParties: z.array(z.string()).optional(),
  storagePeriod: z.string().min(3, "Укажите срок хранения"),
  crossBorder: z.boolean().optional(),
});

toolsRouter.post("/privacy-generator", async (req: Request, res: Response) => {
  try {
    const input = privacyGeneratorSchema.parse(req.body);
    
    const thirdPartiesText = input.thirdParties?.length 
      ? `\n\n6. Передача персональных данных третьим лицам\n\nОператор вправе передавать персональные данные следующим третьим лицам:\n${input.thirdParties.map((t, i) => `${i + 1}) ${t}`).join("\n")}\n\nПередача осуществляется на основании договоров с соответствующими условиями конфиденциальности.`
      : "";
    
    const crossBorderText = input.crossBorder 
      ? "\n\n7. Трансграничная передача\n\nОператор осуществляет трансграничную передачу персональных данных в страны, обеспечивающие адекватную защиту прав субъектов персональных данных."
      : "";
    
    const policy = `ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ
${input.websiteUrl}

Дата публикации: ${new Date().toLocaleDateString("ru-RU")}

1. Общие положения

Настоящая Политика конфиденциальности (далее — Политика) определяет порядок обработки и защиты персональных данных пользователей сайта ${input.websiteUrl}.

Оператор персональных данных:
${input.operatorName}${input.operatorInn ? ` (ИНН: ${input.operatorInn})` : ""}
Адрес: ${input.operatorAddress}
Email: ${input.operatorEmail}

2. Категории обрабатываемых персональных данных

Оператор обрабатывает следующие категории персональных данных:
${input.pdnTypes.map((t, i) => `${i + 1}) ${t}`).join("\n")}

3. Цели обработки персональных данных

Персональные данные обрабатываются в следующих целях:
${input.purposes.map((p, i) => `${i + 1}) ${p}`).join("\n")}

4. Правовые основания обработки

Обработка персональных данных осуществляется на следующих правовых основаниях:
- согласие субъекта персональных данных (ст. 6 ч. 1 п. 1 152-ФЗ);
- исполнение договора с субъектом персональных данных (ст. 6 ч. 1 п. 5 152-ФЗ);
- исполнение обязанностей, возложенных на оператора законодательством (ст. 6 ч. 1 п. 2 152-ФЗ).

5. Сроки обработки персональных данных

Персональные данные хранятся и обрабатываются в течение следующего срока: ${input.storagePeriod}.

По истечении срока хранения персональные данные уничтожаются.
${thirdPartiesText}${crossBorderText}

${input.crossBorder ? "8" : input.thirdParties?.length ? "7" : "6"}. Права субъектов персональных данных

Субъект персональных данных имеет право:
- получить информацию, касающуюся обработки его персональных данных;
- требовать уточнения, блокирования или уничтожения персональных данных;
- отозвать согласие на обработку персональных данных;
- обжаловать действия или бездействие Оператора в уполномоченный орган (Роскомнадзор).

${input.crossBorder ? "9" : input.thirdParties?.length ? "8" : "7"}. Меры по защите персональных данных

Оператор принимает необходимые правовые, организационные и технические меры для защиты персональных данных от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, предоставления, распространения, а также от иных неправомерных действий в соответствии с требованиями 152-ФЗ.

${input.crossBorder ? "10" : input.thirdParties?.length ? "9" : "8"}. Контактная информация

По вопросам обработки персональных данных обращайтесь:
Email: ${input.operatorEmail}
Адрес: ${input.operatorAddress}

${input.crossBorder ? "11" : input.thirdParties?.length ? "10" : "9"}. Заключительные положения

Настоящая Политика является публичным документом и размещается на сайте ${input.websiteUrl}.
Оператор вправе вносить изменения в настоящую Политику.

Основание: Федеральный закон от 27.07.2006 № 152-ФЗ "О персональных данных"`;

    await logToolUsage({
      toolKey: "privacy-generator",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { length: policy.length },
      isPaid: false, // TODO: integrate payment
    });

    res.json({ 
      success: true, 
      policy,
      format: "text",
      lawBasis: "152-ФЗ ст. 18.1"
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] privacy-generator error:", error);
    res.status(500).json({ success: false, error: "Ошибка генерации" });
  }
});

// ============================================
// Tool 2: Consent Generator (согласие на ПДн)
// ============================================
const consentGeneratorSchema = z.object({
  mode: z.enum(["website_checkbox", "written"]),
  operatorName: z.string().min(3),
  operatorInn: z.string().optional(),
  operatorAddress: z.string().min(10),
  operatorContact: z.string().optional(),
  purposes: z.array(z.string()).min(1),
  pdnCategories: z.array(z.string()).min(1),
  processingActions: z.array(z.string()).min(1),
  thirdParties: z.array(z.string()).optional(),
  storagePeriod: z.string().min(3),
  terminationConditions: z.string().optional(),
  withdrawalProcedure: z.string().min(10),
  subjectName: z.string().optional(),
  subjectDocument: z.string().optional(),
  hasSignature: z.boolean().optional(),
});

toolsRouter.post("/consent-generator", async (req: Request, res: Response) => {
  try {
    const input = consentGeneratorSchema.parse(req.body);
    
    const consentInput: ConsentInput = {
      mode: input.mode,
      operatorName: input.operatorName,
      operatorInn: input.operatorInn,
      operatorAddress: input.operatorAddress,
      operatorContact: input.operatorContact,
      purposes: input.purposes,
      pdnCategories: input.pdnCategories,
      processingActions: input.processingActions,
      thirdParties: input.thirdParties,
      storagePeriod: input.storagePeriod,
      terminationConditions: input.terminationConditions,
      withdrawalProcedure: input.withdrawalProcedure,
      subjectName: input.subjectName,
      subjectDocument: input.subjectDocument,
      hasSignature: input.hasSignature,
    };
    
    const validation = validateConsent152(consentInput);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        validation,
        error: "Согласие не соответствует требованиям 152-ФЗ"
      });
    }
    
    const result: any = { success: true, validation };
    
    if (input.mode === "website_checkbox") {
      result.html = generateCheckboxHtml(consentInput);
      result.js = generateConsentJs();
    } else {
      result.text = generateConsentText(consentInput);
    }
    
    await logToolUsage({
      toolKey: "consent-generator",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { mode: input.mode, valid: validation.isValid },
      isPaid: false,
    });
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] consent-generator error:", error);
    res.status(500).json({ success: false, error: "Ошибка генерации" });
  }
});

// ============================================
// Tool 3: Cookie Banner Generator
// ============================================
const cookieBannerSchema = z.object({
  siteName: z.string().min(2),
  privacyPolicyUrl: z.string().url(),
  analyticsEnabled: z.boolean().default(true),
  marketingEnabled: z.boolean().default(false),
  language: z.enum(["ru", "en"]).default("ru"),
  position: z.enum(["bottom", "top", "center"]).default("bottom"),
  theme: z.enum(["light", "dark", "auto"]).default("auto"),
});

toolsRouter.post("/cookie-banner", async (req: Request, res: Response) => {
  try {
    const input = cookieBannerSchema.parse(req.body);
    
    const texts = input.language === "ru" ? {
      title: "Использование файлов cookie",
      description: `Сайт ${input.siteName} использует файлы cookie для улучшения работы сайта и персонализации контента.`,
      necessary: "Необходимые",
      analytics: "Аналитические",
      marketing: "Маркетинговые",
      acceptAll: "Принять все",
      acceptNecessary: "Только необходимые",
      settings: "Настройки",
      save: "Сохранить",
      privacyLink: "Политика конфиденциальности"
    } : {
      title: "Cookie Usage",
      description: `${input.siteName} uses cookies to improve site functionality and personalize content.`,
      necessary: "Necessary",
      analytics: "Analytics",
      marketing: "Marketing",
      acceptAll: "Accept All",
      acceptNecessary: "Necessary Only",
      settings: "Settings",
      save: "Save",
      privacyLink: "Privacy Policy"
    };
    
    const positionStyles = {
      bottom: "bottom: 0; left: 0; right: 0;",
      top: "top: 0; left: 0; right: 0;",
      center: "top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: 500px;"
    };
    
    const html = `<!-- Cookie Consent Banner - 152-ФЗ / GDPR Compliant -->
<div id="cookie-consent-banner" class="cookie-banner cookie-banner--${input.theme}" style="position: fixed; ${positionStyles[input.position]} z-index: 99999; padding: 16px; background: var(--cookie-bg, #fff); box-shadow: 0 -2px 10px rgba(0,0,0,0.1); display: none;">
  <div class="cookie-banner__content">
    <h3 class="cookie-banner__title">${texts.title}</h3>
    <p class="cookie-banner__text">${texts.description}</p>
    
    <div class="cookie-banner__options" id="cookie-options" style="display: none; margin: 12px 0;">
      <label class="cookie-option">
        <input type="checkbox" name="cookie_necessary" checked disabled data-testid="checkbox-cookie-necessary" />
        <span>${texts.necessary}</span>
      </label>
      ${input.analyticsEnabled ? `<label class="cookie-option">
        <input type="checkbox" name="cookie_analytics" id="cookie_analytics" data-testid="checkbox-cookie-analytics" />
        <span>${texts.analytics}</span>
      </label>` : ""}
      ${input.marketingEnabled ? `<label class="cookie-option">
        <input type="checkbox" name="cookie_marketing" id="cookie_marketing" data-testid="checkbox-cookie-marketing" />
        <span>${texts.marketing}</span>
      </label>` : ""}
    </div>
    
    <div class="cookie-banner__actions" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
      <button type="button" id="cookie-accept-all" class="cookie-btn cookie-btn--primary" data-testid="button-cookie-accept-all">${texts.acceptAll}</button>
      <button type="button" id="cookie-accept-necessary" class="cookie-btn cookie-btn--secondary" data-testid="button-cookie-accept-necessary">${texts.acceptNecessary}</button>
      <button type="button" id="cookie-settings-toggle" class="cookie-btn cookie-btn--link" data-testid="button-cookie-settings">${texts.settings}</button>
      <button type="button" id="cookie-save" class="cookie-btn cookie-btn--primary" style="display: none;" data-testid="button-cookie-save">${texts.save}</button>
    </div>
    
    <a href="${input.privacyPolicyUrl}" class="cookie-banner__link" target="_blank" rel="noopener" data-testid="link-privacy-policy">${texts.privacyLink}</a>
  </div>
</div>`;

    const css = `.cookie-banner { font-family: system-ui, -apple-system, sans-serif; }
.cookie-banner--light { --cookie-bg: #fff; --cookie-text: #333; --cookie-primary: #2563eb; }
.cookie-banner--dark { --cookie-bg: #1f2937; --cookie-text: #f3f4f6; --cookie-primary: #3b82f6; }
.cookie-banner--auto { --cookie-bg: light-dark(#fff, #1f2937); --cookie-text: light-dark(#333, #f3f4f6); }
.cookie-banner__title { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: var(--cookie-text); }
.cookie-banner__text { margin: 0; font-size: 14px; color: var(--cookie-text); opacity: 0.9; }
.cookie-option { display: flex; align-items: center; gap: 8px; margin: 8px 0; color: var(--cookie-text); font-size: 14px; }
.cookie-btn { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; transition: opacity 0.2s; }
.cookie-btn:hover { opacity: 0.9; }
.cookie-btn--primary { background: var(--cookie-primary); color: #fff; }
.cookie-btn--secondary { background: transparent; border: 1px solid var(--cookie-primary); color: var(--cookie-primary); }
.cookie-btn--link { background: none; color: var(--cookie-primary); text-decoration: underline; padding: 8px 0; }
.cookie-banner__link { display: block; margin-top: 12px; font-size: 12px; color: var(--cookie-primary); }`;

    const js = `(function() {
  var COOKIE_NAME = 'cookie_consent';
  var banner = document.getElementById('cookie-consent-banner');
  var optionsDiv = document.getElementById('cookie-options');
  var saveBtn = document.getElementById('cookie-save');
  
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? JSON.parse(decodeURIComponent(match[2])) : null;
  }
  
  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(JSON.stringify(value)) + '; expires=' + expires + '; path=/; SameSite=Lax';
  }
  
  function applyConsent(consent) {
    if (consent.analytics) {
      document.dispatchEvent(new CustomEvent('cookie-consent-analytics', { detail: true }));
    }
    if (consent.marketing) {
      document.dispatchEvent(new CustomEvent('cookie-consent-marketing', { detail: true }));
    }
  }
  
  function saveConsent(consent) {
    setCookie(COOKIE_NAME, consent, 365);
    applyConsent(consent);
    banner.style.display = 'none';
  }
  
  var existing = getCookie(COOKIE_NAME);
  if (existing) {
    applyConsent(existing);
  } else {
    banner.style.display = 'block';
  }
  
  document.getElementById('cookie-accept-all').onclick = function() {
    saveConsent({ necessary: true, analytics: true, marketing: true });
  };
  
  document.getElementById('cookie-accept-necessary').onclick = function() {
    saveConsent({ necessary: true, analytics: false, marketing: false });
  };
  
  document.getElementById('cookie-settings-toggle').onclick = function() {
    optionsDiv.style.display = optionsDiv.style.display === 'none' ? 'block' : 'none';
    saveBtn.style.display = optionsDiv.style.display;
    this.style.display = optionsDiv.style.display === 'none' ? 'inline' : 'none';
  };
  
  document.getElementById('cookie-save').onclick = function() {
    var analytics = document.getElementById('cookie_analytics');
    var marketing = document.getElementById('cookie_marketing');
    saveConsent({
      necessary: true,
      analytics: analytics ? analytics.checked : false,
      marketing: marketing ? marketing.checked : false
    });
  };
})();`;

    await logToolUsage({
      toolKey: "cookie-banner",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { generated: true },
      isPaid: false,
    });

    res.json({ 
      success: true, 
      html, 
      css, 
      js,
      lawBasis: "152-ФЗ, GDPR Art. 6-7"
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] cookie-banner error:", error);
    res.status(500).json({ success: false, error: "Ошибка генерации" });
  }
});

// ============================================
// Tool 4: SEO Audit
// ============================================
const seoAuditSchema = z.object({
  url: z.string().min(3),
});

toolsRouter.post("/seo-audit", async (req: Request, res: Response) => {
  try {
    const input = seoAuditSchema.parse(req.body);
    const url = normalizeUrl(input.url);
    
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: "Не удалось загрузить страницу" 
      });
    }
    
    const checks: Array<{ name: string; status: "ok" | "warn" | "fail"; value: string | null; recommendation?: string }> = [];
    
    // Title check
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    checks.push({
      name: "Title",
      status: title ? (title.length > 10 && title.length < 70 ? "ok" : "warn") : "fail",
      value: title,
      recommendation: !title ? "Добавьте уникальный title для страницы" : 
        title.length < 10 ? "Title слишком короткий (рекомендуется 30-60 символов)" :
        title.length > 70 ? "Title слишком длинный (рекомендуется до 60 символов)" : undefined
    });
    
    // Meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : null;
    checks.push({
      name: "Meta Description",
      status: description ? (description.length > 50 && description.length < 160 ? "ok" : "warn") : "fail",
      value: description?.substring(0, 100) + (description && description.length > 100 ? "..." : ""),
      recommendation: !description ? "Добавьте meta description" :
        description.length < 50 ? "Описание слишком короткое" :
        description.length > 160 ? "Описание слишком длинное для сниппета" : undefined
    });
    
    // H1 check
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h1 = h1Match ? h1Match[1].trim() : null;
    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
    checks.push({
      name: "H1",
      status: h1 ? (h1Count === 1 ? "ok" : "warn") : "fail",
      value: h1,
      recommendation: !h1 ? "Добавьте заголовок H1" : 
        h1Count > 1 ? `Найдено ${h1Count} тегов H1, рекомендуется один` : undefined
    });
    
    // Canonical URL
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const canonical = canonicalMatch ? canonicalMatch[1] : null;
    checks.push({
      name: "Canonical URL",
      status: canonical ? "ok" : "warn",
      value: canonical,
      recommendation: !canonical ? "Добавьте canonical URL для предотвращения дублей" : undefined
    });
    
    // Open Graph
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["']/i);
    const ogImage = html.match(/<meta[^>]+property=["']og:image["']/i);
    checks.push({
      name: "Open Graph",
      status: ogTitle && ogImage ? "ok" : "warn",
      value: ogTitle ? "Настроен" : "Не настроен",
      recommendation: !ogTitle || !ogImage ? "Добавьте og:title и og:image для соцсетей" : undefined
    });
    
    // Viewport
    const viewport = html.match(/<meta[^>]+name=["']viewport["']/i);
    checks.push({
      name: "Viewport (мобильная версия)",
      status: viewport ? "ok" : "fail",
      value: viewport ? "Настроен" : "Отсутствует",
      recommendation: !viewport ? "Добавьте meta viewport для мобильных устройств" : undefined
    });
    
    // Images alt
    const images = html.match(/<img[^>]+>/gi) || [];
    const imagesWithAlt = images.filter(img => /alt=["'][^"']+["']/i.test(img));
    checks.push({
      name: "Alt-теги изображений",
      status: images.length === 0 ? "ok" : (imagesWithAlt.length / images.length > 0.8 ? "ok" : "warn"),
      value: `${imagesWithAlt.length}/${images.length}`,
      recommendation: images.length > 0 && imagesWithAlt.length < images.length ? 
        "Добавьте alt-атрибуты ко всем изображениям" : undefined
    });
    
    // HTTPS
    const isHttps = url.startsWith("https://");
    checks.push({
      name: "HTTPS",
      status: isHttps ? "ok" : "fail",
      value: isHttps ? "Да" : "Нет",
      recommendation: !isHttps ? "Переведите сайт на HTTPS" : undefined
    });
    
    const score = Math.round((checks.filter(c => c.status === "ok").length / checks.length) * 100);
    
    await logToolUsage({
      toolKey: "seo-audit",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { score, checksCount: checks.length },
      isPaid: false,
    });
    
    res.json({
      success: true,
      url,
      score,
      checks,
      summary: {
        ok: checks.filter(c => c.status === "ok").length,
        warn: checks.filter(c => c.status === "warn").length,
        fail: checks.filter(c => c.status === "fail").length,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] seo-audit error:", error);
    res.status(500).json({ success: false, error: "Ошибка анализа" });
  }
});

// ============================================
// Tool 5: CMS Detector
// ============================================
const cmsDetectorSchema = z.object({
  url: z.string().min(3),
});

const CMS_SIGNATURES: Array<{ name: string; patterns: RegExp[]; generator?: RegExp }> = [
  { 
    name: "WordPress", 
    patterns: [/wp-content/i, /wp-includes/i, /wp-json/i],
    generator: /WordPress/i
  },
  { 
    name: "Joomla", 
    patterns: [/\/components\/com_/i, /\/media\/jui\//i],
    generator: /Joomla/i
  },
  { 
    name: "Drupal", 
    patterns: [/\/sites\/default\/files/i, /Drupal\.settings/i],
    generator: /Drupal/i
  },
  { 
    name: "1C-Bitrix", 
    patterns: [/bitrix\//i, /BX\./i, /bxUri/i]
  },
  { 
    name: "MODX", 
    patterns: [/assets\/components/i],
    generator: /MODX/i
  },
  { 
    name: "OpenCart", 
    patterns: [/catalog\/view/i, /route=common/i]
  },
  { 
    name: "Tilda", 
    patterns: [/tilda/i, /t-records/i, /t-cover/i]
  },
  { 
    name: "Wix", 
    patterns: [/wix\.com/i, /wixstatic\.com/i]
  },
  { 
    name: "Squarespace", 
    patterns: [/squarespace/i, /sqsp/i]
  },
  { 
    name: "Shopify", 
    patterns: [/cdn\.shopify/i, /shopify/i]
  },
  { 
    name: "Next.js", 
    patterns: [/__NEXT_DATA__/i, /_next\//i]
  },
  { 
    name: "Nuxt.js", 
    patterns: [/__NUXT__/i, /_nuxt\//i]
  },
];

toolsRouter.post("/cms-detector", async (req: Request, res: Response) => {
  try {
    const input = cmsDetectorSchema.parse(req.body);
    const url = normalizeUrl(input.url);
    
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: "Не удалось загрузить страницу" 
      });
    }
    
    const detected: Array<{ name: string; confidence: number; evidence: string[] }> = [];
    
    // Check generator meta tag
    const generatorMatch = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
    const generator = generatorMatch ? generatorMatch[1] : null;
    
    for (const cms of CMS_SIGNATURES) {
      const evidence: string[] = [];
      let matchCount = 0;
      
      // Check generator first
      if (generator && cms.generator && cms.generator.test(generator)) {
        evidence.push(`Generator: ${generator}`);
        matchCount += 2;
      }
      
      // Check patterns
      for (const pattern of cms.patterns) {
        if (pattern.test(html)) {
          evidence.push(`Паттерн: ${pattern.source.substring(0, 30)}`);
          matchCount++;
        }
      }
      
      if (matchCount > 0) {
        detected.push({
          name: cms.name,
          confidence: Math.min(matchCount / cms.patterns.length, 1),
          evidence
        });
      }
    }
    
    // Sort by confidence
    detected.sort((a, b) => b.confidence - a.confidence);
    
    await logToolUsage({
      toolKey: "cms-detector",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { detected: detected.map(d => d.name) },
      isPaid: false,
    });
    
    res.json({
      success: true,
      url,
      generator,
      detected: detected.slice(0, 3),
      primaryCms: detected[0]?.name || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] cms-detector error:", error);
    res.status(500).json({ success: false, error: "Ошибка анализа" });
  }
});

// ============================================
// Tool 6: WHOIS Lookup
// ============================================
const whoisLookupSchema = z.object({
  domain: z.string().min(3),
});

toolsRouter.post("/whois-lookup", async (req: Request, res: Response) => {
  try {
    const input = whoisLookupSchema.parse(req.body);
    const domain = extractDomain(input.domain);
    
    const result = await checkDnsWhoisOwnership(domain);
    
    await logToolUsage({
      toolKey: "whois-lookup",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { status: result.status },
      isPaid: false,
    });
    
    res.json({
      success: true,
      domain,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] whois-lookup error:", error);
    res.status(500).json({ success: false, error: "Ошибка запроса WHOIS" });
  }
});

// ============================================
// Tool 7: SSL Checker
// ============================================
const sslCheckerSchema = z.object({
  url: z.string().min(3),
});

interface SSLInfo {
  valid: boolean;
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  protocol: string | null;
  cipher: string | null;
  warnings: string[];
}

async function checkSSL(hostname: string): Promise<SSLInfo> {
  return new Promise((resolve) => {
    const warnings: string[] = [];
    
    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      timeout: 10000,
    }, () => {
      const cert = socket.getPeerCertificate();
      const cipher = socket.getCipher();
      const protocol = socket.getProtocol();
      
      let validFrom: Date | null = null;
      let validTo: Date | null = null;
      let daysRemaining: number | null = null;
      
      if (cert.valid_from) {
        validFrom = new Date(cert.valid_from);
      }
      if (cert.valid_to) {
        validTo = new Date(cert.valid_to);
        daysRemaining = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining < 30) {
          warnings.push("Сертификат истекает менее чем через 30 дней");
        }
        if (daysRemaining < 0) {
          warnings.push("Сертификат просрочен!");
        }
      }
      
      if (protocol && ["TLSv1", "TLSv1.1"].includes(protocol)) {
        warnings.push(`Устаревший протокол ${protocol}`);
      }
      
      socket.destroy();
      
      resolve({
        valid: socket.authorized,
        issuer: cert.issuer?.O || cert.issuer?.CN || null,
        subject: cert.subject?.CN || null,
        validFrom: validFrom?.toISOString() || null,
        validTo: validTo?.toISOString() || null,
        daysRemaining,
        protocol: protocol || null,
        cipher: cipher?.name || null,
        warnings,
      });
    });
    
    socket.on("error", (err) => {
      socket.destroy();
      resolve({
        valid: false,
        issuer: null,
        subject: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        protocol: null,
        cipher: null,
        warnings: [`Ошибка SSL: ${err.message}`],
      });
    });
    
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        valid: false,
        issuer: null,
        subject: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        protocol: null,
        cipher: null,
        warnings: ["Таймаут подключения"],
      });
    });
  });
}

toolsRouter.post("/ssl-checker", async (req: Request, res: Response) => {
  try {
    const input = sslCheckerSchema.parse(req.body);
    const hostname = extractDomain(input.url);
    
    const sslInfo = await checkSSL(hostname);
    
    await logToolUsage({
      toolKey: "ssl-checker",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { valid: sslInfo.valid, daysRemaining: sslInfo.daysRemaining },
      isPaid: false,
    });
    
    res.json({
      success: true,
      hostname,
      ssl: sslInfo,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] ssl-checker error:", error);
    res.status(500).json({ success: false, error: "Ошибка проверки SSL" });
  }
});

// ============================================
// Tool 8: RKN Registry Check
// ============================================
const rknCheckSchema = z.object({
  inn: z.string().regex(/^\d{10}|\d{12}$/, "ИНН должен содержать 10 или 12 цифр"),
});

toolsRouter.post("/rkn-check", async (req: Request, res: Response) => {
  try {
    const input = rknCheckSchema.parse(req.body);
    
    // Check our cached RKN registry data
    const cached = await storage.getRknCacheByInn(input.inn);
    
    let result: {
      found: boolean;
      registryNumber: string | null;
      operatorName: string | null;
      registrationDate: string | null;
      isRegistered: boolean;
      lastChecked: string;
    };
    
    if (cached) {
      result = {
        found: cached.isRegistered,
        registryNumber: cached.registrationNumber,
        operatorName: cached.companyName,
        registrationDate: cached.registrationDate,
        isRegistered: cached.isRegistered,
        lastChecked: cached.lastCheckedAt?.toISOString() || new Date().toISOString(),
      };
    } else {
      result = {
        found: false,
        registryNumber: null,
        operatorName: null,
        registrationDate: null,
        isRegistered: false,
        lastChecked: new Date().toISOString(),
      };
    }
    
    await logToolUsage({
      toolKey: "rkn-check",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { found: result.found },
      isPaid: false,
    });
    
    res.json({
      success: true,
      inn: input.inn,
      ...result,
      note: result.found 
        ? "Организация зарегистрирована в реестре операторов ПДн" 
        : "Организация не найдена в кэше реестра. Рекомендуем проверить на pd.rkn.gov.ru",
      lawBasis: "ч. 1 ст. 22 152-ФЗ",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] rkn-check error:", error);
    res.status(500).json({ success: false, error: "Ошибка проверки" });
  }
});

// ============================================
// Tool 9: Font Localizer
// ============================================
const fontLocalizerSchema = z.object({
  url: z.string().min(3),
});

const FOREIGN_FONT_SOURCES = [
  { pattern: /fonts\.googleapis\.com/i, name: "Google Fonts", replacement: "Самохостинг или system-ui" },
  { pattern: /fonts\.gstatic\.com/i, name: "Google Fonts CDN", replacement: "Локальные @font-face" },
  { pattern: /use\.typekit\.net/i, name: "Adobe Fonts (Typekit)", replacement: "Локальные @font-face" },
  { pattern: /fast\.fonts\.net/i, name: "Fonts.com", replacement: "Локальные шрифты" },
  { pattern: /cloud\.typography\.com/i, name: "Cloud.typography", replacement: "Локальные @font-face" },
  { pattern: /rsms\.me\/inter/i, name: "Inter (rsms)", replacement: "Самохостинг Inter" },
];

const RUSSIAN_FONT_ALTERNATIVES = [
  { category: "Без засечек", fonts: ["PT Sans", "Golos Text", "Roboto (self-hosted)", "Stem"] },
  { category: "С засечками", fonts: ["PT Serif", "Literata", "Noto Serif"] },
  { category: "Моноширинный", fonts: ["PT Mono", "JetBrains Mono (self-hosted)", "Fira Code (self-hosted)"] },
  { category: "Системные", fonts: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
];

toolsRouter.post("/font-localizer", async (req: Request, res: Response) => {
  try {
    const input = fontLocalizerSchema.parse(req.body);
    const url = normalizeUrl(input.url);
    
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: "Не удалось загрузить страницу" 
      });
    }
    
    const foreignFonts: Array<{ source: string; type: string; replacement: string }> = [];
    
    for (const { pattern, name, replacement } of FOREIGN_FONT_SOURCES) {
      const matches = html.match(new RegExp(pattern.source, "gi"));
      if (matches) {
        foreignFonts.push({
          source: name,
          type: "external",
          replacement,
        });
      }
    }
    
    // Check for inline Google Fonts in CSS
    const inlineStyles = html.match(/@import\s+url\([^)]+fonts\.googleapis[^)]+\)/gi);
    if (inlineStyles) {
      foreignFonts.push({
        source: "Google Fonts (inline @import)",
        type: "inline",
        replacement: "Замените на локальные @font-face",
      });
    }
    
    await logToolUsage({
      toolKey: "font-localizer",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: input,
      outputData: { foreignCount: foreignFonts.length },
      isPaid: false,
    });
    
    res.json({
      success: true,
      url,
      foreignFonts,
      hasIssues: foreignFonts.length > 0,
      alternatives: RUSSIAN_FONT_ALTERNATIVES,
      recommendation: foreignFonts.length > 0 
        ? "Замените внешние шрифты на локальные для соответствия требованиям о локализации данных"
        : "Внешние шрифты не обнаружены",
      lawBasis: "152-ФЗ (локализация данных), 149-ФЗ",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] font-localizer error:", error);
    res.status(500).json({ success: false, error: "Ошибка анализа" });
  }
});

// ============================================
// Tool 10: Russian Hosting Directory (FREE)
// ============================================
const RUSSIAN_HOSTINGS = [
  { 
    name: "Selectel", 
    url: "https://selectel.ru", 
    types: ["VPS", "Dedicated", "Cloud", "Object Storage"],
    datacenters: ["Москва", "Санкт-Петербург"],
    compliance: ["152-ФЗ", "ГОСТ Р 57580"],
    minPrice: "от 50₽/мес"
  },
  { 
    name: "REG.RU", 
    url: "https://reg.ru", 
    types: ["Shared", "VPS", "Dedicated"],
    datacenters: ["Москва"],
    compliance: ["152-ФЗ"],
    minPrice: "от 99₽/мес"
  },
  { 
    name: "Timeweb", 
    url: "https://timeweb.ru", 
    types: ["Shared", "VPS", "Dedicated"],
    datacenters: ["Санкт-Петербург"],
    compliance: ["152-ФЗ"],
    minPrice: "от 89₽/мес"
  },
  { 
    name: "Beget", 
    url: "https://beget.com", 
    types: ["Shared", "VPS"],
    datacenters: ["Санкт-Петербург", "Москва"],
    compliance: ["152-ФЗ"],
    minPrice: "от 105₽/мес"
  },
  { 
    name: "Yandex Cloud", 
    url: "https://cloud.yandex.ru", 
    types: ["Cloud", "Kubernetes", "Object Storage", "Serverless"],
    datacenters: ["Москва", "Франкфурт", "Израиль"],
    compliance: ["152-ФЗ", "ISO 27001"],
    minPrice: "Pay-as-you-go"
  },
  { 
    name: "VK Cloud", 
    url: "https://cloud.vk.com", 
    types: ["Cloud", "Kubernetes", "Object Storage"],
    datacenters: ["Москва"],
    compliance: ["152-ФЗ", "PCI DSS"],
    minPrice: "Pay-as-you-go"
  },
  { 
    name: "SberCloud", 
    url: "https://cloud.ru", 
    types: ["Cloud", "Enterprise"],
    datacenters: ["Москва"],
    compliance: ["152-ФЗ", "ГОСТ Р 57580", "PCI DSS"],
    minPrice: "Enterprise"
  },
  { 
    name: "RUVDS", 
    url: "https://ruvds.com", 
    types: ["VPS", "Dedicated"],
    datacenters: ["Москва", "Санкт-Петербург", "Казань"],
    compliance: ["152-ФЗ"],
    minPrice: "от 25₽/мес"
  },
  { 
    name: "FirstVDS", 
    url: "https://firstvds.ru", 
    types: ["VPS", "Dedicated"],
    datacenters: ["Москва"],
    compliance: ["152-ФЗ"],
    minPrice: "от 100₽/мес"
  },
  { 
    name: "SpaceWeb", 
    url: "https://sweb.ru", 
    types: ["Shared", "VPS", "Dedicated"],
    datacenters: ["Москва"],
    compliance: ["152-ФЗ"],
    minPrice: "от 59₽/мес"
  },
];

toolsRouter.get("/hosting-recommendations", async (req: Request, res: Response) => {
  await logToolUsage({
    toolKey: "hosting-recommendations",
    userId: req.session.userId || null,
    sessionId: req.sessionID,
    inputData: {},
    outputData: { count: RUSSIAN_HOSTINGS.length },
    isPaid: false,
  });
  
  res.json({
    success: true,
    hostings: RUSSIAN_HOSTINGS,
    note: "Все провайдеры имеют ЦОД в России и сертифицированы по 152-ФЗ",
    lastUpdated: "2024-12-01",
  });
});

// Check hosting for a specific URL
toolsRouter.post("/hosting-check", async (req: Request, res: Response) => {
  try {
    const { url } = z.object({ url: z.string().min(3) }).parse(req.body);
    
    const result = await checkHosting(normalizeUrl(url));
    
    await logToolUsage({
      toolKey: "hosting-check",
      userId: req.session.userId || null,
      sessionId: req.sessionID,
      inputData: { url },
      outputData: { status: result.status, confidence: result.confidence },
      isPaid: false,
    });
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[TOOLS] hosting-check error:", error);
    res.status(500).json({ success: false, error: "Ошибка проверки" });
  }
});

// Get all available tools
toolsRouter.get("/", async (req: Request, res: Response) => {
  const tools = await storage.getAllToolConfigs();
  res.json({
    success: true,
    tools: tools.map(t => ({
      key: t.toolKey,
      name: t.displayName,
      description: t.description,
      price: t.price,
      isFree: t.isFree,
      enabled: t.isEnabled,
    })),
  });
});
