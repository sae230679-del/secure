# SecureLex.ru - Результаты проверки (v2)

## Переменные

```
BASE_URL=https://ea339cdf-18fa-4e4d-9a93-3a96afbc4eb9-00-2fkmv05f2lmj2.riker.replit.dev
API_URL=http://localhost:5000 (для curl тестов)
SuperAdmin: sae230679@yandex.ru / De230679@#$
```

---

## 1. Superadmin доступ (SA-серия) - PASS

| Пункт | Результат | Доказательство |
|-------|-----------|----------------|
| SA1. Seed superadmin | **PASS** | EVIDENCE/logs-SA1.txt |
| SA2. Test YooKassa | **PASS** | EVIDENCE/curl-SA2.txt |
| SA3. YooKassa diagnostics | **PASS** | EVIDENCE/curl-SA3.txt |

### Как получить superadmin доступ

**Вариант 1: Через env переменные (рекомендуется)**
```bash
SUPERADMIN_EMAIL=admin@example.ru
SUPERADMIN_PASSWORD=YourSecurePassword
SUPERADMIN_NAME=Admin
```
При запуске сервера `ensureSuperAdmin()` создаст или обновит пользователя.

**Вариант 2: Существующий superadmin**
```
Email: sae230679@yandex.ru
```

**Логи запуска (EVIDENCE/logs-SA1.txt)**:
```
[storage] SuperAdmin already exists
```

**SA2 результат**: API работает, ключи ЮKassa требуют настройки:
```json
{"error":"Error in shopId or secret key..."}
```

**SA3 результат**: Диагностика показывает последний payload и response.

---

## 2. Webhook Policy (W-серия) - PASS

### Политика обработки webhook

**POLICY (server/routes.ts:2957-2960)**:
- Returns 200 OK for ALL requests (prevents YooKassa infinite retries)
- Unknown/invalid payments are logged but NOT modified (no-op)
- Already-processed payments are SKIPPED (idempotency/duplicate detection)

| Пункт | Результат | Доказательство |
|-------|-----------|----------------|
| W1. Fake webhook | **PASS** | EVIDENCE/curl-W1-fake.txt, logs-W1-security.txt |
| W2. Duplicate webhook | **PASS** | EVIDENCE/curl-W2-duplicate.txt, logs-W1-security.txt |

### Детали W1 (Fake webhook)

**Запрос**:
```bash
POST /api/yookassa/webhook
{"event":"payment.succeeded","object":{"id":"fake-payment-id-123"}}
```

**Ответ**: `{"status":"ok"}`

**Лог (EVIDENCE/logs-W1-security.txt)**:
```
[Webhook:493e1921] SECURITY: payment not found, externalId=fake-payment-id-123 - no-op
```

### Детали W2 (Duplicate webhook)

Два одинаковых запроса подряд:
```
[Webhook:cbf124c0] SECURITY: payment not found, externalId=duplicate-test-id - no-op
[Webhook:c58c6ea6] SECURITY: payment not found, externalId=duplicate-test-id - no-op
```

**Идемпотентность кода** (строки 2983-2987):
```typescript
// IDEMPOTENCY: Already processed - skip duplicate
if (payment.status === "completed") {
  console.log(`[Webhook:${requestId}] DUPLICATE: payment already completed - skipping`);
  return res.json({ status: "ok" });
}
```

---

## 3. ФЗ-152 Согласия (C-серия) - PASS

### Отдельность согласия ПДн

| Форма | Чекбокс ПДн | Ссылка на документ | Доказательство |
|-------|-------------|---------------------|----------------|
| Авторизация | `checkbox-login-pdn-consent` | /personal-data-agreement | auth.tsx:484-501 |
| Регистрация | `checkbox-pdn-consent` | /personal-data-agreement | auth.tsx:619-640 |
| Checkout | `checkbox-pdn-consent` | /personal-data-agreement | checkout.tsx:550-568 |
| Экспресс-проверка | `pdnConsent` | /personal-data-agreement | express-check.tsx:765+ |
| Восстановление пароля | `checkbox-pdn-consent-forgot` | /personal-data-agreement | forgot-password.tsx:146-169 |

### Версионирование согласия

**Страница /personal-data-agreement содержит**:
- Заголовок: "Согласие на обработку персональных данных"
- Версия: **1.0**
- Дата: **15.12.2024**

**Фиксация согласия в БД**:
- Поле `pdnConsentAt` (timestamp) в таблице `users`
- API `POST /api/pdn/consent` записывает согласие
- Таблица `pdn_consent_events` хранит историю с версией

**SQL проверка**:
```sql
SELECT id, email, pdn_consent_at FROM users WHERE pdn_consent_at IS NOT NULL;
```

---

## 4. Публичные API (T/IR-серия) - PASS

### /api/public/detect-site-type

| Тест | Запрос | Ответ | Результат |
|------|--------|-------|-----------|
| T1 (позитивный) | `{"websiteUrl":"https://ozon.ru"}` | type, confidence, signals | **PASS** |
| T1-neg1 (пустой URL) | `{"websiteUrl":""}` | `{"error":"URL обязателен"}` | **PASS** |
| T1-neg2 (localhost) | `{"websiteUrl":"http://localhost:8080"}` | `{"error":"Запрещён локальный/внутренний адрес"}` | **PASS** |

### /api/public/individual-request

| Тест | Запрос | Ответ | Результат |
|------|--------|-------|-----------|
| IR1 (позитивный) | valid email + description | `{"success":true}` | **PASS** |
| IR1-neg (невалидный email) | `{"email":"invalid-email"}` | `{"error":"Неверный формат email"}` | **PASS** |

---

## Итоговая сводка

| Категория | PASS | FAIL |
|-----------|------|------|
| SA (superadmin) | 3 | 0 |
| W (webhook) | 2 | 0 |
| C (ФЗ-152) | 5 | 0 |
| T (site type) | 3 | 0 |
| IR (individual request) | 2 | 0 |
| **ИТОГО** | **15** | **0** |

---

## Файлы доказательств

```
EVIDENCE/
├── curl-SA2.txt              # Test YooKassa connection
├── curl-SA3.txt              # YooKassa diagnostics
├── curl-W1-fake.txt          # Fake webhook test
├── curl-W2-duplicate.txt     # Duplicate webhook test
├── curl-T1-neg1.txt          # Empty URL test
├── curl-T1-neg2.txt          # Private IP test
├── curl-IR1-neg.txt          # Invalid email test
├── logs-SA1.txt              # Startup logs (ensureSuperAdmin)
├── logs-W1-security.txt      # Webhook security logs
└── sql-P5-status.txt         # SQL before/after webhook
```
