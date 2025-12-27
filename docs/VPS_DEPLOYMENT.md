# SecureLex.ru - Руководство по развертыванию на VPS

Это руководство описывает процесс переноса приложения SecureLex с Replit на ваш VPS сервер.

## Требования к серверу

- **ОС**: Ubuntu 22.04 LTS или Debian 12
- **RAM**: минимум 2 GB (рекомендуется 4 GB)
- **CPU**: минимум 2 ядра
- **Диск**: минимум 20 GB SSD
- **Node.js**: версия 20.x LTS
- **PostgreSQL**: версия 15+
- **Nginx**: последняя стабильная версия

## 1. Подготовка сервера

### 1.1 Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Установка Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # должно показать v20.x.x
```

### 1.3 Установка PM2

```bash
sudo npm install -g pm2
pm2 startup systemd
```

### 1.4 Установка PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 1.5 Установка Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

## 2. Настройка PostgreSQL

### 2.1 Создание базы данных и пользователя

```bash
sudo -u postgres psql
```

```sql
CREATE USER securelex WITH PASSWORD 'YOUR_SECURE_PASSWORD';
CREATE DATABASE securelex OWNER securelex;
GRANT ALL PRIVILEGES ON DATABASE securelex TO securelex;
\q
```

### 2.2 Настройка доступа

Отредактируйте `/etc/postgresql/15/main/pg_hba.conf`:

```
# IPv4 local connections:
host    securelex       securelex       127.0.0.1/32            scram-sha-256
```

Перезапустите PostgreSQL:

```bash
sudo systemctl restart postgresql
```

## 3. Развертывание приложения

### 3.1 Создание директории и пользователя

```bash
sudo useradd -m -s /bin/bash securelex
sudo mkdir -p /var/www/securelex
sudo chown securelex:securelex /var/www/securelex
```

### 3.2 Клонирование репозитория

```bash
sudo -u securelex -i
cd /var/www/securelex
git clone https://github.com/YOUR_REPO/securelex.git .
```

### 3.3 Установка зависимостей

```bash
npm install
```

### 3.4 Создание .env файла

```bash
cp .env.example .env
nano .env
```

Заполните все обязательные переменные:

```env
DATABASE_URL=postgresql://securelex:YOUR_DB_PASSWORD@localhost:5432/securelex
SESSION_SECRET=<generate with: openssl rand -hex 32>
SECRET_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
SECRET_KEY=<generate with: openssl rand -hex 16>
NODE_ENV=production
PORT=5000
SITE_URL=https://securelex.ru
BASE_URL=https://securelex.ru
CORS_ORIGIN=https://securelex.ru
SUPERADMIN_EMAIL=your-admin@email.com
SUPERADMIN_PASSWORD=YourSecurePassword123!
SUPERADMIN_NAME=Admin
MASTER_ADMIN_PIN=<your-pin>
```

### 3.5 Сборка приложения

```bash
npm run build
```

### 3.6 Миграция базы данных

```bash
npm run db:push
```

### 3.7 Создание SuperAdmin

```bash
npx tsx scripts/create-superadmin.ts
```

### 3.8 Создание директории для логов

```bash
mkdir -p logs
```

## 4. Настройка PM2

### 4.1 Запуск приложения

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

### 4.2 Проверка статуса

```bash
pm2 status
pm2 logs securelex
```

## 5. Настройка Nginx

### 5.1 Копирование конфигурации

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/securelex
sudo ln -s /etc/nginx/sites-available/securelex /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

### 5.2 Получение SSL сертификата (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d securelex.ru -d www.securelex.ru
```

### 5.3 Проверка и перезапуск Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 6. Файрвол и безопасность

### 6.1 Настройка UFW

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 6.2 Fail2Ban (защита от брутфорса)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 7. Бэкапы

### 7.1 Скрипт резервного копирования базы данных

Создайте `/var/www/securelex/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/securelex"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -h localhost -U securelex securelex | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
```

```bash
chmod +x backup.sh
```

### 7.2 Автоматизация через cron

```bash
crontab -e
```

Добавьте строку (ежедневный бэкап в 3:00):

```
0 3 * * * /var/www/securelex/backup.sh >> /var/log/securelex-backup.log 2>&1
```

## 8. Обновление приложения

Для обновления приложения выполните:

```bash
sudo -u securelex -i
cd /var/www/securelex
git pull origin main
npm install
npm run build
pm2 reload securelex
```

## 9. Мониторинг

### 9.1 Логи приложения

```bash
pm2 logs securelex
# или
tail -f /var/www/securelex/logs/combined.log
```

### 9.2 Логи Nginx

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.3 Проверка здоровья

```bash
curl -s https://securelex.ru/api/health | jq
```

## 10. Устранение неполадок

### Приложение не запускается

```bash
pm2 logs securelex --lines 50
# Проверьте .env файл
cat .env | grep -v PASSWORD
```

### Ошибки базы данных

```bash
# Проверка подключения
psql -h localhost -U securelex -d securelex -c "SELECT 1"
```

### Nginx ошибки

```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

## 11. Контрольный список

- [ ] Сервер обновлен
- [ ] Node.js 20 установлен
- [ ] PostgreSQL установлен и настроен
- [ ] База данных и пользователь созданы
- [ ] Приложение склонировано
- [ ] .env файл заполнен
- [ ] npm install выполнен
- [ ] npm run build выполнен
- [ ] npm run db:push выполнен
- [ ] SuperAdmin создан
- [ ] PM2 запущен и сохранен
- [ ] Nginx настроен
- [ ] SSL сертификат получен
- [ ] Файрвол настроен
- [ ] Бэкапы настроены
- [ ] Приложение работает: https://securelex.ru

## Важные файлы

| Файл | Описание |
|------|----------|
| `.env` | Переменные окружения (не коммитить!) |
| `ecosystem.config.js` | Конфигурация PM2 |
| `nginx.conf.example` | Пример конфигурации Nginx |
| `scripts/create-superadmin.ts` | Скрипт создания администратора |
| `scripts/reset-password.ts` | Скрипт сброса пароля |

## Полезные команды

```bash
# Перезапуск приложения
pm2 reload securelex

# Остановка приложения  
pm2 stop securelex

# Просмотр логов в реальном времени
pm2 logs securelex

# Статус всех процессов
pm2 status

# Сброс пароля пользователя
RESET_PASSWORD_EMAIL=user@email.com RESET_PASSWORD_VALUE=NewPass123! npx tsx scripts/reset-password.ts
```
