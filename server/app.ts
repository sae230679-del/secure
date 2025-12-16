import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";

export const app = express();
export const httpServer = createServer(app);

app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && !isTest) {
  console.error("[CONFIG] SESSION_SECRET is not set.");
  if (isProduction) {
    console.error("[CONFIG] WARNING: Running in PRODUCTION without SESSION_SECRET - using fallback");
  }
}

const allowedOrigins = [
  "https://securelex.ru",
  "https://www.securelex.ru",
  process.env.REPLIT_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.endsWith('.replit.app') || origin.endsWith('.repl.co')) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProduction) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

if (!isTest) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const PgSession = connectPgSimple(session);

if (!isTest) {
  console.log(`[CONFIG] Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
}

let allowInsecureLocalhost = process.env.ALLOW_INSECURE_LOCALHOST_COOKIES === "true" || isTest;
if (isProduction && process.env.ALLOW_INSECURE_LOCALHOST_COOKIES === "true") {
  console.error("[CONFIG] WARNING: ALLOW_INSECURE_LOCALHOST_COOKIES is set in production, ignoring.");
  allowInsecureLocalhost = false;
}

const cookieSecure = allowInsecureLocalhost ? false : true;
const cookieSameSite = allowInsecureLocalhost ? "lax" as const : "none" as const;

if (!isTest) {
  console.log(`[CONFIG] Cookie settings: sameSite=${cookieSameSite}, secure=${cookieSecure}, insecureLocalhost=${allowInsecureLocalhost}`);
}

const sessionStore = new PgSession({
  pool,
  tableName: "session",
  createTableIfMissing: true,
  errorLog: isTest ? () => {} : (err) => console.error('[SESSION STORE ERROR]', err),
});

if (!isTest) {
  sessionStore.on('error', (err) => {
    console.error('[SESSION STORE] Connection error:', err);
  });
}

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret || "securelex-dev-secret-key",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: cookieSameSite,
      secure: cookieSecure,
    },
  })
);

export function log(message: string, source = "express") {
  if (isTest) return;
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

if (!isTest) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        log(logLine);
      }
    });

    next();
  });
}

export async function runPdnDestructionJob() {
  try {
    const tasks = await storage.getScheduledDestructionTasks();
    if (tasks.length === 0) {
      if (!isTest) console.log("[PDN Job] No scheduled tasks ready for destruction.");
      return { processed: 0 };
    }

    if (!isTest) console.log(`[PDN Job] Found ${tasks.length} tasks ready for destruction.`);
    
    let processed = 0;
    for (const task of tasks) {
      if (task.status !== "SCHEDULED") continue;
      
      if (!isTest) console.log(`[PDN Job] Processing task ${task.id} for user ${task.userId}`);
      const result = await storage.executePdnDestruction(task.id, 0);
      if (result.success) {
        processed++;
        if (!isTest) console.log(`[PDN Job] Task ${task.id} completed. Act ID: ${result.actId}`);
      } else {
        if (!isTest) console.log(`[PDN Job] Task ${task.id} skipped (status: ${task.status})`);
      }
    }
    return { processed };
  } catch (error: any) {
    if (!isTest) console.error("[PDN Job] Error:", error?.message || error);
    throw error;
  }
}

let appInitialized = false;

export async function initializeApp() {
  if (appInitialized) return;
  appInitialized = true;
  
  await storage.ensureSuperAdmin();
  await storage.seedServicesAndTools();
  await storage.seedGuideSections();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    if (!isTest) throw err;
  });
}
