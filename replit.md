# SecureLex.ru

## Overview

SecureLex.ru is a website compliance checking platform that automatically audits websites for compliance with Russian data protection laws (ФЗ-152, ФЗ-149), GDPR, and other regulations. Users submit their website URL, select a package type from 9 available options, pay via Yandex.Kassa, and receive detailed compliance reports with a traffic-light severity system (green/yellow/red).

The platform features three user roles: regular users who can run audits on their sites, admins who manage paid audits, and superadmins with full system control including theme customization and site settings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for bundling
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for auth and theme
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Design System**: Material Design 3 inspired with professional enterprise customization, light/dark theme support

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **API Pattern**: RESTful endpoints under `/api/*`
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Authentication**: Session-based auth with bcryptjs password hashing

### Database Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**: users, audit_packages, audits, audit_results, payments, reports, contracts, referrals, promo_codes, themes, audit_logs

### Recent Changes (December 2024)

#### Sprint December 15, 2024
- **iOS Safari localStorage Fix**: Wrapped all localStorage calls with try-catch for iOS Safari private browsing compatibility
- **New "Проверка РКН" Package**: Added new 10₽ package for quick Roskomnadzor registry checks
- **Robokassa Integration**: Full payment provider support with settings in superadmin panel
- **Installments (Рассрочка)**: Added installment payment options via YooKassa/Robokassa with banner/modal in checkout
- **YooKassa Diagnostics**: Admin panel shows last payment request/response for debugging
- **PDF Cyrillic Fix**: Fixed font rendering on all pages with DejaVu font after each addPage()

#### Earlier December 2024
- **Comprehensive Theme System**: New preset-based design theme architecture
  - ThemeManagerProvider in `client/src/lib/theme-manager.tsx` manages all theme state
  - ColorModeToggle component for light/dark mode switching with localStorage persistence
  - Themes defined in `design_themes` table with preset JSON containing colors, darkColors, layout configs
  - 19 semantic color tokens (primary, secondary, accent, destructive, etc.) with full light/dark variants
  - Active theme fetched via GET /api/theme/active endpoint
  - Superadmin can create/edit/activate themes via /superadmin/themes page
  - Default themes seeded: Corporate (blue, sidebar), Modern (purple, top-nav), Emerald (green)
- **PDF Report Generation**: Full implementation of PDF reports for completed audits via GET /api/audits/:id/pdf
  - Branded multi-page document with SecureLex.ru header
  - Detailed criteria results grouped by category (ФЗ-152, ФЗ-149, GDPR)
  - Fines and risks section with real penalties from Russian law
  - Recommendations for fixing violations
  - Call-to-action for ordering full audit services
  - Uses pdfkit library for server-side PDF generation
- **AI Provider Selection**: SuperAdmin can choose between GigaChat (default) and OpenAI for audit analysis
  - Settings stored in system_settings table
  - GigaChat uses OAuth token caching with 30-minute refresh
  - Graceful fallback when API errors occur
- **SuperAdmin Dashboard**: Added separate /superadmin/* routes with dedicated sidebar section, including user management, system settings, audit logs, and theme customization
- **Contract Signing System**: Implemented 3 signing methods (digital signature, email confirmation, manual approval) with status tracking and admin approval workflow
- **Referral Program**: Full end-to-end implementation with referral links, earnings tracking, and promo code discounts
- **Enhanced Audit Engine**: Expanded from ~10 to 60+ criteria for premium packages, including comprehensive FZ-152, FZ-149, GDPR, cookie, technical, legal, content, and security checks
- **Email Notifications**: Integrated nodemailer for transactional emails (audit completion, payment confirmation, contract status changes)

### Role-Based Access Control
- **user**: Can create audits, view own audits/payments, update profile
- **admin**: Can view paid audits, manage packages, re-audit
- **superadmin**: Full system access including all users, audit logs, theme management

### Key Design Decisions

1. **Monorepo Structure**: Client code in `/client`, server in `/server`, shared types in `/shared`
   - Enables type sharing between frontend and backend
   - Single deployment unit simplifies hosting

2. **Session-Based Auth over JWT**: Uses server-side sessions stored in PostgreSQL
   - Simpler to implement secure logout
   - Better for web applications with cookie support

3. **Drizzle ORM**: Chosen for type safety and PostgreSQL-specific features
   - Schema defined in TypeScript, migrations in `/migrations`
   - Relations defined for query building

4. **URL Normalization**: Backend normalizes all URL inputs to consistent format
   - Accepts various formats (with/without protocol, www)
   - Stores both original and normalized versions

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, requires `DATABASE_URL` environment variable

### Payment Processing
- **Yookassa (formerly Yandex.Kassa)**: Payment gateway for Russian market
- **Supported Payment Methods**: SBP (0%), SberPay (2.8%), T-Pay (3.8%), Mir Pay (2.8%), YooMoney (2.8%), Mir card, SberBusiness (B2B)
- **Mock Mode**: Currently using simulated payments until API keys are received
- Environment variables: `YANDEX_KASSA_SHOP_ID`, `YANDEX_KASSA_SECURE_TOKEN`, `YANDEX_KASSA_MODE`
- **Checkout Flow**: /checkout/:auditId page with payment method selection, real-time status updates
- **Branding**: Yookassa logo and payment method icons displayed in landing page footer per service requirements

### Email Services
- **Nodemailer**: Configured for transactional emails
- Intended providers: Yandex Mail (primary), Mail.ru (backup)

### Frontend Libraries
- **@radix-ui/***: Accessible UI primitives for shadcn/ui components
- **@tanstack/react-query**: Server state management
- **lucide-react**: Icon library

### Development Tools
- **Vite**: Frontend build and dev server with HMR
- **drizzle-kit**: Database migration tooling (`npm run db:push`)
- **tsx**: TypeScript execution for server

---

## Manual Testing Checklist

### Pre-Release Checklist

#### 1. Authentication Flow
- [ ] User registration with valid email
- [ ] User login/logout
- [ ] Password reset flow (if implemented)
- [ ] Session persistence after page refresh
- [ ] SuperAdmin login with SUPERADMIN_PASSWORD

#### 2. Landing Page
- [ ] Hero section displays correctly
- [ ] Package cards show correct prices
- [ ] "Проверка РКН" package (10₽) visible
- [ ] Footer with Yookassa branding
- [ ] Light/dark theme toggle works
- [ ] Mobile responsive layout

#### 3. Express Check (Free)
- [ ] Enter URL and run free check
- [ ] Results display with traffic light system
- [ ] Express report PDF download button works
- [ ] PDF renders Cyrillic correctly on all pages

#### 4. Package Selection & Checkout
- [ ] All packages display with correct prices
- [ ] Select package and proceed to checkout
- [ ] Promo code input works
- [ ] Payment method selection (YooKassa/Robokassa)
- [ ] Installment banner displays (if enabled)
- [ ] Installment modal opens with provider options

#### 5. Payment Processing
- [ ] YooKassa payment creation
- [ ] Robokassa payment creation
- [ ] Payment callback handling
- [ ] Payment status updates
- [ ] Payment diagnostics in admin panel

#### 6. User Dashboard (ЛК)
- [ ] Dashboard loads without localStorage errors (iOS Safari)
- [ ] Audit list displays correctly
- [ ] Individual audit details page
- [ ] PDF report download for completed audits
- [ ] Contract signing workflow

#### 7. Admin Panel (/admin/*)
- [ ] Admin dashboard with stats
- [ ] Paid audits list
- [ ] Package management with price editing
- [ ] Audit re-run functionality

#### 8. SuperAdmin Panel (/superadmin/*)
- [ ] User management (view, edit roles, delete)
- [ ] System settings (AI provider, email)
- [ ] Payment settings (YooKassa, Robokassa)
- [ ] Installment settings (enable/disable, banner text)
- [ ] Theme management (create, edit, activate themes)
- [ ] Promo codes management
- [ ] Audit logs

#### 9. Cross-Browser Testing
- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Firefox (desktop)
- [ ] iOS Safari (including private browsing)
- [ ] Chrome Mobile

#### 10. Performance & Security
- [ ] Pages load within 3 seconds
- [ ] No console errors in browser
- [ ] No exposed secrets in frontend
- [ ] HTTPS enforced in production

### Environment Variables Required

```
DATABASE_URL=postgresql://...
SUPERADMIN_PASSWORD=...

# YooKassa
YANDEX_KASSA_SHOP_ID=...
YANDEX_KASSA_SECURE_TOKEN=...
YANDEX_KASSA_MODE=live|test

# Robokassa (optional)
ROBOKASSA_LOGIN=...
ROBOKASSA_PASSWORD1=...
ROBOKASSA_PASSWORD2=...
ROBOKASSA_TEST_MODE=false|true

# AI Provider (optional - defaults to GigaChat)
GIGACHAT_CLIENT_ID=...
GIGACHAT_CLIENT_SECRET=...
OPENAI_API_KEY=...

# Email (optional)
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
```

### Quick Sanity Check (5 minutes)
1. Open landing page - verify packages show
2. Run express check on any URL
3. Download express PDF - verify Cyrillic text
4. Login as user - verify dashboard loads
5. Login as superadmin - verify settings pages work