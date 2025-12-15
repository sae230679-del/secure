# SecureLex.ru — Инструкция по деплою на VPS

## 1. Стек технологий

| Компонент | Технология | Версия |
|-----------|------------|--------|
| Runtime | Node.js | 20.x |
| Backend | Express.js + TypeScript | 4.21.2 |
| Frontend | React + Vite | 18.3.1 / 5.4.20 |
| ORM | Drizzle ORM | 0.39.3 |
| Database | PostgreSQL | 16.x |
| Styling | Tailwind CSS + shadcn/ui | 3.4.17 |
| PDF | pdfkit | 0.17.2 |
| AI | OpenAI + GigaChat | - |

---

## 2. Структура проекта

```
securelex/
├── client/                 # Frontend (React + Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/    # UI компоненты
│   │   ├── pages/         # Страницы
│   │   ├── lib/           # Утилиты
│   │   └── hooks/         # React хуки
│   └── index.html
├── server/                 # Backend (Express)
│   ├── fonts/             # Шрифты для PDF
│   ├── audit-engine.ts    # Движок аудита
│   ├── db.ts              # Подключение к БД
│   ├── email.ts           # Email сервис
│   ├── index.ts           # Точка входа
│   ├── pdf-generator.ts   # Генератор PDF
│   ├── routes.ts          # API маршруты
│   ├── static.ts          # Статика для prod
│   ├── storage.ts         # Слой данных
│   └── vite.ts            # Vite dev server
├── shared/                 # Общий код
│   └── schema.ts          # Drizzle схема БД
├── public/                 # Статические файлы
├── script/                 # Скрипты сборки
├── package.json
├── drizzle.config.ts
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 3. Команды

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Запуск в dev-режиме (tsx + Vite HMR) |
| `npm run build` | Сборка production (frontend + backend) |
| `npm run start` | Запуск production (из dist/) |
| `npm run db:push` | Применение миграций Drizzle |

---

## 4. Переменные окружения

Создайте файл `.env`:

```env
# База данных
DATABASE_URL=postgresql://securelex:YOUR_PASSWORD@localhost:5432/securelex

# Сессии
SESSION_SECRET=your-32-char-random-secret-here

# AI провайдеры
OPENAIAPIKEY=sk-your-openai-key
GIGACHATAPIKEY=your-gigachat-key

# Суперадмин
SUPERADMIN_PASSWORD=YourSecurePassword123!
SUPERADMIN_EMAIL=admin@securelex.ru
SUPERADMIN_NAME=Админ

# Сервер
NODE_ENV=production
PORT=5000
```

---

## 5. Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/fonts ./server/fonts

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
```

---

## 6. docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: securelex-app
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DATABASE_URL=postgresql://securelex:${DB_PASSWORD}@db:5432/securelex
      - SESSION_SECRET=${SESSION_SECRET}
      - OPENAIAPIKEY=${OPENAIAPIKEY}
      - GIGACHATAPIKEY=${GIGACHATAPIKEY}
      - SUPERADMIN_PASSWORD=${SUPERADMIN_PASSWORD}
      - SUPERADMIN_EMAIL=${SUPERADMIN_EMAIL}
      - SUPERADMIN_NAME=${SUPERADMIN_NAME}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - securelex-net

  db:
    image: postgres:16-alpine
    container_name: securelex-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=securelex
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=securelex
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U securelex"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - securelex-net

volumes:
  postgres_data:

networks:
  securelex-net:
    driver: bridge
```

---

## 7. Nginx конфиг

`/etc/nginx/sites-available/securelex.ru`:

```nginx
server {
    listen 80;
    server_name securelex.ru www.securelex.ru;

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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    client_max_body_size 10M;
}
```

---

## 8. Пошаговый деплой

```bash
# 1. Подготовка сервера
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install docker-compose-plugin nginx certbot python3-certbot-nginx -y

# 2. Перелогиниться
exit

# 3. Создать директорию
sudo mkdir -p /opt/securelex
sudo chown $USER:$USER /opt/securelex
cd /opt/securelex

# 4. Загрузить проект
# scp -r ./* user@your-vps:/opt/securelex/

# 5. Создать .env
nano .env

# 6. Запустить
docker compose up -d --build

# 7. Миграции
sleep 30
docker compose exec app npm run db:push

# 8. Nginx
sudo nano /etc/nginx/sites-available/securelex.ru
sudo ln -s /etc/nginx/sites-available/securelex.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 9. SSL
sudo certbot --nginx -d securelex.ru -d www.securelex.ru

# 10. Проверка
curl https://securelex.ru
docker compose logs -f
```

---

## 9. Рекомендации по безопасности

| # | Проблема | Решение |
|---|----------|---------|
| 1 | Нет CORS | Добавить `cors` пакет |
| 2 | Нет Rate Limiting | Добавить `express-rate-limit` |
| 3 | Нет Helmet | Добавить `helmet` для headers |
| 4 | SESSION_SECRET fallback | Убрать fallback значение |
| 5 | Нет HTTPS redirect | Настроить в Nginx |
