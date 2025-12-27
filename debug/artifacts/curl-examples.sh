#!/bin/bash
# SecureLex.ru API - Примеры curl команд

# Базовый URL (замените на актуальный)
BASE_URL="https://your-domain.replit.dev"

# 1. Получить список публичных пакетов
echo "=== Публичные пакеты ==="
curl -s "$BASE_URL/api/public/packages" | jq .

# 2. Фильтр по типу сервиса (express_pdf или full_audit)
echo "=== Экспресс-пакеты ==="
curl -s "$BASE_URL/api/public/packages?service=express_pdf" | jq .

echo "=== Полный аудит ==="
curl -s "$BASE_URL/api/public/packages?service=full_audit" | jq .

# 3. Проверка ИНН в реестре РКН
echo "=== Проверка РКН по ИНН ==="
curl -s -X POST "$BASE_URL/api/public/rkn/check" \
  -H "Content-Type: application/json" \
  -d '{"inn": "7707083893"}' | jq .

# 4. Экспресс-проверка сайта (публичная)
echo "=== Экспресс-проверка ==="
curl -s -X POST "$BASE_URL/api/public/express-check" \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl": "https://example.com"}' | jq .

# 5. Статус экспресс-проверки по токену
echo "=== Статус проверки ==="
curl -s "$BASE_URL/api/public/express-check/TOKEN_HERE" | jq .

# 6. Регистрация пользователя
echo "=== Регистрация ==="
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "YOUR_PASSWORD_HERE",
    "name": "Тест Пользователь"
  }' | jq .

# 7. Вход в систему
echo "=== Вход ==="
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq .

# 8. Создание аудита (требует авторизации)
echo "=== Создание аудита ==="
curl -s -X POST "$BASE_URL/api/audits" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "websiteUrl": "https://example.com",
    "packageType": "basic"
  }' | jq .

# 9. Создание платежа (требует авторизации)
echo "=== Создание платежа ==="
curl -s -X POST "$BASE_URL/api/payments/create" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "auditId": 1,
    "paymentMethod": "sbp"
  }' | jq .

# 10. Debug-аудит (GET версия для браузера)
echo "=== Debug-аудит ==="
curl -s "$BASE_URL/api/audit/debug?url=https://example.com" | jq .
