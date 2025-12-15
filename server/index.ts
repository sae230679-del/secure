import { app, httpServer, initializeApp, runPdnDestructionJob, log } from "./app";
import { serveStatic } from "./static";

(async () => {
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
