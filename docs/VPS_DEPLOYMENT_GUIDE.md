# SecureLex.ru - Руководство по развёртыванию на VPS

## Содержание
1. [Требования к серверу](#требования-к-серверу)
2. [Подготовка VPS](#подготовка-vps)
3. [Установка приложения](#установка-приложения)
4. [Настройка базы данных](#настройка-базы-данных)
5. [Настройка переменных окружения](#настройка-переменных-окружения)
6. [PM2 - Управление процессами](#pm2---управление-процессами)
7. [Настройка SSL сертификатов](#настройка-ssl-сертификатов)
8. [Настройка SMTP/Email](#настройка-smtpemail)
9. [DNS конфигурация (reg.ru)](#dns-конфигурация-regru)
10. [Устранение неполадок](#устранение-неполадок)

---

## Требования к серверу

| Параметр | Минимум | Рекомендуется |
|----------|---------|---------------|
| CPU | 1 ядро | 2+ ядра |
| RAM | 1 GB | 2+ GB |
| Диск | 20 GB SSD | 40+ GB SSD |
| ОС | Ubuntu 20.04+ / Debian 11+ | Ubuntu 22.04 LTS |

---

## Подготовка VPS

### 1. Обновление системы
```bash
apt update && apt upgrade -y
```

### 2. Установка Node.js 20.x
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node -v  # Проверка версии
```

### 3. Установка PostgreSQL
```bash
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
```

### 4. Установка PM2
```bash
npm install -g pm2
pm2 startup  # Автозапуск при перезагрузке
```

### 5. Установка дополнительных утилитов
```bash
apt install -y git nginx certbot python3-certbot-nginx
```

---

## Установка приложения

### 1. Клонирование/копирование проекта
```bash
mkdir -p /opt/securelex
cd /opt/securelex
# Скопировать файлы проекта (git clone или scp)
```

### 2. Установка зависимостей
```bash
npm install
```

### 3. Сборка проекта
```bash
npm run build
```

**ВАЖНО:** После любых изменений в TypeScript файлах:
```bash
rm -rf dist && npm run build
```

---

## Настройка базы данных

### 1. Создание базы данных
```bash
sudo -u postgres psql
```

```sql
CREATE USER securelex WITH PASSWORD 'ваш_пароль';
CREATE DATABASE securelex OWNER securelex;
GRANT ALL PRIVILEGES ON DATABASE securelex TO securelex;
\q
```

### 2. Настройка подключения
В файле `.env` или переменных окружения:
```bash
DATABASE_URL="postgresql://securelex:ваш_пароль@localhost:5432/securelex"
```

### 3. Применение миграций
```bash
npm run db:push
```

**Если возникает ошибка конфликта типов:**
```bash
npm run db:push --force
```

**НИКОГДА не меняйте типы ID колонок** (serial ↔ varchar) — это разрушает данные!

---

## Настройка переменных окружения

### Файл /opt/securelex/.env
```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://securelex:пароль@localhost:5432/securelex

# SMTP (опционально, можно настроить через админку)
SMTP_PASSWORD=ваш_smtp_пароль

# Супер-админ (создаётся автоматически)
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=безопасный_пароль

# Сессии
SESSION_SECRET=случайная_строка_32_символа
```

### Загрузка переменных
```bash
export $(cat .env | xargs)
# или добавить в ~/.bashrc
```

---

## PM2 - Управление процессами

### Запуск приложения
```bash
cd /opt/securelex
pm2 start dist/index.cjs --name securelex
pm2 save
```

### Основные команды
```bash
pm2 status                    # Статус процессов
pm2 logs securelex            # Логи в реальном времени
pm2 logs securelex --lines 50 # Последние 50 строк
pm2 restart securelex         # Перезапуск
pm2 stop securelex            # Остановка
pm2 delete securelex          # Удаление
```

### Рабочий процесс после изменений
```bash
cd /opt/securelex
npm run build
pm2 restart securelex
pm2 logs securelex --lines 30  # Проверка логов
```

---

## Настройка SSL сертификатов

### Вариант A: Let's Encrypt (бесплатно)

#### Для веб-сервера (HTTP challenge)
```bash
certbot --nginx -d securelex.ru -d www.securelex.ru
```

#### Для почтового сервера (DNS challenge)
Если почтовый сервер на другом IP:
```bash
certbot certonly --manual --preferred-challenges dns -d mail.securelex.ru
```

Добавьте TXT запись в DNS:
```
_acme-challenge.mail.securelex.ru  TXT  "полученный_токен"
```

### Вариант B: Коммерческий SSL (reg.ru / GlobalSign)
1. Заказать DomainSSL в панели reg.ru
2. Указать SAN (Subject Alternative Names): www, mail, autodiscover
3. Подтвердить через DNS или email
4. Скачать и установить сертификат

### Автообновление Let's Encrypt
```bash
certbot renew --dry-run  # Тест
crontab -e
# Добавить: 0 3 * * * certbot renew --quiet
```

---

## Настройка SMTP/Email

### РЕКОМЕНДУЕТСЯ: Яндекс Бизнес (Yandex 360)

Яндекс Бизнес — надёжный выбор для корпоративной почты в России. Проверенные SSL сертификаты, высокая доставляемость.

#### Шаг 1: Подключение домена к Яндекс 360
1. Зарегистрируйтесь на https://360.yandex.ru/business/
2. Добавьте домен securelex.ru
3. Подтвердите владение доменом через DNS (TXT запись)
4. Создайте почтовый ящик support@securelex.ru

#### Шаг 2: Создание пароля приложения
**ВАЖНО:** Обычный пароль не работает! Нужен специальный пароль приложения.

1. Перейдите в Яндекс ID → Безопасность
2. Включите двухфакторную аутентификацию (если не включена)
3. Перейдите в "Пароли приложений"
4. Создайте новый пароль для "Почта"
5. Скопируйте пароль (показывается только 1 раз!)

#### Шаг 3: SMTP настройки Яндекс

| Параметр | Значение |
|----------|----------|
| **Хост** | smtp.yandex.ru |
| **Порт** | 465 (SSL) или 587 (STARTTLS) |
| **Secure** | true (для порта 465) |
| **Пользователь** | support@securelex.ru (полный адрес) |
| **Пароль** | Пароль приложения (НЕ обычный пароль!) |

#### Шаг 4: Настройка в админке SecureLex
1. Войти как супер-админ
2. Перейти в Настройки → SMTP
3. Заполнить:
   - Хост: `smtp.yandex.ru`
   - Порт: `465`
   - Secure: `Да`
   - Пользователь: `support@securelex.ru`
   - Пароль: (пароль приложения)

#### DNS записи для Яндекс 360
| Тип | Имя | Значение |
|-----|-----|----------|
| MX | @ | mx.yandex.net (приоритет 10) |
| TXT | @ | v=spf1 include:_spf.yandex.net ~all |
| TXT | mail._domainkey | (ключ из панели Яндекс 360) |
| CNAME | mail | domain.mail.yandex.net |

#### Проверка подключения Яндекс SMTP
```bash
openssl s_client -connect smtp.yandex.ru:465
```

#### Ограничения Яндекс 360
- **500 писем/день** на бесплатном тарифе
- Для большего объёма — платный тариф

---

### Альтернатива: Почта reg.ru (НЕ рекомендуется)

При использовании почты от reg.ru возникают проблемы с SSL сертификатами ("self-signed certificate").

**ПРИЧИНА ПРОБЛЕМЫ:** Почтовый сервер reg.ru использует сертификат, который Node.js не может проверить по цепочке доверия.

#### Настройки reg.ru SMTP
| Параметр | Значение |
|----------|----------|
| Хост | mail.securelex.ru |
| Порт | 465 или 587 |
| Пользователь | support@securelex.ru |

#### Небезопасный обходной путь (только для reg.ru)

**ПРЕДУПРЕЖДЕНИЕ:** Следующее решение отключает проверку сертификата, что делает соединение уязвимым для атак "человек посередине". Используйте только если нет возможности перейти на Яндекс 360.

```typescript
tls: {
  rejectUnauthorized: false,  // НЕБЕЗОПАСНО! Только для reg.ru
  minVersion: 'TLSv1.2'
}
```

**РЕКОМЕНДАЦИЯ:** Перейдите на Яндекс 360 — там эта проблема отсутствует, сертификаты валидны, и `rejectUnauthorized` можно оставить в безопасном значении `true`.

---

### Общие настройки: Порты и режимы

| Порт | Режим | secure | requireTLS |
|------|-------|--------|------------|
| 465 | SMTPS (SSL) | true | не нужен |
| 587 | STARTTLS | false | true |

---

## DNS конфигурация (reg.ru)

### Основные записи (для VPS)
| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| A | @ | 95.163.227.214 (IP VPS) | 3600 |
| A | www | 95.163.227.214 | 3600 |

### Записи для Яндекс 360 (рекомендуется)
| Тип | Имя | Значение |
|-----|-----|----------|
| MX | @ | mx.yandex.net (приоритет 10) |
| TXT | @ | v=spf1 include:_spf.yandex.net ~all |
| CNAME | mail | domain.mail.yandex.net |

### Записи для почты reg.ru (альтернатива)
| Тип | Имя | Значение |
|-----|-----|----------|
| A | mail | 37.140.192.155 (IP почты reg.ru) |
| MX | @ | mail.securelex.ru (приоритет 10) |
| TXT | @ | v=spf1 include:_spf.hosting.reg.ru ~all |

### Проверка DNS
```bash
dig A securelex.ru
dig MX securelex.ru
dig TXT securelex.ru
nslookup mail.securelex.ru
```

---

## Устранение неполадок

### Проблема: "self-signed certificate" при отправке email

**Причины:**
1. Кэшированный transporter с устаревшими настройками
2. Отсутствует `rejectUnauthorized: false` в TLS конфиге
3. Node.js не доверяет цепочке сертификатов

**Решения:**

1. **Пересборка с очисткой кэша:**
```bash
rm -rf dist && npm run build && pm2 restart securelex
```

2. **Проверка TLS конфига в dist:**
```bash
grep -A 10 "tls:" /opt/securelex/dist/index.cjs
```

3. **Обновление CA сертификатов:**
```bash
apt update && apt install -y ca-certificates
update-ca-certificates
```

4. **Переменная NODE_EXTRA_CA_CERTS (крайний случай):**
```bash
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
pm2 restart securelex
```

---

### Проблема: Email не отправляется (Connection timeout)

**Проверка:**
```bash
# Проверка порта
nc -zv mail.securelex.ru 465
nc -zv mail.securelex.ru 587

# Проверка файрвола
ufw status
iptables -L -n
```

**Решение:**
```bash
ufw allow 465/tcp
ufw allow 587/tcp
```

---

### Проблема: База данных недоступна

**Проверка:**
```bash
systemctl status postgresql
psql -U securelex -d securelex -c "SELECT 1"
```

**Решение:**
```bash
systemctl restart postgresql
# Проверить DATABASE_URL
echo $DATABASE_URL
```

---

### Проблема: PM2 не запускается после перезагрузки

**Решение:**
```bash
pm2 startup
pm2 save
systemctl enable pm2-root
```

---

### Проблема: Порт 5000 занят

**Проверка:**
```bash
lsof -i :5000
netstat -tlnp | grep 5000
```

**Решение:**
```bash
kill -9 $(lsof -t -i:5000)
pm2 restart securelex
```

---

### Проблема: Миграции не применяются

**Проверка:**
```bash
npm run db:push 2>&1
```

**Решение:**
```bash
# Принудительное применение
npm run db:push --force

# Если ошибка типов ID — НЕ менять schema.ts!
# Проверить текущую схему:
psql -U securelex -d securelex -c "\d users"
```

---

## Чек-лист развёртывания

- [ ] VPS подготовлен (Node.js 20, PostgreSQL, PM2, Nginx)
- [ ] Файлы проекта скопированы в /opt/securelex
- [ ] База данных создана и настроена
- [ ] .env файл заполнен
- [ ] npm install выполнен
- [ ] npm run build выполнен без ошибок
- [ ] Миграции применены (npm run db:push)
- [ ] PM2 запущен (pm2 start dist/index.cjs --name securelex)
- [ ] SSL сертификаты установлены
- [ ] Nginx настроен как reverse proxy
- [ ] DNS записи настроены
- [ ] SMTP проверен (тестовое письмо отправлено)
- [ ] Супер-админ создан и вход работает

---

## Nginx конфигурация (пример)

```nginx
server {
    listen 80;
    server_name securelex.ru www.securelex.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name securelex.ru www.securelex.ru;

    ssl_certificate /etc/letsencrypt/live/securelex.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/securelex.ru/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Контакты и ресурсы

- **Домен/DNS:** reg.ru
- **VPS IP:** 95.163.227.214
- **Почтовый сервер IP:** 37.140.192.155
- **Почта поддержки:** support@securelex.ru

---

*Документ создан: Декабрь 2025*
*Последнее обновление: при каждом успешном развёртывании*
