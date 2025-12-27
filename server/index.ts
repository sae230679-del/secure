import { app, httpServer, initializeApp, runPdnDestructionJob, log } from "./app";
import { serveStatic } from "./static";
import { runNoSimulationGuard } from "./policy/noSimulationGuard";

// Health check endpoints are now in app.ts to ensure they're first in middleware stack

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
      }
    },
  );
})();
