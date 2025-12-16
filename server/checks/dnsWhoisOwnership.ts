/**
 * DNS + WHOIS валидатор владельца домена
 * Использует только локальные методы: DNS резолвер Node.js + WHOIS протокол (порт 43)
 * Без GeoIP и внешних HTTP API
 */

import dns from "dns";
import net from "net";
import { promisify } from "util";

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);
const dnsResolveNs = promisify(dns.resolveNs);
const dnsResolveMx = promisify(dns.resolveMx);

export type CheckStatus = "ok" | "warn" | "fail" | "na" | "unavailable";

export interface DnsWhoisResult {
  status: CheckStatus;
  evidence: string[];
  limitations: string[];
  dns: {
    ns: string[];
    a: string[];
    aaaa: string[];
    mx: string[];
  };
  whois: {
    raw: string | null;
    registrar: string | null;
    registrant: string | null;
    createdDate: string | null;
    expiryDate: string | null;
    nameServers: string[];
  };
}

const WHOIS_SERVERS: Record<string, string> = {
  ru: "whois.tcinet.ru",
  su: "whois.tcinet.ru",
  xn__p1ai: "whois.tcinet.ru", // .рф in punycode
  com: "whois.verisign-grs.com",
  net: "whois.verisign-grs.com",
  org: "whois.pir.org",
  info: "whois.afilias.net",
  biz: "whois.biz",
  io: "whois.nic.io",
  uk: "whois.nic.uk",
  de: "whois.denic.de",
  fr: "whois.nic.fr",
  nl: "whois.sidn.nl",
  eu: "whois.eu",
  me: "whois.nic.me",
  cc: "ccwhois.verisign-grs.com",
  tv: "tvwhois.verisign-grs.com",
  co: "whois.nic.co",
  us: "whois.nic.us",
  ca: "whois.cira.ca",
  au: "whois.auda.org.au",
  jp: "whois.jprs.jp",
  cn: "whois.cnnic.cn",
  by: "whois.cctld.by",
  kz: "whois.nic.kz",
  ua: "whois.ua",
  app: "whois.nic.google",
  dev: "whois.nic.google",
  xyz: "whois.nic.xyz",
  online: "whois.nic.online",
  site: "whois.nic.site",
  club: "whois.nic.club",
  shop: "whois.nic.shop",
  tech: "whois.nic.tech",
  pro: "whois.registrypro.pro",
  mobi: "whois.dotmobiregistry.net",
  name: "whois.nic.name",
  asia: "whois.nic.asia",
};

async function lookupWhoisServerFromIana(tld: string): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let data = "";
    
    socket.setTimeout(10000);
    
    socket.connect(43, "whois.iana.org", () => {
      socket.write(tld + "\r\n");
    });
    
    socket.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
    });
    
    socket.on("end", () => {
      socket.destroy();
      const match = data.match(/whois:\s*(\S+)/i);
      resolve(match ? match[1] : null);
    });
    
    socket.on("error", () => {
      socket.destroy();
      resolve(null);
    });
    
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

async function getWhoisServer(tld: string): Promise<string | null> {
  const normalizedTld = tld.toLowerCase().replace(/^\./, "");
  
  if (WHOIS_SERVERS[normalizedTld]) {
    return WHOIS_SERVERS[normalizedTld];
  }
  
  const ianaServer = await lookupWhoisServerFromIana(normalizedTld);
  if (ianaServer) {
    WHOIS_SERVERS[normalizedTld] = ianaServer;
  }
  return ianaServer;
}

function extractDomain(url: string): string {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const parsed = new URL(normalized);
    return parsed.hostname;
  } catch {
    return url.replace(/^(https?:\/\/)?/, "").split("/")[0].split("?")[0];
  }
}

function getTld(domain: string): string {
  const parts = domain.split(".");
  return parts[parts.length - 1].toLowerCase();
}

async function queryWhois(domain: string, server: string): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let data = "";
    
    socket.setTimeout(15000);
    
    socket.connect(43, server, () => {
      socket.write(domain + "\r\n");
    });
    
    socket.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
    });
    
    socket.on("end", () => {
      socket.destroy();
      resolve(data || null);
    });
    
    socket.on("error", () => {
      socket.destroy();
      resolve(null);
    });
    
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

function parseWhoisData(raw: string): {
  registrar: string | null;
  registrant: string | null;
  createdDate: string | null;
  expiryDate: string | null;
  nameServers: string[];
} {
  const result = {
    registrar: null as string | null,
    registrant: null as string | null,
    createdDate: null as string | null,
    expiryDate: null as string | null,
    nameServers: [] as string[],
  };
  
  const lines = raw.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    const lowerLine = trimmed.toLowerCase();
    
    // Registrar
    if (lowerLine.startsWith("registrar:") || lowerLine.startsWith("registrar name:")) {
      const value = trimmed.split(":").slice(1).join(":").trim();
      if (value && !result.registrar) {
        result.registrar = value;
      }
    }
    
    // Registrant (часто скрыт для GDPR)
    if (lowerLine.startsWith("registrant:") || lowerLine.startsWith("registrant organization:") || lowerLine.startsWith("org:")) {
      const value = trimmed.split(":").slice(1).join(":").trim();
      if (value && !result.registrant && !value.toLowerCase().includes("redacted")) {
        result.registrant = value;
      }
    }
    
    // Created date
    if (lowerLine.startsWith("created:") || lowerLine.startsWith("creation date:") || lowerLine.startsWith("registered on:")) {
      const value = trimmed.split(":").slice(1).join(":").trim();
      if (value && !result.createdDate) {
        result.createdDate = value;
      }
    }
    
    // Expiry date
    if (lowerLine.startsWith("paid-till:") || lowerLine.startsWith("expiry date:") || lowerLine.startsWith("registry expiry date:") || lowerLine.startsWith("free-date:")) {
      const value = trimmed.split(":").slice(1).join(":").trim();
      if (value && !result.expiryDate) {
        result.expiryDate = value;
      }
    }
    
    // Name servers
    if (lowerLine.startsWith("nserver:") || lowerLine.startsWith("name server:")) {
      const value = trimmed.split(":").slice(1).join(":").trim().split(/\s+/)[0];
      if (value) {
        result.nameServers.push(value.toLowerCase());
      }
    }
  }
  
  return result;
}

export async function checkDnsWhoisOwnership(urlOrDomain: string): Promise<DnsWhoisResult> {
  const domain = extractDomain(urlOrDomain);
  const tld = getTld(domain);
  
  const evidence: string[] = [];
  const limitations: string[] = [];
  
  const dnsResult = {
    ns: [] as string[],
    a: [] as string[],
    aaaa: [] as string[],
    mx: [] as string[],
  };
  
  const whoisResult = {
    raw: null as string | null,
    registrar: null as string | null,
    registrant: null as string | null,
    createdDate: null as string | null,
    expiryDate: null as string | null,
    nameServers: [] as string[],
  };
  
  // DNS checks
  try {
    dnsResult.ns = await dnsResolveNs(domain).catch(() => []);
    if (dnsResult.ns.length > 0) {
      evidence.push(`NS серверы: ${dnsResult.ns.join(", ")}`);
    }
  } catch {
    limitations.push("NS записи недоступны");
  }
  
  try {
    dnsResult.a = await dnsResolve4(domain).catch(() => []);
    if (dnsResult.a.length > 0) {
      evidence.push(`A записи (IPv4): ${dnsResult.a.join(", ")}`);
    }
  } catch {
    limitations.push("A записи недоступны");
  }
  
  try {
    dnsResult.aaaa = await dnsResolve6(domain).catch(() => []);
    if (dnsResult.aaaa.length > 0) {
      evidence.push(`AAAA записи (IPv6): ${dnsResult.aaaa.join(", ")}`);
    }
  } catch {
    // IPv6 часто отсутствует
  }
  
  try {
    const mxRecords = await dnsResolveMx(domain).catch(() => []);
    dnsResult.mx = mxRecords.map(r => r.exchange);
    if (dnsResult.mx.length > 0) {
      evidence.push(`MX записи: ${dnsResult.mx.join(", ")}`);
    }
  } catch {
    // MX не обязателен
  }
  
  // WHOIS check
  const whoisServer = await getWhoisServer(tld);
  if (!whoisServer) {
    limitations.push(`WHOIS сервер для TLD .${tld} не найден (включая IANA)`);
  } else {
    try {
      const rawWhois = await queryWhois(domain, whoisServer);
      if (rawWhois) {
        whoisResult.raw = rawWhois;
        const parsed = parseWhoisData(rawWhois);
        whoisResult.registrar = parsed.registrar;
        whoisResult.registrant = parsed.registrant;
        whoisResult.createdDate = parsed.createdDate;
        whoisResult.expiryDate = parsed.expiryDate;
        whoisResult.nameServers = parsed.nameServers;
        
        if (parsed.registrar) {
          evidence.push(`Регистратор: ${parsed.registrar}`);
        }
        if (parsed.registrant) {
          evidence.push(`Владелец: ${parsed.registrant}`);
        } else {
          limitations.push("Данные о владельце скрыты (WHOIS privacy/GDPR)");
        }
        if (parsed.createdDate) {
          evidence.push(`Дата регистрации: ${parsed.createdDate}`);
        }
        if (parsed.expiryDate) {
          evidence.push(`Дата окончания: ${parsed.expiryDate}`);
        }
        if (parsed.nameServers.length > 0) {
          evidence.push(`NS (WHOIS): ${parsed.nameServers.join(", ")}`);
        }
      } else {
        limitations.push(`WHOIS запрос к ${whoisServer} не вернул данных`);
      }
    } catch (err) {
      limitations.push(`Ошибка WHOIS запроса: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  
  // Determine status
  let status: CheckStatus = "ok";
  
  if (dnsResult.ns.length === 0 && dnsResult.a.length === 0) {
    status = "unavailable";
    limitations.push("Домен не резолвится (нет DNS записей)");
  } else if (!whoisResult.raw) {
    status = "warn";
    limitations.push("WHOIS данные недоступны, проверка неполная");
  }
  
  // Standard limitations
  limitations.push("География хостинга не подтверждается без дополнительных источников");
  limitations.push("WHOIS данные могут быть неполными или скрыты");
  
  return {
    status,
    evidence,
    limitations,
    dns: dnsResult,
    whois: whoisResult,
  };
}
