import { db } from "./db";
import { eq, desc, and, or, sql, gt } from "drizzle-orm";
import * as schema from "@shared/schema";
import crypto from "crypto";
import type {
  User,
  AuditPackage,
  Audit,
  AuditResult,
  Payment,
  Report,
  AuditWithDetails,
  InsertAudit,
  InsertPayment,
  CriteriaResult,
  DesignTheme,
  SystemSetting,
  AuditLog,
  UserWithStats,
  Contract,
  Referral,
  PromoCode,
  PromoCodeRedemption,
  PublicAudit,
} from "@shared/schema";
import { hash, compare } from "bcryptjs";

export interface IStorage {
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: { name: string; email: string; phone?: string; password: string; pdnConsent?: boolean; marketingConsent?: boolean }): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;

  getPackages(): Promise<AuditPackage[]>;
  getPackageByType(type: string): Promise<AuditPackage | undefined>;
  getPackageById(id: number): Promise<AuditPackage | undefined>;
  updatePackage(id: number, data: Partial<AuditPackage>): Promise<AuditPackage | undefined>;

  getAuditsByUserId(userId: number): Promise<AuditWithDetails[]>;
  getAuditById(id: number): Promise<AuditWithDetails | undefined>;
  createAudit(data: InsertAudit): Promise<Audit>;
  updateAuditStatus(id: number, status: string, completedAt?: Date): Promise<Audit | undefined>;
  getPaidAudits(): Promise<AuditWithDetails[]>;
  
  createAuditResult(data: { auditId: number; criteriaJson: CriteriaResult[]; rknCheckJson?: any; scorePercent: number; severity: string }): Promise<AuditResult>;
  saveAuditResults(auditId: number, criteriaResults: CriteriaResult[], score: number): Promise<AuditResult>;

  getPaymentsByUserId(userId: number): Promise<Payment[]>;
  getPaymentsByAuditId(auditId: number): Promise<Payment[]>;
  getPaymentByExternalId(externalId: string): Promise<Payment | undefined>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePaymentStatus(id: number, status: string, yandexPaymentId?: string): Promise<Payment | undefined>;

  getUserStats(userId: number): Promise<{ totalAudits: number; totalSpent: number; activeAudits: number }>;
  getAdminStats(): Promise<{ revenue: number; totalPayments: number; activeAudits: number }>;

  getAllUsers(): Promise<UserWithStats[]>;
  updateUserRole(id: number, role: string): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  getSystemSettings(): Promise<SystemSetting[]>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  upsertSystemSetting(key: string, value: string): Promise<SystemSetting>;

  getDesignThemes(): Promise<DesignTheme[]>;
  getActiveTheme(): Promise<DesignTheme | undefined>;
  createDesignTheme(data: { name: string; key: string; description?: string; preset: schema.ThemePreset; createdBy?: number }): Promise<DesignTheme>;
  updateDesignTheme(id: number, data: Partial<DesignTheme>): Promise<DesignTheme | undefined>;
  setActiveTheme(id: number): Promise<DesignTheme | undefined>;

  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(data: { userId?: number; action: string; resourceType?: string; resourceId?: number; details?: string }): Promise<AuditLog>;

  getContractsByUserId(userId: number): Promise<Contract[]>;
  getContractById(id: number): Promise<Contract | undefined>;
  getContractByAuditId(auditId: number): Promise<Contract | undefined>;
  createContract(data: { auditId: number; userId: number; signMethod: string }): Promise<Contract>;
  updateContractStatus(id: number, status: string, signedAt?: Date): Promise<Contract | undefined>;
  confirmContractByToken(token: string): Promise<Contract | undefined>;

  getReferralByUserId(userId: number): Promise<Referral | undefined>;
  getReferralByCode(code: string): Promise<Referral | undefined>;
  createReferral(userId: number): Promise<Referral>;
  updateReferralEarnings(id: number, amount: number): Promise<Referral | undefined>;

  getPromoCodes(): Promise<PromoCode[]>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  getPromoCodeById(id: number): Promise<PromoCode | undefined>;
  createPromoCode(data: {
    code: string;
    discountType: "percent" | "amount";
    discountPercent?: number | null;
    discountAmount?: number | null;
    appliesTo: "all" | "packages" | "reports";
    appliesToIds?: number[] | null;
    maxUses?: number;
    validTo?: Date | null;
    validDurationDays?: number | null;
    description?: string | null;
    createdBy?: number | null;
  }): Promise<PromoCode>;
  updatePromoCode(id: number, data: Partial<PromoCode>): Promise<PromoCode | undefined>;
  deletePromoCode(id: number): Promise<boolean>;
  usePromoCode(id: number): Promise<PromoCode | undefined>;
  validatePromoCode(code: string, amount: number, userId: number, targetType?: "packages" | "reports", targetId?: number): Promise<{ valid: boolean; promoCode?: PromoCode; discount?: number; finalAmount?: number; error?: string }>;
  createPromoCodeRedemption(data: { promoCodeId: number; userId: number; paymentId?: number | null; originalAmount: number; discountedAmount: number; appliedDiscount: number }): Promise<PromoCodeRedemption>;
  getPromoCodeRedemptions(promoCodeId: number): Promise<PromoCodeRedemption[]>;
  getUserPromoCodeRedemptions(userId: number): Promise<PromoCodeRedemption[]>;

  createPublicAudit(data: { token: string; websiteUrl: string; websiteUrlNormalized: string; ipAddress?: string }): Promise<PublicAudit>;
  getPublicAuditByToken(token: string): Promise<PublicAudit | undefined>;
  updatePublicAuditProgress(token: string, data: Partial<PublicAudit>): Promise<PublicAudit | undefined>;
  getRecentPublicAuditsByIp(ipAddress: string, hoursAgo?: number): Promise<PublicAudit[]>;

  seedPackages(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase()));
    return user;
  }

  async createUser(data: { name: string; email: string; phone?: string; password: string; pdnConsent?: boolean; marketingConsent?: boolean }): Promise<User> {
    const passwordHash = await hash(data.password, 10);
    const [user] = await db
      .insert(schema.users)
      .values({
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        passwordHash,
        role: "user",
        pdnConsentAt: data.pdnConsent ? new Date() : null,
        marketingConsent: data.marketingConsent ?? false,
      })
      .returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }

  async getPackages(): Promise<AuditPackage[]> {
    return db.select().from(schema.auditPackages).orderBy(schema.auditPackages.price);
  }

  async getPackageByType(type: string): Promise<AuditPackage | undefined> {
    const [pkg] = await db.select().from(schema.auditPackages).where(eq(schema.auditPackages.type, type));
    return pkg;
  }

  async getPackageById(id: number): Promise<AuditPackage | undefined> {
    const [pkg] = await db.select().from(schema.auditPackages).where(eq(schema.auditPackages.id, id));
    return pkg;
  }

  async updatePackage(id: number, data: Partial<AuditPackage>): Promise<AuditPackage | undefined> {
    const [pkg] = await db
      .update(schema.auditPackages)
      .set(data)
      .where(eq(schema.auditPackages.id, id))
      .returning();
    return pkg;
  }

  async getAuditsByUserId(userId: number): Promise<AuditWithDetails[]> {
    const audits = await db
      .select()
      .from(schema.audits)
      .where(eq(schema.audits.userId, userId))
      .orderBy(desc(schema.audits.createdAt));

    const auditsWithDetails: AuditWithDetails[] = [];
    for (const audit of audits) {
      const pkg = await this.getPackageById(audit.packageId);
      const results = await db.select().from(schema.auditResults).where(eq(schema.auditResults.auditId, audit.id));
      auditsWithDetails.push({
        ...audit,
        package: pkg,
        results,
      });
    }
    return auditsWithDetails;
  }

  async getAuditById(id: number): Promise<AuditWithDetails | undefined> {
    const [audit] = await db.select().from(schema.audits).where(eq(schema.audits.id, id));
    if (!audit) return undefined;

    const pkg = await this.getPackageById(audit.packageId);
    const results = await db.select().from(schema.auditResults).where(eq(schema.auditResults.auditId, audit.id));
    const reports = await db.select().from(schema.reports).where(eq(schema.reports.auditId, audit.id));

    return {
      ...audit,
      package: pkg,
      results,
      reports,
    };
  }

  async createAudit(data: InsertAudit): Promise<Audit> {
    const [audit] = await db
      .insert(schema.audits)
      .values({
        ...data,
        status: "pending",
      })
      .returning();
    return audit;
  }

  async updateAuditStatus(id: number, status: string, completedAt?: Date): Promise<Audit | undefined> {
    const [audit] = await db
      .update(schema.audits)
      .set({ status, completedAt: completedAt || null })
      .where(eq(schema.audits.id, id))
      .returning();
    return audit;
  }

  async getPaidAudits(): Promise<AuditWithDetails[]> {
    const audits = await db
      .select()
      .from(schema.audits)
      .orderBy(desc(schema.audits.createdAt));

    const auditsWithDetails: AuditWithDetails[] = [];
    for (const audit of audits) {
      const pkg = await this.getPackageById(audit.packageId);
      const results = await db.select().from(schema.auditResults).where(eq(schema.auditResults.auditId, audit.id));
      auditsWithDetails.push({
        ...audit,
        package: pkg,
        results,
      });
    }
    return auditsWithDetails;
  }

  async createAuditResult(data: { auditId: number; criteriaJson: CriteriaResult[]; rknCheckJson?: any; scorePercent: number; severity: string; hostingInfo?: any; briefResults?: any }): Promise<AuditResult> {
    const [result] = await db
      .insert(schema.auditResults)
      .values({
        auditId: data.auditId,
        criteriaJson: data.criteriaJson,
        rknCheckJson: data.rknCheckJson || null,
        scorePercent: data.scorePercent,
        severity: data.severity,
        hostingInfo: data.hostingInfo || null,
        briefResults: data.briefResults || null,
      })
      .returning();
    return result;
  }

  async saveAuditResults(auditId: number, criteriaResults: CriteriaResult[], score: number): Promise<AuditResult> {
    const failedCount = criteriaResults.filter(c => c.status === "failed").length;
    const warningCount = criteriaResults.filter(c => c.status === "warning").length;
    const severity = failedCount > 3 ? "high" : warningCount > 5 ? "medium" : "low";
    
    return this.createAuditResult({
      auditId,
      criteriaJson: criteriaResults,
      scorePercent: score,
      severity,
    });
  }

  async getPaymentsByUserId(userId: number): Promise<Payment[]> {
    return db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.userId, userId))
      .orderBy(desc(schema.payments.createdAt));
  }

  async getPaymentsByAuditId(auditId: number): Promise<Payment[]> {
    return db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.auditId, auditId))
      .orderBy(desc(schema.payments.createdAt));
  }

  async getPaymentByExternalId(externalId: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.yandexPaymentId, externalId));
    return payment;
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(schema.payments).values(data).returning();
    return payment;
  }

  async updatePaymentStatus(id: number, status: string, yandexPaymentId?: string): Promise<Payment | undefined> {
    const [payment] = await db
      .update(schema.payments)
      .set({ status, yandexPaymentId })
      .where(eq(schema.payments.id, id))
      .returning();
    return payment;
  }

  async getUserStats(userId: number): Promise<{ totalAudits: number; totalSpent: number; activeAudits: number }> {
    const audits = await db.select().from(schema.audits).where(eq(schema.audits.userId, userId));
    const payments = await db.select().from(schema.payments).where(and(eq(schema.payments.userId, userId), eq(schema.payments.status, "completed")));
    
    return {
      totalAudits: audits.length,
      totalSpent: payments.reduce((sum, p) => sum + p.amount, 0),
      activeAudits: audits.filter(a => a.status === "processing").length,
    };
  }

  async getAdminStats(): Promise<{ revenue: number; totalPayments: number; activeAudits: number }> {
    const payments = await db.select().from(schema.payments).where(eq(schema.payments.status, "completed"));
    const audits = await db.select().from(schema.audits);
    
    return {
      revenue: payments.reduce((sum, p) => sum + p.amount, 0),
      totalPayments: payments.length,
      activeAudits: audits.filter(a => a.status === "processing").length,
    };
  }

  async seedPackages(): Promise<void> {
    await this.ensureDefaultPackages();
  }

  async ensureDefaultPackages(): Promise<void> {
    const defaultPackages = [
      { type: "rkn_check", name: "Проверка РКН", price: 10, criteriaCount: 1, durationMin: 1, durationMax: 2, description: "Быстрая проверка наличия сайта в реестре РКН (Роскомнадзор)", features: ["Проверка в реестре РКН", "Мгновенный результат"], category: "rkn_check", sortOrder: -1 },
      { type: "expressreport", name: "Экспресс‑отчёт (полный PDF)", price: 900, criteriaCount: 10, durationMin: 1, durationMax: 5, description: "Подробный отчёт по результатам экспресс-проверки", features: ["Подробный PDF-отчёт", "Рекомендации по исправлению", "Оценка рисков и штрафов"], category: "express_pdf" },
      { type: "other", name: "Другое / Универсальный", price: 15900, criteriaCount: 25, durationMin: 60, durationMax: 90, description: "Универсальная проверка для любых сайтов", features: ["Анализ специфики сайта", "Выбор критериев", "Персональный подход", "Расширенные рекомендации", "Консультация эксперта"], category: "full_audit" },
      { type: "landing", name: "Лендинг", price: 3900, criteriaCount: 7, durationMin: 15, durationMax: 20, description: "Аудит одностраничного сайта", features: ["Политика конфиденциальности", "Согласие на обработку ПДн", "Cookie-баннер", "HTTPS / SSL сертификат", "Контактные данные", "Соответствие ФЗ-152", "Защита форм"], category: "full_audit" },
      { type: "corporate", name: "Корпоративный сайт", price: 4900, criteriaCount: 10, durationMin: 25, durationMax: 30, description: "Аудит корпоративного сайта", features: ["Все критерии Лендинга", "Корпоративные политики", "Обработка заявок", "Реквизиты компании"], category: "full_audit" },
      { type: "ecommerce", name: "Интернет-магазин", price: 7900, criteriaCount: 14, durationMin: 35, durationMax: 45, description: "Аудит интернет-магазина", features: ["Все критерии Корпоративного", "Оферта и условия продажи", "Политика возврата", "Безопасность платежей", "Защита клиентских данных"], category: "full_audit" },
      { type: "saas", name: "SaaS / Сервис", price: 5900, criteriaCount: 10, durationMin: 30, durationMax: 40, description: "Аудит SaaS-платформы", features: ["Все критерии Лендинга", "Пользовательское соглашение", "Условия подписки", "Безопасность аккаунтов"], category: "full_audit" },
      { type: "portal", name: "Портал / Сообщество", price: 6900, criteriaCount: 14, durationMin: 35, durationMax: 45, description: "Аудит портала или сообщества", features: ["Все критерии SaaS", "Модерация контента", "Правила сообщества", "Защита пользовательских данных"], category: "full_audit" },
      { type: "marketplace", name: "Маркетплейс", price: 9900, criteriaCount: 18, durationMin: 45, durationMax: 60, description: "Аудит маркетплейса", features: ["Все критерии Интернет-магазина", "Правила для продавцов", "Защита покупателей", "Обработка споров", "Комиссии и выплаты"], category: "full_audit" },
      { type: "media", name: "Медиа / Блог", price: 4900, criteriaCount: 10, durationMin: 25, durationMax: 35, description: "Аудит медиа-сайта или блога", features: ["Все критерии Лендинга", "Авторские права", "Комментарии и UGC", "Подписки и рассылки"], category: "full_audit" },
      { type: "medical", name: "Медицинские услуги", price: 8900, criteriaCount: 15, durationMin: 40, durationMax: 55, description: "Аудит медицинского сайта", features: ["Все критерии Корпоративного", "Врачебная тайна", "Специальные категории ПДн", "Лицензии и сертификаты", "Медицинская информация", "Согласие на обработку мед. данных"], category: "full_audit" },
      { type: "children", name: "Детские услуги", price: 8900, criteriaCount: 15, durationMin: 40, durationMax: 55, description: "Аудит сайта для детей", features: ["Все критерии Корпоративного", "Защита данных детей", "Согласие родителей", "Возрастная верификация", "Безопасный контент", "ФЗ-436 соответствие"], category: "full_audit" },
      { type: "premium", name: "Premium Audit", price: 39900, criteriaCount: 61, durationMin: 120, durationMax: 240, description: "Полный премиум-аудит с экспертным анализом", features: ["Все критерии всех пакетов", "Экспертный анализ", "Персональные рекомендации", "Подробный план исправлений", "Консультация с юристом", "Приоритетная поддержка"], category: "full_audit" },
    ];

    for (const pkg of defaultPackages) {
      const existing = await this.getPackageByType(pkg.type);
      if (!existing) {
        console.log(`[SEED] Creating missing package: ${pkg.type}`);
        await db.insert(schema.auditPackages).values(pkg);
      }
    }
  }

  async validatePassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    
    const isValid = await compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  async getAllUsers(): Promise<UserWithStats[]> {
    const users = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
    const usersWithStats: UserWithStats[] = [];
    
    for (const user of users) {
      const audits = await db.select().from(schema.audits).where(eq(schema.audits.userId, user.id));
      const payments = await db.select().from(schema.payments).where(and(eq(schema.payments.userId, user.id), eq(schema.payments.status, "completed")));
      
      usersWithStats.push({
        ...user,
        auditCount: audits.length,
        totalSpent: payments.reduce((sum, p) => sum + p.amount, 0),
      });
    }
    return usersWithStats;
  }

  async updateUserRole(id: number, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set({ role })
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    // Delete related records first to avoid foreign key constraints
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, id));
    await db.delete(schema.promoCodeRedemptions).where(eq(schema.promoCodeRedemptions.userId, id));
    await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, id));
    await db.delete(schema.contracts).where(eq(schema.contracts.userId, id));
    await db.delete(schema.referrals).where(eq(schema.referrals.referrerId, id));
    
    // Delete payments related to user's audits
    const userAudits = await db.select({ id: schema.audits.id }).from(schema.audits).where(eq(schema.audits.userId, id));
    for (const audit of userAudits) {
      await db.delete(schema.auditResults).where(eq(schema.auditResults.auditId, audit.id));
      await db.delete(schema.reports).where(eq(schema.reports.auditId, audit.id));
      await db.delete(schema.payments).where(eq(schema.payments.auditId, audit.id));
    }
    
    // Delete user's audits
    await db.delete(schema.audits).where(eq(schema.audits.userId, id));
    
    // Finally delete the user
    await db.delete(schema.users).where(eq(schema.users.id, id));
    return true;
  }

  async getSystemSettings(): Promise<SystemSetting[]> {
    return db.select().from(schema.systemSettings);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key));
    return setting;
  }

  async upsertSystemSetting(key: string, value: string): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(key);
    if (existing) {
      const [updated] = await db
        .update(schema.systemSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(schema.systemSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(schema.systemSettings)
      .values({ key, value })
      .returning();
    return created;
  }

  async getDesignThemes(): Promise<DesignTheme[]> {
    return db.select().from(schema.designThemes).orderBy(schema.designThemes.name);
  }

  async getActiveTheme(): Promise<DesignTheme | undefined> {
    const [theme] = await db.select().from(schema.designThemes).where(eq(schema.designThemes.isActive, true));
    return theme;
  }

  async createDesignTheme(data: { name: string; key: string; description?: string; preset: schema.ThemePreset; createdBy?: number }): Promise<DesignTheme> {
    const [theme] = await db
      .insert(schema.designThemes)
      .values({
        name: data.name,
        key: data.key,
        description: data.description || null,
        preset: data.preset,
        createdBy: data.createdBy || null,
        isActive: false,
        isDefault: false,
      })
      .returning();
    return theme;
  }

  async updateDesignTheme(id: number, data: Partial<DesignTheme>): Promise<DesignTheme | undefined> {
    const [theme] = await db
      .update(schema.designThemes)
      .set(data)
      .where(eq(schema.designThemes.id, id))
      .returning();
    return theme;
  }

  async setActiveTheme(id: number): Promise<DesignTheme | undefined> {
    await db.update(schema.designThemes).set({ isActive: false });
    const [theme] = await db
      .update(schema.designThemes)
      .set({ isActive: true })
      .where(eq(schema.designThemes.id, id))
      .returning();
    return theme;
  }

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(limit);
  }

  async createAuditLog(data: { userId?: number; action: string; resourceType?: string; resourceId?: number; details?: string }): Promise<AuditLog> {
    const [log] = await db
      .insert(schema.auditLogs)
      .values({
        userId: data.userId || null,
        action: data.action,
        resourceType: data.resourceType || null,
        resourceId: data.resourceId || null,
        details: data.details || null,
      })
      .returning();
    return log;
  }

  async seedThemes(): Promise<void> {
    const existingThemes = await db.select().from(schema.designThemes).where(sql`preset IS NOT NULL`);
    if (existingThemes.length > 0) return;

    const baseFooter: schema.ThemeFooter = {
      columns: [
        { title: "Сервисы", links: [{ label: "Экспресс-проверка", href: "/" }, { label: "Полный аудит", href: "/criteria" }] },
        { title: "Компания", links: [{ label: "О нас", href: "/about" }, { label: "Контакты", href: "/contacts" }] },
        { title: "Правовая информация", links: [{ label: "Политика конфиденциальности", href: "/privacy" }, { label: "Оферта", href: "/offer" }] },
      ],
      showSocial: true,
      showPaymentMethods: true,
      copyrightText: "SecureLex.ru - Проверка сайтов на соответствие законодательству",
    };

    const baseDashboard: schema.ThemeDashboard = {
      cardStyle: "bordered",
      statsLayout: "grid",
      showQuickActions: true,
      accentColors: { success: "142 76% 36%", warning: "38 92% 50%", error: "0 84% 60%", info: "199 89% 48%" },
    };

    const themesData: Array<{
      name: string;
      key: string;
      description: string;
      preset: schema.ThemePreset;
      isActive: boolean;
      isDefault: boolean;
    }> = [
      {
        name: "Корпоративный",
        key: "corporate",
        description: "Строгий деловой стиль с боковым меню. Идеален для B2B.",
        isActive: true,
        isDefault: true,
        preset: {
          colors: {
            primary: "217 91% 32%",
            primaryForeground: "210 20% 98%",
            secondary: "210 18% 86%",
            secondaryForeground: "210 15% 16%",
            background: "210 20% 98%",
            foreground: "210 15% 12%",
            card: "210 18% 96%",
            cardForeground: "210 15% 12%",
            muted: "210 16% 90%",
            mutedForeground: "210 12% 28%",
            accent: "210 16% 92%",
            accentForeground: "210 15% 16%",
            destructive: "0 84% 32%",
            destructiveForeground: "0 20% 98%",
            border: "210 15% 90%",
            sidebar: "210 18% 94%",
            sidebarForeground: "210 15% 14%",
            sidebarPrimary: "217 91% 48%",
            sidebarAccent: "210 18% 88%",
          },
          darkColors: {
            primary: "217 91% 48%",
            primaryForeground: "210 20% 98%",
            secondary: "210 16% 20%",
            secondaryForeground: "210 15% 86%",
            background: "210 18% 8%",
            foreground: "210 15% 92%",
            card: "210 16% 10%",
            cardForeground: "210 15% 92%",
            muted: "210 14% 16%",
            mutedForeground: "210 10% 68%",
            accent: "210 14% 18%",
            accentForeground: "210 15% 86%",
            destructive: "0 84% 40%",
            destructiveForeground: "0 20% 98%",
            border: "210 12% 18%",
            sidebar: "210 16% 12%",
            sidebarForeground: "210 15% 88%",
            sidebarPrimary: "217 91% 48%",
            sidebarAccent: "210 16% 18%",
          },
          layout: { type: "sidebar", sidebarWidth: "18rem", borderRadius: "0.5rem" },
          footer: baseFooter,
          dashboard: baseDashboard,
        },
      },
      {
        name: "Современный",
        key: "modern",
        description: "Минималистичный дизайн с верхним меню и яркими акцентами.",
        isActive: false,
        isDefault: false,
        preset: {
          colors: {
            primary: "262 83% 58%",
            primaryForeground: "0 0% 100%",
            secondary: "270 20% 90%",
            secondaryForeground: "270 15% 20%",
            background: "0 0% 100%",
            foreground: "270 15% 12%",
            card: "270 15% 98%",
            cardForeground: "270 15% 12%",
            muted: "270 10% 94%",
            mutedForeground: "270 8% 40%",
            accent: "262 83% 95%",
            accentForeground: "262 83% 35%",
            destructive: "0 84% 60%",
            destructiveForeground: "0 0% 100%",
            border: "270 10% 90%",
            sidebar: "270 15% 96%",
            sidebarForeground: "270 15% 14%",
            sidebarPrimary: "262 83% 58%",
            sidebarAccent: "262 50% 92%",
          },
          darkColors: {
            primary: "262 83% 65%",
            primaryForeground: "0 0% 100%",
            secondary: "270 15% 18%",
            secondaryForeground: "270 10% 90%",
            background: "270 15% 6%",
            foreground: "270 10% 95%",
            card: "270 15% 9%",
            cardForeground: "270 10% 95%",
            muted: "270 12% 14%",
            mutedForeground: "270 8% 65%",
            accent: "262 40% 18%",
            accentForeground: "262 83% 75%",
            destructive: "0 84% 50%",
            destructiveForeground: "0 0% 100%",
            border: "270 12% 16%",
            sidebar: "270 15% 8%",
            sidebarForeground: "270 10% 90%",
            sidebarPrimary: "262 83% 65%",
            sidebarAccent: "262 40% 16%",
          },
          layout: { type: "top-nav", headerHeight: "4rem", borderRadius: "0.75rem" },
          footer: baseFooter,
          dashboard: { ...baseDashboard, cardStyle: "elevated" },
        },
      },
      {
        name: "Изумрудный",
        key: "emerald",
        description: "Природная палитра с зелёными акцентами. Успокаивающий и профессиональный.",
        isActive: false,
        isDefault: false,
        preset: {
          colors: {
            primary: "158 64% 32%",
            primaryForeground: "0 0% 100%",
            secondary: "160 20% 88%",
            secondaryForeground: "160 15% 18%",
            background: "160 15% 98%",
            foreground: "160 15% 10%",
            card: "160 12% 96%",
            cardForeground: "160 15% 10%",
            muted: "160 10% 92%",
            mutedForeground: "160 8% 38%",
            accent: "158 40% 92%",
            accentForeground: "158 64% 25%",
            destructive: "0 75% 45%",
            destructiveForeground: "0 0% 100%",
            border: "160 10% 88%",
            sidebar: "160 15% 94%",
            sidebarForeground: "160 15% 12%",
            sidebarPrimary: "158 64% 40%",
            sidebarAccent: "158 40% 86%",
          },
          darkColors: {
            primary: "158 64% 45%",
            primaryForeground: "0 0% 100%",
            secondary: "160 15% 16%",
            secondaryForeground: "160 10% 88%",
            background: "160 18% 6%",
            foreground: "160 10% 94%",
            card: "160 16% 9%",
            cardForeground: "160 10% 94%",
            muted: "160 12% 13%",
            mutedForeground: "160 8% 60%",
            accent: "158 35% 15%",
            accentForeground: "158 64% 55%",
            destructive: "0 75% 50%",
            destructiveForeground: "0 0% 100%",
            border: "160 12% 15%",
            sidebar: "160 16% 7%",
            sidebarForeground: "160 10% 88%",
            sidebarPrimary: "158 64% 45%",
            sidebarAccent: "158 35% 14%",
          },
          layout: { type: "sidebar", sidebarWidth: "16rem", borderRadius: "0.5rem" },
          footer: baseFooter,
          dashboard: { ...baseDashboard, cardStyle: "flat" },
        },
      },
    ];

    for (const theme of themesData) {
      await db.insert(schema.designThemes).values(theme);
    }
  }

  async getContractsByUserId(userId: number): Promise<Contract[]> {
    return db.select().from(schema.contracts).where(eq(schema.contracts.userId, userId)).orderBy(desc(schema.contracts.createdAt));
  }

  async getContractById(id: number): Promise<Contract | undefined> {
    const [contract] = await db.select().from(schema.contracts).where(eq(schema.contracts.id, id));
    return contract;
  }

  async getContractByAuditId(auditId: number): Promise<Contract | undefined> {
    const [contract] = await db.select().from(schema.contracts).where(eq(schema.contracts.auditId, auditId));
    return contract;
  }

  async createContract(data: { auditId: number; userId: number; signMethod: string }): Promise<Contract> {
    const emailConfirmationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const [contract] = await db
      .insert(schema.contracts)
      .values({
        auditId: data.auditId,
        userId: data.userId,
        signMethod: data.signMethod,
        status: "pending",
        emailConfirmationToken,
      })
      .returning();
    return contract;
  }

  async updateContractStatus(id: number, status: string, signedAt?: Date): Promise<Contract | undefined> {
    const updateData: any = { status };
    if (signedAt) updateData.signedAt = signedAt;
    const [contract] = await db
      .update(schema.contracts)
      .set(updateData)
      .where(eq(schema.contracts.id, id))
      .returning();
    return contract;
  }

  async confirmContractByToken(token: string): Promise<Contract | undefined> {
    const [contract] = await db
      .update(schema.contracts)
      .set({ status: "signed", signedAt: new Date() })
      .where(and(eq(schema.contracts.emailConfirmationToken, token), eq(schema.contracts.status, "pending")))
      .returning();
    return contract;
  }

  async getReferralByUserId(userId: number): Promise<Referral | undefined> {
    const [referral] = await db.select().from(schema.referrals).where(eq(schema.referrals.referrerId, userId));
    return referral;
  }

  async getReferralByCode(code: string): Promise<Referral | undefined> {
    const [referral] = await db.select().from(schema.referrals).where(eq(schema.referrals.referralCode, code));
    return referral;
  }

  async createReferral(userId: number): Promise<Referral> {
    const referralCode = "REF" + Math.random().toString(36).substring(2, 10).toUpperCase();
    const [referral] = await db
      .insert(schema.referrals)
      .values({
        referrerId: userId,
        referralCode,
        earningsTotal: 0,
        status: "active",
      })
      .returning();
    return referral;
  }

  async updateReferralEarnings(id: number, amount: number): Promise<Referral | undefined> {
    const [referral] = await db
      .update(schema.referrals)
      .set({
        earningsTotal: sql`${schema.referrals.earningsTotal} + ${amount}`,
      })
      .where(eq(schema.referrals.id, id))
      .returning();
    return referral;
  }

  async getPromoCodes(): Promise<PromoCode[]> {
    return db.select().from(schema.promoCodes).orderBy(desc(schema.promoCodes.createdAt));
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const [promoCode] = await db.select().from(schema.promoCodes).where(eq(schema.promoCodes.code, code));
    return promoCode;
  }

  async createPromoCode(data: {
    code: string;
    discountType: "percent" | "amount";
    discountPercent?: number | null;
    discountAmount?: number | null;
    appliesTo: "all" | "packages" | "reports";
    appliesToIds?: number[] | null;
    maxUses?: number;
    validTo?: Date | null;
    validDurationDays?: number | null;
    description?: string | null;
    createdBy?: number | null;
  }): Promise<PromoCode> {
    let validTo = data.validTo;
    if (!validTo && data.validDurationDays) {
      validTo = new Date(Date.now() + data.validDurationDays * 24 * 60 * 60 * 1000);
    }
    
    const [promoCode] = await db
      .insert(schema.promoCodes)
      .values({
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        discountPercent: data.discountPercent || null,
        discountAmount: data.discountAmount || null,
        appliesTo: data.appliesTo,
        appliesToIds: data.appliesToIds || null,
        maxUses: data.maxUses || 1000,
        validTo: validTo || null,
        validDurationDays: data.validDurationDays || null,
        description: data.description || null,
        createdBy: data.createdBy || null,
        usedCount: 0,
        isActive: true,
      })
      .returning();
    return promoCode;
  }

  async getPromoCodeById(id: number): Promise<PromoCode | undefined> {
    const [promoCode] = await db.select().from(schema.promoCodes).where(eq(schema.promoCodes.id, id));
    return promoCode;
  }

  async updatePromoCode(id: number, data: Partial<PromoCode>): Promise<PromoCode | undefined> {
    const [promoCode] = await db
      .update(schema.promoCodes)
      .set(data)
      .where(eq(schema.promoCodes.id, id))
      .returning();
    return promoCode;
  }

  async deletePromoCode(id: number): Promise<boolean> {
    const result = await db.delete(schema.promoCodes).where(eq(schema.promoCodes.id, id));
    return true;
  }

  async usePromoCode(id: number): Promise<PromoCode | undefined> {
    const [promoCode] = await db
      .update(schema.promoCodes)
      .set({ usedCount: sql`${schema.promoCodes.usedCount} + 1` })
      .where(eq(schema.promoCodes.id, id))
      .returning();
    return promoCode;
  }

  async validatePromoCode(
    code: string, 
    amount: number, 
    userId: number, 
    targetType: "packages" | "reports" = "packages",
    targetId?: number
  ): Promise<{ valid: boolean; promoCode?: PromoCode; discount?: number; finalAmount?: number; error?: string }> {
    const promoCode = await this.getPromoCodeByCode(code.toUpperCase());
    
    if (!promoCode) {
      return { valid: false, error: "Промокод не найден" };
    }
    
    if (!promoCode.isActive) {
      return { valid: false, error: "Промокод неактивен" };
    }
    
    const now = new Date();
    if (promoCode.validFrom && now < new Date(promoCode.validFrom)) {
      return { valid: false, error: "Промокод ещё не действует" };
    }
    if (promoCode.validTo && now > new Date(promoCode.validTo)) {
      return { valid: false, error: "Срок действия промокода истёк" };
    }
    
    if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
      return { valid: false, error: "Лимит использований промокода исчерпан" };
    }
    
    if (promoCode.appliesTo !== "all" && promoCode.appliesTo !== targetType) {
      return { valid: false, error: `Промокод применим только к ${promoCode.appliesTo === "packages" ? "пакетам услуг" : "отчётам"}` };
    }
    
    if (promoCode.appliesToIds && promoCode.appliesToIds.length > 0 && targetId) {
      if (!promoCode.appliesToIds.includes(targetId)) {
        return { valid: false, error: "Промокод не применим к выбранному товару" };
      }
    }
    
    let discount = 0;
    if (promoCode.discountType === "percent" && promoCode.discountPercent) {
      discount = Math.floor(amount * promoCode.discountPercent / 100);
    } else if (promoCode.discountType === "amount" && promoCode.discountAmount) {
      discount = Math.min(promoCode.discountAmount, amount);
    }
    
    const finalAmount = Math.max(0, amount - discount);
    
    return { valid: true, promoCode, discount, finalAmount };
  }

  async createPromoCodeRedemption(data: {
    promoCodeId: number;
    userId: number;
    paymentId?: number | null;
    originalAmount: number;
    discountedAmount: number;
    appliedDiscount: number;
  }): Promise<PromoCodeRedemption> {
    const [redemption] = await db
      .insert(schema.promoCodeRedemptions)
      .values({
        promoCodeId: data.promoCodeId,
        userId: data.userId,
        paymentId: data.paymentId || null,
        originalAmount: data.originalAmount,
        discountedAmount: data.discountedAmount,
        appliedDiscount: data.appliedDiscount,
      })
      .returning();
    return redemption;
  }

  async getPromoCodeRedemptions(promoCodeId: number): Promise<PromoCodeRedemption[]> {
    return db
      .select()
      .from(schema.promoCodeRedemptions)
      .where(eq(schema.promoCodeRedemptions.promoCodeId, promoCodeId))
      .orderBy(desc(schema.promoCodeRedemptions.createdAt));
  }

  async getUserPromoCodeRedemptions(userId: number): Promise<PromoCodeRedemption[]> {
    return db
      .select()
      .from(schema.promoCodeRedemptions)
      .where(eq(schema.promoCodeRedemptions.userId, userId))
      .orderBy(desc(schema.promoCodeRedemptions.createdAt));
  }

  async createPublicAudit(data: { token: string; websiteUrl: string; websiteUrlNormalized: string; ipAddress?: string }): Promise<PublicAudit> {
    const [audit] = await db
      .insert(schema.publicAudits)
      .values({
        token: data.token,
        websiteUrl: data.websiteUrl,
        websiteUrlNormalized: data.websiteUrlNormalized,
        ipAddress: data.ipAddress || null,
        status: "processing",
        stageIndex: 0,
        passedCount: 0,
        warningCount: 0,
        failedCount: 0,
        totalCount: 0,
      })
      .returning();
    return audit;
  }

  async getPublicAuditByToken(token: string): Promise<PublicAudit | undefined> {
    const [audit] = await db.select().from(schema.publicAudits).where(eq(schema.publicAudits.token, token));
    return audit;
  }

  async updatePublicAuditProgress(token: string, data: Partial<PublicAudit>): Promise<PublicAudit | undefined> {
    const [audit] = await db
      .update(schema.publicAudits)
      .set(data)
      .where(eq(schema.publicAudits.token, token))
      .returning();
    return audit;
  }

  async getRecentPublicAuditsByIp(ipAddress: string, hoursAgo: number = 1): Promise<PublicAudit[]> {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    return db
      .select()
      .from(schema.publicAudits)
      .where(and(eq(schema.publicAudits.ipAddress, ipAddress), gt(schema.publicAudits.createdAt, cutoffTime)));
  }


  async ensureSuperAdmin(): Promise<void> {
    // Get credentials from environment variables
    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;
    const name = process.env.SUPERADMIN_NAME || "SuperAdmin";

    if (!email || !password) {
      console.log("[storage] No superadmin found. Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD env vars to create one.");
      return;
    }

    // Check if user with this email already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      if (existingUser.role === "superadmin") {
        console.log("[storage] SuperAdmin already exists");
        return;
      }
      // Promote existing user to superadmin
      await db
        .update(schema.users)
        .set({ role: "superadmin" })
        .where(eq(schema.users.id, existingUser.id));
      console.log(`[storage] Promoted existing user ${email} to superadmin`);
      return;
    }

    // Create new superadmin user
    const passwordHash = await hash(password, 10);
    await db
      .insert(schema.users)
      .values({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "superadmin",
      });
    console.log(`[storage] Created superadmin user: ${email}`);
  }

  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<schema.PasswordResetToken> {
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, userId));
    
    const [resetToken] = await db
      .insert(schema.passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<schema.PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.token, token));
    return resetToken;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.token, token));
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    const passwordHash = await hash(newPassword, 10);
    await db
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, userId));
  }

  // OTP methods for two-factor authentication
  async createLoginOtp(userId: number, code: string, expiresAt: Date): Promise<schema.LoginOtpCode> {
    // Delete any existing unused OTP codes for this user
    await db.delete(schema.loginOtpCodes).where(
      and(
        eq(schema.loginOtpCodes.userId, userId),
        sql`used_at IS NULL`
      )
    );
    
    const [otpCode] = await db
      .insert(schema.loginOtpCodes)
      .values({ userId, code, expiresAt })
      .returning();
    return otpCode;
  }

  async getValidLoginOtp(userId: number, code: string): Promise<schema.LoginOtpCode | undefined> {
    const [otpCode] = await db
      .select()
      .from(schema.loginOtpCodes)
      .where(
        and(
          eq(schema.loginOtpCodes.userId, userId),
          eq(schema.loginOtpCodes.code, code),
          sql`used_at IS NULL`,
          gt(schema.loginOtpCodes.expiresAt, new Date())
        )
      );
    return otpCode;
  }

  async markLoginOtpUsed(id: number): Promise<void> {
    await db
      .update(schema.loginOtpCodes)
      .set({ usedAt: new Date() })
      .where(eq(schema.loginOtpCodes.id, id));
  }

  async cleanupExpiredOtps(): Promise<void> {
    await db.delete(schema.loginOtpCodes).where(
      sql`expires_at < NOW() OR used_at IS NOT NULL`
    );
  }

  // Secure settings for API keys
  async getSecureSetting(key: string): Promise<schema.SecureSetting | undefined> {
    const [setting] = await db.select().from(schema.secureSettings).where(eq(schema.secureSettings.key, key));
    return setting;
  }

  async upsertSecureSetting(key: string, encryptedValue: string, updatedBy?: number): Promise<schema.SecureSetting> {
    const existing = await this.getSecureSetting(key);
    if (existing) {
      const [updated] = await db
        .update(schema.secureSettings)
        .set({ encryptedValue, updatedAt: new Date(), updatedBy: updatedBy || null })
        .where(eq(schema.secureSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(schema.secureSettings)
      .values({ key, encryptedValue, updatedBy: updatedBy || null })
      .returning();
    return created;
  }

  async deleteSecureSetting(key: string): Promise<boolean> {
    const result = await db.delete(schema.secureSettings).where(eq(schema.secureSettings.key, key));
    return true;
  }

  async getAllSecureSettings(): Promise<schema.SecureSetting[]> {
    return db.select().from(schema.secureSettings);
  }

  // =====================================================
  // PDN Consent Methods
  // =====================================================
  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return db.select().from(schema.systemSettings);
  }

  async createPdnConsentEvent(data: {
    userId: number;
    eventType: "GIVEN" | "WITHDRAWN";
    documentVersion: string;
    ip: string | null;
    userAgent: string | null;
    source: string;
    meta: Record<string, any>;
  }): Promise<schema.PdnConsentEvent> {
    const [event] = await db
      .insert(schema.pdnConsentEvents)
      .values({
        userId: data.userId,
        eventType: data.eventType,
        documentVersion: data.documentVersion,
        ip: data.ip,
        userAgent: data.userAgent,
        source: data.source,
        meta: data.meta,
      })
      .returning();
    return event;
  }

  async getPdnStatus(userId: number): Promise<{
    lastGivenAt: string | null;
    lastWithdrawnAt: string | null;
    scheduledDestructionAt: string | null;
    destructionStatus: "NONE" | "SCHEDULED" | "DONE" | "LEGAL_HOLD";
    documentVersion: string;
  }> {
    const docVersion = await this.getSystemSetting("pdn_consent_document_version");
    
    const [lastGiven] = await db
      .select()
      .from(schema.pdnConsentEvents)
      .where(and(
        eq(schema.pdnConsentEvents.userId, userId),
        eq(schema.pdnConsentEvents.eventType, "GIVEN")
      ))
      .orderBy(desc(schema.pdnConsentEvents.eventAt))
      .limit(1);

    const [lastWithdrawn] = await db
      .select()
      .from(schema.pdnConsentEvents)
      .where(and(
        eq(schema.pdnConsentEvents.userId, userId),
        eq(schema.pdnConsentEvents.eventType, "WITHDRAWN")
      ))
      .orderBy(desc(schema.pdnConsentEvents.eventAt))
      .limit(1);

    const [task] = await db
      .select()
      .from(schema.pdnDestructionTasks)
      .where(eq(schema.pdnDestructionTasks.userId, userId))
      .orderBy(desc(schema.pdnDestructionTasks.createdAt))
      .limit(1);

    let destructionStatus: "NONE" | "SCHEDULED" | "DONE" | "LEGAL_HOLD" = "NONE";
    if (task) {
      destructionStatus = task.status as "SCHEDULED" | "DONE" | "LEGAL_HOLD";
    }

    return {
      lastGivenAt: lastGiven?.eventAt?.toISOString() || null,
      lastWithdrawnAt: lastWithdrawn?.eventAt?.toISOString() || null,
      scheduledDestructionAt: task?.scheduledAt?.toISOString() || null,
      destructionStatus,
      documentVersion: docVersion?.value || "1.0",
    };
  }

  async createPdnDestructionTask(data: {
    userId: number;
    status: "SCHEDULED" | "DONE" | "LEGAL_HOLD";
    scheduledAt: Date;
    meta: Record<string, any>;
  }): Promise<schema.PdnDestructionTask> {
    const [task] = await db
      .insert(schema.pdnDestructionTasks)
      .values({
        userId: data.userId,
        status: data.status,
        scheduledAt: data.scheduledAt,
        meta: data.meta,
      })
      .returning();
    return task;
  }

  async getPdnWithdrawals(limit: number): Promise<schema.PdnConsentEvent[]> {
    return db
      .select()
      .from(schema.pdnConsentEvents)
      .where(eq(schema.pdnConsentEvents.eventType, "WITHDRAWN"))
      .orderBy(desc(schema.pdnConsentEvents.eventAt))
      .limit(limit);
  }

  async getPdnDestructionTasks(status?: string): Promise<schema.PdnDestructionTask[]> {
    if (status) {
      return db
        .select()
        .from(schema.pdnDestructionTasks)
        .where(eq(schema.pdnDestructionTasks.status, status as "SCHEDULED" | "DONE" | "LEGAL_HOLD"))
        .orderBy(desc(schema.pdnDestructionTasks.createdAt));
    }
    return db
      .select()
      .from(schema.pdnDestructionTasks)
      .orderBy(desc(schema.pdnDestructionTasks.createdAt));
  }

  async setPdnTaskLegalHold(taskId: number, reason: string): Promise<void> {
    await db
      .update(schema.pdnDestructionTasks)
      .set({ status: "LEGAL_HOLD", legalHoldReason: reason, updatedAt: new Date() })
      .where(eq(schema.pdnDestructionTasks.id, taskId));
  }

  async releasePdnTaskLegalHold(taskId: number): Promise<void> {
    await db
      .update(schema.pdnDestructionTasks)
      .set({ status: "SCHEDULED", legalHoldReason: null, updatedAt: new Date() })
      .where(eq(schema.pdnDestructionTasks.id, taskId));
  }

  async getPdnConsentsWithUsers(limit: number): Promise<Array<{
    id: number;
    userId: number;
    eventType: string;
    documentVersion: string;
    eventAt: Date;
    source: string;
    userEmail: string;
  }>> {
    const results = await db
      .select({
        id: schema.pdnConsentEvents.id,
        userId: schema.pdnConsentEvents.userId,
        eventType: schema.pdnConsentEvents.eventType,
        documentVersion: schema.pdnConsentEvents.documentVersion,
        eventAt: schema.pdnConsentEvents.eventAt,
        source: schema.pdnConsentEvents.source,
        userEmail: schema.users.email,
      })
      .from(schema.pdnConsentEvents)
      .leftJoin(schema.users, eq(schema.pdnConsentEvents.userId, schema.users.id))
      .orderBy(desc(schema.pdnConsentEvents.eventAt))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      userEmail: r.userEmail || "deleted@anonymized.local",
    }));
  }

  async executePdnDestruction(taskId: number, operatorUserId: number): Promise<{ success: boolean; actId?: number }> {
    const [task] = await db.select().from(schema.pdnDestructionTasks).where(eq(schema.pdnDestructionTasks.id, taskId));
    if (!task || task.status === "DONE" || task.status === "LEGAL_HOLD") {
      return { success: false };
    }

    // Create destruction act
    const [act] = await db
      .insert(schema.pdnDestructionActs)
      .values({
        userId: task.userId,
        method: "anonymize",
        summary: `Данные пользователя ${task.userId} анонимизированы по запросу`,
        operatorUserId,
        details: { taskId, executedAt: new Date().toISOString() },
      })
      .returning();

    // Anonymize user data
    await this.anonymizeUser(task.userId);

    // Update task
    await db
      .update(schema.pdnDestructionTasks)
      .set({ status: "DONE", doneAt: new Date(), destructionActId: act.id, updatedAt: new Date() })
      .where(eq(schema.pdnDestructionTasks.id, taskId));

    return { success: true, actId: act.id };
  }

  async anonymizeUser(userId: number): Promise<void> {
    const randomHash = crypto.randomBytes(16).toString("hex");
    await db
      .update(schema.users)
      .set({
        email: `deleted-${randomHash}@anonymized.local`,
        name: "Удалённый пользователь",
        phone: null,
        companyName: null,
        inn: null,
      })
      .where(eq(schema.users.id, userId));
  }

  async getScheduledDestructionTasks(): Promise<schema.PdnDestructionTask[]> {
    return db
      .select()
      .from(schema.pdnDestructionTasks)
      .where(and(
        eq(schema.pdnDestructionTasks.status, "SCHEDULED"),
        sql`scheduled_at <= NOW()`
      ));
  }

  // =====================================================
  // Free Express Limit Methods
  // =====================================================
  async getExpressLimitStatus(userId: number | undefined, ip: string, userAgent: string): Promise<{
    remaining: number;
    limit: number;
    resetInSeconds: number;
  }> {
    const limitEnabledSetting = await this.getSystemSetting("free_express_limit_enabled");
    const limitEnabled = limitEnabledSetting?.value !== "false";
    
    const limitPerDaySetting = await this.getSystemSetting("free_express_limit_per_24h");
    const limitPerDay = parseInt(limitPerDaySetting?.value || "5", 10);

    if (!limitEnabled) {
      return { remaining: 999, limit: 999, resetInSeconds: 0 };
    }

    const dayAgo = new Date();
    dayAgo.setHours(dayAgo.getHours() - 24);

    let count = 0;
    let oldestEvent: Date | null = null;

    if (userId) {
      const events = await db
        .select()
        .from(schema.freeExpressLimitEvents)
        .where(and(
          eq(schema.freeExpressLimitEvents.subjectType, "user"),
          eq(schema.freeExpressLimitEvents.userId, userId),
          gt(schema.freeExpressLimitEvents.createdAt, dayAgo)
        ))
        .orderBy(schema.freeExpressLimitEvents.createdAt);
      count = events.length;
      if (events.length > 0) {
        oldestEvent = events[0].createdAt;
      }
    } else {
      const anonHash = crypto.createHash("sha256").update(`${ip}|${userAgent}`).digest("hex");
      const events = await db
        .select()
        .from(schema.freeExpressLimitEvents)
        .where(and(
          eq(schema.freeExpressLimitEvents.subjectType, "anon"),
          eq(schema.freeExpressLimitEvents.anonHash, anonHash),
          gt(schema.freeExpressLimitEvents.createdAt, dayAgo)
        ))
        .orderBy(schema.freeExpressLimitEvents.createdAt);
      count = events.length;
      if (events.length > 0) {
        oldestEvent = events[0].createdAt;
      }
    }

    const remaining = Math.max(0, limitPerDay - count);
    let resetInSeconds = 0;
    if (oldestEvent) {
      const resetTime = new Date(oldestEvent.getTime() + 24 * 60 * 60 * 1000);
      resetInSeconds = Math.max(0, Math.floor((resetTime.getTime() - Date.now()) / 1000));
    }

    return { remaining, limit: limitPerDay, resetInSeconds };
  }

  async checkAndRecordExpressLimit(userId: number | undefined, ip: string, userAgent: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
  }> {
    const status = await this.getExpressLimitStatus(userId, ip, userAgent);
    
    if (status.remaining <= 0) {
      return { allowed: false, remaining: 0, resetInSeconds: status.resetInSeconds };
    }

    // Record the event
    const anonHash = crypto.createHash("sha256").update(`${ip}|${userAgent}`).digest("hex");

    await db.insert(schema.freeExpressLimitEvents).values({
      subjectType: userId ? "user" : "anon",
      userId: userId || null,
      anonHash: userId ? null : anonHash,
      meta: {},
    });

    return { allowed: true, remaining: status.remaining - 1, resetInSeconds: status.resetInSeconds };
  }

  // =====================================================
  // SEO Pages Methods
  // =====================================================
  async getAllSeoPages(): Promise<schema.SeoPage[]> {
    return db.select().from(schema.seoPages).orderBy(desc(schema.seoPages.updatedAt));
  }

  async getSeoPageBySlug(slug: string): Promise<schema.SeoPage | undefined> {
    const [page] = await db.select().from(schema.seoPages).where(eq(schema.seoPages.slug, slug));
    return page;
  }

  async createSeoPage(data: {
    slug: string;
    h1: string;
    title: string;
    description: string;
    content: string;
    isActive?: boolean;
    meta?: Record<string, any>;
  }): Promise<schema.SeoPage> {
    const [page] = await db
      .insert(schema.seoPages)
      .values({
        slug: data.slug,
        h1: data.h1,
        title: data.title,
        description: data.description,
        content: data.content,
        isActive: data.isActive ?? true,
        meta: data.meta || {},
      })
      .returning();
    return page;
  }

  async updateSeoPage(id: number, data: Partial<schema.SeoPage>): Promise<schema.SeoPage | undefined> {
    const [page] = await db
      .update(schema.seoPages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.seoPages.id, id))
      .returning();
    return page;
  }

  async softDeleteSeoPage(id: number): Promise<void> {
    await db
      .update(schema.seoPages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.seoPages.id, id));
  }

  // =====================================================
  // Service Configs Methods
  // =====================================================
  async getAllServiceConfigs(): Promise<schema.ServiceConfig[]> {
    return db.select().from(schema.serviceConfigs).orderBy(schema.serviceConfigs.sortOrder);
  }

  async getServiceConfigByKey(serviceKey: string): Promise<schema.ServiceConfig | undefined> {
    const [service] = await db.select().from(schema.serviceConfigs).where(eq(schema.serviceConfigs.serviceKey, serviceKey));
    return service;
  }

  async updateServiceConfig(id: number, data: Partial<schema.ServiceConfig>): Promise<schema.ServiceConfig | undefined> {
    const [service] = await db
      .update(schema.serviceConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.serviceConfigs.id, id))
      .returning();
    return service;
  }

  async upsertServiceConfig(data: schema.InsertServiceConfig): Promise<schema.ServiceConfig> {
    const existing = await this.getServiceConfigByKey(data.serviceKey);
    if (existing) {
      const [updated] = await db
        .update(schema.serviceConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.serviceConfigs.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(schema.serviceConfigs).values(data).returning();
    return created;
  }

  // =====================================================
  // Tools Methods
  // =====================================================
  async logToolUsage(data: {
    toolKey: string;
    userId: number | null;
    sessionId: string | null;
    inputData: any;
    outputData: any;
    isPaid: boolean;
    paymentId?: number | null;
  }): Promise<void> {
    await db.insert(schema.toolUsage).values({
      toolKey: data.toolKey,
      userId: data.userId,
      sessionId: data.sessionId,
      inputData: data.inputData,
      outputData: data.outputData,
      isPaid: data.isPaid,
      paymentId: data.paymentId || null,
    });
  }

  async getAllToolConfigs(): Promise<schema.ToolConfig[]> {
    return db.select().from(schema.toolConfigs).orderBy(schema.toolConfigs.sortOrder);
  }

  async getToolConfigByKey(toolKey: string): Promise<schema.ToolConfig | undefined> {
    const [tool] = await db.select().from(schema.toolConfigs).where(eq(schema.toolConfigs.toolKey, toolKey));
    return tool;
  }

  async updateToolConfig(id: number, data: Partial<schema.ToolConfig>): Promise<schema.ToolConfig | undefined> {
    const [tool] = await db
      .update(schema.toolConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.toolConfigs.id, id))
      .returning();
    return tool;
  }

  async incrementToolUsageCount(toolKey: string): Promise<void> {
    await db
      .update(schema.toolConfigs)
      .set({ usageCount: sql`${schema.toolConfigs.usageCount} + 1` })
      .where(eq(schema.toolConfigs.toolKey, toolKey));
  }

  async getUserToolHistory(userId: number, limit = 50): Promise<schema.ToolUsage[]> {
    return db
      .select()
      .from(schema.toolUsage)
      .where(eq(schema.toolUsage.userId, userId))
      .orderBy(desc(schema.toolUsage.createdAt))
      .limit(limit);
  }

  async checkToolPayment(userId: number, toolKey: string): Promise<{ hasPaid: boolean; paymentId?: number }> {
    const tool = await this.getToolConfigByKey(toolKey);
    if (!tool) return { hasPaid: false };
    if (tool.isFree) return { hasPaid: true };

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.userId, userId),
          eq(schema.payments.serviceType, "tool"),
          eq(schema.payments.toolId, tool.id),
          or(
            eq(schema.payments.status, "succeeded"),
            eq(schema.payments.status, "paid")
          ),
          sql`${schema.payments.usedAt} IS NULL`
        )
      )
      .orderBy(schema.payments.createdAt)
      .limit(1);
    
    return payment ? { hasPaid: true, paymentId: payment.id } : { hasPaid: false };
  }

  async consumeToolPayment(paymentId: number): Promise<void> {
    await db
      .update(schema.payments)
      .set({ usedAt: new Date() })
      .where(eq(schema.payments.id, paymentId));
  }

  async createToolPayment(userId: number, toolKey: string): Promise<schema.Payment | undefined> {
    const tool = await this.getToolConfigByKey(toolKey);
    if (!tool) return undefined;

    const [payment] = await db
      .insert(schema.payments)
      .values({
        userId,
        serviceType: "tool",
        toolId: tool.id,
        amount: tool.price,
        currency: "RUB",
        status: "pending",
        description: `Инструмент: ${tool.displayName}`,
      })
      .returning();
    return payment;
  }

  async getToolsServiceEnabled(): Promise<boolean> {
    const service = await this.getServiceConfigByKey("tools");
    return service?.isEnabled ?? true;
  }

  // =====================================================
  // RKN Cache Methods
  // =====================================================
  async getRknCacheByInn(inn: string): Promise<schema.RknRegistryEntry | undefined> {
    const [entry] = await db.select().from(schema.rknRegistryCache).where(eq(schema.rknRegistryCache.inn, inn));
    return entry;
  }

  async upsertRknCache(data: {
    inn: string;
    companyName?: string | null;
    registrationNumber?: string | null;
    registrationDate?: string | null;
    isRegistered?: boolean;
  }): Promise<schema.RknRegistryEntry> {
    const existing = await this.getRknCacheByInn(data.inn);
    if (existing) {
      const [updated] = await db
        .update(schema.rknRegistryCache)
        .set({ 
          companyName: data.companyName,
          registrationNumber: data.registrationNumber,
          registrationDate: data.registrationDate,
          isRegistered: data.isRegistered ?? false,
          lastCheckedAt: new Date() 
        })
        .where(eq(schema.rknRegistryCache.inn, data.inn))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(schema.rknRegistryCache)
      .values({
        inn: data.inn,
        companyName: data.companyName || null,
        registrationNumber: data.registrationNumber || null,
        registrationDate: data.registrationDate || null,
        isRegistered: data.isRegistered ?? false,
      })
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
