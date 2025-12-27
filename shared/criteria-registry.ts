export type CriteriaGroup = "fz152" | "fz149" | "cookies" | "technical" | "legal";

export type CriteriaCheckKind =
  | "page_exists"
  | "page_contains_text"
  | "dom_has_selector"
  | "headers_has"
  | "tls"
  | "links_to"
  | "manual_required";

export type CriteriaStatus = "passed" | "warning" | "failed" | "needs_manual";

export type EvidenceType = "url" | "title" | "text_snippet" | "header" | "selector";

export interface CriteriaEvidence {
  url: string;
  type: EvidenceType;
  value: string;
  extra?: Record<string, any>;
}

export interface CriteriaDefinition {
  id: string;
  group: CriteriaGroup;
  title: string;
  lawRef?: string;
  checkKind: CriteriaCheckKind;
  recommendation: string;
  severity: "critical" | "medium" | "low";
}

export interface CriteriaResultV2 {
  id: string;
  group: CriteriaGroup;
  title: string;
  status: CriteriaStatus;
  evidence?: CriteriaEvidence;
  details?: string;
  recommendation: string;
  severity: "critical" | "medium" | "low";
}

export const SERVICE_1_CRITERIA: CriteriaDefinition[] = [
  // ФЗ-152: 12 criteria
  {
    id: "fz152.policy.exists",
    group: "fz152",
    title: "Наличие Политики обработки персональных данных",
    lawRef: "152-ФЗ ст. 18.1",
    checkKind: "page_exists",
    recommendation: "Разместите Политику обработки ПДн на сайте",
    severity: "critical",
  },
  {
    id: "fz152.policy.operator_name",
    group: "fz152",
    title: "Указание наименования оператора ПДн",
    lawRef: "152-ФЗ ст. 18.1",
    checkKind: "page_contains_text",
    recommendation: "Укажите полное наименование организации-оператора в Политике",
    severity: "critical",
  },
  {
    id: "fz152.policy.purposes",
    group: "fz152",
    title: "Указание целей обработки ПДн",
    lawRef: "152-ФЗ ст. 18.1",
    checkKind: "page_contains_text",
    recommendation: "Перечислите все цели обработки персональных данных",
    severity: "critical",
  },
  {
    id: "fz152.policy.categories",
    group: "fz152",
    title: "Указание категорий обрабатываемых ПДн",
    lawRef: "152-ФЗ ст. 18.1",
    checkKind: "page_contains_text",
    recommendation: "Укажите категории обрабатываемых персональных данных",
    severity: "medium",
  },
  {
    id: "fz152.policy.legal_basis",
    group: "fz152",
    title: "Указание правовых оснований обработки",
    lawRef: "152-ФЗ ст. 18.1",
    checkKind: "page_contains_text",
    recommendation: "Укажите правовые основания для обработки ПДн",
    severity: "medium",
  },
  {
    id: "fz152.policy.storage_period",
    group: "fz152",
    title: "Указание сроков хранения ПДн",
    lawRef: "152-ФЗ ст. 18.1",
    checkKind: "page_contains_text",
    recommendation: "Укажите сроки хранения персональных данных",
    severity: "medium",
  },
  {
    id: "fz152.policy.third_parties",
    group: "fz152",
    title: "Указание третьих лиц (получателей ПДн)",
    lawRef: "152-ФЗ ст. 18.1",
    checkKind: "page_contains_text",
    recommendation: "Укажите третьих лиц, которым передаются ПДн",
    severity: "medium",
  },
  {
    id: "fz152.policy.cross_border",
    group: "fz152",
    title: "Информация о трансграничной передаче",
    lawRef: "152-ФЗ ст. 12",
    checkKind: "page_contains_text",
    recommendation: "Укажите информацию о трансграничной передаче ПДн (если применимо)",
    severity: "low",
  },
  {
    id: "fz152.consent.checkbox",
    group: "fz152",
    title: "Наличие чекбокса согласия на обработку ПДн",
    lawRef: "152-ФЗ ст. 9",
    checkKind: "dom_has_selector",
    recommendation: "Добавьте чекбокс получения согласия на обработку ПДн в формы",
    severity: "critical",
  },
  {
    id: "fz152.consent.link_to_policy",
    group: "fz152",
    title: "Ссылка на Политику ПДн в форме согласия",
    lawRef: "152-ФЗ ст. 9",
    checkKind: "links_to",
    recommendation: "Добавьте ссылку на Политику ПДн рядом с чекбоксом согласия",
    severity: "critical",
  },
  {
    id: "fz152.rights.access",
    group: "fz152",
    title: "Информация о правах субъекта ПДн",
    lawRef: "152-ФЗ ст. 14",
    checkKind: "page_contains_text",
    recommendation: "Укажите права субъекта ПДн на доступ, изменение, удаление данных",
    severity: "medium",
  },
  {
    id: "fz152.contacts.dpo",
    group: "fz152",
    title: "Контакты ответственного за обработку ПДн",
    lawRef: "152-ФЗ ст. 22.1",
    checkKind: "page_contains_text",
    recommendation: "Укажите контактные данные ответственного за обработку ПДн",
    severity: "medium",
  },

  // ФЗ-149: 4 criteria
  {
    id: "fz149.operator_info.inn",
    group: "fz149",
    title: "Указание ИНН организации",
    lawRef: "149-ФЗ ст. 10",
    checkKind: "page_contains_text",
    recommendation: "Укажите ИНН организации на сайте",
    severity: "medium",
  },
  {
    id: "fz149.operator_info.ogrn",
    group: "fz149",
    title: "Указание ОГРН организации",
    lawRef: "149-ФЗ ст. 10",
    checkKind: "page_contains_text",
    recommendation: "Укажите ОГРН организации на сайте",
    severity: "medium",
  },
  {
    id: "fz149.operator_info.address",
    group: "fz149",
    title: "Указание юридического адреса",
    lawRef: "149-ФЗ ст. 10",
    checkKind: "page_contains_text",
    recommendation: "Укажите юридический адреса организации",
    severity: "medium",
  },
  {
    id: "fz149.operator_info.email",
    group: "fz149",
    title: "Указание контактного email",
    lawRef: "149-ФЗ ст. 10",
    checkKind: "page_contains_text",
    recommendation: "Укажите контактный email для связи",
    severity: "low",
  },

  // Cookies: 9 criteria
  {
    id: "cookies.banner.exists",
    group: "cookies",
    title: "Наличие уведомления о cookies",
    lawRef: "152-ФЗ",
    checkKind: "dom_has_selector",
    recommendation: "Добавьте баннер уведомления об использовании cookies",
    severity: "critical",
  },
  {
    id: "cookies.banner.accept_button",
    group: "cookies",
    title: "Кнопка принятия cookies",
    lawRef: "152-ФЗ",
    checkKind: "dom_has_selector",
    recommendation: "Добавьте кнопку принятия cookies в баннер",
    severity: "medium",
  },
  {
    id: "cookies.banner.reject_option",
    group: "cookies",
    title: "Возможность отказа от cookies",
    lawRef: "152-ФЗ",
    checkKind: "dom_has_selector",
    recommendation: "Добавьте возможность отказа от необязательных cookies",
    severity: "medium",
  },
  {
    id: "cookies.banner.settings_option",
    group: "cookies",
    title: "Настройки категорий cookies",
    lawRef: "152-ФЗ",
    checkKind: "dom_has_selector",
    recommendation: "Добавьте возможность выбора категорий cookies",
    severity: "low",
  },
  {
    id: "cookies.policy.exists",
    group: "cookies",
    title: "Наличие Политики использования cookies",
    lawRef: "152-ФЗ",
    checkKind: "page_exists",
    recommendation: "Разместите Политику использования cookies на сайте",
    severity: "medium",
  },
  {
    id: "cookies.policy.types_listed",
    group: "cookies",
    title: "Перечисление типов используемых cookies",
    lawRef: "152-ФЗ",
    checkKind: "page_contains_text",
    recommendation: "Перечислите все типы используемых cookies",
    severity: "medium",
  },
  {
    id: "cookies.policy.purposes",
    group: "cookies",
    title: "Указание целей использования cookies",
    lawRef: "152-ФЗ",
    checkKind: "page_contains_text",
    recommendation: "Укажите цели использования каждого типа cookies",
    severity: "medium",
  },
  {
    id: "cookies.policy.third_party",
    group: "cookies",
    title: "Информация о сторонних cookies",
    lawRef: "152-ФЗ",
    checkKind: "page_contains_text",
    recommendation: "Укажите информацию о сторонних cookies (аналитика, реклама)",
    severity: "low",
  },
  {
    id: "cookies.no_preload",
    group: "cookies",
    title: "Cookies не загружаются до согласия",
    lawRef: "152-ФЗ",
    checkKind: "manual_required",
    recommendation: "Убедитесь, что необязательные cookies не загружаются до согласия",
    severity: "medium",
  },

  // Техбезопасность: 12 criteria
  {
    id: "technical.https.enabled",
    group: "technical",
    title: "Использование HTTPS",
    checkKind: "tls",
    recommendation: "Настройте SSL/TLS сертификат для сайта",
    severity: "critical",
  },
  {
    id: "technical.https.redirect",
    group: "technical",
    title: "Редирект с HTTP на HTTPS",
    checkKind: "headers_has",
    recommendation: "Настройте автоматический редирект с HTTP на HTTPS",
    severity: "medium",
  },
  {
    id: "technical.hsts.enabled",
    group: "technical",
    title: "Заголовок Strict-Transport-Security (HSTS)",
    checkKind: "headers_has",
    recommendation: "Добавьте заголовок HSTS для принудительного использования HTTPS",
    severity: "medium",
  },
  {
    id: "technical.csp.exists",
    group: "technical",
    title: "Заголовок Content-Security-Policy",
    checkKind: "headers_has",
    recommendation: "Настройте заголовок CSP для защиты от XSS атак",
    severity: "medium",
  },
  {
    id: "technical.xfo.exists",
    group: "technical",
    title: "Заголовок X-Frame-Options",
    checkKind: "headers_has",
    recommendation: "Добавьте заголовок X-Frame-Options для защиты от clickjacking",
    severity: "medium",
  },
  {
    id: "technical.xcto.exists",
    group: "technical",
    title: "Заголовок X-Content-Type-Options",
    checkKind: "headers_has",
    recommendation: "Добавьте заголовок X-Content-Type-Options: nosniff",
    severity: "low",
  },
  {
    id: "technical.referrer.policy",
    group: "technical",
    title: "Заголовок Referrer-Policy",
    checkKind: "headers_has",
    recommendation: "Настройте заголовок Referrer-Policy для контроля передачи реферера",
    severity: "low",
  },
  {
    id: "technical.permissions.policy",
    group: "technical",
    title: "Заголовок Permissions-Policy",
    checkKind: "headers_has",
    recommendation: "Настройте Permissions-Policy для контроля доступа к API браузера",
    severity: "low",
  },
  {
    id: "technical.mixed_content",
    group: "technical",
    title: "Отсутствие смешанного контента",
    checkKind: "page_contains_text",
    recommendation: "Убедитесь, что все ресурсы загружаются через HTTPS",
    severity: "medium",
  },
  {
    id: "technical.forms.secure",
    group: "technical",
    title: "Формы отправляются через HTTPS",
    checkKind: "dom_has_selector",
    recommendation: "Убедитесь, что все формы отправляются через HTTPS",
    severity: "critical",
  },
  {
    id: "technical.cors.configured",
    group: "technical",
    title: "Корректная настройка CORS",
    checkKind: "headers_has",
    recommendation: "Проверьте настройки CORS для API-запросов",
    severity: "low",
  },
  {
    id: "technical.server_info.hidden",
    group: "technical",
    title: "Скрытие информации о сервере",
    checkKind: "headers_has",
    recommendation: "Скройте версии ПО в заголовках Server и X-Powered-By",
    severity: "low",
  },

  // Юридические страницы: 8 criteria
  {
    id: "legal.offer.exists",
    group: "legal",
    title: "Наличие публичной оферты/договора",
    checkKind: "page_exists",
    recommendation: "Разместите публичную оферту или договор на сайте",
    severity: "critical",
  },
  {
    id: "legal.offer.subject",
    group: "legal",
    title: "Указание предмета договора",
    checkKind: "page_contains_text",
    recommendation: "Укажите предмет договора в оферте",
    severity: "medium",
  },
  {
    id: "legal.offer.price",
    group: "legal",
    title: "Указание стоимости услуг/товаров",
    checkKind: "page_contains_text",
    recommendation: "Укажите стоимость услуг или товаров",
    severity: "medium",
  },
  {
    id: "legal.offer.payment_terms",
    group: "legal",
    title: "Условия оплаты",
    checkKind: "page_contains_text",
    recommendation: "Укажите условия и способы оплаты",
    severity: "medium",
  },
  {
    id: "legal.offer.delivery_terms",
    group: "legal",
    title: "Условия доставки/оказания услуг",
    checkKind: "page_contains_text",
    recommendation: "Укажите условия доставки или оказания услуг",
    severity: "medium",
  },
  {
    id: "legal.contacts.page_exists",
    group: "legal",
    title: "Наличие страницы контактов",
    checkKind: "page_exists",
    recommendation: "Создайте страницу с контактной информацией",
    severity: "medium",
  },
  {
    id: "legal.contacts.phone",
    group: "legal",
    title: "Указание контактного телефона",
    checkKind: "page_contains_text",
    recommendation: "Укажите контактный телефон организации",
    severity: "low",
  },
  {
    id: "legal.refund.policy",
    group: "legal",
    title: "Политика возврата",
    checkKind: "page_contains_text",
    recommendation: "Укажите условия возврата товаров/средств",
    severity: "medium",
  },
];

export const SERVICE_2_CRITERIA: CriteriaDefinition[] = [
  ...SERVICE_1_CRITERIA,
  // Additional document preparation criteria for Service 2
  {
    id: "docs.privacy.policy.ready",
    group: "fz152",
    title: "Подготовка Политики обработки ПДн",
    lawRef: "152-ФЗ ст. 18.1",
    checkKind: "manual_required",
    recommendation: "Документ будет подготовлен специалистом",
    severity: "critical",
  },
  {
    id: "docs.consent.form.ready",
    group: "fz152",
    title: "Подготовка формы согласия на обработку ПДн",
    lawRef: "152-ФЗ ст. 9",
    checkKind: "manual_required",
    recommendation: "Форма согласия будет подготовлена специалистом",
    severity: "critical",
  },
  {
    id: "docs.operator.order.ready",
    group: "fz152",
    title: "Подготовка приказа о назначении ответственного",
    lawRef: "152-ФЗ ст. 22.1",
    checkKind: "manual_required",
    recommendation: "Приказ будет подготовлен специалистом",
    severity: "medium",
  },
  {
    id: "docs.instruction.ready",
    group: "fz152",
    title: "Подготовка инструкции по обработке ПДн",
    lawRef: "152-ФЗ",
    checkKind: "manual_required",
    recommendation: "Инструкция будет подготовлена специалистом",
    severity: "medium",
  },
  {
    id: "docs.rkn.notification.ready",
    group: "fz152",
    title: "Подготовка уведомления в РКН",
    lawRef: "152-ФЗ ст. 22",
    checkKind: "manual_required",
    recommendation: "Уведомление будет подготовлено специалистом",
    severity: "critical",
  },
  {
    id: "docs.cookies.policy.ready",
    group: "cookies",
    title: "Подготовка Политики использования cookies",
    lawRef: "152-ФЗ",
    checkKind: "manual_required",
    recommendation: "Документ будет подготовлен специалистом",
    severity: "medium",
  },
  {
    id: "docs.offer.ready",
    group: "legal",
    title: "Подготовка публичной оферты",
    checkKind: "manual_required",
    recommendation: "Оферта будет подготовлена специалистом",
    severity: "critical",
  },
  {
    id: "docs.implementation.support",
    group: "legal",
    title: "Помощь во внедрении документов на сайт",
    checkKind: "manual_required",
    recommendation: "Специалист поможет разместить документы",
    severity: "low",
  },
];

export function countByGroup(list: CriteriaDefinition[]): Record<CriteriaGroup, number> {
  const result: Record<CriteriaGroup, number> = {
    fz152: 0,
    fz149: 0,
    cookies: 0,
    technical: 0,
    legal: 0,
  };
  for (const c of list) {
    result[c.group]++;
  }
  return result;
}

export function totalCount(list: CriteriaDefinition[]): number {
  return list.length;
}

export const SERVICE_1_GROUP_LABELS: Record<CriteriaGroup, string> = {
  fz152: "ФЗ-152 (Персональные данные)",
  fz149: "ФЗ-149 (Информация)",
  cookies: "Cookie и согласия",
  technical: "Техническая безопасность",
  legal: "Юридические страницы",
};
