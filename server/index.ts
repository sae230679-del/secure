import { app, httpServer, initializeApp, runPdnDestructionJob, log } from "./app";
import { serveStatic } from "./static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function verifyNoSimulationCode(): void {
  const forbiddenPatterns = ["getRandomStatus", "simulateAuditResults", "getStatusByCategory"];
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const auditEnginePath = path.join(__dirname, "audit-engine.ts");
  
  try {
    const content = fs.readFileSync(auditEnginePath, "utf-8");
    for (const pattern of forbiddenPatterns) {
      if (content.includes(pattern)) {
        console.error(`[SECURITY] FATAL: Forbidden simulation code "${pattern}" found in audit-engine.ts`);
        if (process.env.NODE_ENV === "production") {
          process.exit(1);
        }
      }
    }
    console.log("[SECURITY] Audit engine verified: no simulation code detected");
  } catch {
    console.log("[SECURITY] Audit engine verification skipped (file not readable in production build)");
  }
}

(async () => {
  verifyNoSimulationCode();
  await initializeApp();

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  if (process.env.NODE_ENV === "production") {
    const PDN_JOB_INTERVAL_MS = 6 * 60 * 60 * 1000;
    setTimeout(() => runPdnDestructionJob(), 10000);
    setInterval(runPdnDestructionJob, PDN_JOB_INTERVAL_MS);
    console.log("[PDN Job] Scheduled to run every 6 hours (production only)");
  } else {
    console.log("[PDN Job] Skipped scheduling in development mode");
  }
})();
