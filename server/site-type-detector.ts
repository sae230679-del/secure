import * as cheerio from "cheerio";
import { fetchRenderedPage } from "./playwright-fetcher";

export const SITE_TYPES = {
  ecommerce: {
    name: "Интернет-магазин",
    description: "Сайт с каталогом товаров, корзиной и оплатой",
    baseAuditPrice: 9900,
  },
  marketplace: {
    name: "Маркетплейс",
    description: "Площадка для продавцов и покупателей",
    baseAuditPrice: 14900,
  },
  services: {
    name: "Сайт услуг",
    description: "Компания или специалист, предлагающий услуги",
    baseAuditPrice: 6900,
  },
  corporate: {
    name: "Корпоративный сайт",
    description: "Информационный сайт компании",
    baseAuditPrice: 4900,
  },
  landing: {
    name: "Лендинг",
    description: "Одностраничный сайт для продвижения продукта",
    baseAuditPrice: 4900,
  },
  saas: {
    name: "SaaS-сервис",
    description: "Онлайн-сервис с подписной моделью",
    baseAuditPrice: 9900,
  },
  blog: {
    name: "Блог / Медиа",
    description: "Контентный сайт, статьи, новости",
    baseAuditPrice: 4900,
  },
  onlineSchool: {
    name: "Онлайн-школа",
    description: "Платформа для онлайн-обучения",
    baseAuditPrice: 9900,
  },
  ugc: {
    name: "UGC-платформа",
    description: "Сайт с пользовательским контентом (форум, соцсеть)",
    baseAuditPrice: 9900,
  },
  classifieds: {
    name: "Доска объявлений",
    description: "Площадка для размещения объявлений",
    baseAuditPrice: 9900,
  },
  government: {
    name: "Государственный / Муниципальный",
    description: "Сайт органа власти или бюджетного учреждения",
    baseAuditPrice: 6900,
  },
  other: {
    name: "Другое",
    description: "Тип сайта не определён автоматически",
    baseAuditPrice: 6900,
  },
} as const;

export type SiteTypeKey = keyof typeof SITE_TYPES;

export interface SiteTypeResult {
  type: SiteTypeKey;
  name: string;
  description: string;
  baseAuditPrice: number;
  confidence: "high" | "medium" | "low";
  signals: string[];
}

interface DetectionSignals {
  hasCart: boolean;
  hasProducts: boolean;
  hasCheckout: boolean;
  hasRegistration: boolean;
  hasLogin: boolean;
  hasPricing: boolean;
  hasSubscription: boolean;
  hasCourses: boolean;
  hasArticles: boolean;
  hasMultipleVendors: boolean;
  hasClassifieds: boolean;
  hasUserContent: boolean;
  hasForum: boolean;
  isGovernment: boolean;
  isSinglePage: boolean;
  hasServicesList: boolean;
  hasPortfolio: boolean;
  hasContactForm: boolean;
}

function detectSignals(html: string, url: string): DetectionSignals {
  const $ = cheerio.load(html);
  const text = $("body").text().toLowerCase();
  const urlLower = url.toLowerCase();

  const allLinks = $("a[href]").map((_, el) => $(el).attr("href") || "").get();
  const linkCount = allLinks.length;

  const hasCart = Boolean(
    $('[class*="cart"], [class*="basket"], [class*="korzin"], [id*="cart"], [id*="basket"]').length > 0 ||
    text.includes("корзина") ||
    text.includes("в корзину") ||
    text.includes("добавить в корзину") ||
    allLinks.some((l) => l.includes("cart") || l.includes("basket") || l.includes("korzin"))
  );

  const hasProducts = Boolean(
    $('[class*="product"], [class*="tovar"], [class*="catalog"], [class*="goods"]').length > 3 ||
    text.includes("купить") ||
    text.includes("цена") ||
    text.includes("₽") ||
    text.includes("руб.")
  );

  const hasCheckout = Boolean(
    allLinks.some((l) => l.includes("checkout") || l.includes("order") || l.includes("zakaz") || l.includes("oformlen"))
  );

  const hasRegistration = Boolean(
    $('[class*="register"], [class*="signup"], [class*="registrac"], input[name*="email"]').length > 0 ||
    allLinks.some((l) => l.includes("register") || l.includes("signup") || l.includes("registrac"))
  );

  const hasLogin = Boolean(
    $('[class*="login"], [class*="auth"], [class*="vhod"], [class*="signin"]').length > 0 ||
    text.includes("войти") ||
    text.includes("вход") ||
    text.includes("личный кабинет") ||
    allLinks.some((l) => l.includes("login") || l.includes("auth") || l.includes("signin"))
  );

  const hasPricing = Boolean(
    $('[class*="price"], [class*="tarif"], [class*="plan"]').length > 2 ||
    text.includes("тариф") ||
    text.includes("подписка") ||
    text.includes("/мес") ||
    text.includes("в месяц")
  );

  const hasSubscription = Boolean(
    text.includes("подписка") ||
    text.includes("ежемесячн") ||
    text.includes("оплата за месяц") ||
    text.includes("trial") ||
    text.includes("пробный период")
  );

  const hasCourses = Boolean(
    $('[class*="course"], [class*="kurs"], [class*="lesson"], [class*="urok"]').length > 0 ||
    text.includes("курс") ||
    text.includes("обучение") ||
    text.includes("урок") ||
    text.includes("вебинар") ||
    text.includes("онлайн-курс")
  );

  const hasArticles = Boolean(
    $("article, [class*='post'], [class*='article'], [class*='blog'], [class*='news']").length > 3 ||
    text.includes("статья") ||
    text.includes("блог") ||
    text.includes("новости") ||
    urlLower.includes("blog") ||
    urlLower.includes("news")
  );

  const hasMultipleVendors = Boolean(
    text.includes("продавец") ||
    text.includes("поставщик") ||
    text.includes("магазин партнёр") ||
    text.includes("seller") ||
    $('[class*="vendor"], [class*="seller"], [class*="merchant"]').length > 0
  );

  const hasClassifieds = Boolean(
    text.includes("объявлен") ||
    text.includes("разместить объявление") ||
    text.includes("подать объявление") ||
    $('[class*="advert"], [class*="listing"], [class*="obyavlen"]').length > 3
  );

  const hasUserContent = Boolean(
    $('[class*="comment"], [class*="review"], [class*="rating"], [class*="otziv"]').length > 3 ||
    text.includes("отзыв") ||
    text.includes("комментари")
  );

  const hasForum = Boolean(
    $('[class*="forum"], [class*="topic"], [class*="thread"]').length > 0 ||
    text.includes("форум") ||
    text.includes("тема") ||
    text.includes("обсуждение")
  );

  const isGovernment = Boolean(
    urlLower.includes(".gov.ru") ||
    urlLower.includes(".mos.ru") ||
    text.includes("государственн") ||
    text.includes("муниципальн") ||
    text.includes("администрация") ||
    text.includes("министерство") ||
    text.includes("федеральн")
  );

  const isSinglePage = linkCount < 15;

  const hasServicesList = Boolean(
    $('[class*="service"], [class*="uslugi"]').length > 2 ||
    text.includes("услуги") ||
    text.includes("прайс-лист") ||
    text.includes("наши услуги")
  );

  const hasPortfolio = Boolean(
    $('[class*="portfolio"], [class*="project"], [class*="works"]').length > 0 ||
    text.includes("портфолио") ||
    text.includes("наши работы") ||
    text.includes("проекты")
  );

  const hasContactForm = Boolean(
    $("form").length > 0 ||
    text.includes("обратная связь") ||
    text.includes("заказать звонок") ||
    text.includes("оставить заявку")
  );

  return {
    hasCart,
    hasProducts,
    hasCheckout,
    hasRegistration,
    hasLogin,
    hasPricing,
    hasSubscription,
    hasCourses,
    hasArticles,
    hasMultipleVendors,
    hasClassifieds,
    hasUserContent,
    hasForum,
    isGovernment,
    isSinglePage,
    hasServicesList,
    hasPortfolio,
    hasContactForm,
  };
}

function determineSiteType(signals: DetectionSignals): { type: SiteTypeKey; confidence: "high" | "medium" | "low"; reasons: string[] } {
  const reasons: string[] = [];

  if (signals.isGovernment) {
    reasons.push("Обнаружены признаки государственного сайта");
    return { type: "government", confidence: "high", reasons };
  }

  if (signals.hasMultipleVendors && signals.hasProducts) {
    reasons.push("Обнаружены товары от нескольких продавцов");
    return { type: "marketplace", confidence: "high", reasons };
  }

  if (signals.hasClassifieds) {
    reasons.push("Обнаружены признаки доски объявлений");
    return { type: "classifieds", confidence: "high", reasons };
  }

  if (signals.hasCart && signals.hasProducts && signals.hasCheckout) {
    reasons.push("Обнаружены корзина, каталог товаров и оформление заказа");
    return { type: "ecommerce", confidence: "high", reasons };
  }

  if (signals.hasCart || (signals.hasProducts && signals.hasCheckout)) {
    reasons.push("Обнаружены признаки интернет-магазина");
    return { type: "ecommerce", confidence: "medium", reasons };
  }

  if (signals.hasCourses && (signals.hasLogin || signals.hasRegistration)) {
    reasons.push("Обнаружены курсы и система авторизации");
    return { type: "onlineSchool", confidence: "high", reasons };
  }

  if (signals.hasCourses) {
    reasons.push("Обнаружены образовательные материалы");
    return { type: "onlineSchool", confidence: "medium", reasons };
  }

  if (signals.hasPricing && signals.hasSubscription && signals.hasLogin) {
    reasons.push("Обнаружены тарифы, подписка и авторизация");
    return { type: "saas", confidence: "high", reasons };
  }

  if (signals.hasPricing && signals.hasSubscription) {
    reasons.push("Обнаружены признаки SaaS-сервиса");
    return { type: "saas", confidence: "medium", reasons };
  }

  if (signals.hasForum || (signals.hasUserContent && signals.hasRegistration)) {
    reasons.push("Обнаружены признаки UGC-платформы");
    return { type: "ugc", confidence: "medium", reasons };
  }

  if (signals.hasArticles && !signals.hasProducts) {
    reasons.push("Обнаружен контентный сайт со статьями");
    return { type: "blog", confidence: "medium", reasons };
  }

  if (signals.hasServicesList && (signals.hasPortfolio || signals.hasContactForm)) {
    reasons.push("Обнаружены услуги и форма обратной связи");
    return { type: "services", confidence: "high", reasons };
  }

  if (signals.hasServicesList) {
    reasons.push("Обнаружен список услуг");
    return { type: "services", confidence: "medium", reasons };
  }

  if (signals.isSinglePage && signals.hasContactForm) {
    reasons.push("Одностраничный сайт с формой обратной связи");
    return { type: "landing", confidence: "high", reasons };
  }

  if (signals.isSinglePage) {
    reasons.push("Одностраничный сайт");
    return { type: "landing", confidence: "medium", reasons };
  }

  if (signals.hasLogin && signals.hasRegistration && !signals.hasProducts) {
    reasons.push("Обнаружена система авторизации без товаров");
    return { type: "corporate", confidence: "low", reasons };
  }

  reasons.push("Не удалось точно определить тип сайта");
  return { type: "other", confidence: "low", reasons };
}

export async function detectSiteType(url: string): Promise<SiteTypeResult> {
  try {
    const { html } = await fetchRenderedPage(url);
    
    if (!html || html.length < 100) {
      return {
        type: "other",
        name: SITE_TYPES.other.name,
        description: SITE_TYPES.other.description,
        baseAuditPrice: SITE_TYPES.other.baseAuditPrice,
        confidence: "low",
        signals: ["Не удалось загрузить страницу"],
      };
    }

    const signals = detectSignals(html, url);
    const result = determineSiteType(signals);
    const siteType = SITE_TYPES[result.type];

    return {
      type: result.type,
      name: siteType.name,
      description: siteType.description,
      baseAuditPrice: siteType.baseAuditPrice,
      confidence: result.confidence,
      signals: result.reasons,
    };
  } catch (error) {
    console.error("[Site Type Detector] Error:", error);
    return {
      type: "other",
      name: SITE_TYPES.other.name,
      description: SITE_TYPES.other.description,
      baseAuditPrice: SITE_TYPES.other.baseAuditPrice,
      confidence: "low",
      signals: ["Ошибка при анализе сайта"],
    };
  }
}

export function getSiteTypeInfo(type: SiteTypeKey) {
  return SITE_TYPES[type] || SITE_TYPES.other;
}

export function getAllSiteTypes() {
  return Object.entries(SITE_TYPES).map(([key, value]) => ({
    type: key as SiteTypeKey,
    ...value,
  }));
}
