import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const FONT_PATH = path.join(process.cwd(), "server/fonts/DejaVuSans.ttf");
const FONT_NAME = "DejaVu";
const OUTPUT_PATH = "/tmp/test-cyrillic-multipage.pdf";

console.log("=== PDF Cyrillic Font Test ===");
console.log(`Font path: ${FONT_PATH}`);
console.log(`Font exists: ${fs.existsSync(FONT_PATH)}`);

if (!fs.existsSync(FONT_PATH)) {
  console.error("ERROR: Font file not found!");
  process.exit(1);
}

const fontStats = fs.statSync(FONT_PATH);
console.log(`Font size: ${fontStats.size} bytes`);

if (fontStats.size < 100000) {
  console.error("ERROR: Font file is too small (likely corrupted)");
  process.exit(1);
}

const doc = new PDFDocument();
const output = fs.createWriteStream(OUTPUT_PATH);
doc.pipe(output);

try {
  doc.registerFont(FONT_NAME, FONT_PATH);
  doc.font(FONT_NAME);
  console.log("SUCCESS: Font registered successfully");
} catch (e) {
  console.error("ERROR: Font registration failed:", e);
  process.exit(1);
}

doc.fontSize(24)
   .fillColor("#1a56db")
   .text("SECURELEX.RU", { align: "center" });

doc.moveDown();
doc.fontSize(12)
   .fillColor("#000000")
   .text("Тест кириллицы на первой странице:");

doc.moveDown(0.5);
doc.text("Дата проведения: 15 декабря 2024");
doc.text("Сервис проверки сайтов на соответствие законодательству РФ");
doc.text("ФЗ-152, ФЗ-149 — Федеральные законы о персональных данных");
doc.text("Штрафы для юридических лиц составляют до 18 000 000 ₽");

doc.addPage();
doc.font(FONT_NAME);
doc.fontSize(16)
   .fillColor("#dc2626")
   .text("ВТОРАЯ СТРАНИЦА — ПРОВЕРКА ШРИФТА");

doc.moveDown();
doc.fontSize(12)
   .fillColor("#000000")
   .text("После doc.addPage() шрифт должен быть переустановлен.");
doc.text("Этот текст также должен отображаться на кириллице корректно.");
doc.text("Привет мир! Проверка: абвгдеёжзийклмнопрстуфхцчшщъыьэюя");
doc.text("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ");

doc.addPage();
doc.font(FONT_NAME);
doc.fontSize(14)
   .fillColor("#22c55e")
   .text("ТРЕТЬЯ СТРАНИЦА — ИТОГОВЫЙ ТЕСТ");

doc.moveDown();
doc.fontSize(11)
   .fillColor("#374151");

const testTexts = [
  "✓ Политика конфиденциальности присутствует",
  "⚠ Предупреждение: cookie-баннер требует доработки",
  "✗ Нарушение: отсутствует уведомление оператора ПД",
  "▶ Категория: Техническая безопасность",
];

testTexts.forEach(text => {
  doc.text(text);
  doc.moveDown(0.3);
});

doc.end();

output.on("finish", () => {
  const resultStats = fs.statSync(OUTPUT_PATH);
  console.log(`\nPDF generated: ${OUTPUT_PATH}`);
  console.log(`File size: ${resultStats.size} bytes`);
  
  if (resultStats.size > 5000) {
    console.log("\n=== TEST PASSED ===");
    console.log("PDF with Cyrillic text generated successfully.");
    console.log("Please open the PDF to visually verify Cyrillic rendering.");
  } else {
    console.error("\n=== TEST FAILED ===");
    console.error("PDF file is too small, may indicate font issues.");
    process.exit(1);
  }
});

output.on("error", (err) => {
  console.error("ERROR: Failed to write PDF:", err);
  process.exit(1);
});
