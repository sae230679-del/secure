import { z } from "zod";

// ============================================
// Input Schema
// ============================================
export const userAgreementInputSchema = z.object({
  // Обязательные поля
  siteUrl: z.string().url("Введите корректный URL сайта"),
  siteType: z.enum([
    "content",
    "services",
    "saas",
    "ecommerce",
    "marketplace",
    "ugc",
    "onlineSchool",
    "servicesAggregator",
    "classifieds",
    "crmSaas",
  ]),
  operatorType: z.enum(["ooo", "ip", "selfEmployed", "individual"]),
  operatorNameFull: z.string().min(2, "Введите наименование оператора"),
  supportEmail: z.string().email("Введите корректный email"),
  jurisdictionCity: z.string().min(2, "Введите город юрисдикции"),

  // Флаги/опции
  hasRegistration: z.boolean().default(false),
  hasPayments: z.boolean().default(false),
  billingModel: z.enum(["subscription", "oneTime", "payg", "mixed"]).optional(),
  hasSubscription: z.boolean().optional(),
  hasTrial: z.boolean().optional(),
  trialDays: z.number().positive().optional(),
  deliveryType: z.enum(["none", "digital", "physical", "mixed"]).optional(),
  refundPolicy: z.enum(["standard", "custom", "none"]).optional(),
  ugcAllowed: z.boolean().default(false),
  moderationMode: z.enum(["pre", "post", "mixed"]).optional(),
  prohibitedContent: z.array(z.string()).optional(),
  complaintsChannel: z.string().optional(),
  ageRestriction: z.enum(["none", "18plus"]).default("none"),
  analyticsUsed: z.boolean().optional(),
  thirdPartyServices: z.array(z.string()).optional(),

  // Реквизиты (чувствительные - НЕ логировать)
  operatorInn: z.string().optional(),
  operatorOgrnOrOgrnip: z.string().optional(),
  operatorAddress: z.string().optional(),
  supportPhone: z.string().optional(),

  // Дополнительные опции для специальных типов
  platformRole: z.enum(["infoPlatformOnly", "partyToContract", "agent"]).optional(),
  dataRetentionDays: z.number().positive().optional(),
  accessPeriodDays: z.number().positive().optional(),
});

export type UserAgreementInput = z.infer<typeof userAgreementInputSchema>;

// ============================================
// Output Types
// ============================================
interface DocumentBlock {
  id: string;
  title: string;
  html: string;
}

export interface UserAgreementOutput {
  toolId: "user-agreement-generator";
  format: {
    html: string;
    text: string;
    blocks: DocumentBlock[];
    json: Record<string, unknown>;
  };
  evidence: string[];
  limitations: string[];
}

// ============================================
// Helper Functions
// ============================================
function getOperatorTypeName(type: string): string {
  const names: Record<string, string> = {
    ooo: "Общество с ограниченной ответственностью",
    ip: "Индивидуальный предприниматель",
    selfEmployed: "Самозанятый",
    individual: "Физическое лицо",
  };
  return names[type] || type;
}

function getSiteTypeName(type: string): string {
  const names: Record<string, string> = {
    content: "Контентный сайт",
    services: "Сайт услуг",
    saas: "SaaS-сервис",
    ecommerce: "Интернет-магазин",
    marketplace: "Маркетплейс",
    ugc: "UGC-платформа",
    onlineSchool: "Онлайн-школа",
    servicesAggregator: "Агрегатор услуг",
    classifieds: "Доска объявлений",
    crmSaas: "CRM/SaaS система",
  };
  return names[type] || type;
}

function formatDate(): string {
  return new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================
// Module Generators
// ============================================

function generateSummaryBlock(input: UserAgreementInput): DocumentBlock {
  const bullets: string[] = [];

  bullets.push(`Оператор сайта: ${escapeHtml(input.operatorNameFull)}`);
  bullets.push(`Тип сайта: ${getSiteTypeName(input.siteType)}`);
  bullets.push(`Юрисдикция: Российская Федерация, г. ${escapeHtml(input.jurisdictionCity)}`);

  if (input.hasRegistration) {
    bullets.push("Требуется регистрация для полного доступа");
  }
  if (input.hasPayments) {
    bullets.push("Сайт предоставляет платные услуги/товары");
  }
  if (input.ugcAllowed) {
    bullets.push("Пользователи могут размещать собственный контент");
  }
  if (input.ageRestriction === "18plus") {
    bullets.push("Сайт предназначен для лиц старше 18 лет");
  }

  const html = `
    <div class="summary-block">
      <p><strong>Краткое содержание:</strong></p>
      <ul>
        ${bullets.map((b) => `<li>${b}</li>`).join("\n        ")}
      </ul>
    </div>
  `;

  return { id: "summary", title: "Краткое содержание", html };
}

function generateTermsBlock(input: UserAgreementInput): DocumentBlock {
  const terms: string[] = [
    `<strong>«Сайт»</strong> — интернет-ресурс, расположенный по адресу ${escapeHtml(input.siteUrl)}, включая все его страницы и функциональные возможности.`,
    `<strong>«Оператор»</strong> — ${getOperatorTypeName(input.operatorType)} ${escapeHtml(input.operatorNameFull)}, осуществляющий управление Сайтом.`,
    `<strong>«Пользователь»</strong> — физическое лицо, использующее Сайт в любой форме.`,
    `<strong>«Соглашение»</strong> — настоящий документ, определяющий условия использования Сайта.`,
  ];

  if (input.hasRegistration) {
    terms.push(
      `<strong>«Учётная запись»</strong> — персональный аккаунт Пользователя, созданный при регистрации на Сайте.`
    );
    terms.push(
      `<strong>«Личный кабинет»</strong> — защищённый раздел Сайта, доступный Пользователю после авторизации.`
    );
  }

  if (input.hasPayments) {
    terms.push(
      `<strong>«Услуги»</strong> — платные функции, товары или сервисы, предоставляемые через Сайт.`
    );
    terms.push(
      `<strong>«Заказ»</strong> — оформленная заявка Пользователя на получение Услуг.`
    );
  }

  if (input.ugcAllowed) {
    terms.push(
      `<strong>«Пользовательский контент»</strong> — любые материалы, загружаемые или создаваемые Пользователем на Сайте.`
    );
  }

  const html = `
    <div class="terms-block">
      <p>В настоящем Соглашении используются следующие термины:</p>
      <ol>
        ${terms.map((t) => `<li>${t}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "terms", title: "1. Термины и определения", html };
}

function generateGeneralBlock(input: UserAgreementInput): DocumentBlock {
  const points: string[] = [
    "Настоящее Соглашение является публичной офертой и определяет условия использования Сайта.",
    "Использование Сайта означает полное и безоговорочное принятие условий настоящего Соглашения.",
    "Оператор вправе в одностороннем порядке изменять условия Соглашения. Изменения вступают в силу с момента публикации на Сайте.",
    "Пользователь обязуется самостоятельно отслеживать изменения в Соглашении.",
  ];

  if (input.ageRestriction === "18plus") {
    points.push(
      "Сайт предназначен для лиц, достигших 18-летнего возраста. Используя Сайт, Пользователь подтверждает достижение указанного возраста."
    );
  }

  const html = `
    <div class="general-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "general", title: "2. Общие положения", html };
}

function generateRegistrationBlock(input: UserAgreementInput): DocumentBlock | null {
  if (!input.hasRegistration) return null;

  const points: string[] = [
    "Для получения доступа к отдельным функциям Сайта Пользователь должен пройти процедуру регистрации.",
    "При регистрации Пользователь обязан предоставить достоверные данные.",
    "Пользователь несёт полную ответственность за сохранность своих учётных данных.",
    "Все действия, совершённые с использованием учётной записи Пользователя, считаются совершёнными самим Пользователем.",
    "Оператор вправе заблокировать или удалить учётную запись при нарушении условий Соглашения.",
  ];

  const html = `
    <div class="registration-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "registration", title: "3. Регистрация и учётная запись", html };
}

function generatePrivacyBlock(input: UserAgreementInput): DocumentBlock {
  const points: string[] = [
    "Оператор осуществляет обработку персональных данных Пользователей в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных».",
    `Оператором персональных данных является ${escapeHtml(input.operatorNameFull)}.`,
    "Обработка персональных данных осуществляется в целях предоставления доступа к Сайту и его функциональности, исполнения обязательств перед Пользователем, улучшения качества сервиса.",
    "Подробная информация об обработке персональных данных содержится в Политике конфиденциальности, размещённой на Сайте. Политика конфиденциальности является приоритетным документом в вопросах обработки персональных данных.",
  ];

  if (input.analyticsUsed) {
    points.push(
      "Сайт использует средства веб-аналитики для сбора обезличенной статистики посещений. Подробная информация о cookies содержится в соответствующем уведомлении на Сайте."
    );
  }

  if (input.thirdPartyServices && input.thirdPartyServices.length > 0) {
    points.push(
      `Для функционирования Сайта могут использоваться сторонние сервисы: ${input.thirdPartyServices.join(", ")}. Использование данных сервисов регулируется их собственными политиками конфиденциальности.`
    );
  }

  const html = `
    <div class="privacy-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "privacy", title: "4. Конфиденциальность и обработка персональных данных", html };
}

function generatePaymentsBlock(input: UserAgreementInput): DocumentBlock | null {
  if (!input.hasPayments) return null;

  const points: string[] = [];

  // Базовые положения
  points.push(
    "Сайт предоставляет платные Услуги на условиях, указанных в описании соответствующих Услуг."
  );
  points.push(
    "Актуальные цены на Услуги размещены на соответствующих страницах Сайта. Оператор вправе изменять цены без предварительного уведомления."
  );

  // Модель оплаты
  if (input.billingModel === "subscription" || input.hasSubscription) {
    points.push(
      "Оплата Услуг осуществляется по подписной модели. Подписка автоматически продлевается на следующий период, если не отменена Пользователем заблаговременно."
    );
  }

  if (input.hasTrial && input.trialDays) {
    points.push(
      `Пользователю может быть предоставлен пробный период продолжительностью ${input.trialDays} дней. По истечении пробного периода доступ прекращается или происходит автоматическое списание за подписку.`
    );
  }

  if (input.billingModel === "oneTime") {
    points.push(
      "Оплата Услуг осуществляется единовременно за выбранный объём Услуг."
    );
  }

  if (input.billingModel === "payg") {
    points.push(
      "Оплата осуществляется по модели «pay-as-you-go» — за фактически потреблённые Услуги."
    );
  }

  // Момент оплаты и оказания
  points.push(
    "Услуга считается оказанной с момента предоставления доступа к соответствующему функционалу или материалам."
  );
  points.push(
    "Оплата производится с использованием платёжных систем, указанных на Сайте. Оператор не хранит и не обрабатывает данные банковских карт Пользователей."
  );

  // Возвраты
  if (input.refundPolicy === "standard") {
    if (input.deliveryType === "digital" || input.siteType === "onlineSchool" || input.siteType === "saas" || input.siteType === "crmSaas") {
      points.push(
        "Возврат денежных средств за цифровые услуги и доступ к контенту осуществляется в соответствии с законодательством РФ. После получения доступа к цифровому контенту возврат, как правило, не производится."
      );
    } else if (input.deliveryType === "physical") {
      points.push(
        "Возврат товаров надлежащего качества возможен в течение срока, установленного законодательством РФ, при сохранении товарного вида и потребительских свойств."
      );
    } else {
      points.push(
        "Порядок возврата денежных средств определяется в соответствии с законодательством РФ и характером оказываемых Услуг."
      );
    }
  } else if (input.refundPolicy === "none") {
    points.push(
      "Возврат денежных средств не производится, за исключением случаев, прямо предусмотренных законодательством РФ."
    );
  }

  const html = `
    <div class="payments-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "payments", title: "5. Платные услуги и порядок оплаты", html };
}

function generateRefundBlock(input: UserAgreementInput): DocumentBlock | null {
  if (!input.hasPayments || input.refundPolicy === "none") return null;

  const points: string[] = [];

  points.push(
    "Пользователь вправе обратиться с заявлением о возврате денежных средств в порядке, установленном законодательством РФ."
  );

  if (input.deliveryType === "digital" || input.siteType === "onlineSchool" || input.siteType === "saas") {
    points.push(
      "Для цифровых услуг и контента: возврат возможен до момента начала использования (получения доступа). После активации доступа возврат производится только при существенных недостатках услуги."
    );
  }

  if (input.deliveryType === "physical" || input.siteType === "ecommerce") {
    points.push(
      "Для товаров с физической доставкой: возврат товара надлежащего качества возможен в установленные законом сроки при сохранении товарного вида."
    );
    points.push(
      "Расходы на обратную доставку товара несёт Пользователь, за исключением случаев возврата товара ненадлежащего качества."
    );
  }

  points.push(
    "Для оформления возврата Пользователь направляет заявление на адрес электронной почты Оператора."
  );
  points.push(
    "Возврат денежных средств осуществляется тем же способом, которым была произведена оплата, в течение сроков, установленных законодательством."
  );

  const html = `
    <div class="refund-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "refund", title: "6. Порядок возврата", html };
}

function generateLiabilityBlock(input: UserAgreementInput): DocumentBlock {
  const points: string[] = [
    "Сайт и все его функции предоставляются на условиях «как есть» (as is). Оператор не гарантирует бесперебойную работу Сайта.",
    "Оператор не несёт ответственности за любые косвенные, случайные или побочные убытки, возникшие в связи с использованием или невозможностью использования Сайта.",
    "Пользователь несёт полную ответственность за свои действия на Сайте, включая размещаемый контент и сообщения.",
    "Оператор не несёт ответственности за действия третьих лиц, в том числе за контент, размещённый другими Пользователями.",
  ];

  // Специальные оговорки для образовательных платформ
  if (input.siteType === "onlineSchool") {
    points.push(
      "Оператор не гарантирует достижение конкретных результатов обучения. Результат зависит от усилий и способностей самого Пользователя."
    );
  }

  // Для агрегаторов услуг
  if (input.siteType === "servicesAggregator" || input.siteType === "marketplace") {
    if (input.platformRole === "infoPlatformOnly") {
      points.push(
        "Оператор является исключительно информационным посредником и не является стороной договоров между Пользователями и Исполнителями/Продавцами."
      );
    }
    points.push(
      "Ответственность за качество услуг/товаров несут непосредственные исполнители/продавцы."
    );
  }

  // Форс-мажор
  points.push(
    "Оператор освобождается от ответственности за неисполнение обязательств, вызванное обстоятельствами непреодолимой силы (форс-мажор)."
  );

  // Ограничение ответственности
  if (input.hasPayments) {
    points.push(
      "Совокупная ответственность Оператора перед Пользователем ограничивается суммой, фактически уплаченной Пользователем за Услуги."
    );
  }

  const html = `
    <div class="liability-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "liability", title: "7. Ответственность и ограничение гарантий", html };
}

function generateUgcBlock(input: UserAgreementInput): DocumentBlock | null {
  const requiresUgc =
    input.ugcAllowed ||
    input.siteType === "classifieds" ||
    input.siteType === "marketplace" ||
    input.siteType === "servicesAggregator" ||
    input.siteType === "ugc";

  if (!requiresUgc) return null;

  const points: string[] = [];

  // Определение контента
  points.push(
    "Пользовательский контент включает: тексты, изображения, видео, аудио, комментарии, отзывы, объявления и иные материалы, размещаемые Пользователем на Сайте."
  );

  // Требования к контенту
  points.push(
    "Пользователь гарантирует, что размещаемый контент не нарушает права третьих лиц, законодательство РФ и условия настоящего Соглашения."
  );

  // Запрещённый контент
  const prohibited: string[] = [
    "материалы, нарушающие авторские и смежные права",
    "материалы экстремистского характера",
    "материалы, пропагандирующие насилие, дискриминацию, ненависть",
    "материалы порнографического характера (если не разрешено явно)",
    "заведомо ложную информацию",
    "персональные данные третьих лиц без их согласия",
    "рекламу без согласования с Оператором",
    "вредоносное ПО и ссылки на вредоносные ресурсы",
  ];

  if (input.prohibitedContent && input.prohibitedContent.length > 0) {
    prohibited.push(...input.prohibitedContent);
  }

  points.push(`Запрещается размещать: ${prohibited.join("; ")}.`);

  // Модерация
  if (input.moderationMode === "pre") {
    points.push(
      "Все материалы проходят предварительную модерацию. Контент публикуется только после проверки Оператором."
    );
  } else if (input.moderationMode === "post") {
    points.push(
      "Оператор осуществляет постмодерацию контента. Материалы публикуются сразу, но могут быть удалены при нарушении правил."
    );
  } else {
    points.push(
      "Оператор осуществляет модерацию контента. Отдельные материалы могут проходить предварительную проверку."
    );
  }

  // Жалобы
  const complaintsChannel = input.complaintsChannel || input.supportEmail;
  points.push(
    `Жалобы на контент принимаются по адресу: ${escapeHtml(complaintsChannel)}. Оператор рассматривает жалобы в разумные сроки.`
  );

  // Меры
  points.push(
    "При нарушении правил Оператор вправе: скрыть или удалить контент, ограничить функционал учётной записи, заблокировать Пользователя."
  );

  // Лицензия
  points.push(
    "Размещая контент на Сайте, Пользователь предоставляет Оператору неисключительную лицензию на использование такого контента в целях функционирования Сайта, включая хранение, воспроизведение, публичный показ."
  );

  // Для досок объявлений
  if (input.siteType === "classifieds") {
    points.push(
      "Пользователь несёт полную ответственность за достоверность информации в объявлениях."
    );
    points.push(
      "Запрещается размещать объявления о товарах и услугах, оборот которых запрещён или ограничен законодательством РФ."
    );
    points.push(
      "Оператор не является стороной сделок между Пользователями и не несёт ответственности за их исполнение."
    );
  }

  const html = `
    <div class="ugc-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "ugc", title: "8. Пользовательский контент и модерация", html };
}

function generateOnlineSchoolBlock(input: UserAgreementInput): DocumentBlock | null {
  if (input.siteType !== "onlineSchool") return null;

  const points: string[] = [];

  points.push(
    "Сайт предоставляет доступ к образовательным материалам: видеоурокам, текстовым материалам, заданиям и иному контенту."
  );

  if (input.accessPeriodDays) {
    points.push(
      `Доступ к материалам курса предоставляется на срок ${input.accessPeriodDays} дней с момента оплаты/активации.`
    );
  } else {
    points.push(
      "Срок доступа к материалам определяется условиями конкретного курса/программы."
    );
  }

  points.push(
    "Пользователь обязуется не распространять, не копировать и не передавать третьим лицам учебные материалы и записи занятий."
  );
  points.push(
    "При участии в групповых занятиях и чатах Пользователь обязуется соблюдать правила поведения, не оскорблять других участников."
  );
  points.push(
    "Все материалы курса являются объектами интеллектуальной собственности и охраняются законодательством об авторском праве."
  );
  points.push(
    "Нарушение условий использования материалов может повлечь блокировку доступа без возврата денежных средств."
  );

  const html = `
    <div class="online-school-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "onlineSchool", title: "9. Условия онлайн-обучения", html };
}

function generateSaasBlock(input: UserAgreementInput): DocumentBlock | null {
  if (input.siteType !== "saas" && input.siteType !== "crmSaas") return null;

  const points: string[] = [];

  points.push(
    "Сайт предоставляет доступ к программному обеспечению по модели SaaS (Software as a Service)."
  );
  points.push(
    "Оператор обеспечивает функционирование сервиса, выполняет обновления и техническое обслуживание."
  );
  points.push(
    "Оператор вправе проводить профилактические работы с временным ограничением доступа, предварительно уведомив Пользователей при возможности."
  );

  // Подписка
  if (input.hasSubscription || input.billingModel === "subscription") {
    points.push(
      "Доступ к сервису предоставляется на условиях подписки. Подписка автоматически продлевается на следующий период."
    );
    points.push(
      "Для отмены подписки Пользователь должен уведомить Оператора до даты очередного списания."
    );
  }

  // Данные
  points.push(
    "Данные, загруженные Пользователем в сервис, остаются собственностью Пользователя."
  );
  points.push(
    "Пользователь вправе экспортировать свои данные в форматах, поддерживаемых сервисом."
  );

  if (input.dataRetentionDays) {
    points.push(
      `После прекращения подписки данные Пользователя хранятся в течение ${input.dataRetentionDays} дней, после чего могут быть удалены.`
    );
  } else {
    points.push(
      "После прекращения подписки Оператор хранит данные в течение разумного срока для возможности возобновления подписки."
    );
  }

  // Запреты
  points.push(
    "Запрещается: проводить нагрузочное тестирование без согласования, осуществлять реверс-инжиниринг, перепродавать доступ третьим лицам."
  );

  const html = `
    <div class="saas-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "saas", title: "10. Условия использования SaaS-сервиса", html };
}

function generateAggregatorBlock(input: UserAgreementInput): DocumentBlock | null {
  if (input.siteType !== "servicesAggregator" && input.siteType !== "marketplace") return null;

  const points: string[] = [];

  // Роль платформы
  if (input.platformRole === "infoPlatformOnly") {
    points.push(
      "Сайт является информационной платформой, обеспечивающей возможность взаимодействия между Пользователями и Исполнителями/Продавцами."
    );
    points.push(
      "Оператор не является стороной договоров, заключаемых между Пользователями и Исполнителями/Продавцами."
    );
  } else if (input.platformRole === "agent") {
    points.push(
      "Оператор выступает агентом, действующим от имени Исполнителей/Продавцов при оформлении заказов."
    );
  } else {
    points.push(
      "Роль Оператора в отношениях между Пользователями и Исполнителями определяется условиями конкретных услуг."
    );
  }

  points.push(
    "Исполнители/Продавцы несут ответственность за качество предоставляемых услуг/товаров, достоверность описаний и соблюдение законодательства."
  );
  points.push(
    "Оператор не гарантирует качество услуг/товаров, предоставляемых Исполнителями/Продавцами."
  );

  // Отзывы и рейтинги
  points.push(
    "На Сайте могут публиковаться отзывы и рейтинги Исполнителей/Продавцов. Оператор вправе модерировать отзывы."
  );
  points.push(
    "Запрещается накрутка отзывов, размещение заведомо ложных отзывов и иные формы манипуляции рейтингом."
  );

  const html = `
    <div class="aggregator-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "aggregator", title: "11. Условия работы платформы", html };
}

function generateIntellectualPropertyBlock(input: UserAgreementInput): DocumentBlock {
  const points: string[] = [
    "Все материалы Сайта (дизайн, тексты, графика, программный код, товарные знаки) являются объектами интеллектуальной собственности Оператора или третьих лиц.",
    "Использование материалов Сайта без письменного согласия правообладателя запрещено.",
    "Пользователю предоставляется ограниченное право использования Сайта в личных некоммерческих целях.",
  ];

  const html = `
    <div class="ip-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "intellectual-property", title: "12. Интеллектуальная собственность", html };
}

function generateDisputesBlock(input: UserAgreementInput): DocumentBlock {
  const points: string[] = [
    "Все споры, возникающие из настоящего Соглашения, разрешаются путём переговоров.",
    `При невозможности достижения согласия споры подлежат рассмотрению в суде по месту нахождения Оператора (г. ${escapeHtml(input.jurisdictionCity)}).`,
    "К отношениям сторон применяется законодательство Российской Федерации.",
  ];

  const html = `
    <div class="disputes-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "disputes", title: "13. Разрешение споров", html };
}

function generateFinalBlock(input: UserAgreementInput): DocumentBlock {
  const points: string[] = [
    "Настоящее Соглашение вступает в силу с момента начала использования Сайта Пользователем.",
    "Соглашение действует бессрочно до момента его изменения или отмены Оператором.",
    "Недействительность отдельных положений Соглашения не влечёт недействительности Соглашения в целом.",
  ];

  const html = `
    <div class="final-block">
      <ol>
        ${points.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ol>
    </div>
  `;

  return { id: "final", title: "14. Заключительные положения", html };
}

function generateContactsBlock(input: UserAgreementInput): DocumentBlock {
  const lines: string[] = [];

  lines.push(`<strong>Наименование:</strong> ${getOperatorTypeName(input.operatorType)} ${escapeHtml(input.operatorNameFull)}`);

  if (input.operatorInn) {
    lines.push(`<strong>ИНН:</strong> ${escapeHtml(input.operatorInn)}`);
  }

  if (input.operatorOgrnOrOgrnip) {
    const label = input.operatorType === "ip" ? "ОГРНИП" : "ОГРН";
    lines.push(`<strong>${label}:</strong> ${escapeHtml(input.operatorOgrnOrOgrnip)}`);
  }

  if (input.operatorAddress) {
    lines.push(`<strong>Адрес:</strong> ${escapeHtml(input.operatorAddress)}`);
  }

  lines.push(`<strong>Email:</strong> ${escapeHtml(input.supportEmail)}`);

  if (input.supportPhone) {
    lines.push(`<strong>Телефон:</strong> ${escapeHtml(input.supportPhone)}`);
  }

  lines.push(`<strong>Сайт:</strong> ${escapeHtml(input.siteUrl)}`);

  const html = `
    <div class="contacts-block">
      <p>${lines.join("<br>\n      ")}</p>
      <p><em>Дата публикации: ${formatDate()}</em></p>
    </div>
  `;

  return { id: "contacts", title: "15. Реквизиты и контакты Оператора", html };
}

// ============================================
// Main Generator Function
// ============================================
export function generateUserAgreement(input: UserAgreementInput): UserAgreementOutput {
  const blocks: DocumentBlock[] = [];
  const evidence: string[] = [];
  const limitations: string[] = [];

  // Собираем блоки
  blocks.push(generateSummaryBlock(input));
  evidence.push("Добавлено краткое содержание документа");

  blocks.push(generateTermsBlock(input));
  evidence.push("Добавлены термины и определения");

  blocks.push(generateGeneralBlock(input));
  evidence.push("Добавлены общие положения");

  const registrationBlock = generateRegistrationBlock(input);
  if (registrationBlock) {
    blocks.push(registrationBlock);
    evidence.push("Добавлен раздел о регистрации (hasRegistration=true)");
  }

  blocks.push(generatePrivacyBlock(input));
  evidence.push("Добавлен раздел о конфиденциальности");
  if (input.analyticsUsed) {
    evidence.push("Включена информация об аналитике (analyticsUsed=true)");
  }

  const paymentsBlock = generatePaymentsBlock(input);
  if (paymentsBlock) {
    blocks.push(paymentsBlock);
    evidence.push(`Добавлен раздел об оплате (billingModel=${input.billingModel || "default"})`);
    limitations.push("Проверьте соответствие условий оплаты требованиям 54-ФЗ (онлайн-касса, чеки)");
  }

  const refundBlock = generateRefundBlock(input);
  if (refundBlock) {
    blocks.push(refundBlock);
    evidence.push("Добавлен раздел о возвратах");
    limitations.push("Уточните конкретные сроки возврата для вашей категории товаров/услуг");
  }

  blocks.push(generateLiabilityBlock(input));
  evidence.push("Добавлен раздел об ответственности и гарантиях");

  const ugcBlock = generateUgcBlock(input);
  if (ugcBlock) {
    blocks.push(ugcBlock);
    evidence.push(`Добавлен раздел о UGC и модерации (moderationMode=${input.moderationMode || "default"})`);
    limitations.push("При наличии специфического контента проконсультируйтесь с юристом о дополнительных требованиях");
  }

  const onlineSchoolBlock = generateOnlineSchoolBlock(input);
  if (onlineSchoolBlock) {
    blocks.push(onlineSchoolBlock);
    evidence.push("Добавлен раздел для онлайн-школы");
    limitations.push("Для образовательной деятельности могут требоваться лицензии (Закон об образовании)");
  }

  const saasBlock = generateSaasBlock(input);
  if (saasBlock) {
    blocks.push(saasBlock);
    evidence.push("Добавлен раздел для SaaS-сервиса");
    limitations.push("Проверьте соответствие условий хранения данных требованиям 152-ФЗ");
  }

  const aggregatorBlock = generateAggregatorBlock(input);
  if (aggregatorBlock) {
    blocks.push(aggregatorBlock);
    evidence.push(`Добавлен раздел для агрегатора (platformRole=${input.platformRole || "not specified"})`);
    limitations.push("Уточните правовой статус платформы с юристом (агент/комиссионер/посредник)");
  }

  blocks.push(generateIntellectualPropertyBlock(input));
  evidence.push("Добавлен раздел об интеллектуальной собственности");

  blocks.push(generateDisputesBlock(input));
  evidence.push("Добавлен раздел о разрешении споров");

  blocks.push(generateFinalBlock(input));
  evidence.push("Добавлены заключительные положения");

  blocks.push(generateContactsBlock(input));
  evidence.push("Добавлены реквизиты оператора");

  // Общие ограничения
  limitations.push("Рекомендуется проверка документа квалифицированным юристом");
  limitations.push("При работе с отдельными категориями товаров/услуг могут требоваться дополнительные разделы");
  if (input.ageRestriction === "18plus") {
    limitations.push("Для 18+ контента могут требоваться дополнительные меры верификации возраста");
  }

  // Генерируем полный HTML
  const title = "ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ";
  const subtitle = `сайта ${input.siteUrl}`;

  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Times New Roman', serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
    h2 { font-size: 14px; margin-top: 20px; margin-bottom: 10px; }
    .subtitle { text-align: center; font-size: 14px; margin-bottom: 20px; }
    ol { padding-left: 20px; }
    li { margin-bottom: 8px; }
    .summary-block { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
    .summary-block ul { margin: 10px 0; }
    .contacts-block { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="subtitle">${subtitle}</p>
  
  ${blocks.map((block) => `<section id="${block.id}">
    <h2>${block.title}</h2>
    ${block.html}
  </section>`).join("\n\n  ")}
</body>
</html>`;

  // Генерируем TEXT версию
  const fullText = blocks
    .map((block) => {
      const textContent = block.html
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
      return `${block.title}\n\n${textContent}`;
    })
    .join("\n\n---\n\n");

  // JSON представление
  const jsonData: Record<string, unknown> = {
    documentType: "user-agreement",
    version: "1.0",
    generatedAt: new Date().toISOString(),
    operator: {
      type: input.operatorType,
      name: input.operatorNameFull,
      email: input.supportEmail,
      jurisdiction: input.jurisdictionCity,
    },
    site: {
      url: input.siteUrl,
      type: input.siteType,
    },
    features: {
      hasRegistration: input.hasRegistration,
      hasPayments: input.hasPayments,
      ugcAllowed: input.ugcAllowed,
      ageRestriction: input.ageRestriction,
    },
    sections: blocks.map((b) => ({ id: b.id, title: b.title })),
  };

  return {
    toolId: "user-agreement-generator",
    format: {
      html: fullHtml,
      text: fullText,
      blocks,
      json: jsonData,
    },
    evidence,
    limitations,
  };
}
