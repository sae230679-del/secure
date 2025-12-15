export const EXPRESS_PACKAGE = {
  name: "Полный отчёт экспресс-проверки",
  type: "expressreport",
  price: 900,
  criteriaCount: 63,
  durationMin: 5,
  durationMax: 10,
  description: "Детальный PDF-отчёт с анализом каждого нарушения",
  features: [
    "PDF с разбором каждого нарушения",
    "Рекомендации по исправлению",
    "Размер штрафов за каждое нарушение",
    "Ссылки на законодательство",
  ],
} as const;

export const FULL_AUDIT_PACKAGES = {
  landing: {
    name: "Лендинг",
    type: "landing",
    siteType: "landing",
    price: 3900,
    criteriaCount: 63,
    durationMin: 15,
    durationMax: 30,
    description: "Аудит одностраничного сайта (до 3 страниц)",
    features: [
      "Полный аудит по 63 критериям",
      "10 готовых документов",
      "Политика конфиденциальности",
      "Cookie-баннер (HTML/CSS/JS)",
      "Согласия на ОПД",
      "Консультация 30 мин",
    ],
  },
  biometry: {
    name: "С биометрией",
    type: "with_photos",
    siteType: "biometry",
    price: 3900,
    criteriaCount: 63,
    durationMin: 20,
    durationMax: 35,
    description: "Сайт с фотографиями сотрудников (до 5 страниц)",
    features: [
      "Все критерии Лендинга",
      "Согласие на публикацию фото",
      "Обработка биометрических данных",
      "Шаблоны согласий для сотрудников",
    ],
  },
  corporate: {
    name: "Корпоративный",
    type: "corporate",
    siteType: "corporate",
    price: 4900,
    criteriaCount: 63,
    durationMin: 25,
    durationMax: 45,
    description: "Корпоративный сайт (6-50 страниц)",
    features: [
      "Все критерии Лендинга",
      "Корпоративные политики",
      "Реквизиты и документы компании",
      "Видеоконсультация 1 час",
    ],
  },
  media: {
    name: "Медиа / Блог",
    type: "media",
    siteType: "media",
    price: 4900,
    criteriaCount: 63,
    durationMin: 25,
    durationMax: 45,
    description: "Новостные и контентные сайты",
    features: [
      "Все критерии Лендинга",
      "Авторские права",
      "Комментарии и UGC",
      "Подписки и рассылки",
    ],
  },
  saas: {
    name: "SaaS / Сервис",
    type: "saas",
    siteType: "saas",
    price: 5900,
    criteriaCount: 63,
    durationMin: 30,
    durationMax: 50,
    description: "Онлайн-сервисы и приложения",
    features: [
      "Все критерии Корпоративного",
      "Пользовательское соглашение",
      "Условия подписки",
      "Безопасность аккаунтов",
    ],
  },
  children: {
    name: "Детские услуги",
    type: "children",
    siteType: "children",
    price: 6900,
    criteriaCount: 63,
    durationMin: 30,
    durationMax: 50,
    description: "Образование и услуги для детей",
    features: [
      "Согласие родителей/опекунов",
      "Защита данных несовершеннолетних",
      "Специальные требования ФЗ-152",
      "Готовые шаблоны документов",
    ],
  },
  portal: {
    name: "Портал / Комьюнити",
    type: "portal",
    siteType: "portal",
    price: 6900,
    criteriaCount: 63,
    durationMin: 35,
    durationMax: 55,
    description: "Порталы и сообщества с регистрацией",
    features: [
      "Все критерии SaaS",
      "Модерация контента",
      "Правила сообщества",
      "Защита пользовательских данных",
    ],
  },
  ecommerce: {
    name: "Интернет-магазин",
    type: "ecommerce",
    siteType: "ecommerce",
    price: 7900,
    criteriaCount: 63,
    durationMin: 40,
    durationMax: 60,
    description: "E-commerce платформы с оплатой",
    features: [
      "Все критерии Корпоративного",
      "Оферта и условия продажи",
      "Политика возврата",
      "Безопасность платежей",
      "Согласие на доставку",
    ],
  },
  medical: {
    name: "Медицинский сайт",
    type: "medical",
    siteType: "medical",
    price: 7900,
    criteriaCount: 63,
    durationMin: 40,
    durationMax: 60,
    description: "Клиники и медицинские сервисы",
    features: [
      "Согласие на биометрию",
      "Обработка медицинских данных",
      "HIPAA / ФЗ-152 соответствие",
      "Формы согласий пациентов",
    ],
  },
  forum: {
    name: "Форум / Соцсеть",
    type: "forum",
    siteType: "forum",
    price: 8900,
    criteriaCount: 63,
    durationMin: 45,
    durationMax: 70,
    description: "Форумы и социальные сети с UGC",
    features: [
      "Модерация контента",
      "Согласие пользователей",
      "Правила сообщества",
      "Защита персональных данных",
      "Обработка жалоб",
    ],
  },
  marketplace: {
    name: "Маркетплейс",
    type: "marketplace",
    siteType: "marketplace",
    price: 9900,
    criteriaCount: 63,
    durationMin: 50,
    durationMax: 80,
    description: "Торговые площадки с продавцами",
    features: [
      "Все критерии E-Commerce",
      "Правила для продавцов",
      "Защита покупателей",
      "Обработка споров",
      "Комиссии и выплаты",
    ],
  },
  premium: {
    name: "Premium Audit",
    type: "premium",
    siteType: "premium",
    price: 39900,
    criteriaCount: 63,
    durationMin: 120,
    durationMax: 240,
    description: "Полный экспертный аудит (>50 страниц)",
    features: [
      "Все критерии всех пакетов",
      "15 готовых документов",
      "Экспертный анализ юриста",
      "Видеоконсультация 2 часа",
      "Помощь с внедрением (2 недели)",
      "Обучение персонала",
      "Помощь с уведомлением в РКН",
    ],
  },
  other: {
    name: "Другое / Универсальный",
    type: "other",
    siteType: "other",
    price: 15900,
    criteriaCount: 63,
    durationMin: 60,
    durationMax: 90,
    description: "Универсальная проверка всех типов сайтов",
    features: [
      "Полный аудит по 63 критериям",
      "10 готовых документов",
      "Анализ специфики сайта",
      "Персональный подход",
      "Расширенные рекомендации",
      "Консультация эксперта",
    ],
  },
} as const;

export const PACKAGES_DATA = FULL_AUDIT_PACKAGES;

export type PackageType = keyof typeof FULL_AUDIT_PACKAGES;
export type PackageData = typeof FULL_AUDIT_PACKAGES[PackageType];

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatDuration(min: number, max: number): string {
  if (min >= 60 || max >= 60) {
    const minHours = Math.floor(min / 60);
    const maxHours = Math.floor(max / 60);
    if (minHours === maxHours) {
      return `${minHours} ч`;
    }
    return `${minHours}-${maxHours} ч`;
  }
  return `${min}-${max} мин`;
}
