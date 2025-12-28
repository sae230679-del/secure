# SecureLex.ru - Роуты и Эндпоинты

## Переменные

```
BASE_URL=https://ea339cdf-18fa-4e4d-9a93-3a96afbc4eb9-00-2fkmv05f2lmj2.riker.replit.dev
API_URL=https://ea339cdf-18fa-4e4d-9a93-3a96afbc4eb9-00-2fkmv05f2lmj2.riker.replit.dev
```

---

## Superadmin доступ

### Способ 1: Через env переменные (рекомендуется для нового деплоя)

Установите переменные окружения перед запуском:

```bash
SUPERADMIN_EMAIL=admin@example.ru
SUPERADMIN_PASSWORD=YourSecurePassword123!
SUPERADMIN_NAME=Admin
```

При старте сервера функция `ensureSuperAdmin()` автоматически:
- Создаст superadmin если его нет
- Обновит существующего пользователя до superadmin если email совпадает

### Способ 2: Существующий superadmin

```
Email: sae230679@yandex.ru
```

### Проверка после настройки

```bash
# 1. Авторизация
curl -c cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'

# 2. Проверка ЮKassa
curl -b cookies.txt -X POST "$BASE_URL/api/superadmin/test-yookassa"

# 3. Диагностика
curl -b cookies.txt "$BASE_URL/api/superadmin/yookassa-diagnostics"
```

---

## URL Страниц

### Публичные страницы

| URL | Описание |
|-----|----------|
| `/` | Главная страница с экспресс-проверкой |
| `/full-audit` | Полный аудит - выбор пакетов, автоопределение типа сайта, форма индивидуального заказа |
| `/order-report?token={token}` | Страница заказа полного отчёта по экспресс-проверке |
| `/payment-result?auditId={id}` | Страница результата платежа с upsell |
| `/checkout?auditId={id}` | Страница оформления оплаты |
| `/privacy-policy` | Политика конфиденциальности |
| `/personal-data-agreement` | Согласие на обработку ПДн |
| `/offer` | Публичная оферта |
| `/user-agreement` | Пользовательское соглашение |
| `/cookies-policy` | Политика cookies |
| `/auth` | Авторизация/Регистрация |

### Личный кабинет (требует авторизации)

| URL | Описание |
|-----|----------|
| `/dashboard` | Панель управления пользователя |
| `/audits` | Список аудитов пользователя |
| `/audits/:id` | Детали аудита |
| `/personal-data` | Управление персональными данными |

### Административные страницы

| URL | Роль | Описание |
|-----|------|----------|
| `/admin/audits` | admin+ | Управление аудитами |
| `/admin/packages` | admin+ | Управление пакетами |
| `/superadmin/users` | superadmin | Управление пользователями |
| `/superadmin/settings` | superadmin | Системные настройки |
| `/superadmin/themes` | superadmin | Управление темами |
| `/superadmin/pdn-management` | superadmin | Управление ПДн согласиями |

---

## API Эндпоинты

### Платёжные эндпоинты

#### POST /api/payments/create
**Требует**: авторизация пользователя

**Входные данные**:
```json
{
  "auditId": 123,
  "paymentMethod": "sbp" // sbp | sberpay | yoomoney | mir
}
```

**Ответ (успех)**:
```json
{
  "success": true,
  "confirmationUrl": "https://yookassa.ru/checkout/...",
  "message": "Перенаправление на страницу оплаты"
}
```

**Ответ (ошибка)**:
```json
{
  "error": "Пакет временно недоступен для оплаты"
}
```

---

#### POST /api/yookassa/webhook
**Публичный** (вызывается ЮKassa)

**Входные данные**:
```json
{
  "event": "payment.succeeded", // payment.succeeded | payment.canceled | refund.succeeded
  "object": {
    "id": "payment_id",
    "metadata": {
      "auditId": "123",
      "userId": "456",
      "packageId": "789"
    }
  }
}
```

**Ответ**:
```json
{
  "status": "ok"
}
```

**Обработка событий**:
- `payment.succeeded` - обновляет статус платежа на "completed", запускает обработку аудита
- `payment.canceled` - обновляет статус платежа на "failed"
- `refund.succeeded` - обновляет статус платежа на "refunded"

---

#### POST /api/superadmin/test-yookassa
**Требует**: superadmin

**Входные данные**: нет

**Ответ (успех)**:
```json
{
  "success": true,
  "shopId": "...",
  "message": "Подключение к ЮKassa успешно"
}
```

---

#### GET /api/superadmin/yookassa-diagnostics
**Требует**: superadmin

**Ответ**:
```json
{
  "lastPayload": { ... },
  "lastResponse": { ... },
  "hasData": true
}
```

---

### Публичные эндпоинты (типы сайтов)

#### GET /api/public/site-types
**Ответ**: список всех типов сайтов с ценами

---

#### POST /api/public/detect-site-type
**Входные данные**:
```json
{
  "websiteUrl": "https://example.ru"
}
```

**Ответ**:
```json
{
  "type": "ecommerce",
  "name": "Интернет-магазин",
  "description": "...",
  "baseAuditPrice": 9900,
  "confidence": "high",
  "signals": ["Корзина", "Каталог товаров"]
}
```

---

#### POST /api/public/individual-request
**Входные данные**:
```json
{
  "name": "Имя (опционально)",
  "email": "email@example.ru",
  "url": "https://site.ru (опционально)",
  "description": "Описание задачи"
}
```

**Ответ**:
```json
{
  "success": true,
  "message": "Заявка успешно отправлена"
}
```

---

### Экспресс-проверка

#### POST /api/public/express-check
**Входные данные**:
```json
{
  "websiteUrl": "https://example.ru"
}
```

**Ответ**: результаты экспресс-проверки с токеном

---

#### GET /api/public/express-check/:token
**Ответ**: полные результаты экспресс-проверки

---

#### POST /api/express-report/purchase
**Требует**: авторизация

**Входные данные**:
```json
{
  "token": "express-check-token"
}
```

**Ответ**: создаёт аудит и возвращает данные для оплаты

---

### Аутентификация

| Метод | URL | Описание |
|-------|-----|----------|
| POST | /api/auth/register | Регистрация |
| POST | /api/auth/login | Вход |
| POST | /api/auth/logout | Выход |
| GET | /api/auth/me | Текущий пользователь |
| POST | /api/auth/verify-email | Подтверждение email |
| POST | /api/auth/forgot-password | Сброс пароля |
| POST | /api/auth/reset-password | Установка нового пароля |

---

### Общие публичные эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| GET | /api/health | Проверка состояния сервера |
| GET | /api/packages | Список пакетов |
| GET | /api/public/packages | Публичный список пакетов |
| GET | /api/settings/public | Публичные настройки |
| GET | /api/theme/active | Активная тема |
| GET | /api/promotions/active | Активные акции |
| GET | /api/maintenance-mode | Режим обслуживания |
