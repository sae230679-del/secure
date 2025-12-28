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
  platform?: {
    detected: boolean;
    provider: string | null;
    confidence: number;
    evidence: string[];
    actualHostingUrl?: string;
  };
  dnsStatus?: HostingStatus;
  dnsProviderGuess?: string | null;
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

const FOREIGN_PLATFORM_PATTERNS: Array<{
  pattern: RegExp;
  provider: string;
  confidence: number;
}> = [
  { pattern: /lovable\.app/i, provider: "Lovable (GPT Engineer)", confidence: 0.95 },
  { pattern: /lovable\.dev/i, provider: "Lovable (GPT Engineer)", confidence: 0.95 },
  { pattern: /vercel\.app/i, provider: "Vercel", confidence: 0.95 },
  { pattern: /netlify\.app/i, provider: "Netlify", confidence: 0.95 },
  { pattern: /netlify\.com/i, provider: "Netlify", confidence: 0.95 },
  { pattern: /pages\.dev/i, provider: "Cloudflare Pages", confidence: 0.95 },
  { pattern: /herokuapp\.com/i, provider: "Heroku", confidence: 0.95 },
  { pattern: /railway\.app/i, provider: "Railway", confidence: 0.95 },
  { pattern: /render\.com/i, provider: "Render", confidence: 0.95 },
  { pattern: /fly\.dev/i, provider: "Fly.io", confidence: 0.95 },
  { pattern: /github\.io/i, provider: "GitHub Pages", confidence: 0.95 },
  { pattern: /gitlab\.io/i, provider: "GitLab Pages", confidence: 0.95 },
  { pattern: /firebaseapp\.com/i, provider: "Firebase", confidence: 0.95 },
  { pattern: /web\.app/i, provider: "Firebase", confidence: 0.9 },
  { pattern: /azurewebsites\.net/i, provider: "Azure App Service", confidence: 0.95 },
  { pattern: /amplifyapp\.com/i, provider: "AWS Amplify", confidence: 0.95 },
  { pattern: /replit\.app/i, provider: "Replit", confidence: 0.95 },
  { pattern: /replit\.dev/i, provider: "Replit", confidence: 0.95 },
  { pattern: /wixsite\.com/i, provider: "Wix", confidence: 0.95 },
  { pattern: /squarespace\.com/i, provider: "Squarespace", confidence: 0.95 },
  { pattern: /webflow\.io/i, provider: "Webflow", confidence: 0.95 },
  { pattern: /framer\.app/i, provider: "Framer", confidence: 0.95 },
  { pattern: /bubble\.io/i, provider: "Bubble", confidence: 0.95 },
  { pattern: /tilda\.ws/i, provider: "Tilda", confidence: 0.9 },
  { pattern: /lpmotor\.ru/i, provider: "LPmotor", confidence: 0.9 },
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

export interface PlatformDetectionResult {
  detected: boolean;
  provider: string | null;
  confidence: number;
  evidence: string[];
  actualHostingUrl?: string;
}

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^0\./,
  /^169\.254\./,
];

function isPrivateIpOrLocalhost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local")) {
    return true;
  }
  const ipv4Match = lower.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (ipv4Match) {
    return PRIVATE_IP_RANGES.some((re) => re.test(lower));
  }
  return false;
}

export async function detectPlatformFromHttp(url: string): Promise<PlatformDetectionResult> {
  const evidence: string[] = [];
  let provider: string | null = null;
  let confidence = 0;
  let actualHostingUrl: string | undefined;

  try {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    
    let parsed: URL;
    try {
      parsed = new URL(fullUrl);
    } catch {
      return { detected: false, provider: null, confidence: 0, evidence: ["Некорректный URL"] };
    }
    
    if (isPrivateIpOrLocalhost(parsed.hostname)) {
      return { detected: false, provider: null, confidence: 0, evidence: ["Запрещено сканирование внутренних адресов"] };
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(fullUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SecureLexBot/1.0)",
        "Accept": "text/html",
      },
    });

    clearTimeout(timeoutId);

    const headers = response.headers;
    const serverHeader = headers.get("server") || "";
    const xPoweredBy = headers.get("x-powered-by") || "";
    const via = headers.get("via") || "";
    const cfRay = headers.get("cf-ray") || "";
    const xVercelId = headers.get("x-vercel-id") || "";
    const xNetlify = headers.get("x-nf-request-id") || "";
    
    if (cfRay) {
      evidence.push(`HTTP заголовок cf-ray: Cloudflare CDN`);
    }
    
    if (xVercelId) {
      provider = "Vercel";
      confidence = 0.9;
      evidence.push(`HTTP заголовок x-vercel-id: платформа Vercel`);
    }
    
    if (xNetlify) {
      provider = "Netlify";
      confidence = 0.9;
      evidence.push(`HTTP заголовок x-nf-request-id: платформа Netlify`);
    }
    
    if (serverHeader) {
      evidence.push(`HTTP Server: ${serverHeader}`);
      
      if (/cloudflare/i.test(serverHeader)) {
        evidence.push(`Сервер Cloudflare обнаружен`);
      }
      if (/vercel/i.test(serverHeader)) {
        provider = "Vercel";
        confidence = 0.9;
      }
      if (/netlify/i.test(serverHeader)) {
        provider = "Netlify";
        confidence = 0.9;
      }
    }

    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
      const location = headers.get("location");
      if (location) {
        evidence.push(`HTTP редирект на: ${location}`);
        
        for (const { pattern, provider: prov, confidence: conf } of FOREIGN_PLATFORM_PATTERNS) {
          if (pattern.test(location)) {
            provider = prov;
            confidence = conf;
            actualHostingUrl = location;
            evidence.push(`Редирект ведёт на иностранную платформу: ${prov}`);
            break;
          }
        }
      }
    }

    const text = await response.text().catch(() => "");
    
    if (text.length > 0) {
      const iframeSrcMatch = text.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
      if (iframeSrcMatch) {
        for (const iframe of iframeSrcMatch) {
          const srcMatch = iframe.match(/src=["']([^"']+)["']/i);
          if (srcMatch) {
            const iframeSrc = srcMatch[1];
            for (const { pattern, provider: prov, confidence: conf } of FOREIGN_PLATFORM_PATTERNS) {
              if (pattern.test(iframeSrc)) {
                provider = prov;
                confidence = conf;
                actualHostingUrl = iframeSrc;
                evidence.push(`Iframe указывает на иностранную платформу: ${prov} (${iframeSrc})`);
                break;
              }
            }
          }
        }
      }

      const canonicalMatch = text.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      if (canonicalMatch) {
        const canonical = canonicalMatch[1];
        for (const { pattern, provider: prov, confidence: conf } of FOREIGN_PLATFORM_PATTERNS) {
          if (pattern.test(canonical)) {
            provider = prov;
            confidence = conf;
            actualHostingUrl = canonical;
            evidence.push(`Canonical URL указывает на иностранную платформу: ${prov}`);
            break;
          }
        }
      }

      const metaRefreshMatch = text.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'>\s]+)/i);
      if (metaRefreshMatch) {
        const refreshUrl = metaRefreshMatch[1];
        for (const { pattern, provider: prov, confidence: conf } of FOREIGN_PLATFORM_PATTERNS) {
          if (pattern.test(refreshUrl)) {
            provider = prov;
            confidence = conf;
            actualHostingUrl = refreshUrl;
            evidence.push(`Meta refresh указывает на иностранную платформу: ${prov}`);
            break;
          }
        }
      }

      const scriptMatches = text.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi);
      if (scriptMatches) {
        for (const script of scriptMatches.slice(0, 10)) {
          const srcMatch = script.match(/src=["']([^"']+)["']/i);
          if (srcMatch) {
            const scriptSrc = srcMatch[1];
            for (const { pattern, provider: prov } of FOREIGN_PLATFORM_PATTERNS) {
              if (pattern.test(scriptSrc)) {
                if (!provider) {
                  provider = prov;
                  confidence = 0.7;
                }
                evidence.push(`Скрипт загружается с платформы: ${prov}`);
                break;
              }
            }
          }
        }
      }

      if (text.includes("lovable.app") || text.includes("lovable.dev")) {
        provider = "Lovable (GPT Engineer)";
        confidence = 0.95;
        evidence.push(`Обнаружены ссылки на Lovable в HTML`);
        
        const lovableMatch = text.match(/https?:\/\/[^"'\s<>]+lovable\.(app|dev)[^"'\s<>]*/i);
        if (lovableMatch) {
          actualHostingUrl = lovableMatch[0];
        }
      }
      
      // Detect Lovable by generator meta tag
      const generatorMatch = text.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i) ||
                            text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']generator["']/i);
      if (generatorMatch) {
        const generator = generatorMatch[1].toLowerCase();
        if (generator.includes("lovable") || generator.includes("gpt engineer") || generator.includes("gptengineer")) {
          provider = "Lovable (GPT Engineer)";
          confidence = 0.95;
          evidence.push(`Meta generator указывает на Lovable: ${generatorMatch[1]}`);
        }
      }
      
      // Detect Lovable by characteristic script patterns
      if (text.includes("@lovable") || text.includes("gptengineer.app") || 
          text.includes("lovable-tagger") || text.includes("/lovable/")) {
        provider = "Lovable (GPT Engineer)";
        confidence = 0.9;
        evidence.push(`Обнаружены характерные маркеры Lovable в коде страницы`);
      }
      
      // Detect Lovable by HTML comment
      if (/<!--.*lovable.*-->/i.test(text) || /<!--.*gpt.*engineer.*-->/i.test(text)) {
        provider = "Lovable (GPT Engineer)";
        confidence = 0.85;
        evidence.push(`Обнаружен комментарий Lovable в HTML`);
      }
    }

  } catch (error: any) {
    evidence.push(`Ошибка HTTP-проверки: ${error?.message || "неизвестная ошибка"}`);
  }

  return {
    detected: provider !== null,
    provider,
    confidence,
    evidence,
    actualHostingUrl,
  };
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
  const [layer1, platformResult] = await Promise.all([
    checkHostingLayer1(url),
    detectPlatformFromHttp(url),
  ]);
  
  let ai: HostingAiResult = {
    used: false,
    status: "unknown",
    confidence: 0,
    evidence: []
  };

  if (layer1.status === "unknown" || layer1.confidence < 0.6) {
    ai = await checkHostingLayer2AI(url, layer1);
  }

  if (platformResult.detected && platformResult.provider) {
    const isRussianPlatform = /tilda|lpmotor/i.test(platformResult.provider);
    const platformStatus: HostingStatus = isRussianPlatform ? "ru" : "foreign";
    
    const combinedEvidence = [
      ...layer1.evidence,
      `--- Проверка платформы хостинга ---`,
      ...platformResult.evidence,
    ];
    
    if (platformStatus === "foreign" && layer1.status === "ru") {
      combinedEvidence.push(`ВНИМАНИЕ: Домен указывает на российский IP (${layer1.providerGuess || "неизвестный провайдер"}), но сайт фактически размещён на иностранной платформе ${platformResult.provider}`);
    }
    
    if (platformResult.actualHostingUrl) {
      combinedEvidence.push(`Фактический URL хостинга: ${platformResult.actualHostingUrl}`);
    }
    
    if (ai.used && ai.evidence.length > 0) {
      combinedEvidence.push(...ai.evidence);
    }

    return {
      status: platformStatus,
      confidence: platformResult.confidence,
      ips: layer1.ips,
      providerGuess: platformResult.provider,
      evidence: combinedEvidence,
      ai,
      platform: platformResult,
      dnsStatus: layer1.status,
      dnsProviderGuess: layer1.providerGuess,
    };
  }

  if (ai.status !== "unknown" && ai.confidence > layer1.confidence) {
    return {
      status: ai.status,
      confidence: ai.confidence,
      ips: layer1.ips,
      providerGuess: layer1.providerGuess,
      evidence: [...layer1.evidence, ...ai.evidence],
      ai,
      dnsStatus: layer1.status,
      dnsProviderGuess: layer1.providerGuess,
    };
  }

  return {
    status: layer1.status,
    confidence: layer1.confidence,
    ips: layer1.ips,
    providerGuess: layer1.providerGuess,
    evidence: layer1.evidence,
    ai,
    dnsStatus: layer1.status,
    dnsProviderGuess: layer1.providerGuess,
  };
}
