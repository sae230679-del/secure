import dns from "dns";
import https from "https";
import { promisify } from "util";

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);
const dnsReverse = promisify(dns.reverse);
const dnsResolveNs = promisify(dns.resolveNs);

export type HostingStatus = "ru" | "foreign" | "unknown";

export interface HostingAiResult {
  used: boolean;
  status: HostingStatus;
  confidence: number;
  evidence: string[];
  note?: string;
}

export interface HostingCheckResult {
  status: HostingStatus;
  confidence: number;
  ips: string[];
  providerGuess: string | null;
  evidence: string[];
  ai: HostingAiResult;
}

const RUSSIAN_HOSTING_PATTERNS: Array<{
  pattern: RegExp;
  provider: string;
  confidence: number;
}> = [
  { pattern: /regruhosting\.ru/i, provider: "REG.RU", confidence: 0.95 },
  { pattern: /reg\.ru/i, provider: "REG.RU", confidence: 0.9 },
  { pattern: /timeweb\./i, provider: "Timeweb", confidence: 0.95 },
  { pattern: /beget\./i, provider: "Beget", confidence: 0.95 },
  { pattern: /hostland\./i, provider: "Hostland", confidence: 0.9 },
  { pattern: /hoster\.ru/i, provider: "Hoster.ru", confidence: 0.9 },
  { pattern: /mchost\./i, provider: "McHost", confidence: 0.9 },
  { pattern: /mtu\.ru/i, provider: "МТУ-Интел", confidence: 0.85 },
  { pattern: /nic\.ru/i, provider: "RU-CENTER", confidence: 0.9 },
  { pattern: /zenon\./i, provider: "Zenon", confidence: 0.85 },
  { pattern: /fozzy\./i, provider: "Fozzy", confidence: 0.85 },
  { pattern: /ihc\.ru/i, provider: "IHC", confidence: 0.85 },
  { pattern: /ispserver\./i, provider: "ISPserver", confidence: 0.85 },
  { pattern: /firstvds\./i, provider: "FirstVDS", confidence: 0.9 },
  { pattern: /selectel\./i, provider: "Selectel", confidence: 0.9 },
  { pattern: /yandex\./i, provider: "Yandex Cloud", confidence: 0.9 },
  { pattern: /cloud\.ru/i, provider: "SberCloud", confidence: 0.9 },
  { pattern: /vdsina\./i, provider: "VDSina", confidence: 0.85 },
  { pattern: /ruvds\./i, provider: "RUVDS", confidence: 0.9 },
  { pattern: /spaceweb\./i, provider: "SpaceWeb", confidence: 0.9 },
  { pattern: /masterhost\./i, provider: "Masterhost", confidence: 0.9 },
  { pattern: /corbina\./i, provider: "Corbina", confidence: 0.85 },
  { pattern: /rostelecom\./i, provider: "Rostelecom", confidence: 0.9 },
  { pattern: /mts\./i, provider: "MTS", confidence: 0.85 },
  { pattern: /megafon\./i, provider: "Megafon", confidence: 0.85 },
  { pattern: /vk\.com/i, provider: "VK Cloud", confidence: 0.9 },
  { pattern: /mail\.ru/i, provider: "VK Cloud", confidence: 0.85 },
];

const RUSSIAN_NS_PATTERNS: Array<{
  pattern: RegExp;
  provider: string;
}> = [
  { pattern: /ns\d*\.reg\.ru/i, provider: "REG.RU" },
  { pattern: /ns\d*\.timeweb\./i, provider: "Timeweb" },
  { pattern: /ns\d*\.beget\./i, provider: "Beget" },
  { pattern: /nic\.ru/i, provider: "RU-CENTER" },
  { pattern: /yandex\./i, provider: "Yandex" },
  { pattern: /selectel\./i, provider: "Selectel" },
  { pattern: /spaceweb\./i, provider: "SpaceWeb" },
];

const FOREIGN_PROVIDER_PATTERNS: Array<{
  pattern: RegExp;
  provider: string;
}> = [
  { pattern: /cloudflare/i, provider: "Cloudflare" },
  { pattern: /amazonaws\.com/i, provider: "AWS" },
  { pattern: /azure\.com/i, provider: "Microsoft Azure" },
  { pattern: /googleusercontent\.com/i, provider: "Google Cloud" },
  { pattern: /digitalocean/i, provider: "DigitalOcean" },
  { pattern: /hetzner/i, provider: "Hetzner" },
  { pattern: /ovh\./i, provider: "OVH" },
  { pattern: /linode/i, provider: "Linode" },
  { pattern: /vultr/i, provider: "Vultr" },
  { pattern: /hostinger/i, provider: "Hostinger" },
  { pattern: /godaddy/i, provider: "GoDaddy" },
  { pattern: /namecheap/i, provider: "Namecheap" },
  { pattern: /bluehost/i, provider: "Bluehost" },
];

const RUSSIAN_REGISTRARS = [
  "REGRU-RU",
  "REG.RU",
  "RU-CENTER-RU",
  "RU-CENTER",
  "RUCENTR-RU",
  "TIMEWEB-RU",
  "BEGET-RU",
  "WEBNAMES-RU",
];

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname;
  } catch {
    return url.replace(/^(https?:\/\/)?/, "").split("/")[0];
  }
}

async function getWhoisData(domain: string): Promise<string | null> {
  return new Promise((resolve) => {
    const tld = domain.split(".").pop()?.toLowerCase();
    let whoisServer: string;
    
    if (tld === "ru" || tld === "рф" || tld === "su") {
      whoisServer = "whois.tcinet.ru";
    } else if (tld === "com" || tld === "net") {
      whoisServer = "whois.verisign-grs.com";
    } else {
      resolve(null);
      return;
    }

    const net = require("net");
    const socket = new net.Socket();
    let data = "";

    socket.setTimeout(10000);
    
    socket.connect(43, whoisServer, () => {
      socket.write(domain + "\r\n");
    });

    socket.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
    });

    socket.on("end", () => {
      resolve(data);
    });

    socket.on("error", () => {
      resolve(null);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

export async function checkHostingLayer1(url: string): Promise<{
  status: HostingStatus;
  confidence: number;
  ips: string[];
  providerGuess: string | null;
  evidence: string[];
}> {
  const domain = extractDomain(url);
  const evidence: string[] = [];
  let ips: string[] = [];
  let providerGuess: string | null = null;
  let status: HostingStatus = "unknown";
  let confidence = 0;

  try {
    const ipv4 = await dnsResolve4(domain).catch(() => [] as string[]);
    const ipv6 = await dnsResolve6(domain).catch(() => [] as string[]);
    ips = [...ipv4, ...ipv6];

    if (ips.length > 0) {
      evidence.push(`IP адреса: ${ips.join(", ")}`);
    }

    for (const ip of ips.slice(0, 3)) {
      try {
        const ptrRecords = await dnsReverse(ip);
        if (ptrRecords.length > 0) {
          evidence.push(`PTR для ${ip}: ${ptrRecords.join(", ")}`);
          
          for (const ptr of ptrRecords) {
            for (const { pattern, provider, confidence: conf } of RUSSIAN_HOSTING_PATTERNS) {
              if (pattern.test(ptr)) {
                providerGuess = provider;
                status = "ru";
                confidence = Math.max(confidence, conf);
                evidence.push(`PTR содержит ${provider} (${ptr})`);
              }
            }
            
            for (const { pattern, provider } of FOREIGN_PROVIDER_PATTERNS) {
              if (pattern.test(ptr)) {
                if (status !== "ru") {
                  providerGuess = provider;
                  status = "foreign";
                  confidence = Math.max(confidence, 0.7);
                  evidence.push(`PTR указывает на зарубежный хостинг: ${provider} (${ptr})`);
                }
              }
            }
          }
        }
      } catch {
        // PTR not available
      }
    }

    try {
      const nsRecords = await dnsResolveNs(domain);
      if (nsRecords.length > 0) {
        evidence.push(`NS серверы: ${nsRecords.join(", ")}`);
        
        for (const ns of nsRecords) {
          for (const { pattern, provider } of RUSSIAN_NS_PATTERNS) {
            if (pattern.test(ns)) {
              if (status === "unknown") {
                providerGuess = provider;
                status = "ru";
                confidence = Math.max(confidence, 0.7);
              }
              evidence.push(`NS содержит ${provider} (${ns})`);
            }
          }
        }
      }
    } catch {
      // NS not available
    }

    if (domain.endsWith(".ru") || domain.endsWith(".рф") || domain.endsWith(".su")) {
      if (status === "unknown") {
        evidence.push(`Домен в зоне ${domain.split(".").pop()?.toUpperCase()}`);
        confidence = Math.max(confidence, 0.3);
      }
    }

  } catch (error: any) {
    evidence.push(`Ошибка DNS: ${error?.message || "неизвестная ошибка"}`);
  }

  return { status, confidence, ips, providerGuess, evidence };
}

export async function checkHostingLayer2AI(
  url: string,
  layer1Result: Awaited<ReturnType<typeof checkHostingLayer1>>
): Promise<HostingAiResult> {
  const domain = extractDomain(url);
  const evidence: string[] = [];
  
  try {
    const whoisData = await getWhoisData(domain);
    
    if (!whoisData) {
      return {
        used: true,
        status: "unknown",
        confidence: 0,
        evidence: ["WHOIS данные недоступны"],
        note: "Не удалось получить WHOIS данные"
      };
    }

    const lines = whoisData.split("\n");
    let registrar: string | null = null;
    let organization: string | null = null;
    let country: string | null = null;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.includes("registrar:") || lowerLine.includes("регистратор:")) {
        registrar = line.split(":").slice(1).join(":").trim();
        evidence.push(`WHOIS registrar: ${registrar}`);
      }
      
      if (lowerLine.includes("org:") || lowerLine.includes("organization:")) {
        organization = line.split(":").slice(1).join(":").trim();
        evidence.push(`WHOIS org: ${organization}`);
      }
      
      if (lowerLine.includes("country:") || lowerLine.includes("страна:")) {
        country = line.split(":").slice(1).join(":").trim().toUpperCase();
        evidence.push(`WHOIS country: ${country}`);
      }
    }

    let status: HostingStatus = "unknown";
    let confidence = 0;

    if (registrar) {
      for (const ruRegistrar of RUSSIAN_REGISTRARS) {
        if (registrar.toUpperCase().includes(ruRegistrar)) {
          status = "ru";
          confidence = Math.max(confidence, 0.7);
          evidence.push(`Регистратор ${ruRegistrar} — российский`);
        }
      }
    }

    if (country === "RU" || country === "RUSSIA" || country === "РОССИЯ") {
      status = "ru";
      confidence = Math.max(confidence, 0.8);
    } else if (country && country !== "RU") {
      if (status === "unknown") {
        status = "foreign";
        confidence = Math.max(confidence, 0.6);
      }
    }

    return {
      used: true,
      status,
      confidence,
      evidence,
      note: confidence < 0.6 
        ? "AI-оценка по российским данным; требуется ручная верификация при низкой уверенности."
        : undefined
    };

  } catch (error: any) {
    return {
      used: true,
      status: "unknown",
      confidence: 0,
      evidence: [`Ошибка AI-проверки: ${error?.message || "неизвестная ошибка"}`],
      note: "Произошла ошибка при AI-анализе хостинга"
    };
  }
}

export async function checkHosting(url: string): Promise<HostingCheckResult> {
  const layer1 = await checkHostingLayer1(url);
  
  let ai: HostingAiResult = {
    used: false,
    status: "unknown",
    confidence: 0,
    evidence: []
  };

  if (layer1.status === "unknown" || layer1.confidence < 0.6) {
    ai = await checkHostingLayer2AI(url, layer1);
    
    if (ai.status !== "unknown" && ai.confidence > layer1.confidence) {
      return {
        status: ai.status,
        confidence: ai.confidence,
        ips: layer1.ips,
        providerGuess: layer1.providerGuess,
        evidence: [...layer1.evidence, ...ai.evidence],
        ai
      };
    }
  }

  return {
    status: layer1.status,
    confidence: layer1.confidence,
    ips: layer1.ips,
    providerGuess: layer1.providerGuess,
    evidence: layer1.evidence,
    ai
  };
}
