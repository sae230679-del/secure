/**
 * Проверки по ФЗ-149 "Об информации, информационных технологиях и о защите информации"
 * Проверяет требования к распространению информации на сайте
 */

export type CheckStatus = "ok" | "warn" | "fail" | "na";

export interface Check149Result {
  id: string;
  title: string;
  status: CheckStatus;
  evidence: string[];
  limitations: string[];
  lawRef: string;
}

export interface Info149ChecksResult {
  checks: Check149Result[];
  summary: {
    total: number;
    ok: number;
    warn: number;
    fail: number;
    na: number;
  };
}

interface HtmlAnalysisInput {
  html: string;
  url: string;
  footerHtml?: string;
  contactsPageHtml?: string;
  aboutPageHtml?: string;
}

const OWNER_PATTERNS = [
  /ООО\s*[«"']?[^«"'<>\n]{3,100}[»"']?/gi,
  /ОАО\s*[«"']?[^«"'<>\n]{3,100}[»"']?/gi,
  /ЗАО\s*[«"']?[^«"'<>\n]{3,100}[»"']?/gi,
  /АО\s*[«"']?[^«"'<>\n]{3,100}[»"']?/gi,
  /ИП\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]*\.?\s*[А-ЯЁ]?[а-яё]*\.?/gi,
  /Индивидуальный предприниматель\s+[А-ЯЁ][а-яё]+/gi,
];

const INN_PATTERN = /ИНН[:\s]*(\d{10}|\d{12})/gi;
const OGRN_PATTERN = /ОГРН[:\s]*(\d{13}|\d{15})/gi;
const ADDRESS_PATTERNS = [
  /(?:юридический\s+)?адрес[:\s]+[^<\n]{10,200}/gi,
  /(?:место\s+)?нахождения[:\s]+[^<\n]{10,200}/gi,
  /\d{6},?\s*(?:г\.|город|пос\.|село|д\.)[^<\n]{10,150}/gi,
];

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_PATTERN = /(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g;

const UNSUBSCRIBE_PATTERNS = [
  /отписаться/i,
  /отказаться\s+от\s+рассылки/i,
  /unsubscribe/i,
  /отменить\s+подписку/i,
  /управлени[ея]\s+подпиской/i,
];

const SUBSCRIPTION_PATTERNS = [
  /подписаться/i,
  /подписка\s+на\s+(?:новости|рассылку)/i,
  /newsletter/i,
  /subscribe/i,
  /получать\s+(?:новости|уведомления)/i,
];

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatches(text: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) {
      matches.push(...found.map(m => m.trim().substring(0, 150)));
    }
  }
  return Array.from(new Set(matches));
}

export function runInfo149Checks(input: HtmlAnalysisInput): Info149ChecksResult {
  const checks: Check149Result[] = [];
  
  const allHtml = [
    input.html,
    input.footerHtml || "",
    input.contactsPageHtml || "",
    input.aboutPageHtml || "",
  ].join("\n");
  
  const allText = extractText(allHtml);
  
  // Check 1: Owner identification (ст. 10 149-ФЗ)
  const ownerMatches = findMatches(allText, OWNER_PATTERNS);
  const innMatches = allText.match(INN_PATTERN) || [];
  const ogrnMatches = allText.match(OGRN_PATTERN) || [];
  
  const hasOwnerInfo = ownerMatches.length > 0 || innMatches.length > 0 || ogrnMatches.length > 0;
  
  checks.push({
    id: "149_OWNER_IDENTIFICATION",
    title: "Идентификация владельца сайта",
    status: hasOwnerInfo ? "ok" : "fail",
    evidence: hasOwnerInfo
      ? [
          ...ownerMatches.slice(0, 3),
          ...innMatches.slice(0, 2),
          ...ogrnMatches.slice(0, 2),
        ]
      : ["Не найдено наименование организации/ИП, ИНН или ОГРН"],
    limitations: [
      "Анализ выполнен на основе HTML главной страницы и доступных разделов",
      "Информация может быть размещена на других страницах сайта",
    ],
    lawRef: "ст. 10 ч. 2 149-ФЗ",
  });
  
  // Check 2: Contact information (ст. 10 149-ФЗ)
  const addressMatches = findMatches(allText, ADDRESS_PATTERNS);
  const emailMatches = allText.match(EMAIL_PATTERN) || [];
  const phoneMatches = allText.match(PHONE_PATTERN) || [];
  
  const hasAddress = addressMatches.length > 0;
  const hasEmail = emailMatches.length > 0;
  const hasPhone = phoneMatches.length > 0;
  const hasContacts = hasAddress || hasEmail || hasPhone;
  
  let contactStatus: CheckStatus = "ok";
  if (!hasAddress && !hasEmail && !hasPhone) {
    contactStatus = "fail";
  } else if (!hasAddress) {
    contactStatus = "warn";
  }
  
  checks.push({
    id: "149_CONTACT_INFO",
    title: "Контактная информация для обращений",
    status: contactStatus,
    evidence: [
      ...(hasAddress ? addressMatches.slice(0, 2) : ["Адрес не найден"]),
      ...(hasEmail ? [`Email: ${emailMatches.slice(0, 2).join(", ")}`] : []),
      ...(hasPhone ? [`Телефон: ${phoneMatches.slice(0, 2).join(", ")}`] : []),
    ],
    limitations: [
      "Контакты могут быть указаны в формате изображения",
      "Анализ ограничен текстовым содержимым HTML",
    ],
    lawRef: "ст. 10 ч. 2 149-ФЗ",
  });
  
  // Check 3: Unsubscribe mechanism if newsletter exists (ст. 18 149-ФЗ)
  const hasSubscription = SUBSCRIPTION_PATTERNS.some(p => p.test(allText));
  const hasUnsubscribe = UNSUBSCRIBE_PATTERNS.some(p => p.test(allText));
  
  let unsubStatus: CheckStatus = "na";
  const unsubEvidence: string[] = [];
  
  if (hasSubscription) {
    if (hasUnsubscribe) {
      unsubStatus = "ok";
      unsubEvidence.push("Обнаружена форма подписки и механизм отписки");
    } else {
      unsubStatus = "warn";
      unsubEvidence.push("Обнаружена форма подписки, но механизм отписки не найден");
    }
  } else {
    unsubEvidence.push("Формы подписки на рассылку не обнаружены");
  }
  
  checks.push({
    id: "149_UNSUBSCRIBE_MECHANISM",
    title: "Механизм отказа от рассылки",
    status: unsubStatus,
    evidence: unsubEvidence,
    limitations: [
      "Механизм отписки может быть реализован в письмах рассылки",
      "Проверка ограничена анализом видимого контента сайта",
    ],
    lawRef: "ст. 18 ч. 3 149-ФЗ",
  });
  
  // Check 4: Age restrictions notice (if applicable)
  const agePatterns = [/18\+/g, /16\+/g, /12\+/g, /6\+/g, /0\+/g];
  const ageLabels = agePatterns.flatMap(p => allText.match(p) || []);
  
  const adultContentPatterns = [/казино/i, /ставки/i, /алкоголь/i, /табак/i, /18\s*лет/i];
  const hasAdultContent = adultContentPatterns.some(p => p.test(allText));
  
  let ageStatus: CheckStatus = "na";
  const ageEvidence: string[] = [];
  
  if (hasAdultContent) {
    if (ageLabels.length > 0) {
      ageStatus = "ok";
      ageEvidence.push(`Обнаружена маркировка: ${ageLabels.join(", ")}`);
    } else {
      ageStatus = "warn";
      ageEvidence.push("Возможен контент с возрастными ограничениями, но маркировка не найдена");
    }
  } else {
    ageEvidence.push("Признаки контента с возрастными ограничениями не обнаружены");
  }
  
  checks.push({
    id: "149_AGE_RESTRICTION",
    title: "Маркировка возрастных ограничений",
    status: ageStatus,
    evidence: ageEvidence,
    limitations: [
      "Анализ основан на ключевых словах, не является экспертной оценкой контента",
    ],
    lawRef: "ст. 6.1 149-ФЗ, 436-ФЗ",
  });
  
  // Summary
  const summary = {
    total: checks.length,
    ok: checks.filter(c => c.status === "ok").length,
    warn: checks.filter(c => c.status === "warn").length,
    fail: checks.filter(c => c.status === "fail").length,
    na: checks.filter(c => c.status === "na").length,
  };
  
  return { checks, summary };
}
