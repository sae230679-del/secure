import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerSchema, loginSchema, createAuditSchema } from "@shared/schema";
import { z } from "zod";
import type { CriteriaResult } from "@shared/schema";
import { 
  sendAuditCompletedEmail, 
  sendPaymentConfirmationEmail, 
  sendContractStatusEmail,
  sendContractSigningEmail,
  sendPasswordResetEmail,
  sendLoginOtpEmail,
  isEmailConfigured
} from "./email";
import crypto from "crypto";
import { runExpressAudit, runAudit, checkWebsiteExists, runDebugAudit } from "./audit-engine";
import { generatePdfReport } from "./pdf-generator";

// GUARD: Mock mode forbidden in production
if (process.env.AUDIT_MOCK_MODE === "true" && process.env.NODE_ENV === "production") {
  console.error("[FATAL] MOCK MODE FORBIDDEN in production. Exiting.");
  process.exit(1);
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

function normalizeUrl(url: string): string {
  let normalized = url.trim().toLowerCase();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }
  if (normalized.startsWith("https://www.")) {
    normalized = "https://" + normalized.slice(12);
  }
  if (normalized.startsWith("http://www.")) {
    normalized = "http://" + normalized.slice(11);
  }
  normalized = normalized.replace(/\/$/, "");
  return normalized;
}

// SSRF protection - block private/local IPs
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
];

function isUnsafeHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost") return true;
  const ipv4Match = lower.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (!ipv4Match) return false;
  return PRIVATE_IP_RANGES.some((re) => re.test(lower));
}

function validateWebsiteUrl(rawUrl: string): string {
  const normalized = normalizeUrl(rawUrl);

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "Некорректный URL",
        path: ["websiteUrl"],
      },
    ]);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "Разрешены только http/https",
        path: ["websiteUrl"],
      },
    ]);
  }

  if (isUnsafeHost(url.hostname)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "Запрещён локальный/внутренний адрес",
        path: ["websiteUrl"],
      },
    ]);
  }

  return url.toString();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.log(`[AUTH] requireAuth check - path: ${req.path}, userId: ${req.session.userId}, sessionID: ${req.sessionID}`);
  if (!req.session.userId) {
    console.log(`[AUTH] Unauthorized - no userId in session for path: ${req.path}`);
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.role !== "superadmin") {
    return res.status(403).json({ error: "Forbidden - SuperAdmin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await storage.seedPackages();
  await (storage as any).seedThemes();

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Пользователь с таким email уже существует" });
      }

      const user = await storage.createUser(data);
      
      // Set user ID in session
      req.session.userId = user.id;
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error during registration:", saveErr);
          console.error("Session save error details:", JSON.stringify(saveErr, null, 2));
          return res.status(500).json({ error: "Session error: " + (saveErr.message || "Unknown") });
        }
        console.log(`[AUTH] Session saved successfully for new user: ${user.id}`);
        const { passwordHash, ...safeUser } = user;
        res.json({ user: safeUser });
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      console.log(`[AUTH] Login attempt for email: ${data.email}`);
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (!existingUser) {
        console.log(`[AUTH] User not found: ${data.email}`);
        return res.status(401).json({ error: "Неверный email или пароль" });
      }
      
      const user = await (storage as any).validatePassword(data.email, data.password);
      if (!user) {
        console.log(`[AUTH] Invalid password for: ${data.email}`);
        return res.status(401).json({ error: "Неверный email или пароль" });
      }
      
      console.log(`[AUTH] Password validated for: ${data.email}, userId: ${user.id}`);

      // Check if email/SMTP is configured for 2FA
      const emailConfigured = await isEmailConfigured();
      
      if (emailConfigured) {
        // Generate 6-digit OTP code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        
        // Save OTP to database
        await (storage as any).createLoginOtp(user.id, otpCode, expiresAt);
        
        // Send OTP via email
        const emailSent = await sendLoginOtpEmail(user.email, otpCode, user.name);
        
        if (emailSent) {
          console.log(`[AUTH] OTP sent to: ${data.email}`);
          return res.json({ 
            requireOtp: true, 
            userId: user.id,
            message: "Код подтверждения отправлен на ваш email" 
          });
        } else {
          console.log(`[AUTH] Failed to send OTP, falling back to direct login`);
        }
      }
      
      // Fallback: If email not configured or failed, login directly
      console.log(`[AUTH] Direct login for: ${data.email}, userId: ${user.id}`);
      req.session.userId = user.id;
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error during login:", saveErr);
          console.error("Session save error details:", JSON.stringify(saveErr, null, 2));
          return res.status(500).json({ error: "Session error: " + (saveErr.message || "Unknown") });
        }
        console.log(`[AUTH] Session saved successfully for user: ${user.id}`);
        const { passwordHash, ...safeUser } = user;
        res.json({ user: safeUser });
      });
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { userId, code } = req.body;
      
      if (!userId || !code) {
        return res.status(400).json({ error: "userId и код обязательны" });
      }
      
      console.log(`[AUTH] OTP verification attempt for userId: ${userId}`);
      
      // Validate OTP code
      const otpRecord = await (storage as any).getValidLoginOtp(userId, code);
      
      if (!otpRecord) {
        console.log(`[AUTH] Invalid or expired OTP for userId: ${userId}`);
        return res.status(401).json({ error: "Неверный или истекший код подтверждения" });
      }
      
      // Mark OTP as used
      await (storage as any).markLoginOtpUsed(otpRecord.id);
      
      // Get user data
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(401).json({ error: "Пользователь не найден" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error during OTP verification:", saveErr);
          return res.status(500).json({ error: "Session error: " + (saveErr.message || "Unknown") });
        }
        console.log(`[AUTH] OTP verified, session saved for user: ${user.id}`);
        const { passwordHash, ...safeUser } = user;
        res.json({ user: safeUser });
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email обязателен" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ success: true, message: "Если email существует, вы получите письмо с инструкциями" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      await (storage as any).createPasswordResetToken(user.id, token, expiresAt);

      const siteUrl = process.env.SITE_URL || "https://securelex.ru";
      const resetLink = `${siteUrl}/reset-password?token=${token}`;

      await sendPasswordResetEmail(user.email, resetLink, user.name);

      console.log(`[AUTH] Password reset email sent to: ${email}`);
      res.json({ success: true, message: "Если email существует, вы получите письмо с инструкциями" });
    } catch (error) {
      console.error("[AUTH] Forgot password error:", error);
      res.status(500).json({ error: "Ошибка при отправке письма" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Токен и пароль обязательны" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Пароль должен быть не менее 6 символов" });
      }

      const resetToken = await (storage as any).getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: "Недействительная или истекшая ссылка" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ error: "Ссылка уже была использована" });
      }

      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ error: "Ссылка истекла. Запросите новую" });
      }

      await (storage as any).updateUserPassword(resetToken.userId, password);
      await (storage as any).markPasswordResetTokenUsed(token);

      console.log(`[AUTH] Password reset successful for userId: ${resetToken.userId}`);
      res.json({ success: true, message: "Пароль успешно изменен" });
    } catch (error) {
      console.error("[AUTH] Reset password error:", error);
      res.status(500).json({ error: "Ошибка при сбросе пароля" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "User not found" });
    }

    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  app.delete("/api/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.session.userId;
    
    try {
      await storage.deleteUser(userId);
      
      await storage.createAuditLog({
        userId: undefined,
        action: "user_deleted_account",
        resourceType: "user",
        resourceId: userId,
        details: `User ${userId} deleted their account and personal data`,
      });

      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.get("/api/packages", async (req, res) => {
    try {
      const packages = await storage.getPackages();
      res.json(packages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  app.patch("/api/users/profile", requireAuth, async (req, res) => {
    try {
      const { name, phone, companyName, inn } = req.body;
      const user = await storage.updateUser(req.session.userId!, {
        name,
        phone,
        companyName,
        inn,
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { passwordHash, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/audits", requireAuth, async (req, res) => {
    try {
      const audits = await storage.getAuditsByUserId(req.session.userId!);
      res.json(audits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audits" });
    }
  });

  app.get("/api/audits/:id", requireAuth, async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAuditById(auditId);
      
      if (!audit) {
        return res.status(404).json({ error: "Audit not found" });
      }

      if (audit.userId !== req.session.userId) {
        const user = await storage.getUserById(req.session.userId!);
        if (user?.role !== "admin" && user?.role !== "superadmin") {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      res.json(audit);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit" });
    }
  });

  app.get("/api/audits/:id/pdf", requireAuth, async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      console.log(`[PDF] Request for auditId=${auditId}`);
      
      const audit = await storage.getAuditById(auditId);
      
      if (!audit) {
        console.log(`[PDF] Audit not found: ${auditId}`);
        return res.status(404).json({ error: "Audit not found" });
      }
      console.log(`[PDF] Audit found: status=${audit.status}, userId=${audit.userId}`);

      if (audit.userId !== req.session.userId) {
        const user = await storage.getUserById(req.session.userId!);
        if (user?.role !== "admin" && user?.role !== "superadmin") {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      if (audit.status !== "completed") {
        console.log(`[PDF] Audit not completed: status=${audit.status}`);
        return res.status(400).json({ error: "Audit is not completed yet" });
      }

      if (!audit.results || audit.results.length === 0) {
        console.log(`[PDF] No results for audit ${auditId}`);
        return res.status(404).json({ error: "Audit results not found" });
      }

      const result = audit.results[0];
      const pkg = audit.package;
      const user = await storage.getUserById(audit.userId);
      console.log(`[PDF] Result found: scorePercent=${result.scorePercent}, severity=${result.severity}`);

      const criteriaJson = result.criteriaJson as any[];
      console.log(`[PDF] criteriaJson has ${criteriaJson?.length || 0} items`);
      
      const criteria = (criteriaJson || []).map((c: any) => ({
        name: c?.name || "Без названия",
        description: c?.description || "",
        status: (c?.status as "passed" | "warning" | "failed") || "warning",
        details: c?.details || "",
        category: c?.category || "",
        law: c?.law || "",
      }));

      const passedCount = criteria.filter((c: any) => c.status === "passed").length;
      const warningCount = criteria.filter((c: any) => c.status === "warning").length;
      const failedCount = criteria.filter((c: any) => c.status === "failed").length;
      console.log(`[PDF] Counts: passed=${passedCount}, warning=${warningCount}, failed=${failedCount}`);

      const aiModeSetting = await storage.getSystemSetting("ai_mode");
      const aiMode = (aiModeSetting?.value as "gigachat_only" | "openai_only" | "hybrid" | "none") || "gigachat_only";
      
      const aiSummary = (result as any).aiSummary || (result as any).summary || undefined;
      const aiRecommendations = (result as any).aiRecommendations || (result as any).recommendations || [];
      console.log(`[PDF] AI: mode=${aiMode}, hasSummary=${!!aiSummary}, recommendations=${aiRecommendations?.length || 0}`);

      console.log(`[PDF] Calling generatePdfReport for auditId=${auditId}...`);
      const pdfBuffer = await generatePdfReport({
        auditId: audit.id,
        websiteUrl: audit.websiteUrlNormalized || "unknown",
        companyName: user?.companyName || undefined,
        scorePercent: result.scorePercent || 0,
        severity: result.severity || "red",
        passedCount,
        warningCount,
        failedCount,
        totalCount: criteria.length,
        criteria,
        createdAt: audit.createdAt || new Date(),
        packageName: pkg?.name || "Аудит",
        aiSummary,
        aiRecommendations: aiRecommendations || [],
        aiMode,
      });
      console.log(`[PDF] PDF generated: ${pdfBuffer.length} bytes`);

      const filename = `securelex-audit-${auditId}-${Date.now()}.pdf`;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error(`[PDF] Failed to generate PDF:`, error?.message || error);
      console.error(`[PDF] Stack:`, error?.stack);
      res.status(500).json({ error: "Failed to generate PDF report" });
    }
  });

  app.post("/api/audits", requireAuth, async (req, res) => {
    try {
      const data = createAuditSchema.parse(req.body);
      
      const pkg = await storage.getPackageByType(data.packageType);
      if (!pkg) {
        return res.status(400).json({ error: "Invalid package type" });
      }

      // Validate URL to prevent SSRF attacks
      const normalizedUrl = validateWebsiteUrl(data.websiteUrl);

      const audit = await storage.createAudit({
        userId: req.session.userId!,
        packageId: pkg.id,
        websiteUrlNormalized: normalizedUrl,
        websiteUrlOriginal: data.websiteUrl,
      });

      const payment = await storage.createPayment({
        userId: req.session.userId!,
        auditId: audit.id,
        amount: pkg.price,
        description: `Аудит: ${pkg.name} - ${normalizedUrl}`,
        status: "completed",
      });

      const paymentUser = await storage.getUserById(req.session.userId!);
      if (paymentUser && payment) {
        sendPaymentConfirmationEmail(paymentUser.email, {
          userName: paymentUser.name,
          packageName: pkg.name,
          amount: pkg.price,
          transactionId: `TXN-${payment.id}-${Date.now()}`,
          websiteUrl: normalizedUrl,
        }).catch(err => console.error("Failed to send payment email:", err));
      }

      await storage.updateAuditStatus(audit.id, "processing");

      (async () => {
        try {
          console.log(`[AUDIT] Starting audit processing for auditId=${audit.id}, url=${normalizedUrl}`);
          const aiModeSetting = await storage.getSystemSetting("ai_mode");
          const aiMode = (aiModeSetting?.value as "gigachat_only" | "openai_only" | "hybrid" | "none") || "gigachat_only";
          console.log(`[AUDIT] AI mode: ${aiMode}`);
          
          console.log(`[AUDIT] Calling runAudit for ${normalizedUrl}...`);
          const report = await runAudit(normalizedUrl, { level2: true, aiMode });
          console.log(`[AUDIT] runAudit completed: scorePercent=${report.scorePercent}, checks.length=${report.checks?.length || 0}, severity=${report.severity}`);
          
          const criteriaResults: CriteriaResult[] = report.checks.map(check => ({
            name: check.name,
            description: check.description,
            status: check.status,
            details: check.details,
            evidence: check.evidence,
          }));
          console.log(`[AUDIT] Mapped ${criteriaResults.length} criteria results`);

          console.log(`[AUDIT] Saving audit result to DB for auditId=${audit.id}...`);
          await storage.createAuditResult({
            auditId: audit.id,
            criteriaJson: criteriaResults,
            rknCheckJson: report.rknCheck || null,
            scorePercent: report.scorePercent,
            severity: report.severity,
          });
          console.log(`[AUDIT] Audit result saved successfully`);

          await storage.updateAuditStatus(audit.id, "completed", new Date());
          console.log(`[AUDIT] Audit status updated to completed for auditId=${audit.id}`);

          const user = await storage.getUserById(audit.userId);
          if (user) {
            sendAuditCompletedEmail(user.email, {
              userName: user.name,
              websiteUrl: audit.websiteUrlNormalized,
              auditId: audit.id,
              scorePercent: report.scorePercent,
              severity: report.severity,
              passedCount: report.passedCount,
              warningCount: report.warningCount,
              failedCount: report.failedCount,
              totalCount: report.totalCount,
            }).catch(err => console.error("Failed to send audit email:", err));
          }
        } catch (error: any) {
          console.error(`[AUDIT] Failed to complete audit auditId=${audit.id}:`, error?.message || error);
          console.error(`[AUDIT] Stack:`, error?.stack);
          await storage.updateAuditStatus(audit.id, "failed");
        }
      })();

      res.json(audit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create audit" });
    }
  });

  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getPaymentsByUserId(req.session.userId!);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  const createPaymentSchema = z.object({
    auditId: z.number(),
    paymentMethod: z.enum(["sbp", "sberpay", "tpay", "mirpay", "yoomoney", "mir", "sberbusiness"]),
    promoCodeId: z.number().optional(),
    finalAmount: z.number().optional(),
  });

  async function startAuditProcessing(audit: any, user: any, pkg: any) {
    try {
      const aiModeSetting = await storage.getSystemSetting("ai_mode");
      const aiMode = (aiModeSetting?.value as "gigachat_only" | "openai_only" | "hybrid" | "none") || "gigachat_only";
      
      const report = await runAudit(audit.websiteUrlNormalized, { level2: true, aiMode });
      
      const criteriaResults: CriteriaResult[] = report.checks.map(check => ({
        name: check.name,
        description: check.description,
        status: check.status,
        details: check.details,
        evidence: check.evidence,
      }));

      await storage.createAuditResult({
        auditId: audit.id,
        criteriaJson: criteriaResults,
        rknCheckJson: report.rknCheck || null,
        scorePercent: report.scorePercent,
        severity: report.severity,
      });
      await storage.updateAuditStatus(audit.id, "completed");

      if (user) {
        sendAuditCompletedEmail(user.email, {
          userName: user.name,
          websiteUrl: audit.websiteUrlNormalized,
          auditId: audit.id,
          scorePercent: report.scorePercent,
          severity: report.severity,
          passedCount: report.passedCount,
          warningCount: report.warningCount,
          failedCount: report.failedCount,
          totalCount: report.totalCount,
        }).catch(err => console.error("Failed to send audit email:", err));
      }
    } catch (error) {
      console.error("Failed to complete audit:", error);
      await storage.updateAuditStatus(audit.id, "failed");
    }
  }

  app.post("/api/payments/create", requireAuth, async (req, res) => {
    try {
      const data = createPaymentSchema.parse(req.body);
      
      const audit = await storage.getAuditById(data.auditId);
      if (!audit || audit.userId !== req.session.userId) {
        return res.status(404).json({ error: "Audit not found" });
      }

      const pkg = await storage.getPackageById(audit.packageId);
      if (!pkg) {
        return res.status(400).json({ error: "Package not found" });
      }

      const existingPayments = await storage.getPaymentsByUserId(req.session.userId!);
      const existingPayment = existingPayments.find(p => p.auditId === data.auditId && p.status === "completed");
      if (existingPayment) {
        return res.status(400).json({ error: "Payment already completed for this audit" });
      }

      const paymentMethodNames: Record<string, string> = {
        sbp: "СБП",
        sberpay: "SberPay",
        tpay: "T-Pay",
        mirpay: "Mir Pay",
        yoomoney: "ЮMoney",
        mir: "Карта Мир",
        sberbusiness: "СберБизнес",
      };

      const user = await storage.getUserById(req.session.userId!);
      const finalAmount = data.finalAmount || pkg.price;

      const yookassaEnabled = await storage.getSystemSetting("yookassa_enabled");
      const shopIdSetting = await storage.getSystemSetting("yookassa_shop_id");
      const secretKeySetting = await storage.getSystemSetting("yookassa_secret_key");
      
      const isYookassaEnabled = yookassaEnabled?.value === "true" && shopIdSetting?.value && secretKeySetting?.value;

      if (isYookassaEnabled) {
        const shopId = shopIdSetting!.value;
        const secretKey = secretKeySetting!.value;
        const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
        
        const idempotenceKey = `${audit.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        
        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "https://securelex.ru";
        
        const paymentMethodToYookassa: Record<string, any> = {
          sbp: { type: "sbp" },
          sberpay: { type: "sberbank" },
          yoomoney: { type: "yoo_money" },
          mir: { type: "bank_card" },
        };
        
        const yookassaPayload: any = {
          amount: {
            value: (finalAmount / 100).toFixed(2),
            currency: "RUB",
          },
          capture: true,
          confirmation: {
            type: "redirect",
            return_url: `${baseUrl}/payment-result?auditId=${audit.id}`,
          },
          description: `${pkg.name} - ${audit.websiteUrlNormalized}`,
          metadata: {
            auditId: audit.id,
            userId: req.session.userId,
            packageId: pkg.id,
          },
        };

        if (paymentMethodToYookassa[data.paymentMethod]) {
          yookassaPayload.payment_method_data = paymentMethodToYookassa[data.paymentMethod];
        }

        try {
          const response = await fetch("https://api.yookassa.ru/v3/payments", {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json",
              "Idempotence-Key": idempotenceKey,
            },
            body: JSON.stringify(yookassaPayload),
          });

          const responseData = await response.json();

          if (!response.ok) {
            console.error("Yookassa payment error:", responseData);
            return res.status(400).json({ 
              error: responseData.description || "Ошибка создания платежа в Yookassa" 
            });
          }

          const payment = await storage.createPayment({
            userId: req.session.userId!,
            auditId: audit.id,
            amount: finalAmount,
            description: `${pkg.name} - ${audit.websiteUrlNormalized} (${paymentMethodNames[data.paymentMethod]})`,
            status: "pending",
            yandexPaymentId: responseData.id,
          });

          return res.json({
            success: true,
            payment,
            confirmationUrl: responseData.confirmation?.confirmation_url,
            message: "Перенаправление на страницу оплаты",
          });

        } catch (fetchError) {
          console.error("Yookassa fetch error:", fetchError);
          return res.status(500).json({ error: "Ошибка связи с платёжной системой" });
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

      const payment = await storage.createPayment({
        userId: req.session.userId!,
        auditId: audit.id,
        amount: finalAmount,
        description: `${pkg.name} - ${audit.websiteUrlNormalized} (${paymentMethodNames[data.paymentMethod]})`,
        status: "completed",
        yandexPaymentId: `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      });

      await storage.updateAuditStatus(audit.id, "processing");

      if (user && payment) {
        sendPaymentConfirmationEmail(user.email, {
          userName: user.name,
          packageName: pkg.name,
          amount: finalAmount,
          transactionId: payment.yandexPaymentId || `TXN-${payment.id}`,
          websiteUrl: audit.websiteUrlNormalized,
        }).catch(err => console.error("Failed to send payment email:", err));
      }

      startAuditProcessing(audit, user, pkg);

      res.json({ 
        success: true, 
        payment,
        message: "Оплата успешно завершена",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Payment error:", error);
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getUserStats(req.session.userId!);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/audits", requireAdmin, async (req, res) => {
    try {
      const audits = await storage.getPaidAudits();
      res.json(audits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audits" });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.post("/api/admin/audits/:id/reaudit", requireAdmin, async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAuditById(auditId);
      
      if (!audit) {
        return res.status(404).json({ error: "Audit not found" });
      }

      await storage.updateAuditStatus(auditId, "processing");

      // Run real audit asynchronously
      (async () => {
        try {
          const aiModeSetting = await storage.getSystemSetting("ai_mode");
          const aiMode = (aiModeSetting?.value as "gigachat_only" | "openai_only" | "hybrid" | "none") || "gigachat_only";
          
          const report = await runAudit(audit.websiteUrlNormalized, { level2: true, aiMode });
          
          const criteriaResults: CriteriaResult[] = report.checks.map(check => ({
            name: check.name,
            description: check.description,
            status: check.status,
            details: check.details,
            evidence: check.evidence,
          }));

          await storage.createAuditResult({
            auditId: auditId,
            criteriaJson: criteriaResults,
            scorePercent: report.scorePercent,
            severity: report.severity,
          });

          await storage.updateAuditStatus(auditId, "completed", new Date());

          const user = await storage.getUserById(audit.userId);
          if (user) {
            sendAuditCompletedEmail(user.email, {
              userName: user.name,
              websiteUrl: audit.websiteUrlNormalized,
              auditId: audit.id,
              scorePercent: report.scorePercent,
              severity: report.severity,
              passedCount: report.passedCount,
              warningCount: report.warningCount,
              failedCount: report.failedCount,
              totalCount: report.totalCount,
            }).catch(err => console.error("Failed to send reaudit email:", err));
          }
        } catch (error) {
          console.error("Reaudit failed:", error);
          await storage.updateAuditStatus(auditId, "failed");
        }
      })();

      res.json({ success: true, message: "Reaudit started" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start reaudit" });
    }
  });

  const VALID_CATEGORIES = ["fz152", "fz149", "cookies", "technical", "legal", "content", "security"] as const;

  const criteriaTemplateSchema = z.object({
    name: z.string().min(1, "Название критерия обязательно").transform(s => s.trim()),
    description: z.string().min(1, "Описание критерия обязательно").transform(s => s.trim()),
    category: z.enum(VALID_CATEGORIES, { errorMap: () => ({ message: "Недопустимая категория" }) }),
  });

  const updatePackageSchema = z.object({
    price: z.number().optional(),
    description: z.string().optional(),
    criteriaTemplates: z.array(criteriaTemplateSchema).optional(),
    criteriaCount: z.number().optional(),
    durationMin: z.number().optional(),
    durationMax: z.number().optional(),
  });

  app.patch("/api/admin/packages/:id", requireAdmin, async (req, res) => {
    try {
      const packageId = parseInt(req.params.id);
      
      const validationResult = updatePackageSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.errors[0].message });
      }
      
      const { price, description, criteriaTemplates, criteriaCount, durationMin, durationMax } = validationResult.data;
      
      const updateData: Record<string, unknown> = {};
      if (price !== undefined) updateData.price = price;
      if (description !== undefined) updateData.description = description;
      if (criteriaTemplates !== undefined) {
        const validTemplates = criteriaTemplates.filter(t => t.name.trim().length > 0);
        updateData.criteriaTemplates = validTemplates;
        updateData.criteriaCount = validTemplates.length || criteriaCount || 0;
      }
      if (criteriaCount !== undefined && criteriaTemplates === undefined) updateData.criteriaCount = criteriaCount;
      if (durationMin !== undefined) updateData.durationMin = durationMin;
      if (durationMax !== undefined) updateData.durationMax = durationMax;
      
      const pkg = await storage.updatePackage(packageId, updateData);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "update_package",
        resourceType: "package",
        resourceId: packageId,
        details: JSON.stringify(updateData),
      });
      
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to update package" });
    }
  });

  // SuperAdmin Routes
  app.get("/api/superadmin/users", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ passwordHash, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/superadmin/users/:id/role", requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!["user", "admin", "superadmin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      const user = await storage.updateUserRole(userId, role);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "change_user_role",
        resourceType: "user",
        resourceId: userId,
        details: JSON.stringify({ newRole: role }),
      });
      
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.delete("/api/superadmin/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (userId === req.session.userId) {
        return res.status(400).json({ error: "Cannot delete yourself" });
      }
      
      // Protect the main superadmin from deletion
      const userToDelete = await storage.getUserById(userId);
      if (userToDelete?.email === "sae230679@yandex.ru") {
        return res.status(403).json({ error: "Невозможно удалить главного администратора" });
      }
      
      await storage.deleteUser(userId);
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "delete_user",
        resourceType: "user",
        resourceId: userId,
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.get("/api/superadmin/settings", requireSuperAdmin, async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/superadmin/settings/:key", requireSuperAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      const setting = await storage.upsertSystemSetting(key, value);
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "update_setting",
        resourceType: "setting",
        details: JSON.stringify({ key, value }),
      });
      
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.post("/api/superadmin/test-email", requireSuperAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email обязателен" });
      }

      const { sendEmail } = await import("./email");
      
      const sent = await sendEmail({
        to: email,
        subject: "Тестовое письмо - SecureLex.ru",
        html: `
          <h2>Тестовое письмо</h2>
          <p>Это тестовое письмо от SecureLex.ru.</p>
          <p>Если вы получили это письмо, значит настройки SMTP работают корректно.</p>
          <p>Дата отправки: ${new Date().toLocaleString("ru-RU")}</p>
        `,
      });

      if (sent) {
        res.json({ success: true, message: "Письмо отправлено" });
      } else {
        res.status(500).json({ error: "Не удалось отправить письмо. Проверьте настройки SMTP." });
      }
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ error: "Ошибка отправки письма" });
    }
  });

  app.get("/api/superadmin/ai-status", requireSuperAdmin, async (req, res) => {
    try {
      const { decrypt, maskApiKey } = await import("./crypto");
      
      // Check database keys first, then env vars as fallback
      const gigachatDbSetting = await storage.getSecureSetting("gigachat_api_key");
      const openaiDbSetting = await storage.getSecureSetting("openai_api_key");
      
      let gigachatKey = "";
      let openaiKey = "";
      let gigachatSource = "none";
      let openaiSource = "none";
      
      if (gigachatDbSetting) {
        try {
          gigachatKey = decrypt(gigachatDbSetting.encryptedValue);
          gigachatSource = "database";
        } catch (e) {
          console.error("Failed to decrypt gigachat key");
        }
      }
      if (!gigachatKey && process.env.GIGACHAT_API_KEY) {
        gigachatKey = process.env.GIGACHAT_API_KEY;
        gigachatSource = "env";
      }
      
      if (openaiDbSetting) {
        try {
          openaiKey = decrypt(openaiDbSetting.encryptedValue);
          openaiSource = "database";
        } catch (e) {
          console.error("Failed to decrypt openai key");
        }
      }
      if (!openaiKey && process.env.OPENAI_API_KEY) {
        openaiKey = process.env.OPENAI_API_KEY;
        openaiSource = "env";
      }

      const yandexDbSetting = await storage.getSecureSetting("yandex_iam_token");
      let yandexKey = "";
      let yandexSource = "none";
      
      if (yandexDbSetting) {
        try {
          yandexKey = decrypt(yandexDbSetting.encryptedValue);
          yandexSource = "database";
        } catch (e) {
          console.error("Failed to decrypt yandex key");
        }
      }
      if (!yandexKey && process.env.YANDEX_IAM_TOKEN) {
        yandexKey = process.env.YANDEX_IAM_TOKEN;
        yandexSource = "env";
      }
      
      const modeSetting = await storage.getSystemSetting("ai_mode");
      const currentMode = modeSetting?.value || "gigachat_only";
      
      // Get Yandex config settings
      const yandexModelUriSetting = await storage.getSystemSetting("yandex_model_uri");
      const yandexFolderIdSetting = await storage.getSystemSetting("yandex_folder_id");
      
      res.json({
        gigachat: !!gigachatKey && gigachatKey.length > 0,
        gigachatMasked: gigachatKey ? maskApiKey(gigachatKey) : null,
        gigachatSource,
        openai: !!openaiKey && openaiKey.length > 0,
        openaiMasked: openaiKey ? maskApiKey(openaiKey) : null,
        openaiSource,
        yandex: !!yandexKey && yandexKey.length > 0,
        yandexMasked: yandexKey ? maskApiKey(yandexKey) : null,
        yandexSource,
        yandexModelUri: yandexModelUriSetting?.value || "",
        yandexFolderId: yandexFolderIdSetting?.value || "",
        currentMode,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI status" });
    }
  });

  // API key management endpoints
  app.post("/api/superadmin/api-keys/:provider", requireSuperAdmin, async (req, res) => {
    try {
      const { provider } = req.params;
      const { apiKey } = req.body;
      
      if (!["gigachat", "openai", "yandex"].includes(provider)) {
        return res.status(400).json({ error: "Invalid provider" });
      }
      
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
        return res.status(400).json({ error: "API ключ должен содержать минимум 10 символов" });
      }
      
      const { encrypt, maskApiKey } = await import("./crypto");
      const keyNames: Record<string, string> = {
        gigachat: "gigachat_api_key",
        openai: "openai_api_key",
        yandex: "yandex_iam_token",
      };
      const keyName = keyNames[provider];
      const encryptedValue = encrypt(apiKey.trim());
      
      await storage.upsertSecureSetting(keyName, encryptedValue, req.session.userId);
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "update_api_key",
        resourceType: "secure_setting",
        details: `Updated ${provider} API key`,
      });
      
      const providerNames: Record<string, string> = {
        gigachat: "GigaChat",
        openai: "OpenAI",
        yandex: "YandexGPT",
      };
      res.json({ 
        success: true, 
        message: `${providerNames[provider]} ключ сохранён`,
        masked: maskApiKey(apiKey.trim()),
      });
    } catch (error) {
      console.error("Failed to save API key:", error);
      res.status(500).json({ error: "Ошибка сохранения ключа" });
    }
  });

  app.delete("/api/superadmin/api-keys/:provider", requireSuperAdmin, async (req, res) => {
    try {
      const { provider } = req.params;
      
      if (!["gigachat", "openai", "yandex"].includes(provider)) {
        return res.status(400).json({ error: "Invalid provider" });
      }
      
      const keyNames: Record<string, string> = {
        gigachat: "gigachat_api_key",
        openai: "openai_api_key",
        yandex: "yandex_iam_token",
      };
      const keyName = keyNames[provider];
      await storage.deleteSecureSetting(keyName);
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "delete_api_key",
        resourceType: "secure_setting",
        details: `Deleted ${provider} API key`,
      });
      
      const providerNames: Record<string, string> = {
        gigachat: "GigaChat",
        openai: "OpenAI",
        yandex: "YandexGPT",
      };
      res.json({ 
        success: true, 
        message: `${providerNames[provider]} ключ удалён. Будет использоваться ключ из переменных среды, если он есть.`,
      });
    } catch (error) {
      console.error("Failed to delete API key:", error);
      res.status(500).json({ error: "Ошибка удаления ключа" });
    }
  });

  app.get("/api/superadmin/themes", requireSuperAdmin, async (req, res) => {
    try {
      const themes = await storage.getDesignThemes();
      res.json(themes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch themes" });
    }
  });

  app.post("/api/superadmin/themes", requireSuperAdmin, async (req, res) => {
    try {
      const { name, key, description, preset } = req.body;
      
      if (!name || !key || !preset) {
        return res.status(400).json({ error: "Name, key and preset are required" });
      }
      
      const theme = await storage.createDesignTheme({
        name,
        key,
        description,
        preset,
        createdBy: req.session.userId,
      });
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "create_theme",
        resourceType: "theme",
        resourceId: theme.id,
      });
      
      res.json(theme);
    } catch (error) {
      console.error("Failed to create theme:", error);
      res.status(500).json({ error: "Failed to create theme" });
    }
  });

  app.patch("/api/superadmin/themes/:id", requireSuperAdmin, async (req, res) => {
    try {
      const themeId = parseInt(req.params.id);
      const { name, description, preset } = req.body;
      
      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (preset) updateData.preset = preset;
      updateData.updatedAt = new Date();
      
      const theme = await storage.updateDesignTheme(themeId, updateData);
      if (!theme) {
        return res.status(404).json({ error: "Theme not found" });
      }
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "update_theme",
        resourceType: "theme",
        resourceId: themeId,
      });
      
      res.json(theme);
    } catch (error) {
      console.error("Failed to update theme:", error);
      res.status(500).json({ error: "Failed to update theme" });
    }
  });

  app.post("/api/superadmin/themes/:id/activate", requireSuperAdmin, async (req, res) => {
    try {
      const themeId = parseInt(req.params.id);
      
      const theme = await storage.setActiveTheme(themeId);
      if (!theme) {
        return res.status(404).json({ error: "Theme not found" });
      }
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "activate_theme",
        resourceType: "theme",
        resourceId: themeId,
      });
      
      res.json(theme);
    } catch (error) {
      res.status(500).json({ error: "Failed to activate theme" });
    }
  });

  app.get("/api/superadmin/logs", requireSuperAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/superadmin/stats", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const adminStats = await storage.getAdminStats();
      
      res.json({
        ...adminStats,
        totalUsers: users.length,
        adminCount: users.filter(u => u.role === "admin" || u.role === "superadmin").length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch superadmin stats" });
    }
  });

  // Public API for active theme
  app.get("/api/theme", async (req, res) => {
    try {
      const theme = await storage.getActiveTheme();
      res.json(theme || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch theme" });
    }
  });

  // Alias for theme manager frontend
  app.get("/api/theme/active", async (req, res) => {
    try {
      const theme = await storage.getActiveTheme();
      if (!theme || !theme.preset) {
        res.json(null);
        return;
      }
      res.json({
        id: theme.id,
        name: theme.name,
        key: theme.key,
        preset: theme.preset,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active theme" });
    }
  });

  // Public API for site settings (site name, requisites, contacts)
  app.get("/api/settings/public", async (req, res) => {
    try {
      const siteName = await storage.getSystemSetting("site_name");
      const requisitesSetting = await storage.getSystemSetting("company_requisites");
      const contactsSetting = await storage.getSystemSetting("contact_settings");
      const yandexMetrikaSetting = await storage.getSystemSetting("yandex_metrika_code");
      const yandexWebmasterSetting = await storage.getSystemSetting("yandex_webmaster_verification");
      
      let requisites = null;
      let contacts = null;
      
      if (requisitesSetting) {
        try {
          requisites = JSON.parse(requisitesSetting.value);
        } catch (e) {
          console.error("Failed to parse requisites:", e);
        }
      }
      
      if (contactsSetting) {
        try {
          contacts = JSON.parse(contactsSetting.value);
        } catch (e) {
          console.error("Failed to parse contacts:", e);
        }
      }
      
      res.json({
        siteName: siteName?.value || "SecureLex.ru",
        requisites,
        contacts,
        yandexMetrikaCode: yandexMetrikaSetting?.value || "",
        yandexWebmasterVerification: yandexWebmasterSetting?.value || "",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Public maintenance mode check (no auth required)
  app.get("/api/maintenance-mode", async (req, res) => {
    try {
      const setting = await storage.getSystemSetting("maintenance_mode");
      res.json({ enabled: setting?.value === "true" });
    } catch (error) {
      res.json({ enabled: false });
    }
  });

  // Toggle maintenance mode (superadmin only)
  app.post("/api/superadmin/maintenance-mode", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.upsertSystemSetting("maintenance_mode", enabled ? "true" : "false");
      
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: enabled ? "maintenance_enabled" : "maintenance_disabled",
        resourceType: "system",
        resourceId: 0,
        details: JSON.stringify({ enabled }),
      });
      
      res.json({ success: true, enabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to update maintenance mode" });
    }
  });

  // Contract Routes
  app.get("/api/contracts", requireAuth, async (req, res) => {
    try {
      const contracts = await storage.getContractsByUserId(req.session.userId!);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.post("/api/contracts", requireAuth, async (req, res) => {
    try {
      const { auditId, signMethod } = req.body;
      
      if (!["digital_signature", "email_confirmation", "manual_approval"].includes(signMethod)) {
        return res.status(400).json({ error: "Invalid sign method" });
      }
      
      const contract = await storage.createContract({
        auditId,
        userId: req.session.userId!,
        signMethod,
      });
      
      res.json(contract);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contract" });
    }
  });

  app.post("/api/contracts/:id/sign", requireAuth, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContractById(contractId);
      
      if (!contract || contract.userId !== req.session.userId) {
        return res.status(404).json({ error: "Contract not found" });
      }

      const user = await storage.getUserById(contract.userId);
      const audit = await storage.getAuditById(contract.auditId);
      
      if (contract.signMethod === "digital_signature") {
        const updated = await storage.updateContractStatus(contractId, "signed", new Date());
        
        if (user && audit) {
          sendContractStatusEmail(user.email, {
            userName: user.name,
            contractId: contract.id,
            status: "signed",
            websiteUrl: audit.websiteUrlNormalized,
            signMethod: "digital",
          }).catch(err => console.error("Failed to send contract email:", err));
        }
        
        return res.json(updated);
      }
      
      if (contract.signMethod === "email_confirmation") {
        const siteUrl = process.env.SITE_URL || "https://securelex.ru";
        const signLink = `${siteUrl}/api/contracts/confirm/${contract.emailConfirmationToken}`;
        
        if (user) {
          sendContractSigningEmail(user.email, signLink, user.name)
            .catch(err => console.error("Failed to send contract signing email:", err));
        }
        
        return res.json({ message: "Confirmation email sent. Please check your email.", status: "email_sent" });
      }
      
      if (contract.signMethod === "manual_approval") {
        await storage.updateContractStatus(contractId, "pending_approval");
        return res.json({ message: "Contract submitted for approval", status: "pending_approval" });
      }
      
      res.status(400).json({ error: "Invalid sign method" });
    } catch (error) {
      res.status(500).json({ error: "Failed to sign contract" });
    }
  });

  app.get("/api/contracts/confirm/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const contract = await storage.confirmContractByToken(token);
      
      if (!contract) {
        return res.status(404).json({ error: "Invalid or expired token" });
      }

      const user = await storage.getUserById(contract.userId);
      const audit = await storage.getAuditById(contract.auditId);

      if (user && audit) {
        sendContractStatusEmail(user.email, {
          userName: user.name,
          contractId: contract.id,
          status: "signed",
          websiteUrl: audit.websiteUrlNormalized,
          signMethod: "email",
        }).catch(err => console.error("Failed to send contract confirmation email:", err));
      }
      
      res.json({ success: true, message: "Contract confirmed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to confirm contract" });
    }
  });

  app.post("/api/admin/contracts/:id/approve", requireAdmin, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const contract = await storage.updateContractStatus(contractId, "signed", new Date());
      
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }

      const user = await storage.getUserById(contract.userId);
      const audit = await storage.getAuditById(contract.auditId);

      if (user && audit) {
        sendContractStatusEmail(user.email, {
          userName: user.name,
          contractId: contract.id,
          status: "approved",
          websiteUrl: audit.websiteUrlNormalized,
          signMethod: "manual",
        }).catch(err => console.error("Failed to send contract approval email:", err));
      }
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "approve_contract",
        resourceType: "contract",
        resourceId: contractId,
      });
      
      res.json(contract);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve contract" });
    }
  });

  // Referral Routes
  app.get("/api/referral", requireAuth, async (req, res) => {
    try {
      let referral = await storage.getReferralByUserId(req.session.userId!);
      if (!referral) {
        referral = await storage.createReferral(req.session.userId!);
      }
      res.json(referral);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch referral" });
    }
  });

  app.get("/api/referral/:code", async (req, res) => {
    try {
      const referral = await storage.getReferralByCode(req.params.code);
      if (!referral) {
        return res.status(404).json({ error: "Invalid referral code" });
      }
      res.json({ valid: true, code: req.params.code });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate referral code" });
    }
  });

  // Promo Code Routes
  app.get("/api/promo-codes", requireAdmin, async (req, res) => {
    try {
      const promoCodes = await storage.getPromoCodes();
      res.json(promoCodes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch promo codes" });
    }
  });

  app.post("/api/promo-codes", requireAdmin, async (req, res) => {
    try {
      const { 
        code, 
        discountType = "percent", 
        discountPercent, 
        discountAmount,
        appliesTo = "all",
        appliesToIds,
        maxUses, 
        validTo,
        validDurationDays,
        description
      } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: "Код промокода обязателен" });
      }
      
      if (discountType === "percent" && (!discountPercent || discountPercent < 1 || discountPercent > 100)) {
        return res.status(400).json({ error: "Скидка в процентах должна быть от 1 до 100" });
      }
      
      if (discountType === "amount" && (!discountAmount || discountAmount < 1)) {
        return res.status(400).json({ error: "Сумма скидки должна быть больше 0" });
      }
      
      const promoCode = await storage.createPromoCode({
        code,
        discountType,
        discountPercent: discountType === "percent" ? discountPercent : null,
        discountAmount: discountType === "amount" ? discountAmount : null,
        appliesTo,
        appliesToIds: appliesToIds || null,
        maxUses,
        validTo: validTo ? new Date(validTo) : null,
        validDurationDays: validDurationDays || null,
        description: description || null,
        createdBy: req.session.userId || null,
      });
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "create_promo_code",
        resourceType: "promo_code",
        resourceId: promoCode.id,
        details: JSON.stringify({ code, discountType, discountPercent, discountAmount, appliesTo }),
      });
      
      res.json(promoCode);
    } catch (error) {
      console.error("Failed to create promo code:", error);
      res.status(500).json({ error: "Не удалось создать промокод" });
    }
  });

  app.post("/api/promo-codes/validate", async (req, res) => {
    try {
      const { code } = req.body;
      const promoCode = await storage.getPromoCodeByCode(code.toUpperCase());
      
      if (!promoCode || !promoCode.isActive) {
        return res.status(404).json({ error: "Invalid promo code" });
      }
      
      if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
        return res.status(400).json({ error: "Promo code has reached maximum uses" });
      }
      
      if (promoCode.validTo && new Date(promoCode.validTo) < new Date()) {
        return res.status(400).json({ error: "Promo code has expired" });
      }
      
      res.json({
        valid: true,
        discountPercent: promoCode.discountPercent,
        code: promoCode.code,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate promo code" });
    }
  });

  app.patch("/api/promo-codes/:id", requireAdmin, async (req, res) => {
    try {
      const promoCodeId = parseInt(req.params.id);
      const { isActive, maxUses, validTo } = req.body;
      
      const promoCode = await storage.updatePromoCode(promoCodeId, { isActive, maxUses, validTo });
      if (!promoCode) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      
      res.json(promoCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to update promo code" });
    }
  });

  // SuperAdmin: Delete promo code
  app.delete("/api/superadmin/promo-codes/:id", requireSuperAdmin, async (req, res) => {
    try {
      const promoCodeId = parseInt(req.params.id);
      
      const existingCode = await storage.getPromoCodeById(promoCodeId);
      if (!existingCode) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      
      const deleted = await storage.deletePromoCode(promoCodeId);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete promo code" });
      }
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "delete_promo_code",
        resourceType: "promo_code",
        resourceId: promoCodeId,
        details: `Deleted promo code: ${existingCode.code}`,
      });
      
      res.json({ success: true, message: "Promo code deleted successfully" });
    } catch (error) {
      console.error("Failed to delete promo code:", error);
      res.status(500).json({ error: "Failed to delete promo code" });
    }
  });

  // SuperAdmin: Get promo code redemptions
  app.get("/api/superadmin/promo-codes/:id/redemptions", requireSuperAdmin, async (req, res) => {
    try {
      const promoCodeId = parseInt(req.params.id);
      
      const existingCode = await storage.getPromoCodeById(promoCodeId);
      if (!existingCode) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      
      const redemptions = await storage.getPromoCodeRedemptions(promoCodeId);
      res.json(redemptions);
    } catch (error) {
      console.error("Failed to fetch promo code redemptions:", error);
      res.status(500).json({ error: "Failed to fetch redemptions" });
    }
  });

  // SuperAdmin: Get promo code by ID
  app.get("/api/superadmin/promo-codes/:id", requireSuperAdmin, async (req, res) => {
    try {
      const promoCodeId = parseInt(req.params.id);
      const promoCode = await storage.getPromoCodeById(promoCodeId);
      
      if (!promoCode) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      
      res.json(promoCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch promo code" });
    }
  });

  // Apply promo code with full validation (for checkout process)
  app.post("/api/promo-codes/apply", requireAuth, async (req, res) => {
    try {
      const { code, amount, targetType, targetId } = req.body;
      
      if (!code || !amount) {
        return res.status(400).json({ error: "Code and amount are required" });
      }
      
      const userId = req.session.userId!;
      const result = await storage.validatePromoCode(
        code.toUpperCase(),
        parseFloat(amount),
        userId,
        targetType,
        targetId ? parseInt(targetId) : undefined
      );
      
      if (!result.valid) {
        return res.status(400).json({ error: result.error || "Invalid promo code" });
      }
      
      res.json({
        valid: true,
        promoCode: result.promoCode,
        discount: result.discount,
        finalAmount: result.finalAmount,
        originalAmount: parseFloat(amount),
      });
    } catch (error) {
      console.error("Failed to apply promo code:", error);
      res.status(500).json({ error: "Failed to apply promo code" });
    }
  });

  const expressCheckSchema = z.object({
    websiteUrl: z.string().min(1, "URL сайта обязателен").url().or(z.string().min(3)),
  });

  const expressCheckCriteria: CriteriaResult[] = [
    { name: "SSL/HTTPS сертификат", description: "Проверка безопасного соединения", status: "pending" },
    { name: "Cookie-баннер", description: "Уведомление об использовании cookies", status: "pending" },
    { name: "Политика конфиденциальности", description: "Наличие документа на сайте", status: "pending" },
    { name: "Согласие на обработку ПДн", description: "Чекбокс в формах", status: "pending" },
    { name: "Контактные данные", description: "ИНН, ОГРН, адрес оператора", status: "pending" },
    { name: "Форма обратной связи", description: "Наличие защищенной формы", status: "pending" },
    { name: "Метатеги и SEO", description: "Базовая SEO-оптимизация", status: "pending" },
  ];

  function generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  app.post("/api/public/express-check", async (req, res) => {
    try {
      const data = expressCheckSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      
      const recentAudits = await storage.getRecentPublicAuditsByIp(ipAddress, 1);
      if (recentAudits.length >= 3) {
        return res.status(429).json({ 
          error: "Превышен лимит бесплатных проверок. Попробуйте позже или зарегистрируйтесь для полного доступа." 
        });
      }

      const token = generateToken();
      // Validate URL to prevent SSRF attacks
      const normalizedUrl = validateWebsiteUrl(data.websiteUrl);
      
      // Check if website exists before starting audit
      const websiteCheck = await checkWebsiteExists(normalizedUrl);
      if (!websiteCheck.exists) {
        return res.status(400).json({ 
          error: websiteCheck.error || "Сайт недоступен. Проверьте правильность адреса."
        });
      }
      
      const audit = await storage.createPublicAudit({
        token,
        websiteUrl: data.websiteUrl,
        websiteUrlNormalized: normalizedUrl,
        ipAddress,
      });

      const totalStages = 7;
      let currentStage = 0;
      const stageInterval = 5000;
      
      const processStages = async () => {
        try {
          const stageNames = [
            "Подключение к сайту",
            "Проверка SSL сертификата", 
            "Анализ политик конфиденциальности",
            "Проверка cookie-баннера",
            "Анализ форм и согласий",
            "Проверка контактов и реквизитов",
            "Формирование отчета",
          ];
          
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await storage.updatePublicAuditProgress(token, {
              stageIndex: i + 1,
              passedCount: 0,
              warningCount: 0,
              failedCount: 0,
              totalCount: 0,
            });
          }

          console.log(`[EXPRESS] Calling runExpressAudit for ${normalizedUrl}...`);
          const report = await runExpressAudit(normalizedUrl, async (stage, passed, warnings, failed) => {
            const adjustedStage = Math.min(3 + stage, 6);
            await storage.updatePublicAuditProgress(token, {
              stageIndex: adjustedStage,
              passedCount: passed,
              warningCount: warnings,
              failedCount: failed,
              totalCount: passed + warnings + failed,
            });
          });
          console.log(`[EXPRESS] runExpressAudit completed: scorePercent=${report.scorePercent}, checks.length=${report.checks?.length || 0}`);

          for (let i = 4; i <= 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await storage.updatePublicAuditProgress(token, {
              stageIndex: i,
              passedCount: report.passedCount,
              warningCount: report.warningCount,
              failedCount: report.failedCount,
              totalCount: report.totalCount,
            });
          }

          await new Promise(resolve => setTimeout(resolve, 1000));

          const summaryResults = report.checks.map(check => ({
            name: check.name,
            description: check.description,
            status: check.status,
            details: check.details,
          }));

          await storage.updatePublicAuditProgress(token, {
            status: "completed",
            stageIndex: 7,
            passedCount: report.passedCount,
            warningCount: report.warningCount,
            failedCount: report.failedCount,
            totalCount: report.totalCount,
            scorePercent: report.scorePercent,
            severity: report.severity,
            summaryJson: {
              checks: summaryResults,
              rknCheck: report.rknCheck || null,
            },
            completedAt: new Date(),
          });
        } catch (err: any) {
          console.error(`[EXPRESS] Real audit failed:`, err?.message || err);
          console.error(`[EXPRESS] Stack:`, err?.stack);
          
          await storage.updatePublicAuditProgress(token, {
            status: "failed",
            stageIndex: 0,
            passedCount: 0,
            warningCount: 0,
            failedCount: 0,
            totalCount: 0,
            summaryJson: [{
              name: "Ошибка проверки",
              description: "Не удалось выполнить проверку сайта",
              status: "failed",
              details: err?.message || "Неизвестная ошибка",
            }],
            completedAt: new Date(),
          });
        }
      };

      processStages().catch(err => {
        console.error("Error processing public audit:", err);
        storage.updatePublicAuditProgress(token, { status: "failed" });
      });

      res.json({ 
        token, 
        status: "processing",
        websiteUrl: normalizedUrl,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Express check error:", error);
      res.status(500).json({ error: "Ошибка при создании проверки" });
    }
  });

  app.get("/api/public/express-check/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const audit = await storage.getPublicAuditByToken(token);
      
      if (!audit) {
        return res.status(404).json({ error: "Проверка не найдена" });
      }

      const summaryData = audit.summaryJson as any;
      const checks = Array.isArray(summaryData) ? summaryData : (summaryData?.checks || []);
      const rknCheck = summaryData?.rknCheck || null;

      res.json({
        token: audit.token,
        status: audit.status,
        websiteUrl: audit.websiteUrlNormalized,
        stageIndex: audit.stageIndex,
        passedCount: audit.passedCount,
        warningCount: audit.warningCount,
        failedCount: audit.failedCount,
        totalCount: audit.totalCount,
        scorePercent: audit.scorePercent,
        severity: audit.severity,
        summary: checks,
        rknCheck: rknCheck,
        createdAt: audit.createdAt,
        completedAt: audit.completedAt,
      });
    } catch (error) {
      console.error("Get express check error:", error);
      res.status(500).json({ error: "Ошибка при получении статуса проверки" });
    }
  });

  // SuperAdmin: Test Yookassa connection
  app.post("/api/superadmin/test-yookassa", requireSuperAdmin, async (req, res) => {
    try {
      const shopId = await storage.getSystemSetting("yookassa_shop_id");
      const secretKey = await storage.getSystemSetting("yookassa_secret_key");

      if (!shopId || !secretKey) {
        return res.status(400).json({ error: "Настройки Yookassa не заполнены" });
      }

      const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
      
      const response = await fetch("https://api.yookassa.ru/v3/me", {
        method: "GET",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        res.json({ 
          success: true, 
          message: `Подключение успешно. Магазин: ${data.account_id || shopId}`,
          accountId: data.account_id,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        res.status(400).json({ 
          error: errorData.description || "Ошибка авторизации в Yookassa. Проверьте ключи API.",
        });
      }
    } catch (error) {
      console.error("Yookassa test error:", error);
      res.status(500).json({ error: "Не удалось подключиться к Yookassa API" });
    }
  });

  // Yookassa webhook handler
  app.post("/api/yookassa/webhook", async (req, res) => {
    try {
      const { event, object } = req.body;
      
      console.log(`[Yookassa Webhook] Event: ${event}`, JSON.stringify(object, null, 2));

      if (event === "payment.succeeded") {
        const paymentId = object.id;
        const metadata = object.metadata || {};
        const auditId = metadata.auditId ? parseInt(metadata.auditId) : null;
        const userId = metadata.userId ? parseInt(metadata.userId) : null;
        const packageId = metadata.packageId ? parseInt(metadata.packageId) : null;

        const payment = await storage.getPaymentByExternalId(paymentId);
        if (payment) {
          await storage.updatePaymentStatus(payment.id, "completed");
          
          if (auditId) {
            await storage.updateAuditStatus(auditId, "processing");
            console.log(`[Yookassa] Payment ${paymentId} succeeded for audit ${auditId}`);
            
            const audit = await storage.getAuditById(auditId);
            const user = userId ? await storage.getUserById(userId) : null;
            const pkg = packageId ? await storage.getPackageById(packageId) : null;
            
            if (audit && pkg) {
              if (user && payment) {
                sendPaymentConfirmationEmail(user.email, {
                  userName: user.name,
                  packageName: pkg.name,
                  amount: payment.amount,
                  transactionId: payment.yandexPaymentId || `TXN-${payment.id}`,
                  websiteUrl: audit.websiteUrlNormalized,
                }).catch(err => console.error("Failed to send payment email:", err));
              }
              
              startAuditProcessing(audit, user, pkg);
            }
          }
        }
      } else if (event === "payment.canceled") {
        const paymentId = object.id;
        const payment = await storage.getPaymentByExternalId(paymentId);
        if (payment) {
          await storage.updatePaymentStatus(payment.id, "failed");
          console.log(`[Yookassa] Payment ${paymentId} canceled`);
        }
      } else if (event === "refund.succeeded") {
        const paymentId = object.payment_id;
        const payment = await storage.getPaymentByExternalId(paymentId);
        if (payment) {
          await storage.updatePaymentStatus(payment.id, "refunded");
          console.log(`[Yookassa] Payment ${paymentId} refunded`);
        }
      }

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Yookassa webhook error:", error);
      res.status(200).json({ status: "ok" });
    }
  });

  app.post("/api/express-report/purchase", requireAuth, async (req, res) => {
    try {
      const { token } = req.body;
      console.log(`[EXPRESS-REPORT] Purchase request, token: ${token}, userId: ${req.session.userId}`);
      
      if (!token) {
        return res.status(400).json({ error: "Токен экспресс-проверки обязателен" });
      }

      const expressAudit = await storage.getPublicAuditByToken(token);
      console.log(`[EXPRESS-REPORT] Express audit found:`, expressAudit ? `id=${expressAudit.id}, status=${expressAudit.status}` : 'null');
      
      if (!expressAudit) {
        return res.status(404).json({ error: "Экспресс-проверка не найдена" });
      }

      if (expressAudit.status !== "completed") {
        return res.status(400).json({ error: "Экспресс-проверка еще не завершена" });
      }

      const expressReportPackage = await storage.getPackageByType("express_report");
      console.log(`[EXPRESS-REPORT] Package found:`, expressReportPackage ? `id=${expressReportPackage.id}` : 'null');
      if (!expressReportPackage) {
        return res.status(500).json({ error: "Пакет отчета не найден" });
      }

      const audit = await storage.createAudit({
        userId: req.session.userId!,
        packageId: expressReportPackage.id,
        websiteUrlNormalized: expressAudit.websiteUrlNormalized,
        websiteUrlOriginal: expressAudit.websiteUrl,
      });

      if (expressAudit.summaryJson) {
        const criteriaResults: CriteriaResult[] = (expressAudit.summaryJson as any[]).map((c: any) => ({
          name: c.name,
          description: c.description,
          status: c.status,
          details: c.details || "",
          evidence: c.evidence,
        }));

        await storage.createAuditResult({
          auditId: audit.id,
          criteriaJson: criteriaResults,
          scorePercent: expressAudit.scorePercent || 0,
          severity: expressAudit.severity || "yellow",
        });

        await storage.updateAuditStatus(audit.id, "completed", new Date());
      }

      res.json({ 
        auditId: audit.id,
        message: "Отчет создан успешно" 
      });
    } catch (error) {
      console.error("Express report purchase error:", error);
      res.status(500).json({ error: "Ошибка при создании отчета" });
    }
  });

  // Debug audit endpoint with detailed diagnostics
  app.post("/api/audit/debug", async (req: Request, res: Response) => {
    try {
      const { url, maxPages, timeoutMs } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL обязателен" });
      }

      const result = await runDebugAudit(url, {
        maxPages: maxPages || 30,
        timeoutMs: timeoutMs || 20000,
      });

      res.json(result);
    } catch (error) {
      console.error("Debug audit error:", error);
      res.status(500).json({ error: "Ошибка при выполнении debug-аудита" });
    }
  });

  // GET version for easy browser testing
  app.get("/api/audit/debug", async (req: Request, res: Response) => {
    try {
      const url = req.query.url as string;
      
      if (!url) {
        return res.status(400).json({ error: "URL обязателен (?url=https://...)" });
      }

      const result = await runDebugAudit(url, {
        maxPages: 30,
        timeoutMs: 20000,
      });

      res.json(result);
    } catch (error) {
      console.error("Debug audit error:", error);
      res.status(500).json({ error: "Ошибка при выполнении debug-аудита" });
    }
  });

  return httpServer;
}
