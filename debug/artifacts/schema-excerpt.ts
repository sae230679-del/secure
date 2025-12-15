import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  companyName: varchar("company_name", { length: 255 }),
  inn: varchar("inn", { length: 12 }),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  pdnConsentAt: timestamp("pdn_consent_at"),
  marketingConsent: boolean("marketing_consent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("RUB").notNull(),
  yandexPaymentId: varchar("yandex_payment_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  description: text("description"),
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
