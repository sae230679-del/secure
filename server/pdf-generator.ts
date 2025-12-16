import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import path from "path";
import fs from "fs";
import { 
  PENALTY_MAP, 
  calcPenaltyTotals, 
  formatRub, 
  getSubjectName,
  SELF_EMPLOYED_RULE,
  type SubjectType,
  type PenaltyTotals
} from "./penalties-map";

const FONT_PATH = path.join(process.cwd(), "server/fonts/DejaVuSans.ttf");
const FONT_NAME = "DejaVu";

const COLORS = {
  primary: "#1a56db",
  primaryDark: "#1e3a5f",
  secondary: "#6b7280",
  success: "#22c55e",
  successLight: "#dcfce7",
  warning: "#f59e0b",
  warningLight: "#fef9c3",
  danger: "#dc2626",
  dangerLight: "#fee2e2",
  text: "#1f2937",
  textMuted: "#4b5563",
  textLight: "#9ca3af",
  background: "#ffffff",
  backgroundAlt: "#f3f4f6",
  border: "#e5e7eb",
  accent: "#eff6ff",
  accentBorder: "#bfdbfe",
};

const PAGE = {
  width: 595,
  height: 842,
  marginTop: 60,
  marginBottom: 50,
  marginLeft: 50,
  marginRight: 50,
  contentWidth: 495,
  headerHeight: 35,
  footerHeight: 25,
};

interface LawRef {
  act: string;
  ref: string;
}

interface HostingInfo {
  status: "ru" | "foreign" | "uncertain";
  confidence: number;
  ips: string[];
  providerGuess: string | null;
  evidence: string[];
  ai: {
    used: boolean;
    provider?: string;
    rawSummary?: string;
  };
}

interface BriefHighlight {
  id: string;
  title: string;
  status: "ok" | "warn" | "fail" | "na";
  severity: "critical" | "medium" | "low" | "info";
  summary: string;
  howToFixShort?: string;
  law?: LawRef[];
}

interface BriefScore {
  percent: number;
  severity: "low" | "medium" | "high";
  totals: {
    checks: number;
    ok: number;
    warn: number;
    fail: number;
    na: number;
  };
}

interface BriefCta {
  fullReportPriceRub: number;
  fullReportIncludes: string[];
}

interface BriefResults {
  site: {
    domain: string;
    ssl: boolean;
    responseTimeMs: number;
  };
  score: BriefScore;
  hosting: HostingInfo;
  highlights: BriefHighlight[];
  cta: BriefCta;
}

interface CriteriaResult {
  name: string;
  description: string;
  status: "passed" | "warning" | "failed";
  details: string;
  category?: string;
  law?: string;
  howToFix?: string;
  codeExample?: string;
  evidence?: string[];
}

interface PdfReportData {
  auditId: number;
  websiteUrl: string;
  companyName?: string;
  scorePercent: number;
  severity: "red" | "yellow" | "green";
  passedCount: number;
  warningCount: number;
  failedCount: number;
  totalCount: number;
  createdAt: Date;
  packageName: string;
  briefResults?: BriefResults;
  criteria?: CriteriaResult[];
  aiSummary?: string;
  aiRecommendations?: string[];
}

type ReportType = "express" | "full";

function getFontPath(): string {
  if (fs.existsSync(FONT_PATH)) {
    return FONT_PATH;
  }
  const altPath = path.join(__dirname, "fonts/DejaVuSans.ttf");
  if (fs.existsSync(altPath)) {
    return altPath;
  }
  console.error(`[PDF-GEN] Font not found: ${FONT_PATH} or ${altPath}`);
  return FONT_PATH;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getSeverityText(severity: string): string {
  switch (severity) {
    case "low":
    case "green": return "Соответствует";
    case "medium":
    case "yellow": return "Частично соответствует";
    case "high":
    case "red": return "Не соответствует";
    default: return "Неизвестно";
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "low":
    case "green": return COLORS.success;
    case "medium":
    case "yellow": return COLORS.warning;
    case "high":
    case "red": return COLORS.danger;
    default: return COLORS.secondary;
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "ok":
    case "passed": return "[OK]";
    case "warn":
    case "warning": return "[!]";
    case "fail":
    case "failed": return "[X]";
    case "na":
    default: return "[-]";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ok":
    case "passed": return COLORS.success;
    case "warn":
    case "warning": return COLORS.warning;
    case "fail":
    case "failed": return COLORS.danger;
    case "na":
    default: return COLORS.secondary;
  }
}

function mapCriterionToCheckId(name: string): string | null {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes("политик") && (nameLower.includes("конфиденциальн") || nameLower.includes("пдн"))) {
    return "LEGAL_PRIVACY_POLICY_MISSING";
  }
  if (nameLower.includes("согласи") && (nameLower.includes("форм") || nameLower.includes("чекбокс"))) {
    return "PDN_CONSENT_CHECKBOX_MISSING";
  }
  if (nameLower.includes("cookie") && (nameLower.includes("баннер") || nameLower.includes("согласи"))) {
    return "COOKIES_BANNER_MISSING";
  }
  if (nameLower.includes("контакт") || nameLower.includes("реквизит")) {
    return "LEGAL_CONTACTS_MISSING";
  }
  if (nameLower.includes("https") || nameLower.includes("ssl")) {
    return "TECH_NO_HTTPS";
  }
  if (nameLower.includes("hsts")) return "TECH_NO_HSTS";
  if (nameLower.includes("csp")) return "TECH_NO_CSP";
  
  return null;
}

function calculatePenalties(criteria: CriteriaResult[]): { totals: PenaltyTotals; violations: Array<{ title: string; key: string }> } {
  const checkResults: { checkId: string; status: "passed" | "warning" | "failed" }[] = [];
  const seenKeys = new Set<string>();
  const violations: Array<{ title: string; key: string }> = [];
  
  for (const c of criteria) {
    if (c.status === "passed") continue;
    
    const checkId = mapCriterionToCheckId(c.name);
    if (checkId && PENALTY_MAP[checkId]) {
      const penalty = PENALTY_MAP[checkId];
      checkResults.push({ checkId, status: c.status });
      
      if (!seenKeys.has(penalty.aggregationKey)) {
        seenKeys.add(penalty.aggregationKey);
        violations.push({ title: penalty.title, key: penalty.aggregationKey });
      }
    }
  }
  
  return { totals: calcPenaltyTotals(checkResults), violations };
}

class PdfReportGenerator {
  private doc: PDFKit.PDFDocument;
  private data: PdfReportData;
  private reportType: ReportType;
  private pageNumber: number = 1;
  private totalPages: number = 0;
  
  constructor(data: PdfReportData, reportType: ReportType) {
    this.data = data;
    this.reportType = reportType;
    
    this.doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE.marginTop, bottom: PAGE.marginBottom, left: PAGE.marginLeft, right: PAGE.marginRight },
      bufferPages: true,
      info: {
        Title: `${reportType === "express" ? "Экспресс-отчёт" : "Полный отчёт"} - ${data.websiteUrl}`,
        Author: "SecureLex.ru",
        Subject: "Аудит соответствия законодательству РФ",
        Keywords: "ФЗ-152, ФЗ-149, аудит, персональные данные, GDPR",
      },
    });
    
    const fontPath = getFontPath();
    try {
      this.doc.registerFont(FONT_NAME, fontPath);
      this.doc.font(FONT_NAME);
    } catch (e) {
      console.error(`[PDF-GEN] Font error: ${e}`);
      this.doc.font("Helvetica");
    }
  }
  
  private addNewPage(): void {
    this.doc.addPage();
    this.doc.font(FONT_NAME);
    this.pageNumber++;
  }
  
  private checkPageBreak(neededHeight: number): void {
    const available = PAGE.height - PAGE.marginBottom - PAGE.footerHeight - this.doc.y;
    if (neededHeight > available) {
      this.addNewPage();
      this.doc.y = PAGE.marginTop + PAGE.headerHeight + 10;
    }
  }
  
  private renderHeader(): void {
    const y = 20;
    
    this.doc.fontSize(10)
       .fillColor(COLORS.primary)
       .text("SECURELEX.RU", PAGE.marginLeft, y, { continued: false });
    
    this.doc.fontSize(8)
       .fillColor(COLORS.secondary)
       .text(this.data.websiteUrl, PAGE.marginLeft + 200, y + 2, { width: 200, align: "center" });
    
    this.doc.fontSize(8)
       .fillColor(COLORS.secondary)
       .text(formatDate(this.data.createdAt), PAGE.width - PAGE.marginRight - 80, y + 2, { width: 80, align: "right" });
    
    this.doc.moveTo(PAGE.marginLeft, y + 18)
       .lineTo(PAGE.width - PAGE.marginRight, y + 18)
       .strokeColor(COLORS.border)
       .lineWidth(0.5)
       .stroke();
  }
  
  private renderFooter(pageNum: number, totalPages: number): void {
    const y = PAGE.height - 35;
    
    this.doc.moveTo(PAGE.marginLeft, y)
       .lineTo(PAGE.width - PAGE.marginRight, y)
       .strokeColor(COLORS.border)
       .lineWidth(0.5)
       .stroke();
    
    this.doc.fontSize(7)
       .fillColor(COLORS.textLight)
       .text(
         `Стр. ${pageNum} из ${totalPages}`,
         PAGE.marginLeft,
         y + 8,
         { width: 60 }
       );
    
    this.doc.fontSize(7)
       .fillColor(COLORS.textLight)
       .text(
         "Данный отчёт носит информационный характер и не является юридическим заключением.",
         PAGE.marginLeft + 80,
         y + 8,
         { width: PAGE.contentWidth - 140, align: "center" }
       );
    
    this.doc.fontSize(7)
       .fillColor(COLORS.textLight)
       .text(
         `#${this.data.auditId}`,
         PAGE.width - PAGE.marginRight - 60,
         y + 8,
         { width: 60, align: "right" }
       );
  }
  
  private renderCoverPage(): void {
    this.doc.y = 150;
    
    this.doc.fontSize(28)
       .fillColor(COLORS.primary)
       .text("SECURELEX.RU", { align: "center" });
    
    this.doc.moveDown(0.3);
    this.doc.fontSize(11)
       .fillColor(COLORS.secondary)
       .text("Проверка сайтов на соответствие законодательству РФ", { align: "center" });
    
    this.doc.moveDown(2);
    
    const reportTitle = this.reportType === "express" ? "ЭКСПРЕСС-ОТЧЁТ" : "ПОЛНЫЙ ОТЧЁТ АУДИТА";
    this.doc.fontSize(22)
       .fillColor(COLORS.text)
       .text(reportTitle, { align: "center" });
    
    this.doc.moveDown(0.8);
    
    const displayUrl = this.data.briefResults?.site?.domain || this.data.websiteUrl;
    this.doc.fontSize(16)
       .fillColor(COLORS.primary)
       .text(displayUrl, { align: "center" });
    
    this.doc.moveDown(2);
    
    const boxY = this.doc.y;
    const boxHeight = 140;
    
    this.doc.rect(PAGE.marginLeft, boxY, PAGE.contentWidth, boxHeight)
       .fillColor(COLORS.backgroundAlt)
       .fill();
    
    this.doc.rect(PAGE.marginLeft, boxY, PAGE.contentWidth, boxHeight)
       .strokeColor(COLORS.border)
       .lineWidth(1)
       .stroke();
    
    const scoreSize = 60;
    const scoreX = PAGE.marginLeft + 40;
    const scoreY = boxY + (boxHeight - scoreSize) / 2;
    
    const scorePercent = this.data.briefResults?.score?.percent ?? this.data.scorePercent ?? 0;
    const severity = this.data.briefResults?.score?.severity ?? this.data.severity ?? "high";
    const severityColor = getSeverityColor(severity);
    
    this.doc.circle(scoreX + scoreSize / 2, scoreY + scoreSize / 2, scoreSize / 2)
       .fillColor(severityColor)
       .fill();
    
    this.doc.fontSize(24)
       .fillColor("#ffffff")
       .text(`${scorePercent}%`, scoreX, scoreY + 18, { width: scoreSize, align: "center" });
    
    const infoX = PAGE.marginLeft + 130;
    let infoY = boxY + 20;
    
    this.doc.fontSize(10).fillColor(COLORS.text);
    
    this.doc.text("Дата проверки:", infoX, infoY);
    this.doc.text(formatDate(this.data.createdAt), infoX + 120, infoY);
    infoY += 22;
    
    this.doc.text("Тип отчёта:", infoX, infoY);
    this.doc.text(this.data.packageName || (this.reportType === "express" ? "Экспресс-отчёт" : "Полный аудит"), infoX + 120, infoY);
    infoY += 22;
    
    this.doc.text("Статус:", infoX, infoY);
    this.doc.fillColor(severityColor)
       .text(getSeverityText(severity), infoX + 120, infoY);
    infoY += 22;
    
    this.doc.fillColor(COLORS.text);
    this.doc.text("Результаты:", infoX, infoY);
    
    const totals = this.data.briefResults?.score?.totals;
    const passedCount = totals?.ok ?? this.data.passedCount ?? 0;
    const warningCount = totals?.warn ?? this.data.warningCount ?? 0;
    const failedCount = totals?.fail ?? this.data.failedCount ?? 0;
    
    const statsX = infoX + 120;
    this.doc.fillColor(COLORS.success).text(`${passedCount} OK`, statsX, infoY, { continued: true });
    this.doc.fillColor(COLORS.text).text(" / ", { continued: true });
    this.doc.fillColor(COLORS.warning).text(`${warningCount} `, { continued: true });
    this.doc.fillColor(COLORS.text).text("/ ", { continued: true });
    this.doc.fillColor(COLORS.danger).text(`${failedCount} `, { continued: false });
    
    this.doc.y = boxY + boxHeight + 30;
  }
  
  private renderHostingBlock(): void {
    const hosting = this.data.briefResults?.hosting;
    if (!hosting) return;
    
    this.checkPageBreak(100);
    
    this.doc.fontSize(14)
       .fillColor(COLORS.primaryDark)
       .text("РАЗМЕЩЕНИЕ СЕРВЕРА", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(0.5);
    
    const boxY = this.doc.y;
    const boxHeight = 70;
    
    let bgColor: string;
    let statusText: string;
    let flag: string;
    
    switch (hosting.status) {
      case "ru":
      case "russian":
        bgColor = COLORS.successLight;
        statusText = "Размещён в России";
        flag = "[RU]";
        break;
      case "foreign":
        bgColor = COLORS.dangerLight;
        statusText = "Размещён за рубежом";
        flag = "[--]";
        break;
      default:
        bgColor = COLORS.warningLight;
        statusText = "Не удалось определить";
        flag = "[?]";
    }
    
    this.doc.rect(PAGE.marginLeft, boxY, PAGE.contentWidth, boxHeight)
       .fillColor(bgColor)
       .fill();
    
    this.doc.fontSize(14)
       .fillColor(COLORS.text)
       .text(`${flag} ${statusText}`, PAGE.marginLeft + 15, boxY + 15);
    
    const providerName = hosting.providerGuess || (hosting as any).provider;
    if (providerName) {
      this.doc.fontSize(10)
         .fillColor(COLORS.textMuted)
         .text(`Провайдер: ${providerName}`, PAGE.marginLeft + 15, boxY + 35);
    }
    
    if (hosting.ips && hosting.ips.length > 0) {
      this.doc.fontSize(9)
         .fillColor(COLORS.textLight)
         .text(`IP: ${hosting.ips.slice(0, 3).join(", ")}${hosting.ips.length > 3 ? "..." : ""}`, PAGE.marginLeft + 15, boxY + 50);
    }
    
    if (hosting.confidence && hosting.confidence < 80) {
      this.doc.fontSize(8)
         .fillColor(COLORS.warning)
         .text(`Уверенность: ${hosting.confidence}%`, PAGE.marginLeft + 350, boxY + 15);
    }
    
    this.doc.y = boxY + boxHeight + 15;
  }
  
  private renderHighlightsTable(): void {
    const highlights = this.data.briefResults?.highlights || [];
    if (highlights.length === 0) return;
    
    this.checkPageBreak(50);
    
    this.doc.fontSize(14)
       .fillColor(COLORS.primaryDark)
       .text("КЛЮЧЕВЫЕ ПРОВЕРКИ", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(0.5);
    
    const tableStartY = this.doc.y;
    const colWidths = [30, 280, 90, 95];
    const rowHeight = 28;
    
    this.doc.rect(PAGE.marginLeft, tableStartY, PAGE.contentWidth, rowHeight)
       .fillColor(COLORS.backgroundAlt)
       .fill();
    
    let x = PAGE.marginLeft + 5;
    this.doc.fontSize(9).fillColor(COLORS.text);
    this.doc.text("", x, tableStartY + 8);
    x += colWidths[0];
    this.doc.text("Критерий", x, tableStartY + 8, { width: colWidths[1] });
    x += colWidths[1];
    this.doc.text("Статус", x, tableStartY + 8, { width: colWidths[2], align: "center" });
    x += colWidths[2];
    this.doc.text("Закон", x, tableStartY + 8, { width: colWidths[3], align: "center" });
    
    let currentY = tableStartY + rowHeight;
    
    highlights.forEach((item, idx) => {
      this.checkPageBreak(rowHeight + 5);
      
      const bgColor = idx % 2 === 0 ? COLORS.background : COLORS.backgroundAlt;
      
      this.doc.rect(PAGE.marginLeft, currentY, PAGE.contentWidth, rowHeight)
         .fillColor(bgColor)
         .fill();
      
      this.doc.rect(PAGE.marginLeft, currentY, PAGE.contentWidth, rowHeight)
         .strokeColor(COLORS.border)
         .lineWidth(0.3)
         .stroke();
      
      let x = PAGE.marginLeft + 5;
      
      this.doc.fontSize(10)
         .fillColor(getStatusColor(item.status))
         .text(getStatusIcon(item.status), x, currentY + 8, { width: colWidths[0] });
      x += colWidths[0];
      
      this.doc.fontSize(9)
         .fillColor(COLORS.text)
         .text(item.title, x, currentY + 5, { width: colWidths[1] - 5 });
      x += colWidths[1];
      
      const statusLabel = (item.status === "ok" || item.status === "passed") ? "OK" : 
                         (item.status === "warn" || item.status === "warning") ? "Внимание" : 
                         (item.status === "fail" || item.status === "failed") ? "Нарушение" : "-";
      this.doc.fontSize(8)
         .fillColor(getStatusColor(item.status))
         .text(statusLabel, x, currentY + 8, { width: colWidths[2], align: "center" });
      x += colWidths[2];
      
      const lawText = Array.isArray(item.law) && item.law.length > 0 
        ? item.law.map(l => l.ref || l.act).join(", ").substring(0, 20) 
        : (typeof item.law === "string" ? item.law : "-");
      this.doc.fontSize(8)
         .fillColor(COLORS.textMuted)
         .text(lawText, x, currentY + 8, { width: colWidths[3], align: "center" });
      
      currentY += rowHeight;
    });
    
    this.doc.y = currentY + 15;
  }
  
  private renderBriefRecommendations(): void {
    const highlights = this.data.briefResults?.highlights || [];
    const issues = highlights.filter(h => h.status !== "ok" && h.status !== "passed" && h.status !== "na");
    
    if (issues.length === 0) return;
    
    this.checkPageBreak(80);
    
    this.doc.fontSize(14)
       .fillColor(COLORS.primaryDark)
       .text("КРАТКИЕ РЕКОМЕНДАЦИИ", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(0.5);
    
    issues.slice(0, 6).forEach((item, idx) => {
      this.checkPageBreak(45);
      
      const boxY = this.doc.y;
      const bgColor = (item.status === "fail" || item.status === "failed") ? COLORS.dangerLight : COLORS.warningLight;
      
      this.doc.rect(PAGE.marginLeft, boxY, PAGE.contentWidth, 35)
         .fillColor(bgColor)
         .fill();
      
      this.doc.fontSize(10)
         .fillColor(COLORS.text)
         .text(`${idx + 1}. ${item.title}`, PAGE.marginLeft + 10, boxY + 5);
      
      if (item.howToFixShort) {
        this.doc.fontSize(8)
           .fillColor(COLORS.textMuted)
           .text(item.howToFixShort, PAGE.marginLeft + 20, boxY + 20, { width: PAGE.contentWidth - 30 });
      }
      
      this.doc.y = boxY + 40;
    });
  }
  
  private renderCtaPage(): void {
    this.addNewPage();
    this.doc.y = 150;
    
    const boxY = this.doc.y;
    const boxHeight = 280;
    
    this.doc.rect(PAGE.marginLeft, boxY, PAGE.contentWidth, boxHeight)
       .fillColor(COLORS.accent)
       .fill();
    
    this.doc.rect(PAGE.marginLeft, boxY, PAGE.contentWidth, boxHeight)
       .strokeColor(COLORS.accentBorder)
       .lineWidth(2)
       .stroke();
    
    this.doc.fontSize(18)
       .fillColor(COLORS.primary)
       .text("ЭТО ЭКСПРЕСС-ОТЧЁТ", PAGE.marginLeft + 20, boxY + 25, { width: PAGE.contentWidth - 40, align: "center" });
    
    this.doc.moveDown(0.5);
    this.doc.fontSize(12)
       .fillColor(COLORS.text)
       .text("Вы видите сокращённую версию анализа.", { align: "center" });
    
    this.doc.moveDown(1.5);
    this.doc.fontSize(16)
       .fillColor(COLORS.primaryDark)
       .text("Закажите полный отчёт за 900 руб.", { align: "center" });
    
    this.doc.moveDown(1);
    
    const benefits = [
      "Детальный разбор всех 30+ критериев проверки",
      "Пошаговые инструкции по устранению нарушений",
      "Примеры кода для вашего сайта",
      "Расчёт штрафных рисков по КоАП РФ",
      "Чек-лист для внутреннего аудита",
      "Ссылки на официальные ресурсы РКН",
    ];
    
    let benefitY = this.doc.y;
    benefits.forEach((benefit) => {
      this.doc.fontSize(10)
         .fillColor(COLORS.success)
         .text("[+]", PAGE.marginLeft + 60, benefitY, { continued: true })
         .fillColor(COLORS.text)
         .text(` ${benefit}`, { continued: false });
      benefitY += 18;
    });
    
    this.doc.y = benefitY + 20;
    
    this.doc.fontSize(12)
       .fillColor(COLORS.danger)
       .text("Защитите свой бизнес от штрафов до 18 000 000 руб!", { align: "center" });
    
    this.doc.moveDown(1.5);
    
    this.doc.fontSize(11)
       .fillColor(COLORS.primary)
       .text("securelex.ru/audit", { align: "center", underline: true });
    
    this.doc.moveDown(0.5);
    this.doc.fontSize(10)
       .fillColor(COLORS.textMuted)
       .text("support@securelex.ru", { align: "center" });
  }
  
  private renderFullCriteriaTable(): void {
    const criteria = this.data.criteria || [];
    if (criteria.length === 0) return;
    
    this.addNewPage();
    this.doc.y = PAGE.marginTop + PAGE.headerHeight + 10;
    
    this.doc.fontSize(16)
       .fillColor(COLORS.primaryDark)
       .text("ПОЛНАЯ ТАБЛИЦА ПРОВЕРОК", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(1);
    
    const categories: Record<string, CriteriaResult[]> = {};
    criteria.forEach(c => {
      const cat = c.category || "Общие требования";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(c);
    });
    
    Object.entries(categories).forEach(([category, items]) => {
      this.checkPageBreak(60);
      
      this.doc.fontSize(12)
         .fillColor(COLORS.primary)
         .text(`>> ${category}`, PAGE.marginLeft, this.doc.y);
      this.doc.moveDown(0.5);
      
      items.forEach((item, idx) => {
        this.checkPageBreak(35);
        
        const statusIcon = getStatusIcon(item.status);
        const statusColor = getStatusColor(item.status);
        
        this.doc.fontSize(10)
           .fillColor(statusColor)
           .text(statusIcon, PAGE.marginLeft, this.doc.y, { continued: true })
           .fillColor(COLORS.text)
           .text(` ${item.name}`, { continued: false });
        
        if (item.description) {
          this.doc.fontSize(8)
             .fillColor(COLORS.textMuted)
             .text(item.description, PAGE.marginLeft + 25, this.doc.y, { width: PAGE.contentWidth - 25 });
        }
        
        this.doc.moveDown(0.5);
      });
      
      this.doc.moveDown(0.5);
    });
  }
  
  private renderDetailedAnalysis(): void {
    const criteria = this.data.criteria || [];
    const issues = criteria.filter(c => c.status !== "passed");
    
    if (issues.length === 0) return;
    
    this.addNewPage();
    this.doc.y = PAGE.marginTop + PAGE.headerHeight + 10;
    
    this.doc.fontSize(16)
       .fillColor(COLORS.danger)
       .text("ДЕТАЛЬНЫЙ РАЗБОР НАРУШЕНИЙ", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(1);
    
    issues.forEach((item, idx) => {
      this.checkPageBreak(120);
      
      const boxY = this.doc.y;
      const bgColor = item.status === "failed" ? COLORS.dangerLight : COLORS.warningLight;
      
      this.doc.rect(PAGE.marginLeft, boxY, PAGE.contentWidth, 25)
         .fillColor(bgColor)
         .fill();
      
      this.doc.fontSize(11)
         .fillColor(COLORS.text)
         .text(`${idx + 1}. ${item.name}`, PAGE.marginLeft + 10, boxY + 7);
      
      if (item.law) {
        this.doc.fontSize(8)
           .fillColor(COLORS.danger)
           .text(item.law, PAGE.marginLeft + 380, boxY + 9, { width: 110, align: "right" });
      }
      
      this.doc.y = boxY + 30;
      
      if (item.description) {
        this.doc.fontSize(9)
           .fillColor(COLORS.text)
           .text("Описание:", PAGE.marginLeft + 10, this.doc.y, { underline: true });
        this.doc.fontSize(9)
           .fillColor(COLORS.textMuted)
           .text(item.description, PAGE.marginLeft + 10, this.doc.y + 12, { width: PAGE.contentWidth - 20 });
        this.doc.moveDown(0.8);
      }
      
      if (item.howToFix) {
        this.doc.fontSize(9)
           .fillColor(COLORS.success)
           .text("Как исправить:", PAGE.marginLeft + 10, this.doc.y, { underline: true });
        this.doc.fontSize(9)
           .fillColor(COLORS.text)
           .text(item.howToFix, PAGE.marginLeft + 10, this.doc.y + 12, { width: PAGE.contentWidth - 20 });
        this.doc.moveDown(0.8);
      }
      
      if (item.codeExample) {
        this.checkPageBreak(80);
        
        this.doc.fontSize(9)
           .fillColor(COLORS.primary)
           .text("Пример кода:", PAGE.marginLeft + 10, this.doc.y, { underline: true });
        
        const codeY = this.doc.y + 12;
        const codeHeight = Math.min(60, item.codeExample.split("\n").length * 12 + 10);
        
        this.doc.rect(PAGE.marginLeft + 10, codeY, PAGE.contentWidth - 20, codeHeight)
           .fillColor("#f8f9fa")
           .fill();
        
        this.doc.rect(PAGE.marginLeft + 10, codeY, PAGE.contentWidth - 20, codeHeight)
           .strokeColor(COLORS.border)
           .lineWidth(0.5)
           .stroke();
        
        this.doc.fontSize(8)
           .fillColor(COLORS.text)
           .text(item.codeExample.substring(0, 300), PAGE.marginLeft + 15, codeY + 5, { width: PAGE.contentWidth - 30 });
        
        this.doc.y = codeY + codeHeight + 5;
      }
      
      this.doc.moveDown(1);
    });
  }
  
  private renderPenaltySection(): void {
    const criteria = this.data.criteria || [];
    const { totals, violations } = calculatePenalties(criteria);
    
    if (totals.uniqueViolations === 0) return;
    
    this.checkPageBreak(200);
    
    this.doc.fontSize(14)
       .fillColor(COLORS.danger)
       .text("РАСЧЁТ ШТРАФНЫХ РИСКОВ", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(0.3);
    
    this.doc.fontSize(9)
       .fillColor(COLORS.textMuted)
       .text(`Выявлено нарушений: ${totals.uniqueViolations} | Основание: КоАП РФ ст. 13.11`, PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(0.8);
    
    const tableY = this.doc.y;
    const rowHeight = 22;
    const colWidths = [150, 100, 100, 145];
    
    this.doc.rect(PAGE.marginLeft, tableY, PAGE.contentWidth, rowHeight)
       .fillColor(COLORS.backgroundAlt)
       .fill();
    
    let x = PAGE.marginLeft + 5;
    this.doc.fontSize(9).fillColor(COLORS.text);
    this.doc.text("Тип субъекта", x, tableY + 6);
    x += colWidths[0];
    this.doc.text("MIN", x, tableY + 6, { width: colWidths[1], align: "right" });
    x += colWidths[1];
    this.doc.text("MAX", x, tableY + 6, { width: colWidths[2], align: "right" });
    x += colWidths[2];
    this.doc.text("Примечание", x, tableY + 6, { width: colWidths[3] });
    
    let currentY = tableY + rowHeight;
    const subjects: SubjectType[] = ["citizen", "selfEmployed", "official", "ip", "legalEntity"];
    
    subjects.forEach((subj, idx) => {
      const data = totals.bySubject[subj];
      const bg = idx % 2 === 0 ? COLORS.background : COLORS.backgroundAlt;
      
      this.doc.rect(PAGE.marginLeft, currentY, PAGE.contentWidth, rowHeight)
         .fillColor(bg)
         .fill();
      
      this.doc.rect(PAGE.marginLeft, currentY, PAGE.contentWidth, rowHeight)
         .strokeColor(COLORS.border)
         .lineWidth(0.3)
         .stroke();
      
      let x = PAGE.marginLeft + 5;
      this.doc.fontSize(9).fillColor(COLORS.text);
      this.doc.text(getSubjectName(subj), x, currentY + 6);
      x += colWidths[0];
      
      this.doc.fillColor(data.minRub > 0 ? COLORS.danger : COLORS.text);
      this.doc.text(formatRub(data.minRub), x, currentY + 6, { width: colWidths[1], align: "right" });
      x += colWidths[1];
      
      this.doc.fillColor(data.maxRub > 0 ? COLORS.danger : COLORS.text);
      this.doc.text(formatRub(data.maxRub), x, currentY + 6, { width: colWidths[2], align: "right" });
      x += colWidths[2];
      
      const note = subj === "selfEmployed" ? "как физлицо" : "";
      this.doc.fontSize(8).fillColor(COLORS.textMuted);
      this.doc.text(note, x, currentY + 7);
      
      currentY += rowHeight;
    });
    
    this.doc.y = currentY + 10;
    
    this.doc.fontSize(8)
       .fillColor(COLORS.textMuted)
       .text(`* ${SELF_EMPLOYED_RULE}`, PAGE.marginLeft, this.doc.y, { width: PAGE.contentWidth });
    
    this.doc.moveDown(1);
  }
  
  private renderChecklist(): void {
    const criteria = this.data.criteria || [];
    const issues = criteria.filter(c => c.status !== "passed");
    
    if (issues.length === 0) return;
    
    this.addNewPage();
    this.doc.y = PAGE.marginTop + PAGE.headerHeight + 10;
    
    this.doc.fontSize(16)
       .fillColor(COLORS.primaryDark)
       .text("ЧЕК-ЛИСТ ДЛЯ УСТРАНЕНИЯ НАРУШЕНИЙ", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(0.5);
    
    this.doc.fontSize(9)
       .fillColor(COLORS.textMuted)
       .text("Распечатайте эту страницу и отмечайте выполненные пункты:", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(1);
    
    issues.forEach((item, idx) => {
      this.checkPageBreak(25);
      
      this.doc.rect(PAGE.marginLeft, this.doc.y, 12, 12)
         .strokeColor(COLORS.text)
         .lineWidth(1)
         .stroke();
      
      this.doc.fontSize(10)
         .fillColor(COLORS.text)
         .text(`${idx + 1}. ${item.name}`, PAGE.marginLeft + 20, this.doc.y + 1);
      
      this.doc.moveDown(0.8);
    });
  }
  
  private renderResourcesPage(): void {
    this.addNewPage();
    this.doc.y = PAGE.marginTop + PAGE.headerHeight + 10;
    
    this.doc.fontSize(16)
       .fillColor(COLORS.primaryDark)
       .text("ПОЛЕЗНЫЕ РЕСУРСЫ", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(1);
    
    const resources = [
      { title: "Роскомнадзор - официальный сайт", url: "rkn.gov.ru" },
      { title: "Реестр операторов ПДн", url: "pd.rkn.gov.ru" },
      { title: "Федеральный закон 152-ФЗ", url: "consultant.ru/document/cons_doc_LAW_61801" },
      { title: "Федеральный закон 149-ФЗ", url: "consultant.ru/document/cons_doc_LAW_61798" },
      { title: "КоАП РФ ст. 13.11", url: "consultant.ru/document/cons_doc_LAW_34661" },
      { title: "ФСТЭК России", url: "fstec.ru" },
    ];
    
    resources.forEach((res, idx) => {
      this.doc.fontSize(10)
         .fillColor(COLORS.text)
         .text(`${idx + 1}. ${res.title}`, PAGE.marginLeft, this.doc.y);
      
      this.doc.fontSize(9)
         .fillColor(COLORS.primary)
         .text(res.url, PAGE.marginLeft + 20, this.doc.y);
      
      this.doc.moveDown(0.8);
    });
    
    this.doc.moveDown(2);
    
    this.doc.fontSize(11)
       .fillColor(COLORS.primaryDark)
       .text("КОНТАКТЫ SECURELEX.RU", PAGE.marginLeft, this.doc.y);
    this.doc.moveDown(0.5);
    
    this.doc.fontSize(10)
       .fillColor(COLORS.text)
       .text("Сайт: securelex.ru", PAGE.marginLeft, this.doc.y);
    this.doc.text("Email: support@securelex.ru");
  }
  
  private addHeadersAndFooters(): void {
    const range = this.doc.bufferedPageRange();
    this.totalPages = range.count;
    
    for (let i = 0; i < this.totalPages; i++) {
      this.doc.switchToPage(i);
      this.renderHeader();
      this.renderFooter(i + 1, this.totalPages);
    }
  }
  
  async generate(): Promise<Buffer> {
    console.log(`[PDF-GEN] Starting ${this.reportType} report for audit #${this.data.auditId}`);
    
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = new PassThrough();
      
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
      
      this.doc.pipe(stream);
      
      this.renderCoverPage();
      
      if (this.reportType === "express") {
        this.addNewPage();
        this.doc.y = PAGE.marginTop + PAGE.headerHeight + 10;
        
        this.renderHostingBlock();
        this.renderHighlightsTable();
        this.renderBriefRecommendations();
        this.renderCtaPage();
      } else {
        this.addNewPage();
        this.doc.y = PAGE.marginTop + PAGE.headerHeight + 10;
        
        this.renderHostingBlock();
        this.renderHighlightsTable();
        this.renderFullCriteriaTable();
        this.renderDetailedAnalysis();
        this.renderPenaltySection();
        this.renderChecklist();
        this.renderResourcesPage();
      }
      
      this.addHeadersAndFooters();
      
      this.doc.end();
    });
  }
}

export async function generatePdfReport(
  data: PdfReportData, 
  type: ReportType = "full"
): Promise<Buffer> {
  const generator = new PdfReportGenerator(data, type);
  return generator.generate();
}

export function getCriteriaCategory(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("персональн") || nameLower.includes("согласи") || nameLower.includes("152")) {
    return "ФЗ-152";
  }
  if (nameLower.includes("cookie")) {
    return "Cookie-политика";
  }
  if (nameLower.includes("информац") || nameLower.includes("149") || nameLower.includes("реквизит")) {
    return "ФЗ-149";
  }
  if (nameLower.includes("ssl") || nameLower.includes("безопасност") || nameLower.includes("https")) {
    return "Техническая безопасность";
  }
  return "Общие требования";
}
