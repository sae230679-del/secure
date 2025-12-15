import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import path from "path";
import fs from "fs";
import { 
  PENALTY_MAP, 
  calcPenaltyTotals, 
  attachPenalties, 
  formatRub, 
  getSubjectName,
  SELF_EMPLOYED_RULE,
  type SubjectType,
  type PenaltyTotals
} from "./penalties-map";

const FONT_PATH = path.join(process.cwd(), "server/fonts/DejaVuSans.ttf");
const FONT_NAME = "DejaVu";

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

function addPageWithFont(doc: PDFKit.PDFDocument): void {
  doc.addPage();
  doc.font(FONT_NAME);
}

// AI mode type
type AuditAiMode = "gigachat_only" | "openai_only" | "hybrid" | "none";

// Color constants for AI block
const AI_COLORS = {
  header: "#6366f1",      // Indigo for AI header
  critical: "#dc2626",    // Red for critical items
  medium: "#f59e0b",      // Amber for medium priority
  low: "#22c55e",         // Green for low priority / passed
  text: "#374151",        // Gray-700 for text
  background: "#eef2ff",  // Light indigo background
  border: "#a5b4fc",      // Indigo border
};

interface CriteriaResult {
  name: string;
  description: string;
  status: "passed" | "warning" | "failed";
  details: string;
  category?: string;
  law?: string;
}

interface AuditReportData {
  auditId: number;
  websiteUrl: string;
  companyName?: string;
  scorePercent: number;
  severity: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  totalCount: number;
  criteria: CriteriaResult[];
  createdAt: Date;
  packageName: string;
  // AI analysis fields
  aiSummary?: string;
  aiRecommendations?: string[];
  aiMode?: AuditAiMode;
}

// Classify recommendation priority based on keywords
function classifyPriority(text: string): "critical" | "medium" | "low" {
  const textLower = text.toLowerCase();
  if (textLower.includes("критич") || textLower.includes("срочно") || 
      textLower.includes("немедленно") || textLower.includes("обязательно") ||
      textLower.includes("штраф") || textLower.includes("блокировк")) {
    return "critical";
  }
  if (textLower.includes("рекоменду") || textLower.includes("желательно") ||
      textLower.includes("следует") || textLower.includes("важно")) {
    return "medium";
  }
  return "low";
}

// Get icon for priority
function getPriorityIcon(priority: "critical" | "medium" | "low"): string {
  switch (priority) {
    case "critical": return "[!]";
    case "medium": return "[~]";
    case "low": return "[+]";
  }
}

// Get color for priority
function getPriorityColor(priority: "critical" | "medium" | "low"): string {
  switch (priority) {
    case "critical": return AI_COLORS.critical;
    case "medium": return AI_COLORS.medium;
    case "low": return AI_COLORS.low;
  }
}

// Render express (brief) AI block - for expressreport package
function renderExpressAIBlock(doc: PDFKit.PDFDocument, data: AuditReportData): void {
  const startY = doc.y;
  
  // Background box
  doc.rect(50, startY, 495, 120)
     .fillColor(AI_COLORS.background)
     .fill();
  
  // Border
  doc.rect(50, startY, 495, 120)
     .strokeColor(AI_COLORS.border)
     .lineWidth(1)
     .stroke();
  
  // Header
  doc.fillColor(AI_COLORS.header)
     .fontSize(14)
     .text("[AI] ИИ-АНАЛИЗ", 70, startY + 12);
  
  // Summary (truncated to 2 lines max)
  doc.fillColor(AI_COLORS.text)
     .fontSize(10);
  
  const summaryText = data.aiSummary || "";
  const truncatedSummary = summaryText.length > 200 
    ? summaryText.substring(0, 197) + "..." 
    : summaryText;
  
  doc.text("Резюме:", 70, startY + 35, { underline: true });
  doc.text(truncatedSummary, 70, startY + 50, { width: 455 });
  
  // TOP-3 recommendations
  if (data.aiRecommendations && data.aiRecommendations.length > 0) {
    const top3 = data.aiRecommendations.slice(0, 3);
    let recY = startY + 80;
    
    doc.text("ТОП-3:", 70, recY, { underline: true });
    recY += 12;
    
    top3.forEach((rec, idx) => {
      const priority = classifyPriority(rec);
      const icon = getPriorityIcon(priority);
      const color = getPriorityColor(priority);
      const shortRec = rec.length > 60 ? rec.substring(0, 57) + "..." : rec;
      
      doc.fillColor(color)
         .text(icon, 70, recY, { continued: true })
         .fillColor(AI_COLORS.text)
         .text(` ${shortRec}`, { continued: false });
      recY += 12;
    });
  }
  
  doc.y = startY + 130;
}

// Render full AI block - for all other packages
function renderFullAIBlock(doc: PDFKit.PDFDocument, data: AuditReportData): void {
  const startY = doc.y;
  const recommendations = data.aiRecommendations || [];
  
  // Calculate height needed
  const headerHeight = 30;
  const summaryHeight = 60;
  const recHeight = Math.min(recommendations.length * 18, 120);
  const footerHeight = 25;
  const totalHeight = headerHeight + summaryHeight + recHeight + footerHeight + 20;
  
  // Check if we need a new page
  if (startY + totalHeight > 720) {
    addPageWithFont(doc);
  }
  
  const boxY = doc.y;
  
  // Background box
  doc.rect(50, boxY, 495, totalHeight)
     .fillColor(AI_COLORS.background)
     .fill();
  
  // Border
  doc.rect(50, boxY, 495, totalHeight)
     .strokeColor(AI_COLORS.border)
     .lineWidth(1)
     .stroke();
  
  // Header with icon
  doc.fillColor(AI_COLORS.header)
     .fontSize(14)
     .text("[AI] ИИ-АНАЛИТИКА ПО ФЗ-152/149", 70, boxY + 12);
  
  // Summary section
  doc.fillColor(AI_COLORS.text)
     .fontSize(11)
     .text("РЕЗЮМЕ АНАЛИЗА:", 70, boxY + 35, { underline: true });
  
  doc.fontSize(10);
  const summaryText = data.aiSummary || "Анализ не проведён";
  doc.text(summaryText, 70, boxY + 50, { width: 455 });
  
  // Recommendations section
  if (recommendations.length > 0) {
    let recY = boxY + summaryHeight + headerHeight;
    
    doc.fillColor(AI_COLORS.text)
       .fontSize(11)
       .text("РЕКОМЕНДАЦИИ:", 70, recY, { underline: true });
    recY += 15;
    
    recommendations.forEach((rec, idx) => {
      if (recY > boxY + totalHeight - 30) return; // Don't overflow
      
      const priority = classifyPriority(rec);
      const icon = getPriorityIcon(priority);
      const color = getPriorityColor(priority);
      
      doc.fillColor(color)
         .fontSize(10)
         .text(icon, 70, recY, { continued: true })
         .fillColor(AI_COLORS.text)
         .text(` ${rec}`, { continued: false, width: 440 });
      
      recY += 18;
    });
  }
  
  // Footer with AI provider info
  const aiModeText = data.aiMode === "gigachat_only" ? "GigaChat" :
                     data.aiMode === "openai_only" ? "OpenAI GPT" :
                     data.aiMode === "hybrid" ? "Hybrid (OpenAI + GigaChat)" : "N/A";
  
  doc.fillColor("#9ca3af")
     .fontSize(8)
     .text(`Powered by ${aiModeText} | ai_mode: ${data.aiMode || "unknown"}`, 
           70, boxY + totalHeight - 18, { width: 455, align: "right" });
  
  doc.y = boxY + totalHeight + 10;
}

const FINES_INFO: Record<string, { law: string; article: string; fine: string; risk: string }> = {
  "ФЗ-152": {
    law: "Федеральный закон № 152-ФЗ «О персональных данных»",
    article: "ст. 13.11 КоАП РФ",
    fine: "от 6 000 до 18 000 000 ₽",
    risk: "Штрафы для должностных лиц от 10 000 ₽, для юрлиц от 60 000 ₽ до 18 000 000 ₽ при повторных нарушениях",
  },
  "ФЗ-149": {
    law: "Федеральный закон № 149-ФЗ «Об информации»",
    article: "ст. 13.18 КоАП РФ, ст. 274 УК РФ",
    fine: "от 50 000 до 500 000 ₽",
    risk: "Блокировка сайта Роскомнадзором, уголовная ответственность за утечку данных",
  },
};

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
  passed: [34, 139, 34],
  warning: [218, 165, 32],
  failed: [220, 53, 69],
};

function getCategoryFromCriteria(name: string): string {
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

function getLawFromCategory(category: string): string {
  if (category === "ФЗ-152") return "ФЗ-152";
  if (category === "ФЗ-149") return "ФЗ-149";
  if (category === "Cookie-политика") return "ФЗ-152";
  return "";
}

// Map criterion names to PENALTY_MAP checkIds
function mapCriterionNameToCheckId(name: string): string | null {
  const nameLower = name.toLowerCase();
  
  // Privacy policy
  if (nameLower.includes("политик") && (nameLower.includes("конфиденциальн") || nameLower.includes("пдн"))) {
    return "LEGAL_PRIVACY_POLICY_MISSING";
  }
  if (nameLower.includes("privacy policy")) return "LEGAL_PRIVACY_POLICY_MISSING";
  
  // Consent checkbox  
  if (nameLower.includes("согласи") && (nameLower.includes("форм") || nameLower.includes("чекбокс") || nameLower.includes("checkbox"))) {
    return "PDN_CONSENT_CHECKBOX_MISSING";
  }
  if (nameLower.includes("согласие на обработку")) return "PDN_CONSENT_CHECKBOX_MISSING";
  
  // Cookie banner
  if (nameLower.includes("cookie") && (nameLower.includes("баннер") || nameLower.includes("banner") || nameLower.includes("согласи"))) {
    return "COOKIES_BANNER_MISSING";
  }
  
  // Contacts
  if (nameLower.includes("контакт") || nameLower.includes("реквизит")) {
    return "LEGAL_CONTACTS_MISSING";
  }
  
  // HTTPS/SSL
  if (nameLower.includes("https") || nameLower.includes("ssl") || nameLower.includes("сертификат")) {
    return "TECH_NO_HTTPS";
  }
  
  // Security headers
  if (nameLower.includes("hsts")) return "TECH_NO_HSTS";
  if (nameLower.includes("csp") || nameLower.includes("content-security-policy")) return "TECH_NO_CSP";
  if (nameLower.includes("x-frame") || nameLower.includes("frame-options")) return "TECH_NO_XFRAME";
  if (nameLower.includes("x-content-type") || nameLower.includes("content-type-options")) return "TECH_NO_CONTENT_TYPE_OPTIONS";
  
  // Data processing agreement
  if (nameLower.includes("поручени") && nameLower.includes("обработк")) return "LEGAL_NO_DPA";
  
  // Operator notification
  if (nameLower.includes("реестр") || nameLower.includes("уведомлени")) return "LEGAL_RKN_NO_NOTIFICATION";
  
  // Data localization
  if (nameLower.includes("локализац") || nameLower.includes("россий")) return "LEGAL_DATA_NOT_LOCALIZED";
  
  return null;
}

// Calculate penalty totals from criteria results
function calculatePenaltyTotalsFromCriteria(criteria: CriteriaResult[]): PenaltyTotals {
  const checkResults: { checkId: string; status: string }[] = [];
  
  for (const c of criteria) {
    if (c.status === "passed") continue; // Skip passed checks
    
    const checkId = mapCriterionNameToCheckId(c.name);
    if (checkId && PENALTY_MAP[checkId]) {
      checkResults.push({ checkId, status: c.status });
    }
  }
  
  return calcPenaltyTotals(checkResults);
}

// Render calculated penalty totals section
function renderPenaltyTotalsSection(doc: PDFKit.PDFDocument, penaltyTotals: PenaltyTotals): void {
  const primaryColor = "#1e3a5f";
  const dangerColor = "#dc2626";
  
  if (penaltyTotals.uniqueViolations === 0) return;
  
  doc.moveDown(1);
  doc.fontSize(14)
     .fillColor(primaryColor)
     .text("РАСЧЁТ ШТРАФНЫХ РИСКОВ ПО КоАП РФ", { underline: true });
  doc.moveDown(0.5);
  
  doc.fontSize(9)
     .fillColor("#6b7280")
     .text(`Выявлено уникальных нарушений: ${penaltyTotals.uniqueViolations}`, { indent: 10 });
  doc.text(`Основная статья: КоАП РФ ст. 13.11`, { indent: 10 });
  doc.moveDown(0.5);
  
  // Table header
  const tableStartY = doc.y;
  const colWidths = [140, 100, 100, 140];
  const rowHeight = 22;
  
  doc.rect(50, tableStartY, 480, rowHeight)
     .fillColor("#f3f4f6")
     .fill();
  
  doc.fillColor("#1f2937")
     .fontSize(9);
  
  let x = 55;
  doc.text("Тип субъекта", x, tableStartY + 6, { width: colWidths[0] });
  x += colWidths[0];
  doc.text("MIN штраф", x, tableStartY + 6, { width: colWidths[1], align: "right" });
  x += colWidths[1];
  doc.text("MAX штраф", x, tableStartY + 6, { width: colWidths[2], align: "right" });
  x += colWidths[2];
  doc.text("Примечание", x, tableStartY + 6, { width: colWidths[3] });
  
  let currentY = tableStartY + rowHeight;
  
  const subjectOrder: SubjectType[] = ["citizen", "selfEmployed", "official", "ip", "legalEntity"];
  
  subjectOrder.forEach((subject, idx) => {
    const totals = penaltyTotals.bySubject[subject];
    const bgColor = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
    
    doc.rect(50, currentY, 480, rowHeight)
       .fillColor(bgColor)
       .fill();
    
    doc.rect(50, currentY, 480, rowHeight)
       .strokeColor("#e5e7eb")
       .lineWidth(0.5)
       .stroke();
    
    let x = 55;
    doc.fillColor("#374151")
       .fontSize(9);
    
    doc.text(getSubjectName(subject), x, currentY + 6, { width: colWidths[0] });
    x += colWidths[0];
    
    const minColor = totals.minRub > 0 ? dangerColor : "#374151";
    const maxColor = totals.maxRub > 0 ? dangerColor : "#374151";
    
    doc.fillColor(minColor)
       .text(formatRub(totals.minRub), x, currentY + 6, { width: colWidths[1], align: "right" });
    x += colWidths[1];
    doc.fillColor(maxColor)
       .text(formatRub(totals.maxRub), x, currentY + 6, { width: colWidths[2], align: "right" });
    x += colWidths[2];
    
    const note = subject === "selfEmployed" ? "как физлицо" : "";
    doc.fillColor("#6b7280")
       .fontSize(8)
       .text(note, x, currentY + 7, { width: colWidths[3] });
    
    currentY += rowHeight;
  });
  
  doc.y = currentY + 10;
  
  // Self-employed rule note
  doc.fontSize(8)
     .fillColor("#6b7280")
     .text(`* ${SELF_EMPLOYED_RULE}`, 50, doc.y, { width: 480 });
  
  doc.moveDown(1);
}

export async function generatePdfReport(data: AuditReportData): Promise<Buffer> {
  console.log(`[PDF-GEN] Starting PDF generation for audit ${data.auditId}`);
  
  const safeData: AuditReportData = {
    auditId: data.auditId || 0,
    websiteUrl: data.websiteUrl || "unknown",
    companyName: data.companyName,
    scorePercent: data.scorePercent ?? 0,
    severity: data.severity || "red",
    passedCount: data.passedCount ?? 0,
    warningCount: data.warningCount ?? 0,
    failedCount: data.failedCount ?? 0,
    totalCount: data.totalCount ?? 0,
    criteria: (data.criteria || []).map(c => ({
      name: c?.name || "Без названия",
      description: c?.description || "",
      status: c?.status || "warning",
      details: c?.details || "",
      category: c?.category,
      law: c?.law,
    })),
    createdAt: data.createdAt || new Date(),
    packageName: data.packageName || "Аудит",
    aiSummary: data.aiSummary,
    aiRecommendations: data.aiRecommendations || [],
    aiMode: data.aiMode,
  };
  
  console.log(`[PDF-GEN] SafeData: criteria=${safeData.criteria.length}, score=${safeData.scorePercent}`);
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `Отчёт аудита сайта ${safeData.websiteUrl}`,
        Author: "SecureLex.ru",
        Subject: "Аудит соответствия законодательству",
        Keywords: "ФЗ-152, ФЗ-149, аудит, персональные данные",
      },
    });
    
    const data = safeData;

    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    doc.pipe(stream);

    const fontPath = getFontPath();
    console.log(`[PDF-GEN] Using font: ${fontPath}, exists: ${fs.existsSync(fontPath)}`);
    try {
      doc.registerFont(FONT_NAME, fontPath);
      doc.font(FONT_NAME);
      console.log(`[PDF-GEN] DejaVu font registered successfully`);
    } catch (fontError) {
      console.error(`[PDF-GEN] Font error, using Helvetica: ${fontError}`);
      doc.font("Helvetica");
    }

    const primaryColor = "#1a56db";
    const secondaryColor = "#6b7280";
    const successColor = "#22c55e";
    const warningColor = "#eab308";
    const dangerColor = "#dc2626";

    doc.fontSize(24)
       .fillColor(primaryColor)
       .text("SECURELEX.RU", { align: "center" });
    
    doc.moveDown(0.5);
    doc.fontSize(10)
       .fillColor(secondaryColor)
       .text("Сервис проверки сайтов на соответствие законодательству РФ", { align: "center" });

    doc.moveDown(2);
    doc.fontSize(20)
       .fillColor("#1f2937")
       .text("ПОЛНЫЙ ОТЧЁТ АУДИТА", { align: "center" });

    doc.moveDown(1);
    doc.fontSize(14)
       .fillColor(primaryColor)
       .text(data.websiteUrl, { align: "center" });

    doc.moveDown(2);

    const boxY = doc.y;
    doc.rect(50, boxY, 495, 100)
       .fillColor("#f3f4f6")
       .fill();

    doc.fillColor("#1f2937")
       .fontSize(12)
       .text("Дата проведения:", 70, boxY + 15)
       .text("Тип проверки:", 70, boxY + 35)
       .text("Общий результат:", 70, boxY + 55)
       .text("Статус:", 70, boxY + 75);

    doc.fontSize(12)
       .text(new Date(data.createdAt).toLocaleDateString("ru-RU", { 
         year: "numeric", 
         month: "long", 
         day: "numeric" 
       }), 200, boxY + 15)
       .text(data.packageName, 200, boxY + 35)
       .text(`${data.scorePercent}%`, 200, boxY + 55);

    const severityText = data.severity === "green" ? "Соответствует" : 
                         data.severity === "yellow" ? "Частично соответствует" : "Не соответствует";
    const severityColor = data.severity === "green" ? successColor : 
                          data.severity === "yellow" ? warningColor : dangerColor;
    doc.fillColor(severityColor)
       .text(severityText, 200, boxY + 75);

    doc.y = boxY + 120;

    doc.moveDown(1);
    doc.fontSize(11)
       .fillColor("#1f2937");
    
    const statsY = doc.y;
    const colWidth = 165;
    
    doc.rect(50, statsY, colWidth - 5, 50).fillColor("#dcfce7").fill();
    doc.rect(50 + colWidth, statsY, colWidth - 5, 50).fillColor("#fef9c3").fill();
    doc.rect(50 + colWidth * 2, statsY, colWidth - 5, 50).fillColor("#fee2e2").fill();

    doc.fillColor("#166534").fontSize(20)
       .text(data.passedCount.toString(), 50, statsY + 10, { width: colWidth - 5, align: "center" });
    doc.fontSize(10).text("Пройдено", 50, statsY + 32, { width: colWidth - 5, align: "center" });

    doc.fillColor("#854d0e").fontSize(20)
       .text(data.warningCount.toString(), 50 + colWidth, statsY + 10, { width: colWidth - 5, align: "center" });
    doc.fontSize(10).text("Предупреждений", 50 + colWidth, statsY + 32, { width: colWidth - 5, align: "center" });

    doc.fillColor("#991b1b").fontSize(20)
       .text(data.failedCount.toString(), 50 + colWidth * 2, statsY + 10, { width: colWidth - 5, align: "center" });
    doc.fontSize(10).text("Нарушений", 50 + colWidth * 2, statsY + 32, { width: colWidth - 5, align: "center" });

    doc.y = statsY + 70;

    // AI Analysis Block - render ONLY if AI data is available
    if (data.aiSummary && data.aiRecommendations && data.aiRecommendations.length > 0) {
      doc.moveDown(1);
      
      // Use express (brief) block for expressreport package, full block for others
      if (data.packageName === "Экспресс-отчёт" || data.packageName?.includes("Экспресс") || data.packageName === "expressreport") {
        renderExpressAIBlock(doc, data);
      } else {
        renderFullAIBlock(doc, data);
      }
    }

    addPageWithFont(doc);
    doc.fontSize(16)
       .fillColor(primaryColor)
       .text("ДЕТАЛЬНЫЕ РЕЗУЛЬТАТЫ ПРОВЕРКИ", { underline: true });
    doc.moveDown(1);

    const groupedCriteria: Record<string, CriteriaResult[]> = {};
    data.criteria.forEach(c => {
      const category = c.category || getCategoryFromCriteria(c.name);
      if (!groupedCriteria[category]) {
        groupedCriteria[category] = [];
      }
      groupedCriteria[category].push({ ...c, category });
    });

    Object.entries(groupedCriteria).forEach(([category, criteriaList]) => {
      if (doc.y > 700) {
        addPageWithFont(doc);
      }

      doc.fontSize(13)
         .fillColor(primaryColor)
         .text(`▶ ${category}`, { continued: false });
      doc.moveDown(0.5);

      criteriaList.forEach((criterion, idx) => {
        if (doc.y > 720) {
          addPageWithFont(doc);
        }

        const statusIcon = criterion.status === "passed" ? "✓" : 
                           criterion.status === "warning" ? "⚠" : "✗";
        const statusColor = criterion.status === "passed" ? successColor : 
                            criterion.status === "warning" ? warningColor : dangerColor;

        doc.fontSize(11)
           .fillColor(statusColor)
           .text(statusIcon, { continued: true })
           .fillColor("#1f2937")
           .text(` ${criterion.name}`, { continued: false });

        doc.fontSize(9)
           .fillColor(secondaryColor)
           .text(`   ${criterion.description}`, { indent: 20 });

        if (criterion.details) {
          doc.fontSize(9)
             .fillColor("#4b5563")
             .text(`   Детали: ${criterion.details}`, { indent: 20 });
        }

        const law = criterion.law || getLawFromCategory(category);
        if (law && criterion.status !== "passed") {
          doc.fontSize(9)
             .fillColor(dangerColor)
             .text(`   Требование: ${law}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      doc.moveDown(0.5);
    });

    const hasViolations = data.failedCount > 0 || data.warningCount > 0;
    
    if (hasViolations) {
      addPageWithFont(doc);
      doc.fontSize(16)
         .fillColor(dangerColor)
         .text("⚠ ИНФОРМАЦИЯ О ШТРАФАХ И РИСКАХ", { underline: true });
      doc.moveDown(1);

      doc.fontSize(10)
         .fillColor("#1f2937")
         .text("При выявленных нарушениях законодательства предусмотрены следующие санкции:");
      doc.moveDown(1);

      Object.entries(FINES_INFO).forEach(([key, info]) => {
        if (doc.y > 680) {
          addPageWithFont(doc);
        }

        doc.fontSize(12)
           .fillColor(primaryColor)
           .text(info.law, { underline: false });
        
        doc.fontSize(10)
           .fillColor("#1f2937");
        
        doc.text(`Статья: ${info.article}`, { indent: 10 });
        doc.text(`Размер штрафа: ${info.fine}`, { indent: 10 });
        doc.fillColor(dangerColor)
           .text(`Риски: ${info.risk}`, { indent: 10 });
        
        doc.moveDown(1);
      });

      // Calculate and render penalty totals from actual violations
      const penaltyTotals = calculatePenaltyTotalsFromCriteria(data.criteria);
      renderPenaltyTotalsSection(doc, penaltyTotals);

      doc.moveDown(1);
      doc.rect(50, doc.y, 495, 80)
         .fillColor("#fef2f2")
         .fill();

      const warnBoxY = doc.y;
      doc.fillColor(dangerColor)
         .fontSize(12)
         .text("ВАЖНО!", 70, warnBoxY + 15, { underline: true });
      doc.fontSize(10)
         .fillColor("#991b1b")
         .text("С 1 сентября 2023 года штрафы за нарушения в области персональных данных", 70, warnBoxY + 35)
         .text("увеличены в несколько раз. Рекомендуем устранить нарушения в ближайшее время.", 70, warnBoxY + 50);

      doc.y = warnBoxY + 100;
    }

    addPageWithFont(doc);
    doc.fontSize(16)
       .fillColor(primaryColor)
       .text("РЕКОМЕНДАЦИИ ПО УСТРАНЕНИЮ", { underline: true });
    doc.moveDown(1);

    const failedCriteria = data.criteria.filter(c => c.status === "failed");
    const warningCriteria = data.criteria.filter(c => c.status === "warning");

    if (failedCriteria.length > 0) {
      doc.fontSize(12)
         .fillColor(dangerColor)
         .text("Критические нарушения (требуют немедленного устранения):");
      doc.moveDown(0.5);

      failedCriteria.forEach((c, idx) => {
        if (doc.y > 700) {
          addPageWithFont(doc);
        }
        doc.fontSize(10)
           .fillColor("#1f2937")
           .text(`${idx + 1}. ${c.name}`, { indent: 10 });
        doc.fontSize(9)
           .fillColor(secondaryColor)
           .text(`   Рекомендация: Необходимо устранить нарушение для соответствия требованиям законодательства`, { indent: 20 });
        doc.moveDown(0.3);
      });

      doc.moveDown(1);
    }

    if (warningCriteria.length > 0) {
      doc.fontSize(12)
         .fillColor(warningColor)
         .text("Предупреждения (рекомендуется исправить):");
      doc.moveDown(0.5);

      warningCriteria.forEach((c, idx) => {
        if (doc.y > 700) {
          addPageWithFont(doc);
        }
        doc.fontSize(10)
           .fillColor("#1f2937")
           .text(`${idx + 1}. ${c.name}`, { indent: 10 });
        doc.moveDown(0.3);
      });

      doc.moveDown(1);
    }

    addPageWithFont(doc);
    
    doc.rect(50, doc.y, 495, 200)
       .fillColor("#eff6ff")
       .fill();

    const promoY = doc.y;
    
    doc.fillColor(primaryColor)
       .fontSize(14)
       .text("ЗАКАЖИТЕ ПОЛНЫЙ АУДИТ САЙТА", 70, promoY + 20, { align: "center", width: 455 });

    doc.fontSize(11)
       .fillColor("#1f2937")
       .text("на соответствие ФЗ-152, ФЗ-149", 70, promoY + 45, { align: "center", width: 455 });

    doc.moveDown(1);
    doc.fontSize(10)
       .text("В полный аудит входит:", 70, promoY + 70);

    const services = [
      "Выявление всех нарушений законодательства",
      "Подготовка Политики конфиденциальности",
      "Составление форм согласия на обработку ПД",
      "Инструкции для сотрудников",
      "Настройка Cookie-баннера",
      "Юридическое сопровождение",
    ];

    services.forEach((service, idx) => {
      doc.fontSize(9)
         .fillColor("#1f2937")
         .text(`✓ ${service}`, 80, promoY + 90 + idx * 14);
    });

    doc.fontSize(12)
       .fillColor(dangerColor)
       .text("ЗАЩИТА ОТ ШТРАФОВ И БЛОКИРОВКИ!", 70, promoY + 175, { align: "center", width: 455 });

    doc.y = promoY + 220;

    doc.moveDown(1);
    doc.fontSize(11)
       .fillColor(primaryColor)
       .text("Контакты:", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10)
       .fillColor("#1f2937")
       .text("Сайт: securelex.ru")
       .text("Email: support@securelex.ru")
       .text("Телефон: +7 (XXX) XXX-XX-XX");

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      doc.fontSize(8)
         .fillColor(secondaryColor)
         .text(
           `SecureLex.ru | Отчёт аудита #${data.auditId} | ${data.websiteUrl} | Страница ${i + 1} из ${pageCount}`,
           50,
           doc.page.height - 30,
           { align: "center", width: 495 }
         );
    }

    doc.end();
  });
}

export function getCriteriaCategory(name: string): string {
  return getCategoryFromCriteria(name);
}
