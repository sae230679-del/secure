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

### Конфигурация в email.ts

**КРИТИЧНО:** Для решения проблемы "self-signed certificate" необходим правильный TLS блок:

```typescript
const transportConfig: any = {
  host: settings.host,
  port: settings.port,
  secure: settings.secure, // true для 465, false для 587
  auth: {
    user: settings.user,
    pass: settings.pass,
  },
  tls: {
    rejectUnauthorized: false,  // ВАЖНО для некоторых почтовых серверов
    minVersion: 'TLSv1.2'
  }
};
```

### Порты и режимы
| Порт | Режим | secure | requireTLS |
|------|-------|--------|------------|
| 465 | SMTPS (SSL) | true | не нужен |
| 587 | STARTTLS | false | true |

### Настройка через админку
1. Войти как супер-админ
2. Перейти в Настройки → SMTP
3. Заполнить параметры:
   - Хост: mail.securelex.ru
   - Порт: 465
   - Secure: Да
   - Пользователь: support@securelex.ru
   - Пароль: (из секретов)

### Проверка SMTP
```bash
# Проверка соединения
openssl s_client -connect mail.securelex.ru:465

# Проверка STARTTLS
openssl s_client -starttls smtp -connect mail.securelex.ru:587
```

---

## DNS конфигурация (reg.ru)

### Основные записи
| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| A | @ | 95.163.227.214 (IP VPS) | 3600 |
| A | www | 95.163.227.214 | 3600 |
| A | mail | 37.140.192.155 (IP почты) | 3600 |
| MX | @ | mail.securelex.ru (приоритет 10) | 3600 |

### Записи для почты
| Тип | Имя | Значение |
|-----|-----|----------|
| TXT | @ | v=spf1 include:_spf.hosting.reg.ru ~all |
| TXT | _dmarc | v=DMARC1; p=none; rua=mailto:admin@securelex.ru |
| TXT | mail._domainkey | (DKIM ключ от провайдера) |

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
