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
  sendEmailVerificationEmail,
  isEmailConfigured
} from "./email";
import crypto from "crypto";
import fs from "fs";
import { runExpressAudit, runAudit, checkWebsiteExists, runDebugAudit } from "./audit-engine";
import { generatePdfReport } from "./pdf-generator";
import { toolsRouter } from "./tools-routes";
import { maskEmail } from "./utils/pii";

// GUARD: Mock mode forbidden in production
const auditMockMode = process.env.AUDIT_MOCK_MODE === "true";
if (auditMockMode && process.env.NODE_ENV === "production") {
  console.error("[CONFIG] WARNING: AUDIT_MOCK_MODE is set in production, ignoring.");
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

// Rate limiter for resend verification emails (max 5 per hour per email)
const RESEND_RATE_LIMIT = 5;
const RESEND_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const resendAttempts = new Map<string, { count: number; windowStart: number }>();

function checkResendRateLimit(email: string): { allowed: boolean; retryAfter?: number } {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  const record = resendAttempts.get(normalizedEmail);
  
  if (!record || now - record.windowStart > RESEND_RATE_WINDOW_MS) {
    resendAttempts.set(normalizedEmail, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  if (record.count >= RESEND_RATE_LIMIT) {
    const retryAfter = Math.ceil((record.windowStart + RESEND_RATE_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
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

// =====================================================
// Token Utilities for Email Verification & Password Reset
// =====================================================
const TOKEN_PEPPER = process.env.SECRET_KEY || "default-pepper-change-me";

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHmac("sha256", TOKEN_PEPPER).update(token).digest("hex");
}

function verifyToken(rawToken: string, storedHash: string): boolean {
  const computedHash = hashToken(rawToken);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
}

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const PASSWORD_RESET_MAX_ATTEMPTS = 3;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour window for rate limiting

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
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

  // Health check endpoint for monitoring
  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  });

  // Tools API router (10 paid tools for compliance checking)
  app.use("/api/tools", toolsRouter);

  app.post("/api/auth/register", async (req, res) => {
    try {
      // Check if SMTP is configured before allowing registration
      const emailConfigured = await isEmailConfigured();
      if (!emailConfigured) {
        console.log(`[AUTH] Registration blocked: SMTP not configured`);
        return res.status(503).json({ 
          error: "Регистрация временно недоступна. Email сервис не настроен.",
          code: "SMTP_NOT_CONFIGURED",
          message: "Регистрация временно недоступна. Email сервис не настроен."
        });
      }
      
      const data = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ 
          error: "Пользователь с таким email уже существует",
          code: "EMAIL_EXISTS",
          message: "Пользователь с таким email уже существует"
        });
      }

      const user = await storage.createUser(data);
      
      // Generate email verification token
      const verifyToken = generateSecureToken();
      const verifyTokenHash = hashToken(verifyToken);
      const verifyExpiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
      
      // Save token hash to user
      await storage.updateUser(user.id, {
        emailVerifyTokenHash: verifyTokenHash,
        emailVerifyTokenExpiresAt: verifyExpiresAt,
      });
      
      // Send verification email (SMTP already verified at start of handler)
      const siteUrl = process.env.SITE_URL || "https://securelex.ru";
      const verifyLink = `${siteUrl}/verify-email?token=${verifyToken}`;
      
      const emailSent = await sendEmailVerificationEmail(user.email, {
        userName: user.name,
        verificationLink: verifyLink,
      });
      
      if (emailSent) {
        console.log(`[AUTH] Verification email sent to: ${maskEmail(user.email)}`);
      } else {
        console.log(`[AUTH] Failed to send verification email`);
      }
      
      // Set user ID in session
      req.session.userId = user.id;
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error during registration:", saveErr);
          return res.status(500).json({ error: "Session error: " + (saveErr.message || "Unknown") });
        }
        console.log(`[AUTH] Session saved successfully for new user: ${user.id}`);
        const { passwordHash, emailVerifyTokenHash, passwordResetTokenHash, ...safeUser } = user;
        res.json({ 
          user: safeUser,
          emailVerificationRequired: true,
          emailSent,
          message: emailSent 
            ? "Письмо с подтверждением отправлено на ваш email" 
            : "Регистрация завершена. Подтвердите email для полного доступа."
        });
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
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (!existingUser) {
        console.log(`[AUTH] User not found`);
        return res.status(401).json({ 
          error: "Неверный email или пароль",
          code: "INVALID_CREDENTIALS",
          message: "Неверный email или пароль"
        });
      }
      
      const user = await (storage as any).validatePassword(data.email, data.password);
      if (!user) {
        console.log(`[AUTH] Invalid password`);
        return res.status(401).json({ 
          error: "Неверный email или пароль",
          code: "INVALID_CREDENTIALS",
          message: "Неверный email или пароль"
        });
      }
      
      console.log(`[AUTH] Password validated for userId: ${user.id}`);
      
      // Admin and superadmin skip email verification requirement
      const isPrivileged = user.role === "admin" || user.role === "superadmin";
      
      // Check email verification status for regular users
      if (!isPrivileged && !user.emailVerifiedAt) {
        console.log(`[AUTH] Email not verified`);
        return res.status(403).json({ 
          error: "Email не подтвержден",
          code: "EMAIL_NOT_VERIFIED",
          message: "Пожалуйста, подтвердите ваш email. Проверьте почту или запросите повторную отправку письма."
        });
      }
      
      // Login directly
      console.log(`[AUTH] Login successful for userId: ${user.id}`);
      req.session.userId = user.id;
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error during login:", saveErr);
          return res.status(500).json({ error: "Session error: " + (saveErr.message || "Unknown") });
        }
        console.log(`[AUTH] Session saved successfully for user: ${user.id}`);
        const { passwordHash, emailVerifyTokenHash, passwordResetTokenHash, ...safeUser } = user;
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

  // =====================================================
  // Email Verification Endpoints
  // =====================================================
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Токен обязателен" });
      }
      
      console.log(`[AUTH] Email verification attempt`);
      
      // Find user with matching token hash using timing-safe comparison
      const users = await storage.getUsers();
      const usersWithTokens = users.filter(u => u.emailVerifyTokenHash);
      
      let matchedUser = null;
      for (const user of usersWithTokens) {
        if (verifyToken(token, user.emailVerifyTokenHash!)) {
          matchedUser = user;
          break;
        }
      }
      
      if (!matchedUser) {
        console.log(`[AUTH] Email verification: token not found`);
        return res.status(400).json({ error: "Недействительная ссылка подтверждения" });
      }
      
      // Check if already verified
      if (matchedUser.emailVerifiedAt) {
        console.log(`[AUTH] Email already verified`);
        return res.json({ success: true, message: "Email уже подтвержден", alreadyVerified: true });
      }
      
      // Check expiration
      if (matchedUser.emailVerifyTokenExpiresAt && new Date() > new Date(matchedUser.emailVerifyTokenExpiresAt)) {
        console.log(`[AUTH] Email verification token expired`);
        return res.status(400).json({ error: "Ссылка истекла. Запросите повторную отправку.", code: "TOKEN_EXPIRED" });
      }
      
      // Mark as verified
      await storage.updateUser(matchedUser.id, {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyTokenExpiresAt: null,
      });
      
      console.log(`[AUTH] Email verified successfully`);
      
      res.json({ success: true, message: "Email успешно подтвержден" });
    } catch (error) {
      console.error("[AUTH] Email verification error:", error);
      res.status(500).json({ error: "Ошибка подтверждения email" });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email обязателен", code: "VALIDATION_ERROR", message: "Email обязателен" });
      }
      
      // Check rate limit
      const rateCheck = checkResendRateLimit(email);
      if (!rateCheck.allowed) {
        console.log(`[AUTH] Resend rate limited`);
        return res.status(429).json({ 
          error: "Слишком много запросов. Попробуйте позже.",
          code: "RATE_LIMITED",
          message: "Слишком много запросов. Попробуйте позже.",
          retryAfter: rateCheck.retryAfter
        });
      }
      
      console.log(`[AUTH] Resend verification request`);
      
      const user = await storage.getUserByEmail(email);
      
      // Don't reveal if email exists
      if (!user) {
        console.log(`[AUTH] Resend verification: user not found (silent)`);
        return res.json({ success: true, message: "Если email зарегистрирован, письмо будет отправлено" });
      }
      
      // Check if already verified
      if (user.emailVerifiedAt) {
        return res.json({ success: true, message: "Email уже подтвержден", alreadyVerified: true });
      }
      
      // Generate new token
      const verifyToken = generateSecureToken();
      const verifyTokenHash = hashToken(verifyToken);
      const verifyExpiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
      
      await storage.updateUser(user.id, {
        emailVerifyTokenHash: verifyTokenHash,
        emailVerifyTokenExpiresAt: verifyExpiresAt,
      });
      
      // Send verification email
      const emailConfigured = await isEmailConfigured();
      if (!emailConfigured) {
        console.log(`[AUTH] SMTP not configured, cannot send verification email`);
        return res.status(503).json({ error: "Email сервис временно недоступен" });
      }
      
      const siteUrl = process.env.SITE_URL || "https://securelex.ru";
      const verifyLink = `${siteUrl}/verify-email?token=${verifyToken}`;
      
      const emailSent = await sendEmailVerificationEmail(user.email, {
        userName: user.name,
        verificationLink: verifyLink,
      });
      
      if (emailSent) {
        console.log(`[AUTH] Verification email resent`);
      } else {
        console.log(`[AUTH] Failed to resend verification email`);
      }
      
      res.json({ success: true, message: "Если email зарегистрирован, письмо будет отправлено" });
    } catch (error) {
      console.error("[AUTH] Resend verification error:", error);
      res.status(500).json({ error: "Ошибка при отправке письма" });
    }
  });

  // Legacy OTP endpoint (deprecated but kept for compatibility)
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

  // =====================================================
  // Password Reset Endpoints (Public - for regular users only)
  // =====================================================
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email обязателен" });
      }
      
      console.log(`[AUTH] Password reset request`);

      const user = await storage.getUserByEmail(email);
      
      // Don't reveal if email exists
      if (!user) {
        console.log(`[AUTH] Password reset: user not found (silent)`);
        return res.json({ success: true, message: "Если email существует, вы получите письмо с инструкциями" });
      }
      
      // Admin/superadmin cannot use public password reset - must go through SuperAdmin
      if (user.role === "admin" || user.role === "superadmin") {
        console.log(`[AUTH] Password reset: privileged user must use SuperAdmin reset`);
        return res.json({ success: true, message: "Если email существует, вы получите письмо с инструкциями" });
      }
      
      // Rate limiting: check attempts in last hour
      const now = Date.now();
      const lastAttempt = user.passwordResetLastAttempt ? new Date(user.passwordResetLastAttempt).getTime() : 0;
      const attempts = user.passwordResetAttempts || 0;
      
      // Reset counter if window has passed
      let currentAttempts = attempts;
      if (now - lastAttempt > PASSWORD_RESET_WINDOW_MS) {
        currentAttempts = 0;
      }
      
      if (currentAttempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
        console.log(`[AUTH] Password reset rate limited`);
        return res.status(429).json({ 
          error: "Слишком много запросов. Попробуйте через час.",
          code: "RATE_LIMITED"
        });
      }
      
      // Generate token with hash
      const resetToken = generateSecureToken();
      const resetTokenHash = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      
      // Save token hash and update rate limiting
      await storage.updateUser(user.id, {
        passwordResetTokenHash: resetTokenHash,
        passwordResetTokenExpiresAt: expiresAt,
        passwordResetAttempts: currentAttempts + 1,
        passwordResetLastAttempt: new Date(),
      });
      
      // Send reset email
      const emailConfigured = await isEmailConfigured();
      if (!emailConfigured) {
        console.log(`[AUTH] SMTP not configured, cannot send password reset`);
        return res.json({ success: true, message: "Если email существует, вы получите письмо с инструкциями" });
      }

      const siteUrl = process.env.SITE_URL || "https://securelex.ru";
      const resetLink = `${siteUrl}/reset-password?token=${resetToken}`;

      const emailSent = await sendPasswordResetEmail(user.email, resetLink, user.name);
      
      if (emailSent) {
        console.log(`[AUTH] Password reset email sent`);
      } else {
        console.log(`[AUTH] Failed to send password reset email`);
      }
      
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

      console.log(`[AUTH] Password reset attempt`);
      
      // Find user with matching token hash using timing-safe comparison
      const users = await storage.getUsers();
      const usersWithTokens = users.filter(u => u.passwordResetTokenHash);
      
      let matchedUser = null;
      for (const user of usersWithTokens) {
        if (verifyToken(token, user.passwordResetTokenHash!)) {
          matchedUser = user;
          break;
        }
      }

      if (!matchedUser) {
        console.log(`[AUTH] Password reset: token not found`);
        return res.status(400).json({ 
          error: "Недействительная или истекшая ссылка", 
          code: "TOKEN_INVALID" 
        });
      }
      
      // Check expiration
      if (matchedUser.passwordResetTokenExpiresAt && new Date() > new Date(matchedUser.passwordResetTokenExpiresAt)) {
        console.log(`[AUTH] Password reset token expired`);
        return res.status(400).json({ 
          error: "Ссылка истекла. Запросите новую", 
          code: "TOKEN_EXPIRED" 
        });
      }

      // Update password and clear token
      await (storage as any).updateUserPassword(matchedUser.id, password);
      await storage.updateUser(matchedUser.id, {
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetAttempts: 0,
      });

      console.log(`[AUTH] Password reset successful`);
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

    const { passwordHash, emailVerifyTokenHash, passwordResetTokenHash, ...safeUser } = user;
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

  app.get("/api/packages/:id", async (req, res) => {
    try {
      const packageId = parseInt(req.params.id);
      if (isNaN(packageId)) {
        return res.status(400).json({ error: "Invalid package ID" });
      }
      const pkg = await storage.getPackageById(packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch package" });
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

      if (audit.status === "pending_payment") {
        console.log(`[PDF] Audit pending payment: status=${audit.status}`);
        return res.status(402).json({ error: "Требуется оплата для доступа к PDF-отчёту" });
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
          console.log(`[AUDIT] runAudit completed: scorePercent=${report.scorePercent}, checks.length=${report.checks?.length || 0}, severity=${report.severity}, rknCheck=${JSON.stringify(report.rknCheck)}`);
          
          const criteriaResults: CriteriaResult[] = report.checks.map(check => ({
            name: check.name,
            description: check.description,
            status: check.status,
            details: check.details,
            evidence: Array.isArray(check.evidence) ? check.evidence.join("; ") : check.evidence,
          }));
          console.log(`[AUDIT] Mapped ${criteriaResults.length} criteria results`);

          console.log(`[AUDIT] Saving audit result to DB for auditId=${audit.id}...`);
          await storage.createAuditResult({
            auditId: audit.id,
            criteriaJson: criteriaResults,
            rknCheckJson: report.rknCheck || null,
            scorePercent: report.scorePercent,
            severity: report.severity,
            hostingInfo: report.hostingCheck || null,
            briefResults: report.briefResults || null,
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
      
      if (!pkg.isActive) {
        return res.status(400).json({ error: "Пакет временно недоступен для оплаты" });
      }
      
      const finalAmount = pkg.price;
      
      if (finalAmount <= 0) {
        return res.status(400).json({ error: "Невозможно создать платёж на сумму 0 рублей" });
      }
      
      console.log(`[PAYMENT] Creating payment for auditId=${audit.id}, packageId=${pkg.id}, price=${finalAmount} RUB (from DB)`);

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
        
        const paymentDescription = pkg.type === "expressreport"
          ? "Оплата за полный отчет (экспресс-проверка)"
          : `Оплата за полный аудит сайта: ${pkg.name}`;
        
        const yookassaPayload: any = {
          amount: {
            value: finalAmount.toFixed(2),
            currency: "RUB",
          },
          capture: true,
          confirmation: {
            type: "redirect",
            return_url: `${baseUrl}/payment-result?auditId=${audit.id}`,
          },
          description: paymentDescription,
          metadata: {
            auditId: audit.id,
            userId: req.session.userId,
            packageId: pkg.id,
          },
        };

        if (paymentMethodToYookassa[data.paymentMethod]) {
          yookassaPayload.payment_method_data = paymentMethodToYookassa[data.paymentMethod];
        }

        // DEBUG: Write payload to file (no secrets)
        try {
          fs.writeFileSync("debug/yookassa-last-payload.json", JSON.stringify(yookassaPayload, null, 2));
          console.log("[DEBUG] YooKassa payload written to debug/yookassa-last-payload.json");
        } catch (fsErr) {
          console.error("[DEBUG] Failed to write payload:", fsErr);
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

          // DEBUG: Write response to file
          try {
            fs.writeFileSync("debug/yookassa-last-response.json", JSON.stringify({
              statusCode: response.status,
              body: responseData
            }, null, 2));
            console.log("[DEBUG] YooKassa response written to debug/yookassa-last-response.json");
          } catch (fsErr) {
            console.error("[DEBUG] Failed to write response:", fsErr);
          }

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
            description: `${paymentDescription} (${paymentMethodNames[data.paymentMethod]})`,
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

      const mockPaymentDescription = pkg.type === "expressreport"
        ? "Оплата за полный отчет (экспресс-проверка)"
        : `Оплата за полный аудит сайта: ${pkg.name}`;
        
      const payment = await storage.createPayment({
        userId: req.session.userId!,
        auditId: audit.id,
        amount: finalAmount,
        description: `${mockPaymentDescription} (${paymentMethodNames[data.paymentMethod]})`,
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
            evidence: Array.isArray(check.evidence) ? check.evidence.join("; ") : check.evidence,
          }));

          await storage.createAuditResult({
            auditId: auditId,
            criteriaJson: criteriaResults,
            rknCheckJson: report.rknCheck || null,
            scorePercent: report.scorePercent,
            severity: report.severity,
            hostingInfo: report.hostingCheck || null,
            briefResults: report.briefResults || null,
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
    name: z.string().min(1).optional(),
    price: z.number().min(0).optional(),
    description: z.string().optional(),
    criteriaTemplates: z.array(criteriaTemplateSchema).optional(),
    criteriaCount: z.number().optional(),
    durationMin: z.number().optional(),
    durationMax: z.number().optional(),
    isActive: z.boolean().optional(),
  });

  app.get("/api/admin/audit-packages", requireAdmin, async (req, res) => {
    try {
      const packages = await storage.getPackages();
      res.json(packages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  app.patch("/api/admin/packages/:id", requireAdmin, async (req, res) => {
    try {
      const packageId = parseInt(req.params.id);
      
      const validationResult = updatePackageSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.errors[0].message });
      }
      
      const { name, price, description, criteriaTemplates, criteriaCount, durationMin, durationMax, isActive } = validationResult.data;
      
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = price;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;
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
      
      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (existingUser.isMasterAdmin || existingUser.email === "sae230679@yandex.ru") {
        return res.status(403).json({ error: "Невозможно изменить роль главного администратора" });
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
      const { pin } = req.body as { pin?: string };
      
      if (userId === req.session.userId) {
        return res.status(400).json({ error: "Cannot delete yourself" });
      }
      
      const userToDelete = await storage.getUserById(userId);
      if (!userToDelete) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }
      
      if (userToDelete.isMasterAdmin || userToDelete.email === "sae230679@yandex.ru") {
        const masterPin = process.env.MASTER_ADMIN_PIN;
        if (!pin) {
          return res.status(403).json({ 
            error: "Для удаления главного администратора требуется PIN-код",
            requiresPin: true 
          });
        }
        if (pin !== masterPin) {
          return res.status(403).json({ error: "Неверный PIN-код" });
        }
      }
      
      await storage.deleteUser(userId);
      
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "delete_user",
        resourceType: "user",
        resourceId: userId,
        details: userToDelete.isMasterAdmin ? "Master admin deleted with PIN" : undefined,
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
      if (!gigachatKey && process.env.GIGACHATAPIKEY) {
        gigachatKey = process.env.GIGACHATAPIKEY;
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
      if (!openaiKey && process.env.OPENAIAPIKEY) {
        openaiKey = process.env.OPENAIAPIKEY;
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

  // AI keys diagnostics endpoint (SuperAdmin only) - returns boolean flags, no actual values
  app.get("/api/admin/diagnostics/ai-keys", requireSuperAdmin, async (req, res) => {
    try {
      const { hasApiKey } = await import("./api-keys");
      
      const hasGigaChatKey = await hasApiKey("gigachat");
      const hasOpenAiKey = await hasApiKey("openai");
      
      const modeSetting = await storage.getSystemSetting("ai_mode");
      const aiModeConfigured = modeSetting?.value || "gigachat_only";
      
      // Determine effective mode based on available keys
      let effectiveAiMode = aiModeConfigured;
      if (aiModeConfigured === "gigachat_only" && !hasGigaChatKey) {
        effectiveAiMode = "none (no GIGACHATAPIKEY)";
      } else if (aiModeConfigured === "openai_only" && !hasOpenAiKey) {
        effectiveAiMode = "none (no OPENAIAPIKEY)";
      } else if (aiModeConfigured === "hybrid" && !hasGigaChatKey && !hasOpenAiKey) {
        effectiveAiMode = "none (no keys)";
      } else if (aiModeConfigured === "hybrid" && !hasOpenAiKey) {
        effectiveAiMode = "gigachat_only (fallback)";
      } else if (aiModeConfigured === "hybrid" && !hasGigaChatKey) {
        effectiveAiMode = "openai_only (fallback)";
      }
      
      res.json({
        hasGigaChatKey,
        hasOpenAiKey,
        aiModeConfigured,
        effectiveAiMode,
      });
    } catch (error) {
      console.error("AI keys diagnostics error:", error);
      res.status(500).json({ error: "Failed to fetch AI diagnostics" });
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
      const widgetCodeSetting = await storage.getSystemSetting("widget_code");
      
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
        widgetCode: widgetCodeSetting?.value || "",
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

  // Public API: Get active packages with prices (read-only, no auth required)
  // Supports filters: ?type=landing&service=full_audit|express_pdf
  app.get("/api/public/packages", async (req, res) => {
    try {
      const typeFilter = req.query.type as string | undefined;
      const serviceFilter = req.query.service as string | undefined;
      const packages = await storage.getPackages();
      
      const activePackages = packages
        .filter(pkg => pkg.isActive)
        .filter(pkg => !typeFilter || pkg.type === typeFilter)
        .map(pkg => {
          // Derive service from package type
          const service = pkg.type === "expressreport" ? "express_pdf" : "full_audit";
          return {
            id: pkg.id,
            type: pkg.type,
            name: pkg.name,
            price: pkg.price,
            category: pkg.category,
            description: pkg.description,
            isActive: pkg.isActive,
            service,
          };
        })
        .filter(pkg => !serviceFilter || pkg.service === serviceFilter);
      
      res.json(activePackages);
    } catch (error) {
      console.error("Failed to fetch public packages:", error);
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  // Public API: Get installments settings for checkout page
  app.get("/api/public/installments-settings", async (req, res) => {
    try {
      const yookassaEnabled = await storage.getSystemSetting("installments_yookassa_enabled");
      const robokassaEnabled = await storage.getSystemSetting("installments_robokassa_enabled");
      const bannerTitle = await storage.getSystemSetting("installments_banner_title");
      const bannerText = await storage.getSystemSetting("installments_banner_text");
      
      res.json({
        yookassaEnabled: yookassaEnabled?.value === "true",
        robokassaEnabled: robokassaEnabled?.value === "true",
        bannerTitle: bannerTitle?.value || "Оплата в рассрочку",
        bannerText: bannerText?.value || "Разделите платёж на несколько частей без переплат",
      });
    } catch (error) {
      console.error("Failed to fetch installments settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/public/express-check", async (req, res) => {
    try {
      const data = expressCheckSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "";
      const userId = req.session.userId;

      // Check express limit (uses freeExpressLimitEvents table)
      const limitCheck = await storage.checkAndRecordExpressLimit(userId, ipAddress, userAgent);
      if (!limitCheck.allowed) {
        const hoursRemaining = Math.ceil(limitCheck.resetInSeconds / 3600);
        return res.status(429).json({ 
          error: `Превышен лимит бесплатных проверок. Попробуйте через ${hoursRemaining} ч. или зарегистрируйтесь для полного доступа.`,
          remaining: 0,
          resetInSeconds: limitCheck.resetInSeconds
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
              hostingInfo: report.hostingCheck || null,
              briefResults: report.briefResults || null,
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
      const briefResults = summaryData?.briefResults || null;
      const hostingInfo = summaryData?.hostingInfo || null;

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
        briefResults: briefResults,
        hostingInfo: hostingInfo,
        createdAt: audit.createdAt,
        completedAt: audit.completedAt,
      });
    } catch (error) {
      console.error("Get express check error:", error);
      res.status(500).json({ error: "Ошибка при получении статуса проверки" });
    }
  });

  // Download express PDF report by token
  app.get("/api/public/express-check/:token/pdf", async (req, res) => {
    try {
      const { token } = req.params;
      const audit = await storage.getPublicAuditByToken(token);
      
      if (!audit) {
        return res.status(404).json({ error: "Проверка не найдена" });
      }
      
      if (audit.status !== "completed") {
        return res.status(400).json({ error: "Проверка ещё не завершена" });
      }
      
      const summaryData = audit.summaryJson as any;
      const briefResults = summaryData?.briefResults || null;
      const hostingInfo = summaryData?.hostingInfo || null;
      const checks = Array.isArray(summaryData) ? summaryData : (summaryData?.checks || []);
      
      // Convert checks to criteria format
      const criteria = checks.map((check: any) => ({
        name: check.name || check.title || "Проверка",
        description: check.description || check.summary || "",
        status: check.status || "warning",
        details: check.details || "",
        category: check.category,
        law: check.law,
        howToFix: check.howToFix || check.howToFixShort,
      }));
      
      console.log(`[PDF] Generating express PDF for token ${token}`);
      
      const pdfBuffer = await generatePdfReport({
        auditId: audit.id,
        websiteUrl: audit.websiteUrlNormalized || "unknown",
        scorePercent: audit.scorePercent || 0,
        severity: (audit.severity as "red" | "yellow" | "green") || "red",
        passedCount: audit.passedCount || 0,
        warningCount: audit.warningCount || 0,
        failedCount: audit.failedCount || 0,
        totalCount: audit.totalCount || criteria.length,
        criteria,
        createdAt: audit.createdAt || new Date(),
        packageName: "Экспресс-проверка",
        briefResults: briefResults ? {
          score: briefResults.score || audit.scorePercent || 0,
          severity: briefResults.severity || audit.severity || "red",
          hosting: hostingInfo || briefResults.hosting || { status: "uncertain" },
          highlights: briefResults.highlights || [],
          cta: briefResults.cta || { title: "Полный аудит", price: 900, benefits: [] },
        } : undefined,
      }, "express");
      
      const filename = `express-report-${audit.websiteUrlNormalized?.replace(/[^a-zA-Z0-9]/g, "_") || "audit"}-${new Date().toISOString().split("T")[0]}.pdf`;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
      
      console.log(`[PDF] Express PDF sent: ${filename} (${pdfBuffer.length} bytes)`);
    } catch (error) {
      console.error("Express PDF generation error:", error);
      res.status(500).json({ error: "Ошибка при генерации PDF отчёта" });
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

      const auth = Buffer.from(`${shopId.value}:${secretKey.value}`).toString("base64");
      
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

  // SuperAdmin: Get YooKassa diagnostics (last payload/response)
  app.get("/api/superadmin/yookassa-diagnostics", requireSuperAdmin, async (req, res) => {
    try {
      let lastPayload = null;
      let lastResponse = null;
      
      try {
        const payloadData = fs.readFileSync("debug/yookassa-last-payload.json", "utf-8");
        lastPayload = JSON.parse(payloadData);
      } catch {
        // File doesn't exist or is invalid
      }
      
      try {
        const responseData = fs.readFileSync("debug/yookassa-last-response.json", "utf-8");
        lastResponse = JSON.parse(responseData);
      } catch {
        // File doesn't exist or is invalid
      }
      
      res.json({
        lastPayload,
        lastResponse,
        hasData: lastPayload !== null || lastResponse !== null,
      });
    } catch (error) {
      console.error("YooKassa diagnostics error:", error);
      res.status(500).json({ error: "Ошибка получения диагностики" });
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
              
              if (pkg.type === "expressreport") {
                await storage.updateAuditStatus(auditId, "completed", new Date());
                console.log(`[Yookassa] Express report ${auditId} marked as completed (already has results)`);
              } else {
                startAuditProcessing(audit, user, pkg);
              }
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

      const expressReportPackage = await storage.getPackageByType("expressreport");
      console.log(`[EXPRESS-REPORT] Package found:`, expressReportPackage ? `id=${expressReportPackage.id}, price=${expressReportPackage.price}` : 'null');
      if (!expressReportPackage) {
        return res.status(500).json({ error: "Пакет отчета не найден" });
      }

      if (!expressReportPackage.isActive) {
        return res.status(400).json({ error: "Пакет экспресс-отчёта временно недоступен" });
      }

      const audit = await storage.createAudit({
        userId: req.session.userId!,
        packageId: expressReportPackage.id,
        websiteUrlNormalized: expressAudit.websiteUrlNormalized,
        websiteUrlOriginal: expressAudit.websiteUrl,
      });

      if (expressAudit.summaryJson) {
        const summaryData = expressAudit.summaryJson as any;
        const checks = Array.isArray(summaryData) ? summaryData : (summaryData?.checks || []);
        const rknCheck = summaryData?.rknCheck || null;

        const criteriaResults: CriteriaResult[] = checks.map((c: any) => ({
          name: c.name,
          description: c.description,
          status: c.status,
          details: c.details || "",
          evidence: c.evidence,
        }));

        await storage.createAuditResult({
          auditId: audit.id,
          criteriaJson: criteriaResults,
          rknCheckJson: rknCheck,
          scorePercent: expressAudit.scorePercent || 0,
          severity: expressAudit.severity || "yellow",
        });
      }

      await storage.updateAuditStatus(audit.id, "pending_payment");
      console.log(`[EXPRESS-REPORT] Created audit id=${audit.id} with status pending_payment, price=${expressReportPackage.price}`);

      res.json({ 
        auditId: audit.id,
        packageId: expressReportPackage.id,
        price: expressReportPackage.price,
        packageName: expressReportPackage.name,
        message: "Отчет создан, ожидает оплаты" 
      });
    } catch (error: any) {
      console.error("[EXPRESS-REPORT] Purchase error:", error?.message || error);
      console.error("[EXPRESS-REPORT] Stack:", error?.stack);
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

  // RKN registry check by INN (public endpoint)
  app.post("/api/public/rkn/check", async (req: Request, res: Response) => {
    try {
      const { inn } = req.body;
      
      if (!inn || typeof inn !== "string") {
        return res.status(400).json({ error: "ИНН обязателен и должен быть строкой" });
      }

      const cleanInn = inn.trim().replace(/\D/g, "");
      if (cleanInn.length < 10 || cleanInn.length > 12) {
        return res.status(400).json({ error: "ИНН должен содержать 10 или 12 цифр" });
      }

      const { checkRknRegistry } = await import("./rkn-parser");
      const result = await checkRknRegistry(cleanInn);

      res.json({
        status: result.isRegistered ? "passed" : "failed",
        confidence: result.confidence,
        details: result.details,
        companyName: result.companyName,
        registrationNumber: result.registrationNumber,
        registrationDate: result.registrationDate,
        fromCache: result.fromCache,
      });
    } catch (error: any) {
      console.error("[RKN] Check error:", error?.message || error);
      res.status(500).json({ error: "Ошибка проверки реестра РКН" });
    }
  });

  // =============================================
  // ROBOKASSA PAYMENT ENDPOINTS
  // =============================================

  // Create Robokassa payment URL
  app.post("/api/payments/create-robokassa", requireAuth, async (req, res) => {
    try {
      const { auditId } = req.body;

      if (!auditId) {
        return res.status(400).json({ error: "auditId обязателен" });
      }

      const audit = await storage.getAuditById(auditId);
      if (!audit) {
        return res.status(404).json({ error: "Аудит не найден" });
      }

      if (audit.userId !== req.session.userId) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }

      const pkg = await storage.getPackageById(audit.packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Пакет не найден" });
      }

      // Get Robokassa settings
      const robokassaEnabled = await storage.getSystemSetting("robokassa_enabled");
      const merchantLogin = await storage.getSystemSetting("robokassa_merchant_login");
      const password1 = await storage.getSystemSetting("robokassa_password1");
      const testMode = await storage.getSystemSetting("robokassa_test_mode");

      if (robokassaEnabled?.value !== "true") {
        return res.status(400).json({ error: "Robokassa не активирована" });
      }

      if (!merchantLogin?.value || !password1?.value) {
        return res.status(400).json({ error: "Robokassa не настроена" });
      }

      const amount = pkg.price;
      const invId = audit.id;
      const description = `Аудит: ${pkg.name} - ${audit.websiteUrlNormalized}`;
      const isTest = testMode?.value === "true";

      // Generate signature: MD5(MerchantLogin:OutSum:InvId:Password1)
      const signatureString = `${merchantLogin.value}:${amount.toFixed(2)}:${invId}:${password1.value}`;
      const signature = crypto.createHash("md5").update(signatureString).digest("hex");

      // Build Robokassa URL
      const params = new URLSearchParams({
        MerchantLogin: merchantLogin.value,
        OutSum: amount.toFixed(2),
        InvId: invId.toString(),
        Description: description,
        SignatureValue: signature,
        Culture: "ru",
        Encoding: "utf-8",
      });

      if (isTest) {
        params.append("IsTest", "1");
      }

      const robokassaUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;

      console.log(`[Robokassa] Created payment URL for audit ${invId}, amount: ${amount}, testMode: ${isTest}`);

      res.json({
        paymentUrl: robokassaUrl,
        invId,
        amount,
      });
    } catch (error: any) {
      console.error("[Robokassa] Create payment error:", error?.message || error);
      res.status(500).json({ error: "Ошибка создания платежа Robokassa" });
    }
  });

  // Robokassa Result URL (server callback)
  app.post("/api/robokassa/result", async (req, res) => {
    try {
      const { OutSum, InvId, SignatureValue } = req.body;

      console.log(`[Robokassa Result] Received: OutSum=${OutSum}, InvId=${InvId}, Sig=${SignatureValue}`);

      if (!OutSum || !InvId || !SignatureValue) {
        console.error("[Robokassa Result] Missing required params");
        return res.status(400).send("bad sign");
      }

      // Get Robokassa password2 for verification
      const password2 = await storage.getSystemSetting("robokassa_password2");
      if (!password2?.value) {
        console.error("[Robokassa Result] password2 not configured");
        return res.status(500).send("configuration error");
      }

      // Verify signature: MD5(OutSum:InvId:Password2)
      const expectedSignature = crypto
        .createHash("md5")
        .update(`${OutSum}:${InvId}:${password2.value}`)
        .digest("hex")
        .toUpperCase();

      if (SignatureValue.toUpperCase() !== expectedSignature) {
        console.error(`[Robokassa Result] Invalid signature: expected ${expectedSignature}, got ${SignatureValue}`);
        return res.status(400).send("bad sign");
      }

      const auditId = parseInt(InvId);
      const audit = await storage.getAuditById(auditId);

      if (!audit) {
        console.error(`[Robokassa Result] Audit not found: ${auditId}`);
        return res.status(404).send("audit not found");
      }

      // Check for duplicate callback (idempotency)
      const existingPayments = await storage.getPaymentsByAuditId(auditId);
      const hasCompletedPayment = existingPayments.some(p => p.status === "completed" && p.yandexPaymentId === `robokassa-${InvId}`);
      
      if (hasCompletedPayment) {
        console.log(`[Robokassa Result] Duplicate callback ignored for audit ${auditId}`);
        return res.send(`OK${InvId}`);
      }

      // Create payment record
      const payment = await storage.createPayment({
        userId: audit.userId,
        auditId: audit.id,
        amount: parseFloat(OutSum),
        description: `Robokassa payment #${InvId}`,
        status: "completed",
        yandexPaymentId: `robokassa-${InvId}`,
      });

      console.log(`[Robokassa Result] Payment created: ${payment.id} for audit ${auditId}`);

      // Update audit status and start processing
      if (audit.status === "pending_payment") {
        await storage.updateAuditStatus(audit.id, "processing");

        const pkg = await storage.getPackageById(audit.packageId);
        const user = await storage.getUserById(audit.userId);

        // Start audit processing in background
        (async () => {
          try {
            console.log(`[Robokassa] Starting audit processing for auditId=${audit.id}`);
            const aiModeSetting = await storage.getSystemSetting("ai_mode");
            const aiMode = (aiModeSetting?.value as "gigachat_only" | "openai_only" | "hybrid" | "none") || "gigachat_only";

            const report = await runAudit(audit.websiteUrlNormalized!, { level2: true, aiMode });

            await storage.createAuditResult({
              auditId: audit.id,
              criteriaJson: report.criteria || [],
              rknCheckJson: report.rknCheck || null,
              scorePercent: report.scorePercent || 0,
              severity: report.severity || "yellow",
              aiSummary: report.aiSummary || null,
              aiRecommendations: report.aiRecommendations || [],
            });

            await storage.updateAuditStatus(audit.id, "completed");
            console.log(`[Robokassa] Audit ${audit.id} completed`);

            if (user) {
              sendAuditCompletedEmail(user.email, {
                userName: user.name,
                websiteUrl: audit.websiteUrlNormalized!,
                auditId: audit.id,
                severity: report.severity || "yellow",
                scorePercent: report.scorePercent || 0,
              }).catch(err => console.error("[Robokassa] Failed to send email:", err));
            }
          } catch (auditError: any) {
            console.error(`[Robokassa] Audit processing failed:`, auditError?.message || auditError);
            await storage.updateAuditStatus(audit.id, "failed");
          }
        })();
      }

      // Robokassa expects "OK" + InvId response
      res.send(`OK${InvId}`);
    } catch (error: any) {
      console.error("[Robokassa Result] Error:", error?.message || error);
      res.status(500).send("error");
    }
  });

  // GET version for Result URL (some Robokassa configurations use GET)
  app.get("/api/robokassa/result", async (req, res) => {
    try {
      const OutSum = req.query.OutSum as string;
      const InvId = req.query.InvId as string;
      const SignatureValue = req.query.SignatureValue as string;

      console.log(`[Robokassa Result GET] Received: OutSum=${OutSum}, InvId=${InvId}`);

      if (!OutSum || !InvId || !SignatureValue) {
        return res.status(400).send("bad sign");
      }

      const password2 = await storage.getSystemSetting("robokassa_password2");
      if (!password2?.value) {
        return res.status(500).send("configuration error");
      }

      const expectedSignature = crypto
        .createHash("md5")
        .update(`${OutSum}:${InvId}:${password2.value}`)
        .digest("hex")
        .toUpperCase();

      if (SignatureValue.toUpperCase() !== expectedSignature) {
        return res.status(400).send("bad sign");
      }

      const auditId = parseInt(InvId);
      const audit = await storage.getAuditById(auditId);

      if (!audit) {
        return res.status(404).send("audit not found");
      }

      // Check if payment already exists
      const existingPayments = await storage.getPaymentsByAuditId(auditId);
      const hasCompletedPayment = existingPayments.some(p => p.status === "completed");

      if (!hasCompletedPayment) {
        await storage.createPayment({
          userId: audit.userId,
          auditId: audit.id,
          amount: parseFloat(OutSum),
          description: `Robokassa payment #${InvId}`,
          status: "completed",
          yandexPaymentId: `robokassa-${InvId}`,
        });

        if (audit.status === "pending_payment") {
          await storage.updateAuditStatus(audit.id, "processing");
          // Audit processing would be triggered by POST version
        }
      }

      res.send(`OK${InvId}`);
    } catch (error: any) {
      console.error("[Robokassa Result GET] Error:", error?.message || error);
      res.status(500).send("error");
    }
  });

  // Robokassa Success URL (user redirect after successful payment)
  app.get("/api/robokassa/success", async (req, res) => {
    try {
      const InvId = req.query.InvId as string;
      const OutSum = req.query.OutSum as string;

      console.log(`[Robokassa Success] InvId=${InvId}, OutSum=${OutSum}`);

      if (!InvId) {
        return res.redirect("/dashboard?error=missing_inv_id");
      }

      const auditId = parseInt(InvId);
      
      // Redirect to audit details page
      res.redirect(`/dashboard/audits/${auditId}?payment=success`);
    } catch (error: any) {
      console.error("[Robokassa Success] Error:", error?.message || error);
      res.redirect("/dashboard?error=payment_error");
    }
  });

  // Robokassa Fail URL (user redirect after failed/cancelled payment)
  app.get("/api/robokassa/fail", async (req, res) => {
    try {
      const InvId = req.query.InvId as string;
      const OutSum = req.query.OutSum as string;

      console.log(`[Robokassa Fail] InvId=${InvId}, OutSum=${OutSum}`);

      if (InvId) {
        const auditId = parseInt(InvId);
        return res.redirect(`/checkout/${auditId}?payment=failed`);
      }

      res.redirect("/dashboard?error=payment_cancelled");
    } catch (error: any) {
      console.error("[Robokassa Fail] Error:", error?.message || error);
      res.redirect("/dashboard?error=payment_error");
    }
  });

  // =====================================================
  // Admin Settings API (requireSuperAdmin)
  // =====================================================
  const SECRET_KEYS = ["robokassa_password1", "robokassa_password2", "yookassa_secret_key"];

  app.get("/api/admin/settings", requireSuperAdmin, async (req, res) => {
    try {
      const allSettings = await storage.getAllSystemSettings();
      const masked = allSettings.map(s => ({
        ...s,
        value: SECRET_KEYS.includes(s.key) && s.value ? "***" : s.value
      }));
      res.json(masked);
    } catch (error: any) {
      console.error("[Admin Settings GET] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/admin/settings", requireSuperAdmin, async (req, res) => {
    try {
      const { updates } = req.body as { updates: Record<string, any> };
      if (!updates || typeof updates !== "object") {
        return res.status(400).json({ error: "updates object required" });
      }

      for (const [key, value] of Object.entries(updates)) {
        const stringValue = typeof value === "string" ? value : JSON.stringify(value);
        await storage.upsertSystemSetting(key, stringValue);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Admin Settings PUT] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // =====================================================
  // RKN Registry Check Settings (SuperAdmin)
  // =====================================================
  app.get("/api/admin/settings/rkn-registry-check", requireSuperAdmin, async (req, res) => {
    try {
      const enabledSetting = await storage.getSystemSetting("rknRegistryCheckEnabled");
      const priceSetting = await storage.getSystemSetting("rknRegistryCheckPriceRub");
      
      res.json({
        enabled: enabledSetting?.value === "true" || enabledSetting?.value === undefined,
        priceRub: priceSetting?.value ? parseInt(priceSetting.value, 10) : 10,
      });
    } catch (error: any) {
      console.error("[RKN Settings GET] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch RKN settings" });
    }
  });

  app.put("/api/admin/settings/rkn-registry-check", requireSuperAdmin, async (req, res) => {
    try {
      const { enabled, priceRub } = req.body as { enabled?: boolean; priceRub?: number };
      
      if (enabled !== undefined) {
        await storage.upsertSystemSetting("rknRegistryCheckEnabled", String(enabled));
      }
      if (priceRub !== undefined) {
        await storage.upsertSystemSetting("rknRegistryCheckPriceRub", String(priceRub));
      }
      
      const enabledSetting = await storage.getSystemSetting("rknRegistryCheckEnabled");
      const priceSetting = await storage.getSystemSetting("rknRegistryCheckPriceRub");
      
      res.json({
        enabled: enabledSetting?.value === "true",
        priceRub: priceSetting?.value ? parseInt(priceSetting.value, 10) : 10,
      });
    } catch (error: any) {
      console.error("[RKN Settings PUT] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to update RKN settings" });
    }
  });

  // =====================================================
  // SMTP / Email Settings (SuperAdmin)
  // =====================================================
  app.get("/api/admin/settings/email", requireSuperAdmin, async (req, res) => {
    try {
      const { getSmtpStatus } = await import("./email");
      const status = await getSmtpStatus();
      
      // Get settings from DB (never return password)
      const smtpEnabled = await storage.getSystemSetting("smtp_enabled");
      const smtpHost = await storage.getSystemSetting("smtp_host");
      const smtpPort = await storage.getSystemSetting("smtp_port");
      const smtpSecure = await storage.getSystemSetting("smtp_secure");
      const smtpRequireTls = await storage.getSystemSetting("smtp_require_tls");
      const smtpUser = await storage.getSystemSetting("smtp_user");
      const smtpFrom = await storage.getSystemSetting("smtp_from");
      const smtpFromName = await storage.getSystemSetting("smtp_from_name");
      const smtpReplyTo = await storage.getSystemSetting("smtp_reply_to");
      const smtpPass = await storage.getSystemSetting("smtp_pass");
      
      res.json({
        status,
        settings: {
          enabled: smtpEnabled?.value !== "false",
          host: smtpHost?.value || "mail.securelex.ru",
          port: parseInt(smtpPort?.value || "465"),
          secure: smtpSecure?.value !== "false",
          requireTls: smtpRequireTls?.value === "true",
          user: smtpUser?.value || "support@securelex.ru",
          from: smtpFrom?.value || "support@securelex.ru",
          fromName: smtpFromName?.value || "SecureLex",
          replyTo: smtpReplyTo?.value || "",
          hasPassword: !!(smtpPass?.value || process.env.SMTP_PASSWORD),
        },
      });
    } catch (error: any) {
      console.error("[SMTP Settings GET] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch email settings" });
    }
  });

  app.put("/api/admin/settings/email", requireSuperAdmin, async (req, res) => {
    try {
      const { enabled, host, port, secure, requireTls, user, pass, from, fromName, replyTo } = req.body;
      
      // Update settings including password (stored securely in DB)
      if (enabled !== undefined) await storage.upsertSystemSetting("smtp_enabled", String(enabled));
      if (host !== undefined) await storage.upsertSystemSetting("smtp_host", host);
      if (port !== undefined) await storage.upsertSystemSetting("smtp_port", String(port));
      if (secure !== undefined) await storage.upsertSystemSetting("smtp_secure", String(secure));
      if (requireTls !== undefined) await storage.upsertSystemSetting("smtp_require_tls", String(requireTls));
      if (user !== undefined) await storage.upsertSystemSetting("smtp_user", user);
      // Only update password if provided (don't overwrite with empty)
      if (pass && pass.trim()) await storage.upsertSystemSetting("smtp_pass", pass);
      if (from !== undefined) await storage.upsertSystemSetting("smtp_from", from);
      if (fromName !== undefined) await storage.upsertSystemSetting("smtp_from_name", fromName);
      if (replyTo !== undefined) await storage.upsertSystemSetting("smtp_reply_to", replyTo);
      
      // Invalidate cache
      const { invalidateSmtpCache } = await import("./email");
      invalidateSmtpCache();
      
      // Log the action (never log password)
      const userId = req.session.userId!;
      await storage.createAuditLog({
        userId,
        action: "smtp_settings_updated",
        targetType: "system",
        details: { changedBy: userId, passwordUpdated: !!(pass && pass.trim()) },
      });
      
      res.json({ success: true, message: "Настройки SMTP сохранены" });
    } catch (error: any) {
      console.error("[SMTP Settings PUT] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to update email settings" });
    }
  });

  app.post("/api/admin/settings/email/test", requireSuperAdmin, async (req, res) => {
    try {
      const { toEmail } = req.body as { toEmail?: string };
      
      if (!toEmail || !toEmail.includes("@")) {
        return res.status(400).json({ error: "Valid email address required" });
      }
      
      const { getSmtpStatus, isEmailConfigured } = await import("./email");
      const status = await getSmtpStatus();
      
      if (!status.configured) {
        return res.status(400).json({ 
          error: `SMTP not configured: ${status.reason}`,
          status 
        });
      }
      
      // Send test email
      const nodemailer = await import("nodemailer");
      const settings = await storage.getSystemSettings();
      
      const host = settings.find(s => s.key === "smtp_host")?.value || "mail.securelex.ru";
      const port = parseInt(settings.find(s => s.key === "smtp_port")?.value || "465");
      const secure = settings.find(s => s.key === "smtp_secure")?.value !== "false";
      const requireTls = settings.find(s => s.key === "smtp_require_tls")?.value === "true";
      const user = settings.find(s => s.key === "smtp_user")?.value || "support@securelex.ru";
      const from = settings.find(s => s.key === "smtp_from")?.value || "support@securelex.ru";
      const fromName = settings.find(s => s.key === "smtp_from_name")?.value || "SecureLex";
      const pass = settings.find(s => s.key === "smtp_pass")?.value || process.env.SMTP_PASSWORD;
      
      if (!pass) {
        return res.status(400).json({ error: "Пароль SMTP не настроен" });
      }
      
      const transportConfig: any = {
        host,
        port,
        secure,
        auth: { user, pass },
      };
      if (!secure && requireTls) {
        transportConfig.requireTLS = true;
      }
      
      const transporter = nodemailer.default.createTransport(transportConfig);
      
      await transporter.sendMail({
        from: `"${fromName}" <${from}>`,
        to: toEmail,
        subject: "SecureLex SMTP Test",
        text: "This is a test email from SecureLex.ru SMTP configuration.",
        html: `
          <h2>SMTP Test Successful</h2>
          <p>This test email confirms that your SMTP settings are working correctly.</p>
          <p><strong>Host:</strong> ${host}</p>
          <p><strong>Port:</strong> ${port}</p>
          <p><strong>Secure:</strong> ${secure}</p>
          <p><strong>From:</strong> ${from}</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Sent at ${new Date().toISOString()}
          </p>
        `,
      });
      
      res.json({ success: true, message: `Test email sent to ${toEmail}` });
    } catch (error: any) {
      console.error("[SMTP Test] Error:", error?.message || error);
      res.status(500).json({ 
        error: "Failed to send test email",
        details: error?.message || String(error)
      });
    }
  });

  app.post("/api/admin/settings/email/verify", requireSuperAdmin, async (req, res) => {
    try {
      const { getSmtpStatus } = await import("./email");
      const status = await getSmtpStatus();
      
      if (!status.configured) {
        return res.status(400).json({ 
          error: `SMTP не настроен: ${status.reason}`,
          status 
        });
      }
      
      // Verify connection
      const nodemailer = await import("nodemailer");
      const settings = await storage.getSystemSettings();
      
      const host = settings.find(s => s.key === "smtp_host")?.value || "mail.securelex.ru";
      const port = parseInt(settings.find(s => s.key === "smtp_port")?.value || "465");
      const secure = settings.find(s => s.key === "smtp_secure")?.value !== "false";
      const requireTls = settings.find(s => s.key === "smtp_require_tls")?.value === "true";
      const user = settings.find(s => s.key === "smtp_user")?.value || "support@securelex.ru";
      const pass = settings.find(s => s.key === "smtp_pass")?.value || process.env.SMTP_PASSWORD;
      
      if (!pass) {
        return res.status(400).json({ error: "Пароль SMTP не настроен" });
      }
      
      const transportConfig: any = {
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
      };
      if (!secure && requireTls) {
        transportConfig.requireTLS = true;
      }
      
      const transporter = nodemailer.default.createTransport(transportConfig);
      await transporter.verify();
      
      res.json({ success: true, message: "Соединение с SMTP сервером установлено успешно" });
    } catch (error: any) {
      console.error("[SMTP Verify] Error:", error?.message || error);
      res.status(500).json({ 
        error: "Не удалось подключиться к SMTP серверу",
        details: error?.message || String(error)
      });
    }
  });

  // =====================================================
  // SuperAdmin Password Reset for Admin/SuperAdmin Users
  // =====================================================
  app.post("/api/admin/users/:userId/reset-password", requireSuperAdmin, async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.userId, 10);
      const { sendEmail } = req.body as { sendEmail?: boolean };
      
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const targetUser = await storage.getUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only allow resetting admin or superadmin users through this endpoint
      if (targetUser.role !== "admin" && targetUser.role !== "superadmin") {
        return res.status(400).json({ 
          error: "This endpoint is only for admin/superadmin users. Regular users should use public password reset."
        });
      }
      
      console.log(`[ADMIN] Password reset initiated for ${targetUser.role} user: ${maskEmail(targetUser.email)}`);
      
      // Generate new temporary password
      const tempPassword = crypto.randomBytes(8).toString("hex");
      
      // Update password
      await (storage as any).updateUserPassword(targetUserId, tempPassword);
      
      // Clear any existing reset tokens
      await storage.updateUser(targetUserId, {
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetAttempts: 0,
      });
      
      // Log the action
      const adminUserId = req.session.userId!;
      await storage.createAuditLog({
        userId: adminUserId,
        action: "admin_password_reset",
        targetType: "user",
        targetId: targetUserId,
        details: { targetEmail: targetUser.email, targetRole: targetUser.role },
      });
      
      // Optionally send email with reset link (not temp password for security)
      let emailSent = false;
      if (sendEmail) {
        const emailConfigured = await isEmailConfigured();
        if (emailConfigured) {
          const resetToken = generateSecureToken();
          const resetTokenHash = hashToken(resetToken);
          const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
          
          await storage.updateUser(targetUserId, {
            passwordResetTokenHash: resetTokenHash,
            passwordResetTokenExpiresAt: expiresAt,
          });
          
          const siteUrl = process.env.SITE_URL || "https://securelex.ru";
          const resetLink = `${siteUrl}/reset-password?token=${resetToken}`;
          
          emailSent = await sendPasswordResetEmail(targetUser.email, resetLink, targetUser.name);
          
          if (emailSent) {
            console.log(`[ADMIN] Password reset email sent`);
          }
        }
      }
      
      res.json({ 
        success: true, 
        tempPassword, // Return temp password for SuperAdmin to communicate securely
        emailSent,
        message: `Password reset for ${targetUser.email}. ${emailSent ? "Reset link sent via email." : "Temp password provided."}`
      });
    } catch (error: any) {
      console.error("[ADMIN] Password reset error:", error?.message || error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // =====================================================
  // RKN Registry Check Endpoint (Public - with payment gating)
  // =====================================================
  app.post("/api/rkn/registry-check", async (req, res) => {
    try {
      const { inn, name } = req.body as { inn?: string; name?: string };
      
      if (!inn && !name) {
        return res.status(400).json({ error: "Необходимо указать ИНН или наименование организации" });
      }
      
      // Check if feature is enabled (default to true if not set)
      const enabledSetting = await storage.getSystemSetting("rknRegistryCheckEnabled");
      const isEnabled = enabledSetting?.value !== "false";
      if (!isEnabled) {
        return res.status(503).json({ error: "Сервис временно недоступен" });
      }
      
      // For now, return needs_manual response since reliable RKN scraping
      // would require external API or complex implementation
      // This is honest - we don't fake results
      res.json({
        found: null,
        status: "needs_manual",
        message: "Для точной проверки рекомендуем использовать официальный реестр РКН: pd.rkn.gov.ru",
        searchParams: { inn, name },
        officialRegistryUrl: "https://pd.rkn.gov.ru/operators-registry/operators-list/",
      });
    } catch (error: any) {
      console.error("[RKN Check] Error:", error?.message || error);
      res.status(500).json({ error: "Ошибка при проверке реестра" });
    }
  });

  // =====================================================
  // PDN User Endpoints (requireAuth)
  // =====================================================
  app.get("/api/me/pdn-status", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const status = await storage.getPdnStatus(userId);
      res.json(status);
    } catch (error: any) {
      console.error("[PDN Status] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to get PDN status" });
    }
  });

  app.post("/api/me/withdraw-pdn-consent", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const ip = req.ip || req.socket.remoteAddress || null;
      const userAgent = req.headers["user-agent"] || null;

      const docVersionSetting = await storage.getSystemSetting("pdn_consent_document_version");
      const docVersion = docVersionSetting?.value || "1.0";

      // Record withdrawal event
      await storage.createPdnConsentEvent({
        userId,
        eventType: "WITHDRAWN",
        documentVersion: docVersion,
        ip,
        userAgent,
        source: "lk",
        meta: {}
      });

      // Schedule destruction in 30 days per 152-ФЗ ст.21 п.5
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 30);

      await storage.createPdnDestructionTask({
        userId,
        status: "SCHEDULED",
        scheduledAt,
        meta: {}
      });

      // Destroy session (logout)
      req.session.destroy((err) => {
        if (err) {
          console.error("[PDN Withdraw] Session destroy error:", err);
        }
      });

      res.json({ 
        success: true, 
        scheduledDestructionAt: scheduledAt.toISOString() 
      });
    } catch (error: any) {
      console.error("[PDN Withdraw] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to withdraw consent" });
    }
  });

  // =====================================================
  // Service Configs Admin Endpoints (requireSuperAdmin)
  // =====================================================
  app.get("/api/admin/services", requireSuperAdmin, async (req, res) => {
    try {
      const services = await storage.getAllServiceConfigs();
      res.json({ success: true, services });
    } catch (error: any) {
      console.error("[Admin Services GET] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.put("/api/admin/services/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid service ID" });
      }
      const { displayName, description, basePrice, isEnabled, config } = req.body;
      const updated = await storage.updateServiceConfig(id, {
        displayName,
        description,
        basePrice,
        isEnabled,
        config
      });
      if (!updated) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json({ success: true, service: updated });
    } catch (error: any) {
      console.error("[Admin Services PUT] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  // =====================================================
  // Tool Configs Admin Endpoints (requireSuperAdmin)
  // =====================================================
  app.get("/api/admin/tools", requireSuperAdmin, async (req, res) => {
    try {
      const tools = await storage.getAllToolConfigs();
      res.json({ success: true, tools });
    } catch (error: any) {
      console.error("[Admin Tools GET] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch tools" });
    }
  });

  app.patch("/api/admin/tools/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid tool ID" });
      }
      const { displayName, description, price, isFree, isEnabled } = req.body;
      const updated = await storage.updateToolConfig(id, {
        displayName,
        description,
        price,
        isFree,
        isEnabled
      });
      if (!updated) {
        return res.status(404).json({ error: "Tool not found" });
      }
      res.json({ success: true, tool: updated });
    } catch (error: any) {
      console.error("[Admin Tools PATCH] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to update tool" });
    }
  });

  app.patch("/api/admin/tools/:id/toggle", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid tool ID" });
      }
      const { isEnabled } = req.body;
      const updated = await storage.updateToolConfig(id, { isEnabled });
      if (!updated) {
        return res.status(404).json({ error: "Tool not found" });
      }
      res.json({ success: true, tool: updated });
    } catch (error: any) {
      console.error("[Admin Tools Toggle] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to toggle tool" });
    }
  });

  // =====================================================
  // PDN Admin Endpoints (requireSuperAdmin)
  // =====================================================
  app.get("/api/admin/pdn/consents", requireSuperAdmin, async (req, res) => {
    try {
      const consents = await storage.getPdnConsentsWithUsers(500);
      res.json(consents);
    } catch (error: any) {
      console.error("[PDN Consents] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch consents" });
    }
  });

  app.get("/api/admin/pdn/withdrawals", requireSuperAdmin, async (req, res) => {
    try {
      const events = await storage.getPdnWithdrawals(200);
      res.json(events);
    } catch (error: any) {
      console.error("[PDN Withdrawals] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch withdrawals" });
    }
  });

  app.get("/api/admin/pdn/destruction-tasks", requireSuperAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const tasks = await storage.getPdnDestructionTasks(status);
      res.json(tasks);
    } catch (error: any) {
      console.error("[PDN Tasks] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/admin/pdn/destruction-tasks/:id/legal-hold", requireSuperAdmin, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { reason } = req.body as { reason: string };
      
      if (!reason) {
        return res.status(400).json({ error: "reason required" });
      }

      await storage.setPdnTaskLegalHold(taskId, reason);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[PDN Legal Hold] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to set legal hold" });
    }
  });

  app.post("/api/admin/pdn/destruction-tasks/:id/release-hold", requireSuperAdmin, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      await storage.releasePdnTaskLegalHold(taskId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[PDN Release Hold] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to release legal hold" });
    }
  });

  app.post("/api/admin/pdn/destruction-tasks/:id/run-now", requireSuperAdmin, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const operatorUserId = req.session.userId!;
      
      const result = await storage.executePdnDestruction(taskId, operatorUserId);
      res.json(result);
    } catch (error: any) {
      console.error("[PDN Run Now] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to execute destruction" });
    }
  });

  // =====================================================
  // Free Express Limit Endpoints
  // =====================================================
  app.get("/api/public/express-limit-status", async (req, res) => {
    try {
      const userId = req.session.userId;
      const ip = req.ip || req.socket.remoteAddress || "";
      const userAgent = req.headers["user-agent"] || "";
      
      const status = await storage.getExpressLimitStatus(userId, ip, userAgent);
      res.json(status);
    } catch (error: any) {
      console.error("[Express Limit Status] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to get limit status" });
    }
  });

  // =====================================================
  // SEO Pages Public Endpoint
  // =====================================================
  app.get("/api/public/seo/:slug", async (req, res) => {
    try {
      const page = await storage.getSeoPageBySlug(req.params.slug);
      if (!page || !page.isActive) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.json(page);
    } catch (error: any) {
      console.error("[SEO Page] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch page" });
    }
  });

  // =====================================================
  // SEO Pages Admin CRUD
  // =====================================================
  app.get("/api/admin/seo-pages", requireSuperAdmin, async (req, res) => {
    try {
      const pages = await storage.getAllSeoPages();
      res.json(pages);
    } catch (error: any) {
      console.error("[SEO Pages List] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  app.post("/api/admin/seo-pages", requireSuperAdmin, async (req, res) => {
    try {
      const page = await storage.createSeoPage(req.body);
      res.json(page);
    } catch (error: any) {
      console.error("[SEO Page Create] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to create page" });
    }
  });

  app.put("/api/admin/seo-pages/:id", requireSuperAdmin, async (req, res) => {
    try {
      const pageId = parseInt(req.params.id);
      const page = await storage.updateSeoPage(pageId, req.body);
      res.json(page);
    } catch (error: any) {
      console.error("[SEO Page Update] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to update page" });
    }
  });

  app.delete("/api/admin/seo-pages/:id", requireSuperAdmin, async (req, res) => {
    try {
      const pageId = parseInt(req.params.id);
      await storage.softDeleteSeoPage(pageId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SEO Page Delete] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to delete page" });
    }
  });

  // =====================================================
  // Sitemap and Robots.txt
  // =====================================================
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = await storage.getSystemSetting("seo_canonical_base_url") || "https://securelex.ru";
      const seoPages = await storage.getAllSeoPages();
      const activePages = seoPages.filter(p => p.isActive);

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      // Static pages
      const staticPages = [
        { loc: "/", priority: "1.0" },
        { loc: "/user-agreement", priority: "0.5" },
        { loc: "/personal-data-consent", priority: "0.5" },
      ];
      
      for (const page of staticPages) {
        xml += `  <url><loc>${baseUrl}${page.loc}</loc><priority>${page.priority}</priority></url>\n`;
      }
      
      // Dynamic SEO pages
      for (const page of activePages) {
        xml += `  <url><loc>${baseUrl}/seo/${page.slug}</loc><priority>0.7</priority></url>\n`;
      }
      
      xml += '</urlset>';
      
      res.type("application/xml").send(xml);
    } catch (error: any) {
      console.error("[Sitemap] Error:", error?.message || error);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", async (req, res) => {
    try {
      const robotsSetting = await storage.getSystemSetting("seo_robots_txt");
      const robotsTxt = robotsSetting?.value || "User-agent: *\nAllow: /\nSitemap: https://securelex.ru/sitemap.xml";
      res.type("text/plain").send(robotsTxt);
    } catch (error: any) {
      console.error("[Robots.txt] Error:", error?.message || error);
      res.type("text/plain").send("User-agent: *\nAllow: /");
    }
  });

  // =====================================================
  // PDN Consent Recording for Checkout (called from frontend)
  // =====================================================
  app.post("/api/pdn-consent", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const ip = req.ip || req.socket.remoteAddress || null;
      const userAgent = req.headers["user-agent"] || null;
      const { source } = req.body as { source: string };

      const docVersionSetting = await storage.getSystemSetting("pdn_consent_document_version");
      const docVersion = docVersionSetting?.value || "1.0";

      await storage.createPdnConsentEvent({
        userId,
        eventType: "GIVEN",
        documentVersion: docVersion,
        ip,
        userAgent,
        source: source || "checkout",
        meta: {}
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[PDN Consent] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to record consent" });
    }
  });

  // =====================================================
  // Tools: WHOIS Lookup (Фаза D)
  // =====================================================
  app.post("/api/tools/whois-lookup", async (req, res) => {
    try {
      const { domain } = req.body as { domain: string };
      
      if (!domain || typeof domain !== "string") {
        return res.status(400).json({ error: "Не указан домен" });
      }
      
      const { checkDnsWhoisOwnership } = await import("./checks/dnsWhoisOwnership");
      const result = await checkDnsWhoisOwnership(domain);
      
      res.json(result);
    } catch (error: any) {
      console.error("[WHOIS Lookup] Error:", error?.message || error);
      res.status(500).json({ 
        error: "Ошибка при проверке WHOIS",
        status: "unavailable",
        evidence: [],
        limitations: [error?.message || "Неизвестная ошибка"]
      });
    }
  });

  // =====================================================
  // Tools: Consent Generator (Фаза E)
  // =====================================================
  app.post("/api/tools/consent-generator", async (req, res) => {
    try {
      const { 
        validateConsent152, 
        generateConsentText, 
        generateCheckboxHtml, 
        generateConsentJs 
      } = await import("./legal/consent152Validator");
      
      const input = req.body;
      
      if (!input.mode) {
        input.mode = "website_checkbox";
      }
      
      const validation = validateConsent152(input);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          isValid: false,
          issues: validation.issues,
          message: "Обязательные поля не заполнены. Исправьте ошибки и повторите запрос.",
        });
      }
      
      const consentText = generateConsentText(input);
      const checkboxHtml = input.mode === "website_checkbox" ? generateCheckboxHtml(input) : null;
      const consentJs = input.mode === "website_checkbox" ? generateConsentJs() : null;
      
      res.json({
        success: true,
        isValid: true,
        hasWarnings: validation.hasWarnings,
        issues: validation.issues.filter(i => i.severity === "warn"),
        consentText,
        checkboxHtml,
        consentJs,
      });
    } catch (error: any) {
      console.error("[Consent Generator] Error:", error?.message || error);
      res.status(500).json({ 
        success: false,
        error: "Ошибка при генерации согласия",
        message: error?.message || "Неизвестная ошибка"
      });
    }
  });

  // =====================================================
  // Tools: 149-FZ Check (Фаза F)
  // =====================================================
  app.post("/api/tools/info149-check", async (req, res) => {
    try {
      const { url } = req.body as { url: string };
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Не указан URL сайта" });
      }
      
      const { runInfo149Checks } = await import("./legal/info149Checks");
      const { fetchWebsite } = await import("./audit-engine");
      
      const websiteData = await fetchWebsite(url);
      
      if (!websiteData.html || websiteData.error) {
        return res.status(400).json({ 
          error: websiteData.error || "Не удалось получить HTML страницы",
          checks: [],
          summary: { total: 0, ok: 0, warn: 0, fail: 0, na: 0 }
        });
      }
      
      const result = runInfo149Checks({ html: websiteData.html, url });
      
      res.json(result);
    } catch (error: any) {
      console.error("[149-FZ Check] Error:", error?.message || error);
      res.status(500).json({ 
        error: "Ошибка при проверке по 149-ФЗ",
        message: error?.message || "Неизвестная ошибка"
      });
    }
  });

  // =====================================================
  // Consent Event Recording (public, for JS snippet)
  // =====================================================
  app.post("/api/consent/record", async (req, res) => {
    try {
      const { timestamp, consentVersionHash, pageUrl, userAgent, screenResolution } = req.body;
      
      const ip = req.ip || req.socket.remoteAddress || null;
      const maskedIp = ip ? ip.replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.xxx.xxx") : null;
      
      console.log("[Consent Record] Recorded consent:", {
        timestamp,
        consentVersionHash,
        pageUrl,
        maskedIp,
        screenResolution,
      });
      
      res.json({ success: true, recorded: true });
    } catch (error: any) {
      console.error("[Consent Record] Error:", error?.message || error);
      res.status(500).json({ success: false, error: "Failed to record consent" });
    }
  });

  // =====================================================
  // Guide Справочник - Public API (v2 - hierarchical)
  // =====================================================

  // Get guide home data with sections and counters
  app.get("/api/guide/home", async (req, res) => {
    try {
      const data = await storage.getGuideHomeData();
      res.json(data);
    } catch (error: any) {
      console.error("[Guide] Error fetching home data:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки справочника" });
    }
  });

  // Search guide (articles, topics, sections)
  app.get("/api/guide/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const limit = parseInt(req.query.limit as string) || 10;
      const results = await storage.searchGuide(query, limit);
      res.json(results);
    } catch (error: any) {
      console.error("[Guide] Error searching:", error?.message);
      res.status(500).json({ error: "Ошибка поиска" });
    }
  });

  // Get section with topics
  app.get("/api/guide/sections/:sectionSlug", async (req, res) => {
    try {
      const { sectionSlug } = req.params;
      const section = await storage.getGuideSectionBySlug(sectionSlug);
      if (!section || !section.isPublished) {
        return res.status(404).json({ error: "Раздел не найден" });
      }
      
      const topics = await storage.getGuideTopics(section.id, true);
      const topicsWithCounts = await Promise.all(
        topics.map(async (topic) => {
          const articles = await storage.getGuideArticlesByTopic(topic.id, true);
          return { ...topic, articlesCount: articles.length };
        })
      );
      
      res.json({ section, topics: topicsWithCounts });
    } catch (error: any) {
      console.error("[Guide] Error fetching section:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки раздела" });
    }
  });

  // Get topic with articles
  app.get("/api/guide/topics/:topicSlug", async (req, res) => {
    try {
      const { topicSlug } = req.params;
      const topic = await storage.getGuideTopicBySlug(topicSlug);
      if (!topic || !topic.isPublished) {
        return res.status(404).json({ error: "Тема не найдена" });
      }
      
      const section = await storage.getGuideSectionById(topic.sectionId);
      const articles = await storage.getGuideArticlesByTopic(topic.id, true);
      
      res.json({ 
        topic, 
        section: section ? { slug: section.slug, title: section.title } : null,
        articles 
      });
    } catch (error: any) {
      console.error("[Guide] Error fetching topic:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки темы" });
    }
  });

  // Get article with breadcrumbs
  app.get("/api/guide/article/:articleSlug", async (req, res) => {
    try {
      const { articleSlug } = req.params;
      const article = await storage.getGuideArticleBySlug(articleSlug);
      if (!article || article.status !== "published") {
        return res.status(404).json({ error: "Статья не найдена" });
      }
      
      let breadcrumbs = { section: null as any, topic: null as any };
      if (article.topicId) {
        const topic = await storage.getGuideTopicById(article.topicId);
        if (topic) {
          const section = await storage.getGuideSectionById(topic.sectionId);
          breadcrumbs = {
            section: section ? { slug: section.slug, title: section.title } : null,
            topic: { slug: topic.slug, title: topic.title }
          };
        }
      }
      
      res.json({ article, breadcrumbs });
    } catch (error: any) {
      console.error("[Guide] Error fetching article:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки статьи" });
    }
  });

  // =====================================================
  // Guide Справочник - Public API (legacy)
  // =====================================================
  
  // Get published articles (public)
  app.get("/api/guide/articles", async (req, res) => {
    try {
      const articles = await storage.getGuideArticles("published");
      res.json(articles);
    } catch (error: any) {
      console.error("[Guide] Error fetching articles:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки статей" });
    }
  });

  // Get single article by slug (public)
  app.get("/api/guide/articles/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const article = await storage.getGuideArticleBySlug(slug);
      if (!article || article.status !== "published") {
        return res.status(404).json({ error: "Статья не найдена" });
      }
      res.json(article);
    } catch (error: any) {
      console.error("[Guide] Error fetching article:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки статьи" });
    }
  });

  // Get guide settings (public)
  app.get("/api/guide/settings", async (req, res) => {
    try {
      const settings = await storage.getGuideSettings();
      res.json(settings || { featuredSlugs: [], topicsOrder: [], enableIndexing: true });
    } catch (error: any) {
      console.error("[Guide] Error fetching settings:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки настроек" });
    }
  });

  // Record analytics event (public)
  app.post("/api/guide/event", async (req, res) => {
    try {
      const { visitorId, slug, mode, eventType, eventValue } = req.body;
      if (!slug || !eventType) {
        return res.status(400).json({ error: "Slug and eventType required" });
      }
      await storage.createGuideEvent({ visitorId, slug, mode, eventType, eventValue });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Guide] Error recording event:", error?.message);
      res.status(500).json({ error: "Ошибка записи события" });
    }
  });

  // =====================================================
  // Guide Справочник - Admin API
  // =====================================================
  
  // Get all articles (admin)
  app.get("/api/admin/guide/articles", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const articles = await storage.getGuideArticles(status);
      res.json(articles);
    } catch (error: any) {
      console.error("[Guide Admin] Error fetching articles:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки статей" });
    }
  });

  // Get single article by ID (admin)
  app.get("/api/admin/guide/articles/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const article = await storage.getGuideArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Статья не найдена" });
      }
      res.json(article);
    } catch (error: any) {
      console.error("[Guide Admin] Error fetching article:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки статьи" });
    }
  });

  // Create article (admin)
  app.post("/api/admin/guide/articles", requireAdmin, async (req, res) => {
    try {
      const article = await storage.createGuideArticle(req.body);
      res.json(article);
    } catch (error: any) {
      console.error("[Guide Admin] Error creating article:", error?.message);
      res.status(500).json({ error: "Ошибка создания статьи" });
    }
  });

  // Update article (admin)
  app.patch("/api/admin/guide/articles/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const article = await storage.updateGuideArticle(id, req.body);
      if (!article) {
        return res.status(404).json({ error: "Статья не найдена" });
      }
      res.json(article);
    } catch (error: any) {
      console.error("[Guide Admin] Error updating article:", error?.message);
      res.status(500).json({ error: "Ошибка обновления статьи" });
    }
  });

  // Delete article (admin)
  app.delete("/api/admin/guide/articles/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteGuideArticle(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Guide Admin] Error deleting article:", error?.message);
      res.status(500).json({ error: "Ошибка удаления статьи" });
    }
  });

  // Publish article (admin)
  app.post("/api/admin/guide/articles/:id/publish", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const article = await storage.publishGuideArticle(id);
      if (!article) {
        return res.status(404).json({ error: "Статья не найдена" });
      }
      res.json(article);
    } catch (error: any) {
      console.error("[Guide Admin] Error publishing article:", error?.message);
      res.status(500).json({ error: "Ошибка публикации статьи" });
    }
  });

  // Unpublish article (admin)
  app.post("/api/admin/guide/articles/:id/unpublish", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const article = await storage.unpublishGuideArticle(id);
      if (!article) {
        return res.status(404).json({ error: "Статья не найдена" });
      }
      res.json(article);
    } catch (error: any) {
      console.error("[Guide Admin] Error unpublishing article:", error?.message);
      res.status(500).json({ error: "Ошибка снятия с публикации" });
    }
  });

  // Get guide stats (admin)
  app.get("/api/admin/guide/stats", requireAdmin, async (req, res) => {
    try {
      const slug = req.query.slug as string | undefined;
      const stats = await storage.getGuideStats(slug);
      res.json(stats);
    } catch (error: any) {
      console.error("[Guide Admin] Error fetching stats:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки статистики" });
    }
  });

  // Get guide settings (admin)
  app.get("/api/admin/guide/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getGuideSettings();
      res.json(settings || { featuredSlugs: [], topicsOrder: [], enableIndexing: true });
    } catch (error: any) {
      console.error("[Guide Admin] Error fetching settings:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки настроек" });
    }
  });

  // Update guide settings (admin)
  app.patch("/api/admin/guide/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.updateGuideSettings(req.body);
      res.json(settings);
    } catch (error: any) {
      console.error("[Guide Admin] Error updating settings:", error?.message);
      res.status(500).json({ error: "Ошибка обновления настроек" });
    }
  });

  // Import articles from markdown pack (admin)
  app.post("/api/admin/guide/import", requireAdmin, async (req, res) => {
    try {
      const { articles } = req.body as { articles: any[] };
      if (!Array.isArray(articles)) {
        return res.status(400).json({ error: "Ожидается массив статей" });
      }
      const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] };
      
      for (const articleData of articles) {
        try {
          await storage.createGuideArticle(articleData);
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`${articleData.slug}: ${err.message}`);
        }
      }
      
      res.json(results);
    } catch (error: any) {
      console.error("[Guide Admin] Error importing articles:", error?.message);
      res.status(500).json({ error: "Ошибка импорта статей" });
    }
  });

  // =====================================================
  // Guide Home Config - SuperAdmin API
  // =====================================================

  // Get guide home config (superadmin)
  app.get("/api/admin/guide/home-config", requireSuperAdmin, async (req, res) => {
    try {
      const configStr = await storage.getSystemSetting("guide.home");
      const sections = await storage.getGuideSections();
      const config = configStr ? JSON.parse(configStr as string) : null;
      res.json({ config, sections });
    } catch (error: any) {
      console.error("[Guide Admin] Error fetching home config:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки конфигурации" });
    }
  });

  // Update guide home config (superadmin)
  app.put("/api/admin/guide/home-config", requireSuperAdmin, async (req, res) => {
    try {
      const { sections } = req.body as { 
        sections: Array<{ 
          slug: string; 
          enabled: boolean; 
          order: number;
          titleOverride?: string | null;
          descriptionOverride?: string | null;
          iconOverride?: string | null;
        }> 
      };
      
      if (!Array.isArray(sections)) {
        return res.status(400).json({ error: "Ожидается массив секций" });
      }
      
      const config = { sections };
      await storage.upsertSystemSetting("guide.home", JSON.stringify(config));
      res.json({ success: true, config });
    } catch (error: any) {
      console.error("[Guide Admin] Error updating home config:", error?.message);
      res.status(500).json({ error: "Ошибка обновления конфигурации" });
    }
  });

  // Get all sections (superadmin)
  app.get("/api/admin/guide/sections", requireSuperAdmin, async (req, res) => {
    try {
      const sections = await storage.getGuideSections();
      res.json(sections);
    } catch (error: any) {
      console.error("[Guide Admin] Error fetching sections:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки разделов" });
    }
  });

  // Update section (superadmin)
  app.patch("/api/admin/guide/sections/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const section = await storage.updateGuideSection(id, req.body);
      if (!section) {
        return res.status(404).json({ error: "Раздел не найден" });
      }
      res.json(section);
    } catch (error: any) {
      console.error("[Guide Admin] Error updating section:", error?.message);
      res.status(500).json({ error: "Ошибка обновления раздела" });
    }
  });

  // Get all topics (superadmin)
  app.get("/api/admin/guide/topics", requireSuperAdmin, async (req, res) => {
    try {
      const sectionId = req.query.sectionId ? parseInt(req.query.sectionId as string) : undefined;
      const topics = await storage.getGuideTopics(sectionId);
      res.json(topics);
    } catch (error: any) {
      console.error("[Guide Admin] Error fetching topics:", error?.message);
      res.status(500).json({ error: "Ошибка загрузки тем" });
    }
  });

  // Create topic (superadmin)
  app.post("/api/admin/guide/topics", requireSuperAdmin, async (req, res) => {
    try {
      const topic = await storage.createGuideTopic(req.body);
      res.json(topic);
    } catch (error: any) {
      console.error("[Guide Admin] Error creating topic:", error?.message);
      res.status(500).json({ error: "Ошибка создания темы" });
    }
  });

  // Update topic (superadmin)
  app.patch("/api/admin/guide/topics/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const topic = await storage.updateGuideTopic(id, req.body);
      if (!topic) {
        return res.status(404).json({ error: "Тема не найдена" });
      }
      res.json(topic);
    } catch (error: any) {
      console.error("[Guide Admin] Error updating topic:", error?.message);
      res.status(500).json({ error: "Ошибка обновления темы" });
    }
  });

  // Delete topic (superadmin)
  app.delete("/api/admin/guide/topics/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteGuideTopic(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Guide Admin] Error deleting topic:", error?.message);
      res.status(500).json({ error: "Ошибка удаления темы" });
    }
  });

  return httpServer;
}
