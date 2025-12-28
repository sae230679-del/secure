import * as cheerio from "cheerio";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const RKN_REGISTRY_URL = "https://pd.rkn.gov.ru/operators-registry/operators-list/";
const CACHE_TTL_HOURS = 24;

export interface RknCheckResult {
  isRegistered: boolean;
  companyName?: string;
  registrationNumber?: string;
  registrationDate?: string;
  confidence: "high" | "medium" | "low" | "none";
  details: string;
  fromCache: boolean;
  error?: string;
}

async function getCachedEntry(inn: string): Promise<schema.RknRegistryEntry | null> {
  try {
    const [entry] = await db
      .select()
      .from(schema.rknRegistryCache)
      .where(eq(schema.rknRegistryCache.inn, inn));
    
    if (!entry) return null;
    
    const cacheAge = Date.now() - new Date(entry.lastCheckedAt).getTime();
    const ttlMs = CACHE_TTL_HOURS * 60 * 60 * 1000;
    
    if (cacheAge > ttlMs) {
      return null;
    }
    
    return entry;
  } catch (error) {
    console.error("[RKN] Cache lookup error:", error);
    return null;
  }
}

async function saveCacheEntry(
  inn: string,
  isRegistered: boolean,
  companyName?: string,
  registrationNumber?: string,
  registrationDate?: string,
  rawData?: any
): Promise<void> {
  try {
    await db
      .insert(schema.rknRegistryCache)
      .values({
        inn,
        isRegistered,
        companyName: companyName || null,
        registrationNumber: registrationNumber || null,
        registrationDate: registrationDate || null,
        rawData: rawData || null,
        lastCheckedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.rknRegistryCache.inn,
        set: {
          isRegistered,
          companyName: companyName || null,
          registrationNumber: registrationNumber || null,
          registrationDate: registrationDate || null,
          rawData: rawData || null,
          lastCheckedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[RKN] Cache save error:", error);
  }
}

export interface RknRetryCallback {
  onAttempt?: (attemptNumber: number, maxAttempts: number) => void;
  onSuccess?: () => void;
  onAllFailed?: () => void;
}

const MAX_RKN_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;

async function fetchRknWithRetry(
  searchUrl: string, 
  cleanInn: string,
  callbacks?: RknRetryCallback
): Promise<{ success: boolean; html?: string; error?: string }> {
  for (let attempt = 1; attempt <= MAX_RKN_ATTEMPTS; attempt++) {
    try {
      console.log(`[RKN] Attempt ${attempt}/${MAX_RKN_ATTEMPTS} for INN ${cleanInn}...`);
      callbacks?.onAttempt?.(attempt, MAX_RKN_ATTEMPTS);
      
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error(`[RKN] HTTP error on attempt ${attempt}: ${response.status}`);
        if (attempt < MAX_RKN_ATTEMPTS) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        return { success: false, error: `http_${response.status}` };
      }

      const html = await response.text();
      callbacks?.onSuccess?.();
      return { success: true, html };
    } catch (error: any) {
      console.error(`[RKN] Attempt ${attempt} failed:`, error?.message || error);
      if (attempt < MAX_RKN_ATTEMPTS) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      callbacks?.onAllFailed?.();
      return { success: false, error: error?.message || "unknown_error" };
    }
  }
  
  callbacks?.onAllFailed?.();
  return { success: false, error: "max_attempts_reached" };
}

export async function checkRknRegistry(
  inn: string, 
  callbacks?: RknRetryCallback
): Promise<RknCheckResult & { attemptsMade?: number; manualCheckUrl?: string }> {
  if (!inn || inn.length < 10 || inn.length > 12) {
    return {
      isRegistered: false,
      confidence: "none",
      details: "Некорректный ИНН (должен быть 10 или 12 цифр)",
      fromCache: false,
      error: "invalid_inn",
    };
  }

  const cleanInn = inn.replace(/\D/g, "");
  
  const cached = await getCachedEntry(cleanInn);
  if (cached) {
    console.log(`[RKN] Cache hit for INN ${cleanInn}`);
    return {
      isRegistered: cached.isRegistered,
      companyName: cached.companyName || undefined,
      registrationNumber: cached.registrationNumber || undefined,
      registrationDate: cached.registrationDate || undefined,
      confidence: cached.isRegistered ? "high" : "medium",
      details: cached.isRegistered 
        ? `Организация найдена в реестре РКН (${cached.companyName || "ИНН: " + cleanInn})`
        : "Организация не найдена в реестре операторов ПД",
      fromCache: true,
    };
  }

  console.log(`[RKN] Fetching registry for INN ${cleanInn}...`);
  
  const searchUrl = `${RKN_REGISTRY_URL}?inn=${encodeURIComponent(cleanInn)}`;
  const manualCheckUrl = `https://pd.rkn.gov.ru/operators-registry/operators-list/?inn=${cleanInn}`;
  
  const fetchResult = await fetchRknWithRetry(searchUrl, cleanInn, callbacks);
  
  if (!fetchResult.success || !fetchResult.html) {
    await saveCacheEntry(cleanInn, false, undefined, undefined, undefined, {
      error: fetchResult.error,
      timestamp: new Date().toISOString(),
      attemptsMade: MAX_RKN_ATTEMPTS,
    });

    return {
      isRegistered: false,
      confidence: "none",
      details: `Не удалось проверить реестр РКН после ${MAX_RKN_ATTEMPTS} попыток. Проверьте вручную на сайте pd.rkn.gov.ru`,
      fromCache: false,
      error: fetchResult.error,
      attemptsMade: MAX_RKN_ATTEMPTS,
      manualCheckUrl,
    };
  }

  try {
    const $ = cheerio.load(fetchResult.html);
    
    const tableRows = $("table tbody tr, .registry-table tr, .operators-list tr");
    
    let found = false;
    let companyName: string | undefined;
    let registrationNumber: string | undefined;
    let registrationDate: string | undefined;

    tableRows.each((_, row) => {
      const cells = $(row).find("td");
      const rowText = $(row).text().toLowerCase();
      
      if (rowText.includes(cleanInn)) {
        found = true;
        
        if (cells.length >= 2) {
          companyName = $(cells[1]).text().trim() || $(cells[0]).text().trim();
        }
        if (cells.length >= 3) {
          registrationNumber = $(cells[2]).text().trim();
        }
        if (cells.length >= 4) {
          registrationDate = $(cells[3]).text().trim();
        }
        
        return false;
      }
    });

    if (!found) {
      const pageText = $("body").text();
      if (pageText.includes(cleanInn)) {
        found = true;
        companyName = "Найдено на странице (детали недоступны)";
      }
    }

    await saveCacheEntry(cleanInn, found, companyName, registrationNumber, registrationDate, {
      searchUrl,
      timestamp: new Date().toISOString(),
    });

    if (found) {
      console.log(`[RKN] Found in registry: INN ${cleanInn}, company: ${companyName}`);
      return {
        isRegistered: true,
        companyName,
        registrationNumber,
        registrationDate,
        confidence: "high",
        details: `Организация зарегистрирована в реестре операторов ПД${companyName ? ` (${companyName})` : ""}`,
        fromCache: false,
      };
    } else {
      console.log(`[RKN] Not found in registry: INN ${cleanInn}`);
      return {
        isRegistered: false,
        confidence: "medium",
        details: "Организация не найдена в реестре операторов персональных данных Роскомнадзора",
        fromCache: false,
        manualCheckUrl,
      };
    }
  } catch (error: any) {
    console.error("[RKN] Registry parse error:", error?.message || error);
    
    return {
      isRegistered: false,
      confidence: "none",
      details: "Ошибка при разборе ответа от реестра РКН",
      fromCache: false,
      error: error?.message || "parse_error",
      manualCheckUrl,
    };
  }
}

export async function checkRknByCompanyName(companyName: string): Promise<RknCheckResult> {
  if (!companyName || companyName.length < 3) {
    return {
      isRegistered: false,
      confidence: "none",
      details: "Некорректное название организации",
      fromCache: false,
      error: "invalid_name",
    };
  }

  try {
    console.log(`[RKN] Fetching registry for company: ${companyName}...`);
    
    const searchUrl = `${RKN_REGISTRY_URL}?title=${encodeURIComponent(companyName)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return {
        isRegistered: false,
        confidence: "none",
        details: "Не удалось проверить реестр РКН",
        fromCache: false,
        error: `http_${response.status}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const pageText = $("body").text().toLowerCase();
    const searchName = companyName.toLowerCase();
    
    if (pageText.includes(searchName)) {
      return {
        isRegistered: true,
        companyName,
        confidence: "low",
        details: `Организация предположительно найдена в реестре (поиск по названию)`,
        fromCache: false,
      };
    }
    
    return {
      isRegistered: false,
      confidence: "low",
      details: "Организация не найдена в реестре (поиск по названию)",
      fromCache: false,
    };
  } catch (error: any) {
    console.error("[RKN] Company name check error:", error?.message || error);
    return {
      isRegistered: false,
      confidence: "none",
      details: "Не удалось проверить реестр РКН",
      fromCache: false,
      error: error?.message || "unknown_error",
    };
  }
}
