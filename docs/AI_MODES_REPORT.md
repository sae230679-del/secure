# AI Audit Modes Report - SecureLex.ru

## 1. AI Mode Types

The system supports the following AI analysis modes:

| Mode | Description | Providers Used |
|------|-------------|----------------|
| `gigachat_only` | Only GigaChat (Sber) | GigaChat |
| `openai_only` | Only OpenAI (GPT) | OpenAI |
| `yandex_only` | Only YandexGPT | YandexGPT |
| `hybrid` | OpenAI priority, fallback to GigaChat | OpenAI -> GigaChat |
| `tri_hybrid` | All 3 providers in parallel, best result wins | GigaChat + OpenAI + YandexGPT |
| `none` | AI disabled, base rules only | None |

## 2. Mode Selection Logic

### Priority Order:
1. `system_settings.ai_mode` (database)
2. Default: `gigachat_only`

### Code Location:
- Mode type: `server/audit-engine.ts` line 301
- Mode selection: `server/routes.ts` (multiple locations reading `ai_mode` setting)
- Admin UI: `client/src/pages/superadmin-settings.tsx`

## 3. Mode Behavior

### `none` Mode:
- No AI providers called
- Returns: `{ summary: "ИИ-анализ отключен", recommendations: [] }`

### `gigachat_only` Mode:
- Calls only GigaChat API
- Requires: `GIGACHATAPIKEY` env var or database key
- If key missing: Returns error message

### `openai_only` Mode:
- Calls only OpenAI API
- Requires: `OPENAIAPIKEY` env var or database key
- If key missing: Returns error message

### `yandex_only` Mode:
- Calls only YandexGPT API
- Requires: `YANDEX_IAM_TOKEN` env var or database key
- If key missing: Returns error message

### `hybrid` Mode:
- Priority: OpenAI first
- Fallback: GigaChat if OpenAI fails
- Requires: At least one of the keys

### `tri_hybrid` Mode:
- Parallel execution of all 3 providers
- Best result selected by scoring algorithm
- Scoring: summary length + recommendations count + issues count

## 4. PDF Integration

The PDF generator (`server/pdf-generator.ts`) displays:
- AI Summary in report header
- Top 3 recommendations
- AI provider info in footer

Footer text format:
```
Powered by {provider} | ai_mode: {mode}
```

## 5. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/superadmin/ai-status` | GET | Get current AI status and mode |
| `/api/superadmin/settings/ai_mode` | PUT | Update AI mode |
| `/api/superadmin/api-keys/:provider` | POST | Save API key (gigachat/openai/yandex) |

## 6. Edge Cases

### Missing API Keys:
- If selected mode requires unavailable key, audit returns informative error
- Example: `"GigaChat недоступен: не настроен GIGACHATAPIKEY"`

### All Keys Missing (hybrid/tri_hybrid):
- Returns: `"ИИ-анализ недоступен: не настроены API ключи"`

### Provider Failure:
- `hybrid`: Automatically falls back to next provider
- `tri_hybrid`: Continues with remaining providers, selects best available result

## 7. Diagnostics API

### Endpoint: `GET /api/admin/diagnostics/ai-keys`

**Access**: SuperAdmin only

**Response format**:
```json
{
  "hasGigaChatKey": false,
  "hasOpenAiKey": false,
  "aiModeConfigured": "gigachat_only",
  "effectiveAiMode": "none (no GIGACHATAPIKEY)"
}
```

**Field descriptions**:
| Field | Type | Description |
|-------|------|-------------|
| `hasGigaChatKey` | boolean | True if GIGACHATAPIKEY env var is set |
| `hasOpenAiKey` | boolean | True if OPENAIAPIKEY env var is set |
| `aiModeConfigured` | string | AI mode from system settings |
| `effectiveAiMode` | string | Actual mode that will be used (accounts for missing keys) |

**Effective mode logic**:
- If configured mode is `none` → effective is `none`
- If configured mode is `gigachat_only` but no key → effective is `none (no GIGACHATAPIKEY)`
- If configured mode is `openai_only` but no key → effective is `none (no OPENAIAPIKEY)`
- If configured mode is `hybrid` but no keys → effective is `none (no keys)`
- If configured mode is `hybrid` and at least one key → effective is `hybrid`

## 8. Current Status

- **Default Mode**: `gigachat_only`
- **Configured Keys**: None (needs configuration in SuperAdmin panel)
- **Effective Mode**: `none` (no keys configured)

### AI Status Quick Check:
```bash
# Login as superadmin first
curl -X POST /api/auth/login -d '{"email":"admin@securelex.ru","password":"..."}'

# Then check AI status
curl /api/admin/diagnostics/ai-keys
```

## 9. Recommendations

1. Configure at least one AI provider key for full functionality
2. Use `hybrid` mode for production (best reliability)
3. Use `none` mode for basic compliance checking without AI costs
4. Monitor AI costs in `tri_hybrid` mode (3x API calls)

---
*Report generated: 2025-12-15*
