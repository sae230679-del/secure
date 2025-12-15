# SecureLex.ru Installation Guide

## Replit Deployment

### 1. Configure Secrets

In the Replit Secrets tab, add the following:

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-configured with Replit DB) |
| `SESSION_SECRET` | Random 32+ character string for session encryption |
| `SUPERADMIN_PASSWORD` | Password for the superadmin account |
| `OPENAI_API_KEY` | OpenAI API key (optional, for AI analysis) |
| `GIGACHAT_API_KEY` | GigaChat API key (optional, for Russian AI) |

### 2. Database Migration

Run the following command in the Shell:

```bash
npm run db:push
```

### 3. Deploy

Click the "Deploy" button in Replit. The deployment command runs:

```bash
npm run build && npm run db:migrate && npm run start
```

### 4. Custom Domain (Optional)

In the Replit deployment settings, configure your custom domain (e.g., securelex.ru).

---

## VPS Docker Deployment

### Prerequisites

- Docker and Docker Compose installed
- Domain name pointing to your server
- SSL certificate (via Certbot)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/securelex.git
cd securelex
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit the `.env` file with your production values:

```bash
DATABASE_URL=postgresql://securelex:YOUR_PASSWORD@db:5432/securelex
SESSION_SECRET=your-32-char-random-secret-here
OPENAI_API_KEY=sk-your-openai-key
GIGACHAT_API_KEY=your-gigachat-key
SUPERADMIN_EMAIL=admin@securelex.ru
SUPERADMIN_PASSWORD=YourSecurePassword123!
SUPERADMIN_NAME=Admin
NODE_ENV=production
PORT=5000
```

### 3. Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "127.0.0.1:5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: securelex
      POSTGRES_PASSWORD: YOUR_PASSWORD
      POSTGRES_DB: securelex
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### 4. Create Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]
```

### 5. Build and Start

```bash
docker compose up -d --build
```

### 6. Run Migrations

```bash
docker compose exec app npm run db:push
```

### 7. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/securelex`:

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

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/securelex /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. SSL Certificate with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d securelex.ru -d www.securelex.ru
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check database logs
docker compose logs db

# Verify connection
docker compose exec app npx drizzle-kit studio
```

### Application Not Starting

```bash
# Check application logs
docker compose logs app

# Restart services
docker compose restart
```

### Session/Cookie Issues

Ensure `SESSION_SECRET` is set and consistent across restarts.

---

## Backup and Restore

### Create Backup

```bash
docker compose exec db pg_dump -U securelex securelex > backup_$(date +%Y%m%d).sql
```

### Restore Backup

```bash
docker compose exec -T db psql -U securelex securelex < backup_20241215.sql
```

---

## Background Jobs

The PDN destruction job runs automatically every 6 hours. Check status:

```bash
# View logs for PDN job
docker compose logs app | grep "PDN Job"
```

To manually trigger destruction of scheduled tasks, use the SuperAdmin panel at `/superadmin/pdn`.
