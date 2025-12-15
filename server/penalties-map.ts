/**
 * Карта штрафов КоАП РФ для нарушений в области персональных данных
 * Источник: КоАП РФ ст. 13.11 (актуальная редакция)
 * https://www.consultant.ru/document/cons_doc_LAW_34661/
 */

export type SubjectType = "citizen" | "selfEmployed" | "official" | "ip" | "legalEntity";

export type Confidence = "high" | "medium" | "low";

export interface KoapPenalty {
  koapArticle: string;
  koapPart?: string;
  subject: SubjectType;
  minRub: number;
  maxRub: number;
  confidence: Confidence;
  note?: string;
  sourceUrl?: string;
}

export interface LawBasis {
  law: "152" | "149";
  article: string;
  note?: string;
}

export interface PenaltyMappingItem {
  checkId: string;
  title: string;
  lawBasis: LawBasis[];
  penalties: KoapPenalty[];
  aggregationKey: string;
  fixSteps: string[];
}

/**
 * Правило для самозанятого:
 * - Если пользователь НЕ ИП: selfEmployed считать как citizen (НПД — физлицо).
 * - Если пользователь ИП на НПД: считать как ip.
 */
export const SELF_EMPLOYED_RULE =
  "Самозанятый (НПД) учитывается как физлицо, если не зарегистрирован как ИП; если зарегистрирован как ИП — учитывается как ИП.";

const CONSULTANT_URL = "https://www.consultant.ru/document/cons_doc_LAW_34661/";

export const PENALTY_MAP: Record<string, PenaltyMappingItem> = {
  // 1) Нет политики ПДн/конфиденциальности
  "LEGAL_PRIVACY_POLICY_MISSING": {
    checkId: "LEGAL_PRIVACY_POLICY_MISSING",
    title: "Отсутствует политика обработки персональных данных",
    lawBasis: [
      { law: "152", article: "ст. 18.1", note: "Обязанность оператора опубликовать или обеспечить доступ к документу о политике в отношении обработки ПДн" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.3", subject: "citizen", minRub: 1500, maxRub: 3000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.3", subject: "selfEmployed", minRub: 1500, maxRub: 3000, confidence: "high", note: "Как физлицо (НПД)" },
      { koapArticle: "13.11", koapPart: "ч.3", subject: "official", minRub: 6000, maxRub: 12000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.3", subject: "ip", minRub: 10000, maxRub: 20000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.3", subject: "legalEntity", minRub: 30000, maxRub: 60000, confidence: "high", sourceUrl: CONSULTANT_URL },
    ],
    aggregationKey: "PRIVACY_POLICY",
    fixSteps: [
      "Разместить политику конфиденциальности на сайте",
      "Указать ссылку на политику в подвале каждой страницы",
      "Включить в политику все обязательные разделы по ст. 18.1 ФЗ-152",
    ],
  },

  // 2) Нет чекбокса согласия в формах
  "PDN_CONSENT_CHECKBOX_MISSING": {
    checkId: "PDN_CONSENT_CHECKBOX_MISSING",
    title: "В формах нет явного согласия на обработку персональных данных",
    lawBasis: [
      { law: "152", article: "ст. 9", note: "Согласие субъекта ПДн должно быть конкретным, информированным, сознательным" },
      { law: "152", article: "ст. 18", note: "Обязанности оператора при сборе ПДн" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.2", subject: "citizen", minRub: 6000, maxRub: 10000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.2", subject: "selfEmployed", minRub: 6000, maxRub: 10000, confidence: "high" },
      { koapArticle: "13.11", koapPart: "ч.2", subject: "official", minRub: 20000, maxRub: 40000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.2", subject: "ip", minRub: 20000, maxRub: 40000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.2", subject: "legalEntity", minRub: 30000, maxRub: 150000, confidence: "high", sourceUrl: CONSULTANT_URL },
    ],
    aggregationKey: "PDN_CONSENT_FORMS",
    fixSteps: [
      "Добавить чекбокс согласия на обработку ПДн перед кнопкой отправки формы",
      "Текст согласия должен ссылаться на политику конфиденциальности",
      "Чекбокс не должен быть предзаполненным",
    ],
  },

  // 3) Нет cookie-banner
  "COOKIES_BANNER_MISSING": {
    checkId: "COOKIES_BANNER_MISSING",
    title: "Нет cookie-баннера или механизма согласия на cookies",
    lawBasis: [
      { law: "152", article: "ст. 9", note: "Согласие на обработку ПДн при использовании идентификаторов" },
      { law: "149", article: "ст. 10.1", note: "Обязанности владельца сайта" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.2", subject: "citizen", minRub: 6000, maxRub: 10000, confidence: "medium", note: "Применимость зависит от типа cookies" },
      { koapArticle: "13.11", koapPart: "ч.2", subject: "selfEmployed", minRub: 6000, maxRub: 10000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.2", subject: "official", minRub: 20000, maxRub: 40000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.2", subject: "ip", minRub: 20000, maxRub: 40000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.2", subject: "legalEntity", minRub: 30000, maxRub: 150000, confidence: "medium" },
    ],
    aggregationKey: "COOKIES_CONSENT",
    fixSteps: [
      "Установить cookie-баннер с возможностью выбора категорий",
      "Не устанавливать аналитические/рекламные cookies до согласия",
      "Сохранять выбор пользователя",
    ],
  },

  // 4) HTTPS не принудителен
  "SEC_HTTPS_NOT_ENFORCED": {
    checkId: "SEC_HTTPS_NOT_ENFORCED",
    title: "HTTPS не принудителен (доступ по HTTP)",
    lawBasis: [
      { law: "152", article: "ст. 19", note: "Меры по обеспечению безопасности ПДн при передаче" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.6", subject: "citizen", minRub: 1000, maxRub: 2000, confidence: "medium", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "selfEmployed", minRub: 1000, maxRub: 2000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "official", minRub: 4000, maxRub: 10000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "ip", minRub: 10000, maxRub: 20000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "legalEntity", minRub: 25000, maxRub: 50000, confidence: "medium" },
    ],
    aggregationKey: "HTTPS_ENFORCEMENT",
    fixSteps: [
      "Настроить принудительный редирект HTTP → HTTPS",
      "Добавить HSTS заголовок",
      "Проверить, что все ресурсы загружаются по HTTPS",
    ],
  },

  // 5) Отсутствует HSTS
  "SEC_HEADERS_HSTS_MISSING": {
    checkId: "SEC_HEADERS_HSTS_MISSING",
    title: "Отсутствует заголовок HSTS",
    lawBasis: [
      { law: "152", article: "ст. 19", note: "Технические меры безопасности при передаче данных" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.6", subject: "citizen", minRub: 1000, maxRub: 2000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "selfEmployed", minRub: 1000, maxRub: 2000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "official", minRub: 4000, maxRub: 10000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "ip", minRub: 10000, maxRub: 20000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "legalEntity", minRub: 25000, maxRub: 50000, confidence: "low" },
    ],
    aggregationKey: "SEC_HEADERS",
    fixSteps: [
      "Добавить заголовок Strict-Transport-Security",
      "Рекомендуемое значение: max-age=31536000; includeSubDomains",
    ],
  },

  // 6) Отсутствует CSP
  "SEC_HEADERS_CSP_MISSING": {
    checkId: "SEC_HEADERS_CSP_MISSING",
    title: "Отсутствует Content-Security-Policy",
    lawBasis: [
      { law: "152", article: "ст. 19", note: "Защита от XSS и инъекций" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.6", subject: "citizen", minRub: 1000, maxRub: 2000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "selfEmployed", minRub: 1000, maxRub: 2000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "official", minRub: 4000, maxRub: 10000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "ip", minRub: 10000, maxRub: 20000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "legalEntity", minRub: 25000, maxRub: 50000, confidence: "low" },
    ],
    aggregationKey: "SEC_HEADERS",
    fixSteps: [
      "Настроить Content-Security-Policy заголовок",
      "Минимально: default-src 'self'",
      "Постепенно расширять политику для легитимных ресурсов",
    ],
  },

  // 7) Отсутствует X-Frame-Options
  "SEC_HEADERS_XFO_MISSING": {
    checkId: "SEC_HEADERS_XFO_MISSING",
    title: "Отсутствует X-Frame-Options",
    lawBasis: [
      { law: "152", article: "ст. 19", note: "Защита от clickjacking атак" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.6", subject: "citizen", minRub: 1000, maxRub: 2000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "selfEmployed", minRub: 1000, maxRub: 2000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "official", minRub: 4000, maxRub: 10000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "ip", minRub: 10000, maxRub: 20000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "legalEntity", minRub: 25000, maxRub: 50000, confidence: "low" },
    ],
    aggregationKey: "SEC_HEADERS",
    fixSteps: [
      "Добавить заголовок X-Frame-Options: DENY или SAMEORIGIN",
    ],
  },

  // 8) Отсутствует X-Content-Type-Options
  "SEC_HEADERS_XCTO_MISSING": {
    checkId: "SEC_HEADERS_XCTO_MISSING",
    title: "Отсутствует X-Content-Type-Options",
    lawBasis: [
      { law: "152", article: "ст. 19", note: "Защита от MIME sniffing" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.6", subject: "citizen", minRub: 1000, maxRub: 2000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "selfEmployed", minRub: 1000, maxRub: 2000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "official", minRub: 4000, maxRub: 10000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "ip", minRub: 10000, maxRub: 20000, confidence: "low" },
      { koapArticle: "13.11", koapPart: "ч.6", subject: "legalEntity", minRub: 25000, maxRub: 50000, confidence: "low" },
    ],
    aggregationKey: "SEC_HEADERS",
    fixSteps: [
      "Добавить заголовок X-Content-Type-Options: nosniff",
    ],
  },

  // 9) Нет контактов оператора
  "LEGAL_CONTACTS_MISSING": {
    checkId: "LEGAL_CONTACTS_MISSING",
    title: "Не найдены контакты оператора/владельца сайта",
    lawBasis: [
      { law: "152", article: "ст. 18.1", note: "Публичная политика и сведения об операторе" },
      { law: "149", article: "ст. 10.1", note: "Обязанности владельца сайта" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.3", subject: "citizen", minRub: 1500, maxRub: 3000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.3", subject: "selfEmployed", minRub: 1500, maxRub: 3000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.3", subject: "official", minRub: 6000, maxRub: 12000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.3", subject: "ip", minRub: 10000, maxRub: 20000, confidence: "medium" },
      { koapArticle: "13.11", koapPart: "ч.3", subject: "legalEntity", minRub: 30000, maxRub: 60000, confidence: "medium" },
    ],
    aggregationKey: "LEGAL_CONTACTS",
    fixSteps: [
      "Разместить контактную информацию оператора (email, телефон, адрес)",
      "Указать ИНН/ОГРН организации",
      "Добавить страницу 'Контакты' с полными реквизитами",
    ],
  },

  // 10) Обработка ПДн без уведомления РКН
  "RKN_REGISTRATION_MISSING": {
    checkId: "RKN_REGISTRATION_MISSING",
    title: "Оператор не зарегистрирован в реестре РКН",
    lawBasis: [
      { law: "152", article: "ст. 22", note: "Уведомление уполномоченного органа о намерении осуществлять обработку ПДн" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.1", subject: "citizen", minRub: 3000, maxRub: 5000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.1", subject: "selfEmployed", minRub: 3000, maxRub: 5000, confidence: "high" },
      { koapArticle: "13.11", koapPart: "ч.1", subject: "official", minRub: 10000, maxRub: 20000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.1", subject: "ip", minRub: 10000, maxRub: 20000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.1", subject: "legalEntity", minRub: 30000, maxRub: 50000, confidence: "high", sourceUrl: CONSULTANT_URL },
    ],
    aggregationKey: "RKN_REGISTRATION",
    fixSteps: [
      "Подать уведомление в Роскомнадзор через портал pd.rkn.gov.ru",
      "Указать все цели обработки и категории данных",
      "Дождаться внесения в реестр операторов",
    ],
  },

  // 11) Нарушение локализации ПДн россиян
  "LOCALIZATION_VIOLATION": {
    checkId: "LOCALIZATION_VIOLATION",
    title: "Нарушение требований локализации ПДн россиян",
    lawBasis: [
      { law: "152", article: "ст. 18", note: "Обязанность локализации баз данных с ПДн граждан РФ на территории РФ" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.8", subject: "citizen", minRub: 30000, maxRub: 60000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.8", subject: "selfEmployed", minRub: 30000, maxRub: 60000, confidence: "high" },
      { koapArticle: "13.11", koapPart: "ч.8", subject: "official", minRub: 100000, maxRub: 200000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.8", subject: "ip", minRub: 100000, maxRub: 200000, confidence: "high" },
      { koapArticle: "13.11", koapPart: "ч.8", subject: "legalEntity", minRub: 1000000, maxRub: 6000000, confidence: "high", sourceUrl: CONSULTANT_URL },
    ],
    aggregationKey: "LOCALIZATION",
    fixSteps: [
      "Перенести базы данных с ПДн россиян на серверы в РФ",
      "Документально подтвердить локализацию",
      "При трансграничной передаче — получить согласие субъекта",
    ],
  },

  // 12) Повторное нарушение (увеличенные штрафы)
  "REPEAT_VIOLATION": {
    checkId: "REPEAT_VIOLATION",
    title: "Повторное нарушение требований ФЗ-152",
    lawBasis: [
      { law: "152", article: "ст. 9, 18.1, 19", note: "Повторное совершение правонарушения" },
    ],
    penalties: [
      { koapArticle: "13.11", koapPart: "ч.2.1", subject: "citizen", minRub: 10000, maxRub: 20000, confidence: "high", sourceUrl: CONSULTANT_URL },
      { koapArticle: "13.11", koapPart: "ч.2.1", subject: "selfEmployed", minRub: 10000, maxRub: 20000, confidence: "high" },
      { koapArticle: "13.11", koapPart: "ч.2.1", subject: "official", minRub: 40000, maxRub: 100000, confidence: "high" },
      { koapArticle: "13.11", koapPart: "ч.2.1", subject: "ip", minRub: 50000, maxRub: 100000, confidence: "high" },
      { koapArticle: "13.11", koapPart: "ч.2.1", subject: "legalEntity", minRub: 300000, maxRub: 500000, confidence: "high", sourceUrl: CONSULTANT_URL },
    ],
    aggregationKey: "REPEAT_VIOLATION",
    fixSteps: [
      "Устранить все выявленные нарушения",
      "Провести внутренний аудит системы обработки ПДн",
      "Назначить ответственного за организацию обработки ПДн",
    ],
  },
};

/**
 * Маппинг ID проверок из audit-engine на checkId в PENALTY_MAP
 */
export const CHECK_ID_MAP: Record<string, string> = {
  "SEC-001": "SEC_HTTPS_NOT_ENFORCED",
  "SEC-002": "SEC_HEADERS_HSTS_MISSING",
  "SEC-003": "SEC_HEADERS_CSP_MISSING",
  "SEC-004": "SEC_HEADERS_XFO_MISSING",
  "SEC-005": "SEC_HEADERS_XCTO_MISSING",
  "LEGAL-001": "LEGAL_PRIVACY_POLICY_MISSING",
  "LEGAL-002": "PDN_CONSENT_CHECKBOX_MISSING",
  "LEGAL-003": "COOKIES_BANNER_MISSING",
  "LEGAL-004": "LEGAL_CONTACTS_MISSING",
  "RKN-001": "RKN_REGISTRATION_MISSING",
};

export interface PenaltyTotals {
  bySubject: Record<SubjectType, { minRub: number; maxRub: number }>;
  uniqueViolations: number;
  aggregationKeys: string[];
}

/**
 * Привязывает штрафы к результатам аудита
 */
export function attachPenalties(
  checkId: string,
  status: "passed" | "warning" | "failed"
): PenaltyMappingItem | null {
  if (status === "passed") return null;
  
  const mappedId = CHECK_ID_MAP[checkId] || checkId;
  return PENALTY_MAP[mappedId] || null;
}

/**
 * Рассчитывает общие суммы штрафов с дедупликацией по aggregationKey
 */
export function calcPenaltyTotals(
  results: Array<{ checkId: string; status: "passed" | "warning" | "failed" }>
): PenaltyTotals {
  const seenAggKeys = new Set<string>();
  const totals: Record<SubjectType, { minRub: number; maxRub: number }> = {
    citizen: { minRub: 0, maxRub: 0 },
    selfEmployed: { minRub: 0, maxRub: 0 },
    official: { minRub: 0, maxRub: 0 },
    ip: { minRub: 0, maxRub: 0 },
    legalEntity: { minRub: 0, maxRub: 0 },
  };

  for (const result of results) {
    const penalty = attachPenalties(result.checkId, result.status);
    if (!penalty) continue;
    
    if (seenAggKeys.has(penalty.aggregationKey)) continue;
    seenAggKeys.add(penalty.aggregationKey);

    for (const p of penalty.penalties) {
      totals[p.subject].minRub += p.minRub;
      totals[p.subject].maxRub += p.maxRub;
    }
  }

  return {
    bySubject: totals,
    uniqueViolations: seenAggKeys.size,
    aggregationKeys: Array.from(seenAggKeys),
  };
}

/**
 * Форматирует сумму в рублях
 */
export function formatRub(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Получает название типа субъекта на русском
 */
export function getSubjectName(subject: SubjectType): string {
  const names: Record<SubjectType, string> = {
    citizen: "Гражданин",
    selfEmployed: "Самозанятый",
    official: "Должностное лицо",
    ip: "ИП",
    legalEntity: "Юридическое лицо",
  };
  return names[subject];
}
