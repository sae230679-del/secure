# SecureLex.ru

## Overview

SecureLex.ru is a website compliance checking platform that automatically audits websites for adherence to Russian data protection laws (ФЗ-152, ФЗ-149), GDPR, and other relevant regulations. Users can submit their website URL, select from various audit packages, make payments, and receive detailed compliance reports utilizing a traffic-light severity system. The platform supports three distinct user roles: regular users for self-audits, admins for managing paid audits, and superadmins for comprehensive system control, including theme customization and system settings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state, React Context for auth and theme
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style), Material Design 3 inspired
- **Theming**: Comprehensive preset-based system with light/dark modes, 19 semantic color tokens, and SuperAdmin theme management.
- **Express Audit Results UI**: `AuditResultsView` component (`client/src/components/audit/AuditResultsView.tsx`) displays BriefResults with score circle, stats summary (OK/Warn/Fail counts with icons), hosting info block, expandable highlights accordion, CTA for PDF download and full report purchase, and reset button.
- **Full Audit Page**: Dedicated `/full-audit` route (`client/src/pages/full-audit.tsx`) for site type selection with expandable package grid, moved from landing page anchor for cleaner UX.

### Backend
- **Runtime**: Node.js with Express.js
- **API Pattern**: RESTful endpoints
- **Authentication**: Session-based with PostgreSQL session store and bcryptjs for password hashing.
- **Email Verification**: One-time verification at registration with 24-hour token expiry. Tokens hashed with HMAC-SHA256+pepper (SECRET_KEY), timing-safe comparison prevents timing attacks.
- **Password Reset**: Public endpoint for regular users with 3/hour rate limiting, 1-hour token expiry. Admin/superadmin password reset requires SuperAdmin access with PIN confirmation.
- **Compliance Features**:
    - **PDN Consent Tracking**: Full lifecycle management including versioning, IP/user-agent logging, pre-payment consent, and withdrawal with a 30-day destruction schedule. Background jobs process destruction tasks, with SuperAdmin legal hold capability.
    - **Cookie Consent**: GDPR/152-ФЗ compliant banner with granular preferences.
    - **Legal Pages**: Versioned /offer and /privacy pages.
- **Audit Engine**: Expanded to 60+ criteria for premium packages, covering FZ-152, FZ-149, GDPR, cookies, technical aspects, legal, content, and security. Enhanced with structured evidence arrays and law basis references (AuditCheckResult interface).
- **Hosting Detection**: 2-layer Russian hosting detection (`server/hosting-checker.ts`):
  - **Layer 1 (Deterministic)**: DNS→IP→PTR lookup with dictionary matching (timeweb, beget, reg.ru, etc.)
  - **Layer 2 (AI)**: WHOIS analysis via AI when Layer 1 is uncertain (saves API costs)
  - Results stored in `hosting_info` jsonb column with status: russian/foreign/uncertain
- **Brief Results**: Standardized JSON structure (`BriefResults` type) for express audit reports containing score, severity, 7-12 key highlights, hosting status, and upsell CTA. Stored in `brief_results` jsonb column.
- **Penalty System**: Real КоАП РФ ст. 13.11 penalties in `server/penalties-map.ts` with 10+ check types, calculated totals by subject type (физлица, должностные лица, ИП, юрлица), and automatic deduplication by aggregation keys.
- **PDF Report Generation**: Branded multi-page PDF reports with detailed criteria results, calculated penalty risk tables by subject type, law references, recommendations, and calls to action.
- **SEO Management**: SuperAdmin controlled CRUD for SEO pages, dynamic public routes, and sitemap generation.
- **Tools Service (Инструментарий)**: 11 paid tools (10₽ per use) with pay-per-use model:
  - `/api/tools/catalog` - Returns all tools with pricing and payment status
  - `/api/tools/history` - User's tool usage history
  - `/api/tools/payment/create` - Create payment for tool access
  - Paywall guard middleware (`createPaywallGuard`) checks: service enabled → tool enabled → auth → unused payment
  - Payments marked with `usedAt` timestamp after consumption (single-use tokens)
  - PII protection: sessionId never logged, emails/INN/passport masked via `redactObject()`
  - Free tool: hosting-recommendations (Russian hosting directory)
  - **User Agreement Generator**: Modular generator for website user agreements with support for 10 site types (content, services, saas, ecommerce, marketplace, ugc, onlineSchool, servicesAggregator, classifieds, crmSaas). Output format: {html, text, blocks[], json, evidence[], limitations[]}. Generator module: `server/generators/user-agreement-generator.ts`

### Database
- **Type**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema**: Defined in `shared/schema.ts`
- **Key Tables**: users, audit_packages, audits, audit_results, payments, reports, contracts, referrals, promo_codes, themes, audit_logs, pdn_consent_events, pdn_destruction_tasks, pdn_destruction_acts, seo_pages, express_audit_limits, tool_configs, tool_usage, service_configs.

### Role-Based Access Control
- **user**: Create audits, view own data, update profile.
- **admin**: View paid audits, manage packages, re-audit.
- **superadmin**: Full system access, including user management, system settings, audit logs, and theme management.

### Design Decisions
- **Monorepo**: Client, server, and shared types in one repository for type sharing and simplified deployment.
- **Session-Based Authentication**: Chosen for simplified secure logout and better web application integration.
- **Drizzle ORM**: Selected for type safety and PostgreSQL-specific features.
- **URL Normalization**: Backend standardizes all URL inputs.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.

### Payment Processing
- **Yookassa (formerly Yandex.Kassa)**: Primary payment gateway for the Russian market, supporting various payment methods (SBP, SberPay, T-Pay, Mir Pay, YooMoney, Mir card, SberBusiness).
- **Robokassa**: Integrated payment provider for additional options.
- **Installments**: Supported via YooKassa/Robokassa.

### AI Providers
- **GigaChat**: Default AI for audit analysis.
- **OpenAI**: Alternative AI provider option.

### Email Services
- **Nodemailer**: Configured for transactional emails (e.g., audit completion, payment confirmation, contract status changes). Intended providers: REG.RU, Yandex Mail, Mail.ru.
- **SMTP Configuration**: All SMTP settings including password stored in database (`system_settings` table). Password never logged or returned to API responses (only `hasPassword: boolean` flag). SuperAdmin UI at `/superadmin/email-settings` for configuration, connection testing, and test email sending.
- **Endpoints**: 
  - `GET /api/admin/settings/email` - Get SMTP settings with status
  - `PUT /api/admin/settings/email` - Update settings (password saved to DB)
  - `POST /api/admin/settings/email/verify` - Test SMTP connection
  - `POST /api/admin/settings/email/test` - Send test email

### Frontend Libraries
- **@radix-ui/***: Accessible UI primitives.
- **@tanstack/react-query**: Server state management.
- **lucide-react**: Icon library.

### Development Tools
- **Vite**: Frontend build and dev server.
- **drizzle-kit**: Database migration tooling.
- **tsx**: TypeScript execution for the server.
- **vitest**: Test framework with supertest for API integration tests.

## Testing

### Running Tests
```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
```

### Test Suites (8 tests, 4 files)
- **admin-settings.test.ts**: Settings update/masking, secret preservation
- **seo-pages.test.ts**: SEO CRUD lifecycle, public visibility control
- **pdn-workflow.test.ts**: PDN withdrawal → 30-day destruction task
- **pdn-job.test.ts**: SCHEDULED/LEGAL_HOLD/future scheduling behavior

### Test Infrastructure
- `tests/setup.ts`: App initialization for testing
- `tests/dbReset.ts`: Database reset with CASCADE deletes
- `tests/authHelper.ts`: Login helpers for superadmin/user roles

## Deployment

### Scripts
```bash
npm run build         # Build frontend + backend
npm run db:migrate    # Apply database migrations (drizzle-kit push --force)
npm run ci            # Full CI: build + test + migrate
npm run start         # Start production server
```

### Health Check
`GET /api/health` returns:
```json
{"ok": true, "version": "1.0.0", "environment": "production", "timestamp": "..."}
```

### Production Notes
- PDN destruction job runs every 6 hours (production only)
- Cookie consent banner blocks analytics/marketing scripts until consent
- `ALLOW_INSECURE_LOCALHOST_COOKIES` forbidden in production
- `AUDIT_MOCK_MODE` forbidden in production
- `SECRET_KEY` must remain stable to avoid invalidating outstanding email verification and password reset tokens
- Registration is blocked (503) if SMTP is not configured - configure email settings in SuperAdmin panel first
- Resend verification emails rate limited to 5 per hour per email address

### Session Table Setup (Required for Production)
After deploying to a new database, create the session table for `connect-pg-simple`:
```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

### Auth Flow Summary
- **Registration**: Requires SMTP → sends verification email → user lands on pending verification screen
- **Email Verification**: Token valid 24h → auto-redirect to /auth?state=verified → toast shown
- **Password Reset**: Public endpoint (3/hour limit) → token valid 1h → auto-redirect to /auth?state=password_reset
- **Login**: Blocked if email not verified (code: EMAIL_NOT_VERIFIED) → resend option shown