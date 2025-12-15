# Сброс пароля в Production-базе SecureLex.ru

## Метод 1: Через панель Database в Replit

### Шаг 1: Открыть панель Database
1. В Replit нажмите на вкладку **"Database"** (или **"Tools" -> "Database"**)
2. Переключитесь на **Production** базу данных

### Шаг 2: Сгенерировать хэш пароля
Выполните в терминале:
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('De230679@#\$', 10).then(h => console.log(h));"
```

Скопируйте полученный хэш (начинается с `$2a$10$...`)

### Шаг 3: Обновить пароль в Production
В SQL-консоли Production базы выполните:
```sql
UPDATE users 
SET password = 'ВСТАВЬТЕ_ХЭШ_СЮДА' 
WHERE email = 'sae230679@yandex.ru';
```

---

## Метод 2: Через API после деплоя

### Вариант A: Использовать функцию "Забыли пароль"
1. Настройте SMTP в SuperAdmin панели
2. На странице /auth нажмите "Забыли пароль?"
3. Получите письмо со ссылкой сброса

### Вариант B: Временный эндпоинт (удалить после использования)
Добавьте в routes.ts:
```typescript
app.post("/api/admin-reset-temp", async (req, res) => {
  const { email, newPassword, secretKey } = req.body;
  if (secretKey !== "ВРЕМЕННЫЙ_СЕКРЕТ_КЛЮЧ") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ password: hash }).where(eq(users.email, email));
  res.json({ success: true });
});
```

Затем вызовите:
```bash
curl -X POST https://securelex.ru/api/admin-reset-temp \
  -H "Content-Type: application/json" \
  -d '{"email":"sae230679@yandex.ru","newPassword":"De230679@#$","secretKey":"ВРЕМЕННЫЙ_СЕКРЕТ_КЛЮЧ"}'
```

**ВАЖНО:** Удалите этот эндпоинт сразу после использования!

---

## Метод 3: Синхронизация Development -> Production

После деплоя production использует отдельную базу. Чтобы синхронизировать пользователя:

1. Экспорт из development:
```sql
SELECT email, password, role, "isMasterAdmin", "masterAdminPin" 
FROM users 
WHERE email = 'sae230679@yandex.ru';
```

2. Импорт в production (через Database панель -> Production):
```sql
UPDATE users SET 
  password = 'ХЭШ_ИЗ_DEVELOPMENT',
  role = 'superadmin',
  "isMasterAdmin" = true,
  "masterAdminPin" = '212379'
WHERE email = 'sae230679@yandex.ru';
```

---

## Текущие данные для Development

| Поле | Значение |
|------|----------|
| Email | sae230679@yandex.ru |
| Пароль | De230679@#$ |
| Роль | superadmin |
| Master Admin | Да |
| PIN защиты | 212379 |

---

*Документ создан: 2025-12-15*
