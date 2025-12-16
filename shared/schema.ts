import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, serial, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// =====================================================
// PDN (Personal Data) & Limits Enums
// =====================================================
export const pdnConsentEventTypeEnum = pgEnum("pdn_consent_event_type", ["GIVEN", "WITHDRAWN"]);
export const pdnDestructionStatusEnum = pgEnum("pdn_destruction_status", ["SCHEDULED", "DONE", "LEGAL_HOLD"]);
export const pdnDestructionMethodEnum = pgEnum("pdn_destruction_method", ["anonymize", "delete"]);
export const freeLimitSubjectTypeEnum = pgEnum("free_limit_subject_type", ["user", "anon"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  companyName: varchar("company_name", { length: 255 }),
  inn: varchar("inn", { length: 12 }),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  isMasterAdmin: boolean("is_master_admin").default(false),
  pdnConsentAt: timestamp("pdn_consent_at"),
  marketingConsent: boolean("marketing_consent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  emailVerifiedAt: timestamp("email_verified_at"),
  emailVerifyTokenHash: text("email_verify_token_hash"),
  emailVerifyTokenExpiresAt: timestamp("email_verify_token_expires_at"),
  emailVerifySentAt: timestamp("email_verify_sent_at"),
  passwordResetTokenHash: text("password_reset_token_hash"),
  passwordResetTokenExpiresAt: timestamp("password_reset_token_expires_at"),
});

export const usersRelations = relations(users, ({ many }) => ({
  audits: many(audits),
  payments: many(payments),
}));

export const auditPackages = pgTable("audit_packages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().unique(),
  category: varchar("category", { length: 50 }).default("full_audit").notNull(),
  siteType: varchar("site_type", { length: 100 }),
  price: integer("price").notNull(),
  criteriaCount: integer("criteria_count").notNull(),
  durationMin: integer("duration_min").notNull(),
  durationMax: integer("duration_max").notNull(),
  description: text("description"),
  features: text("features").array(),
  criteriaTemplates: jsonb("criteria_templates"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const auditPackagesRelations = relations(auditPackages, ({ many }) => ({
  audits: many(audits),
}));

export const audits = pgTable("audits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  packageId: integer("package_id").references(() => auditPackages.id).notNull(),
  websiteUrlNormalized: varchar("website_url_normalized", { length: 255 }).notNull(),
  websiteUrlOriginal: varchar("website_url_original", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const auditsRelations = relations(audits, ({ one, many }) => ({
  user: one(users, {
    fields: [audits.userId],
    references: [users.id],
  }),
  package: one(auditPackages, {
    fields: [audits.packageId],
    references: [auditPackages.id],
  }),
  results: many(auditResults),
  reports: many(reports),
}));

export const auditResults = pgTable("audit_results", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id").references(() => audits.id).notNull(),
  criteriaJson: jsonb("criteria_json").notNull(),
  rknCheckJson: jsonb("rkn_check_json"),
  hostingInfo: jsonb("hosting_info"),
  briefResults: jsonb("brief_results"),
  fullResults: jsonb("full_results"),
  scorePercent: integer("score_percent"),
  severity: varchar("severity", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditResultsRelations = relations(auditResults, ({ one }) => ({
  audit: one(audits, {
    fields: [auditResults.auditId],
    references: [audits.id],
  }),
}));

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  auditId: integer("audit_id").references(() => audits.id),
  serviceType: varchar("service_type", { length: 50 }).default("audit"),
  toolId: integer("tool_id"),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("RUB").notNull(),
  yandexPaymentId: varchar("yandex_payment_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  description: text("description"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  audit: one(audits, {
    fields: [payments.auditId],
    references: [audits.id],
  }),
}));

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id").references(() => audits.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  contentHtml: text("content_html"),
  pdfUrl: varchar("pdf_url", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reportsRelations = relations(reports, ({ one }) => ({
  audit: one(audits, {
    fields: [reports.auditId],
    references: [audits.id],
  }),
}));

// Theme preset type definitions
export const themeColorsSchema = z.object({
  primary: z.string(),
  primaryForeground: z.string(),
  secondary: z.string(),
  secondaryForeground: z.string(),
  background: z.string(),
  foreground: z.string(),
  card: z.string(),
  cardForeground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  accent: z.string(),
  accentForeground: z.string(),
  destructive: z.string(),
  destructiveForeground: z.string(),
  border: z.string(),
  sidebar: z.string(),
  sidebarForeground: z.string(),
  sidebarPrimary: z.string(),
  sidebarAccent: z.string(),
});

export const themeLayoutSchema = z.object({
  type: z.enum(["sidebar", "top-nav"]),
  sidebarWidth: z.string().optional(),
  headerHeight: z.string().optional(),
  borderRadius: z.string().optional(),
});

export const themeFooterSchema = z.object({
  columns: z.array(z.object({
    title: z.string(),
    links: z.array(z.object({
      label: z.string(),
      href: z.string(),
    })),
  })),
  showSocial: z.boolean(),
  showPaymentMethods: z.boolean(),
  copyrightText: z.string().optional(),
});

export const themeDashboardSchema = z.object({
  cardStyle: z.enum(["flat", "elevated", "bordered"]),
  statsLayout: z.enum(["grid", "list"]),
  showQuickActions: z.boolean(),
  accentColors: z.object({
    success: z.string(),
    warning: z.string(),
    error: z.string(),
    info: z.string(),
  }).optional(),
});

export const themePresetSchema = z.object({
  colors: themeColorsSchema,
  darkColors: themeColorsSchema.optional(),
  layout: themeLayoutSchema,
  footer: themeFooterSchema.optional(),
  dashboard: themeDashboardSchema.optional(),
});

export type ThemeColors = z.infer<typeof themeColorsSchema>;
export type ThemeLayout = z.infer<typeof themeLayoutSchema>;
export type ThemeFooter = z.infer<typeof themeFooterSchema>;
export type ThemeDashboard = z.infer<typeof themeDashboardSchema>;
export type ThemePreset = z.infer<typeof themePresetSchema>;

export const designThemes = pgTable("design_themes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  description: text("description"),
  previewImage: varchar("preview_image", { length: 500 }),
  preset: jsonb("preset").notNull().$type<ThemePreset>(),
  isActive: boolean("is_active").default(false).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const secureSettings = pgTable("secure_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  encryptedValue: text("encrypted_value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export type SecureSetting = typeof secureSettings.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 255 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: integer("resource_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").references(() => users.id).notNull(),
  referredUserId: integer("referred_user_id").references(() => users.id),
  referralCode: varchar("referral_code", { length: 50 }).notNull().unique(),
  earningsTotal: integer("earnings_total").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: varchar("discount_type", { length: 20 }).default("percent").notNull(),
  discountPercent: integer("discount_percent"),
  discountAmount: integer("discount_amount"),
  appliesTo: varchar("applies_to", { length: 20 }).default("all").notNull(),
  appliesToIds: integer("applies_to_ids").array(),
  maxUses: integer("max_uses").default(1000),
  usedCount: integer("used_count").default(0).notNull(),
  validFrom: timestamp("valid_from").defaultNow().notNull(),
  validTo: timestamp("valid_to"),
  validDurationDays: integer("valid_duration_days"),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const promoCodeRedemptions = pgTable("promo_code_redemptions", {
  id: serial("id").primaryKey(),
  promoCodeId: integer("promo_code_id").references(() => promoCodes.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  paymentId: integer("payment_id").references(() => payments.id),
  originalAmount: integer("original_amount").notNull(),
  discountedAmount: integer("discounted_amount").notNull(),
  appliedDiscount: integer("applied_discount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id").references(() => audits.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  signMethod: varchar("sign_method", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  signedAt: timestamp("signed_at"),
  documentUrl: varchar("document_url", { length: 255 }),
  emailConfirmationToken: varchar("email_confirmation_token", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const publicAudits = pgTable("public_audits", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  websiteUrl: varchar("website_url", { length: 255 }).notNull(),
  websiteUrlNormalized: varchar("website_url_normalized", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).default("processing").notNull(),
  stageIndex: integer("stage_index").default(0).notNull(),
  passedCount: integer("passed_count").default(0).notNull(),
  warningCount: integer("warning_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  totalCount: integer("total_count").default(0).notNull(),
  scorePercent: integer("score_percent"),
  severity: varchar("severity", { length: 10 }),
  summaryJson: jsonb("summary_json"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rknRegistryCache = pgTable("rkn_registry_cache", {
  id: serial("id").primaryKey(),
  inn: varchar("inn", { length: 20 }).notNull().unique(),
  companyName: varchar("company_name", { length: 500 }),
  registrationNumber: varchar("registration_number", { length: 50 }),
  registrationDate: varchar("registration_date", { length: 20 }),
  isRegistered: boolean("is_registered").default(false).notNull(),
  lastCheckedAt: timestamp("last_checked_at").defaultNow().notNull(),
  rawData: jsonb("raw_data"),
});

export type RknRegistryEntry = typeof rknRegistryCache.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  pdnConsent: z.boolean().refine(val => val === true, {
    message: "Необходимо согласие на обработку персональных данных",
  }),
  marketingConsent: z.boolean().optional().default(false),
});

export const insertAuditPackageSchema = createInsertSchema(auditPackages).omit({
  id: true,
});

export const insertAuditSchema = createInsertSchema(audits).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  status: true,
});

export const createAuditSchema = z.object({
  websiteUrl: z.string().min(1, "Website URL is required"),
  packageType: z.string().min(1, "Package type is required"),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type AuditPackage = typeof auditPackages.$inferSelect;
export type InsertAuditPackage = z.infer<typeof insertAuditPackageSchema>;

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type CreateAuditInput = z.infer<typeof createAuditSchema>;

export type AuditResult = typeof auditResults.$inferSelect;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type DesignTheme = typeof designThemes.$inferSelect;

export const insertDesignThemeSchema = createInsertSchema(designThemes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDesignTheme = z.infer<typeof insertDesignThemeSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;

export type Referral = typeof referrals.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type PromoCodeRedemption = typeof promoCodeRedemptions.$inferSelect;
export type Contract = typeof contracts.$inferSelect;

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  earningsTotal: true,
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  createdAt: true,
  usedCount: true,
}).extend({
  discountType: z.enum(["percent", "amount"]).default("percent"),
  appliesTo: z.enum(["all", "packages", "reports"]).default("all"),
  maxUses: z.number().min(1).max(1000).optional(),
  validDurationDays: z.number().min(1).max(30).optional().nullable(),
});

export const insertPromoCodeRedemptionSchema = createInsertSchema(promoCodeRedemptions).omit({
  id: true,
  createdAt: true,
});

export type InsertPromoCodeRedemption = z.infer<typeof insertPromoCodeRedemptionSchema>;

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  signedAt: true,
});

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type InsertContract = z.infer<typeof insertContractSchema>;

export const insertPublicAuditSchema = createInsertSchema(publicAudits).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type PublicAudit = typeof publicAudits.$inferSelect;
export type InsertPublicAudit = z.infer<typeof insertPublicAuditSchema>;

// Login OTP codes for two-factor authentication
export const loginOtpCodes = pgTable("login_otp_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLoginOtpSchema = createInsertSchema(loginOtpCodes).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type LoginOtpCode = typeof loginOtpCodes.$inferSelect;
export type InsertLoginOtp = z.infer<typeof insertLoginOtpSchema>;

export type UserWithStats = User & {
  auditCount?: number;
  totalSpent?: number;
};

export type AuditWithDetails = Audit & {
  package?: AuditPackage;
  results?: AuditResult[];
  reports?: Report[];
};

export type CriteriaResult = {
  name: string;
  status: "passed" | "warning" | "failed" | "pending";
  description: string;
  details?: string;
  evidence?: string;
};

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// =====================================================
// PDN Consent Events - tracks user consent given/withdrawn
// =====================================================
export const pdnConsentEvents = pgTable("pdn_consent_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  eventType: pdnConsentEventTypeEnum("event_type").notNull(),
  eventAt: timestamp("event_at", { withTimezone: true }).defaultNow().notNull(),
  documentVersion: text("document_version").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  source: text("source").notNull(), // 'register' | 'checkout' | 'lk'
  meta: jsonb("meta").default({}).notNull(),
}, (table) => [
  index("pdn_consent_user_event_idx").on(table.userId, table.eventType, table.eventAt),
]);

export const pdnConsentEventsRelations = relations(pdnConsentEvents, ({ one }) => ({
  user: one(users, {
    fields: [pdnConsentEvents.userId],
    references: [users.id],
  }),
}));

// =====================================================
// PDN Destruction Acts - records of actual data destruction
// =====================================================
export const pdnDestructionActs = pgTable("pdn_destruction_acts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  method: pdnDestructionMethodEnum("method").notNull(),
  summary: text("summary").notNull(),
  operatorUserId: integer("operator_user_id").references(() => users.id, { onDelete: "set null" }),
  details: jsonb("details").default({}).notNull(),
});

export const pdnDestructionActsRelations = relations(pdnDestructionActs, ({ one }) => ({
  user: one(users, {
    fields: [pdnDestructionActs.userId],
    references: [users.id],
  }),
  operator: one(users, {
    fields: [pdnDestructionActs.operatorUserId],
    references: [users.id],
  }),
}));

// =====================================================
// PDN Destruction Tasks - scheduled destruction after consent withdrawal
// =====================================================
export const pdnDestructionTasks = pgTable("pdn_destruction_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: pdnDestructionStatusEnum("status").default("SCHEDULED").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  legalHoldReason: text("legal_hold_reason"),
  destructionActId: integer("destruction_act_id").references(() => pdnDestructionActs.id, { onDelete: "set null" }),
  meta: jsonb("meta").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("pdn_tasks_status_scheduled_idx").on(table.status, table.scheduledAt),
  index("pdn_tasks_user_idx").on(table.userId),
]);

export const pdnDestructionTasksRelations = relations(pdnDestructionTasks, ({ one }) => ({
  user: one(users, {
    fields: [pdnDestructionTasks.userId],
    references: [users.id],
  }),
  destructionAct: one(pdnDestructionActs, {
    fields: [pdnDestructionTasks.destructionActId],
    references: [pdnDestructionActs.id],
  }),
}));

// =====================================================
// Free Express Limit Events - tracks usage of free express checks
// =====================================================
export const freeExpressLimitEvents = pgTable("free_express_limit_events", {
  id: serial("id").primaryKey(),
  subjectType: freeLimitSubjectTypeEnum("subject_type").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  anonHash: text("anon_hash"), // sha256(ip + '|' + user-agent)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  meta: jsonb("meta").default({}).notNull(),
}, (table) => [
  index("free_limit_user_idx").on(table.subjectType, table.userId, table.createdAt),
  index("free_limit_anon_idx").on(table.subjectType, table.anonHash, table.createdAt),
]);

export const freeExpressLimitEventsRelations = relations(freeExpressLimitEvents, ({ one }) => ({
  user: one(users, {
    fields: [freeExpressLimitEvents.userId],
    references: [users.id],
  }),
}));

// =====================================================
// SEO Pages - dynamic SEO-optimized content pages
// =====================================================
export const seoPages = pgTable("seo_pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  h1: text("h1").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  content: text("content").notNull(), // markdown
  isActive: boolean("is_active").default(true).notNull(),
  meta: jsonb("meta").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// =====================================================
// New Types
// =====================================================
export type PdnConsentEvent = typeof pdnConsentEvents.$inferSelect;
export type PdnDestructionAct = typeof pdnDestructionActs.$inferSelect;
export type PdnDestructionTask = typeof pdnDestructionTasks.$inferSelect;
export type FreeExpressLimitEvent = typeof freeExpressLimitEvents.$inferSelect;
export type SeoPage = typeof seoPages.$inferSelect;

export const insertPdnConsentEventSchema = createInsertSchema(pdnConsentEvents).omit({
  id: true,
  eventAt: true,
});

export const insertSeoPageSchema = createInsertSchema(seoPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPdnConsentEvent = z.infer<typeof insertPdnConsentEventSchema>;
export type InsertSeoPage = z.infer<typeof insertSeoPageSchema>;

// =====================================================
// Hosting Check Types (для проверки хостинга РФ)
// =====================================================
export const hostingStatusSchema = z.enum(["ru", "foreign", "unknown"]);

export const hostingAiResultSchema = z.object({
  used: z.boolean(),
  status: hostingStatusSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  note: z.string().optional(),
});

export const hostingInfoSchema = z.object({
  status: hostingStatusSchema,
  confidence: z.number().min(0).max(1),
  ips: z.array(z.string()),
  providerGuess: z.string().nullable(),
  evidence: z.array(z.string()),
  ai: hostingAiResultSchema,
});

export type HostingStatus = z.infer<typeof hostingStatusSchema>;
export type HostingAiResult = z.infer<typeof hostingAiResultSchema>;
export type HostingInfo = z.infer<typeof hostingInfoSchema>;

// =====================================================
// Brief Results (экспресс-проверка) - структурированный JSON
// =====================================================
export const lawRefSchema = z.object({
  act: z.string(),
  ref: z.string(),
});

export const briefHighlightSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["ok", "warn", "fail", "na"]),
  severity: z.enum(["critical", "medium", "low", "info"]),
  summary: z.string(),
  howToFixShort: z.string().optional(),
  law: z.array(lawRefSchema).optional(),
});

export const briefScoreSchema = z.object({
  percent: z.number().min(0).max(100),
  severity: z.enum(["low", "medium", "high"]),
  totals: z.object({
    checks: z.number(),
    ok: z.number(),
    warn: z.number(),
    fail: z.number(),
    na: z.number(),
  }),
});

export const briefCtaSchema = z.object({
  fullReportPriceRub: z.number(),
  fullReportIncludes: z.array(z.string()),
});

export const briefResultsSchema = z.object({
  version: z.string().default("1.0"),
  reportType: z.literal("express"),
  generatedAt: z.string(),
  site: z.object({
    url: z.string(),
    domain: z.string(),
  }),
  score: briefScoreSchema,
  hosting: hostingInfoSchema,
  highlights: z.array(briefHighlightSchema),
  cta: briefCtaSchema,
});

export type LawRef = z.infer<typeof lawRefSchema>;
export type BriefHighlight = z.infer<typeof briefHighlightSchema>;
export type BriefScore = z.infer<typeof briefScoreSchema>;
export type BriefCta = z.infer<typeof briefCtaSchema>;
export type BriefResults = z.infer<typeof briefResultsSchema>;

// =====================================================
// Full Results (полный отчёт за 900₽) - структурированный JSON
// =====================================================
export const possibleLiabilitySchema = z.object({
  type: z.enum(["administrative", "civil", "criminal"]),
  note: z.string(),
});

export const fullCheckSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["ok", "warn", "fail", "na"]),
  severity: z.enum(["critical", "medium", "low", "info"]),
  evidence: z.array(z.string()).optional(),
  risk: z.string().optional(),
  howToFix: z.array(z.string()).optional(),
  law: z.array(lawRefSchema).optional(),
  possibleLiability: z.array(possibleLiabilitySchema).optional(),
  links: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })).optional(),
});

export const fullSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  checks: z.array(fullCheckSchema),
});

export const fullRecommendationsSchema = z.object({
  priority1: z.array(z.string()),
  priority2: z.array(z.string()),
  priority3: z.array(z.string()),
});

export const fullResultsSchema = z.object({
  version: z.string().default("1.0"),
  reportType: z.literal("full"),
  generatedAt: z.string(),
  site: z.object({
    url: z.string(),
    domain: z.string(),
    snapshot: z.object({
      checkedPaths: z.array(z.string()).optional(),
      responseTimeMs: z.number().optional(),
      statusCodes: z.array(z.object({
        path: z.string(),
        code: z.number(),
      })).optional(),
    }).optional(),
  }),
  score: briefScoreSchema,
  hosting: hostingInfoSchema,
  sections: z.array(fullSectionSchema),
  recommendations: fullRecommendationsSchema,
});

export type PossibleLiability = z.infer<typeof possibleLiabilitySchema>;
export type FullCheck = z.infer<typeof fullCheckSchema>;
export type FullSection = z.infer<typeof fullSectionSchema>;
export type FullRecommendations = z.infer<typeof fullRecommendationsSchema>;
export type FullResults = z.infer<typeof fullResultsSchema>;

// =====================================================
// Payment Gateways (v2.1)
// =====================================================
export const paymentGateways = pgTable("payment_gateways", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  isDefault: boolean("is_default").default(false),
  config: jsonb("config"),
  commissionPercent: integer("commission_percent").default(0),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPaymentGatewaySchema = createInsertSchema(paymentGateways).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentGateway = z.infer<typeof insertPaymentGatewaySchema>;
export type PaymentGateway = typeof paymentGateways.$inferSelect;

// =====================================================
// Service Configs (v2.1) - 3 main services
// =====================================================
export const serviceConfigs = pgTable("service_configs", {
  id: serial("id").primaryKey(),
  serviceKey: varchar("service_key", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  basePrice: integer("base_price").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  config: jsonb("config"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServiceConfigSchema = createInsertSchema(serviceConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceConfig = z.infer<typeof insertServiceConfigSchema>;
export type ServiceConfig = typeof serviceConfigs.$inferSelect;

// =====================================================
// Tool Configs (v2.1) - 10 tools
// =====================================================
export const toolConfigs = pgTable("tool_configs", {
  id: serial("id").primaryKey(),
  toolKey: varchar("tool_key", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  price: integer("price").default(10).notNull(),
  isFree: boolean("is_free").default(false),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  usageCount: integer("usage_count").default(0),
  config: jsonb("config"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertToolConfigSchema = createInsertSchema(toolConfigs).omit({ id: true, createdAt: true, updatedAt: true, usageCount: true });
export type InsertToolConfig = z.infer<typeof insertToolConfigSchema>;
export type ToolConfig = typeof toolConfigs.$inferSelect;

// =====================================================
// Tool Usage (v2.1) - history of tool usage
// =====================================================
export const toolUsage = pgTable("tool_usage", {
  id: serial("id").primaryKey(),
  toolKey: varchar("tool_key", { length: 50 }).notNull(),
  userId: integer("user_id").references(() => users.id),
  sessionId: varchar("session_id", { length: 255 }),
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  paymentId: integer("payment_id").references(() => payments.id),
  isPaid: boolean("is_paid").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("tool_usage_tool_key_idx").on(table.toolKey),
  index("tool_usage_user_id_idx").on(table.userId),
]);

export const insertToolUsageSchema = createInsertSchema(toolUsage).omit({ id: true, createdAt: true });
export type InsertToolUsage = z.infer<typeof insertToolUsageSchema>;
export type ToolUsage = typeof toolUsage.$inferSelect;
