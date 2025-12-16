/**
 * Защита от симуляций и моков в production коде
 * Сканирует репозиторий при старте и блокирует запуск при обнаружении запрещённых паттернов
 */

import fs from "fs";
import path from "path";

export interface SimulationViolation {
  file: string;
  line: number;
  pattern: string;
  context: string;
}

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bsimulate\w*\(/i,
  /\bsimulation\b/i,
  /\bmock\s*audit/i,
  /\bfake\s*result/i,
  /\bпримерный\s*результат/i,
  /\bтестовые\s*данные\b(?!.*test)/i,
  /\bgetRandomStatus\b/,
  /\bsimulateAuditResults\b/,
  /\bgetStatusByCategory\b/,
  /\bMOCK_MODE\s*=\s*true/i,
];

const ALLOWED_CONTEXT_PATTERNS: RegExp[] = [
  /MOCK_MODE.*FORBIDDEN/i,
  /process\.env\.AUDIT_MOCK_MODE.*production/i,
  /FATAL.*MOCK/i,
];

const EXCLUDED_PATHS = [
  "node_modules",
  ".git",
  "dist",
  "__tests__",
  "tests",
  ".test.",
  ".spec.",
  "test-",
  "noSimulationGuard.ts",
];

const SCANNABLE_EXTENSIONS = [".ts", ".js", ".tsx", ".jsx"];

function shouldScanFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  
  if (EXCLUDED_PATHS.some((ex) => normalized.includes(ex))) {
    return false;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  return SCANNABLE_EXTENSIONS.includes(ext);
}

function scanFile(filePath: string): SimulationViolation[] {
  const violations: SimulationViolation[] = [];
  
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    
    lines.forEach((line, index) => {
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) {
        return;
      }
      
      const isAllowedContext = ALLOWED_CONTEXT_PATTERNS.some(p => p.test(line));
      if (isAllowedContext) {
        return;
      }
      
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file: filePath,
            line: index + 1,
            pattern: pattern.source,
            context: line.trim().substring(0, 100),
          });
        }
      }
    });
  } catch (err) {
    console.warn(`[NO_SIMULATION_GUARD] Не удалось прочитать файл: ${filePath}`);
  }
  
  return violations;
}

function scanDirectory(dir: string): SimulationViolation[] {
  const violations: SimulationViolation[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!EXCLUDED_PATHS.some((ex) => entry.name.includes(ex))) {
          violations.push(...scanDirectory(fullPath));
        }
      } else if (entry.isFile() && shouldScanFile(fullPath)) {
        violations.push(...scanFile(fullPath));
      }
    }
  } catch (err) {
    console.warn(`[NO_SIMULATION_GUARD] Не удалось прочитать директорию: ${dir}`);
  }
  
  return violations;
}

export function runNoSimulationGuard(rootDir: string = "."): void {
  const isProduction = process.env.NODE_ENV === "production";
  const serverDir = path.join(rootDir, "server");
  const sharedDir = path.join(rootDir, "shared");
  
  console.log("[NO_SIMULATION_GUARD] Сканирование кода на запрещённые паттерны...");
  
  const violations: SimulationViolation[] = [];
  
  if (fs.existsSync(serverDir)) {
    violations.push(...scanDirectory(serverDir));
  }
  
  if (fs.existsSync(sharedDir)) {
    violations.push(...scanDirectory(sharedDir));
  }
  
  if (violations.length > 0) {
    console.error("[NO_SIMULATION_GUARD] ОБНАРУЖЕНЫ ЗАПРЕЩЁННЫЕ ПАТТЕРНЫ:");
    console.error("=".repeat(60));
    
    for (const v of violations) {
      console.error(`  Файл: ${v.file}:${v.line}`);
      console.error(`  Паттерн: ${v.pattern}`);
      console.error(`  Контекст: ${v.context}`);
      console.error("-".repeat(60));
    }
    
    if (isProduction) {
      console.error("[NO_SIMULATION_GUARD] CRITICAL: Обнаружены паттерны симуляции в production!");
      console.error("[NO_SIMULATION_GUARD] Приложение продолжит работу, но требуется проверка кода.");
    } else {
      console.warn("[NO_SIMULATION_GUARD] ПРЕДУПРЕЖДЕНИЕ: Обнаружены паттерны симуляции (dev режим, продолжаем)");
    }
  } else {
    console.log("[NO_SIMULATION_GUARD] OK: Запрещённые паттерны не обнаружены");
  }
}

export function getViolations(rootDir: string = "."): SimulationViolation[] {
  const serverDir = path.join(rootDir, "server");
  const sharedDir = path.join(rootDir, "shared");
  const violations: SimulationViolation[] = [];
  
  if (fs.existsSync(serverDir)) {
    violations.push(...scanDirectory(serverDir));
  }
  
  if (fs.existsSync(sharedDir)) {
    violations.push(...scanDirectory(sharedDir));
  }
  
  return violations;
}
