import { chromium, Browser, Page } from "playwright";
import { execSync } from "child_process";

let browserInstance: Browser | null = null;

function findChromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }
  
  try {
    const whichResult = execSync("which chromium 2>/dev/null", { encoding: "utf8" }).trim();
    if (whichResult) return whichResult;
  } catch {}
  
  try {
    const nixPath = execSync("find /nix/store -name chromium -type f -executable 2>/dev/null | head -1", { encoding: "utf8" }).trim();
    if (nixPath) return nixPath;
  } catch {}
  
  return undefined;
}

async function getBrowser(): Promise<Browser | null> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  
  const chromiumPath = findChromiumPath();
  console.log(`[Playwright] Using Chromium at: ${chromiumPath || "default"}`);
  
  try {
    const launchOptions: any = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
      ],
    };
    
    if (chromiumPath) {
      launchOptions.executablePath = chromiumPath;
    }
    
    browserInstance = await chromium.launch(launchOptions);
    return browserInstance;
  } catch (error) {
    console.error("[Playwright] Failed to launch browser:", error);
    return null;
  }
}

export interface RenderedPage {
  html: string;
  statusCode: number;
  error?: string;
}

export async function fetchRenderedPage(url: string, timeout = 30000): Promise<RenderedPage> {
  const browser = await getBrowser();
  
  if (!browser) {
    return {
      html: "",
      statusCode: 0,
      error: "Browser not available",
    };
  }
  
  let page: Page | null = null;
  
  try {
    page = await browser.newPage();
    
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    });
    
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout,
    });
    
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    const statusCode = response?.status() || 200;
    
    return {
      html,
      statusCode,
    };
  } catch (error: any) {
    console.error("[Playwright] Fetch error:", error.message);
    return {
      html: "",
      statusCode: 0,
      error: error.message,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}
