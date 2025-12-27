import { app, httpServer, initializeApp, runPdnDestructionJob, log } from "./app";
import { serveStatic } from "./static";
import { runNoSimulationGuard } from "./policy/noSimulationGuard";

// Health check endpoint - responds immediately even during initialization
let appReady = false;
app.get("/health", (_req, res) => {
  if (appReady) {
    res.status(200).json({ status: "ok", ready: true });
  } else {
    res.status(200).json({ status: "starting", ready: false });
  }
});

// Also add a simple root health check for Cloud Run
app.get("/_health", (_req, res) => {
  res.status(200).send("OK");
});

(async () => {
  const port = parseInt(process.env.PORT || "5000", 10);
  
  // Start listening IMMEDIATELY before any heavy initialization
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);
      
      // Now run heavy initialization after server is listening
      try {
        // Run simulation guard check (deferred)
        if (process.env.NODE_ENV === "production") {
          setImmediate(() => runNoSimulationGuard());
        } else {
          runNoSimulationGuard();
        }
        
        // Initialize app (database seeding, routes)
        await initializeApp();

        if (process.env.NODE_ENV === "production") {
          serveStatic(app);
        } else {
          const { setupVite } = await import("./vite");
          await setupVite(httpServer, app);
        }
        
        // Mark app as ready after initialization
        appReady = true;
        log("Application fully initialized");

        if (process.env.NODE_ENV === "production") {
          const PDN_JOB_INTERVAL_MS = 6 * 60 * 60 * 1000;
          setTimeout(() => runPdnDestructionJob(), 10000);
          setInterval(runPdnDestructionJob, PDN_JOB_INTERVAL_MS);
          console.log("[PDN Job] Scheduled to run every 6 hours (production only)");
        } else {
          console.log("[PDN Job] Skipped scheduling in development mode");
        }
      } catch (error) {
        console.error("[INIT ERROR]", error);
        appReady = false;
      }
    },
  );
})();
