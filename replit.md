# SecureLex.ru

## Overview
SecureLex.ru is a website compliance checking platform designed to audit websites for adherence to Russian data protection laws (ФЗ-152, ФЗ-149) and other relevant regulations of the Russian Federation. It enables users to submit URLs for audits, select audit packages, process payments, and receive detailed, traffic-light-coded compliance reports. The platform supports regular users for self-audits, admins for managing paid audits, and superadmins for comprehensive system control, including theme customization and system settings.

## User Preferences
Preferred communication style: Simple, everyday language.
No foreign services: The platform does not use or support foreign data protection regulations (GDPR, etc.) - only Russian laws (ФЗ-152, ФЗ-149).

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state, React Context for auth and theme
- **Styling**: Tailwind CSS with shadcn/ui (New York style), Material Design 3 inspired, comprehensive theming system with light/dark modes and 19 semantic color tokens.
- **Key Features**: Express Audit Results UI, dedicated Full Audit page with auto-detection and individual order form, order-report page with integrated auth flow, payment-result page with upsell, and legal pages (Privacy Policy, User Agreement, Personal Data Agreement, Offer, Cookies Policy).

### Backend
- **Runtime**: Node.js with Express.js
- **API Pattern**: RESTful endpoints
- **Authentication**: Session-based with PostgreSQL session store, bcryptjs for password hashing. Includes email verification and password reset functionalities.
- **Compliance Features**: PDN Consent Tracking (with versioning, IP/user-agent logging, withdrawal with destruction schedule), 152-ФЗ compliant Cookie Consent, and versioned legal pages.
- **Audit Engine**: Over 60 criteria for premium packages covering ФЗ-152, ФЗ-149, cookies, technical, legal, content, and security aspects.
- **Hosting Detection**: Two-layer Russian hosting detection (DNS/PTR lookup and AI-powered WHOIS analysis).
- **Brief Results**: Standardized JSON structure for express audit reports, including score, severity, key highlights, hosting status, site type detection, and dynamic pricing.
- **Site Type Detection**: Automated classification of websites into 12 categories (ecommerce, marketplace, services, corporate, landing, saas, blog, onlineSchool, ugc, classifieds, government, other) using HTML analysis with confidence levels. Each type has a recommended audit package price.
- **Penalty System**: Calculation of real КоАП РФ ст. 13.11 penalties with automated deduplication.
- **PDF Report Generation**: Branded, multi-page PDF reports with detailed criteria results, penalty risk tables, law references, and recommendations.
- **SEO Management**: SuperAdmin controlled CRUD for SEO pages and sitemap generation.
- **Tools Service**: 11 paid, pay-per-use tools including RKN Registry Check and a modular User Agreement Generator.
- **Email Subscription Service**: Newsletter system with Russian email provider integrations (SendPulse, Unisender, Dashamail) and double opt-in.

### Database
- **Type**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod.
- **Schema**: Comprehensive, including tables for users, audits, payments, reports, contracts, promotions, and system settings.
- **Features**: Promotions system for time-limited campaigns and a Guide feature for educational articles on data protection laws.

### Role-Based Access Control
- **user**: Create audits, view personal data.
- **admin**: Manage paid audits and packages.
- **superadmin**: Full system control, user management, system settings, theme management.

### Design Decisions
- **Monorepo**: For shared types and simplified deployment.
- **Session-Based Authentication**: For secure logout and web application integration.
- **Drizzle ORM**: For type safety and PostgreSQL features.
- **URL Normalization**: Backend standardizes all URL inputs.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.

### Payment Processing
- **Yookassa**: Primary payment gateway for the Russian market.
- **Robokassa**: Additional payment provider.

### AI Providers
- **GigaChat**: Default AI for audit analysis.
- **OpenAI**: Alternative AI provider option.

### Email Services
- **Nodemailer**: For transactional emails with configurable SMTP via REG.RU, Yandex Mail, Mail.ru.
- **SendPulse, Unisender, Dashamail**: For newsletter subscriptions.

### Frontend Libraries
- **@radix-ui/***: Accessible UI primitives.
- **@tanstack/react-query**: Server state management.
- **lucide-react**: Icon library.