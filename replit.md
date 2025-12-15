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

### Backend
- **Runtime**: Node.js with Express.js
- **API Pattern**: RESTful endpoints
- **Authentication**: Session-based with PostgreSQL session store and bcryptjs for password hashing.
- **Compliance Features**:
    - **PDN Consent Tracking**: Full lifecycle management including versioning, IP/user-agent logging, pre-payment consent, and withdrawal with a 30-day destruction schedule. Background jobs process destruction tasks, with SuperAdmin legal hold capability.
    - **Cookie Consent**: GDPR/152-ФЗ compliant banner with granular preferences.
    - **Legal Pages**: Versioned /offer and /privacy pages.
- **Audit Engine**: Expanded to 60+ criteria for premium packages, covering FZ-152, FZ-149, GDPR, cookies, technical aspects, legal, content, and security. Enhanced with structured evidence arrays and law basis references (AuditCheckResult interface).
- **Penalty System**: Real КоАП РФ ст. 13.11 penalties in `server/penalties-map.ts` with 10+ check types, calculated totals by subject type (физлица, должностные лица, ИП, юрлица), and automatic deduplication by aggregation keys.
- **PDF Report Generation**: Branded multi-page PDF reports with detailed criteria results, calculated penalty risk tables by subject type, law references, recommendations, and calls to action.
- **SEO Management**: SuperAdmin controlled CRUD for SEO pages, dynamic public routes, and sitemap generation.

### Database
- **Type**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema**: Defined in `shared/schema.ts`
- **Key Tables**: users, audit_packages, audits, audit_results, payments, reports, contracts, referrals, promo_codes, themes, audit_logs, pdn_consent_events, pdn_destruction_tasks, pdn_destruction_acts, seo_pages, express_audit_limits.

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
- **Nodemailer**: Configured for transactional emails (e.g., audit completion, payment confirmation, contract status changes). Intended providers: Yandex Mail, Mail.ru.

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