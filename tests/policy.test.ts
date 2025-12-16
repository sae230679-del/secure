import { describe, it, expect } from "vitest";
import { 
  assertAllowedIntegration, 
  isIntegrationAllowed, 
  SourcePolicyError,
  validatePaymentProvider 
} from "../server/policy/sourcePolicy";
import { getViolations } from "../server/policy/noSimulationGuard";
import { validateConsent152 } from "../server/legal/consent152Validator";
import { runInfo149Checks } from "../server/legal/info149Checks";

describe("Source Policy", () => {
  it("allows Russian payment providers", () => {
    expect(isIntegrationAllowed("yookassa")).toBe(true);
    expect(isIntegrationAllowed("robokassa")).toBe(true);
    expect(isIntegrationAllowed("cloudpayments")).toBe(true);
  });

  it("allows local technical methods", () => {
    expect(isIntegrationAllowed("dns")).toBe(true);
    expect(isIntegrationAllowed("whois")).toBe(true);
    expect(isIntegrationAllowed("html_fetch")).toBe(true);
  });

  it("denies foreign services", () => {
    expect(isIntegrationAllowed("google_pagespeed")).toBe(false);
    expect(isIntegrationAllowed("maxmind_geoip")).toBe(false);
    expect(isIntegrationAllowed("ahrefs_api")).toBe(false);
  });

  it("throws error for denied integrations", () => {
    expect(() => assertAllowedIntegration("google_pagespeed")).toThrow(SourcePolicyError);
  });

  it("validates payment providers", () => {
    expect(() => validatePaymentProvider("yookassa")).not.toThrow();
    expect(() => validatePaymentProvider("stripe")).toThrow(SourcePolicyError);
  });
});

describe("No Simulation Guard", () => {
  it("returns no violations for clean codebase", () => {
    const violations = getViolations(".");
    const nonTestViolations = violations.filter(
      v => !v.file.includes("test") && !v.file.includes("noSimulationGuard")
    );
    expect(nonTestViolations.length).toBe(0);
  });
});

describe("Consent 152-FZ Validator", () => {
  it("fails when required fields are missing", () => {
    const result = validateConsent152({ mode: "website_checkbox" });
    expect(result.isValid).toBe(false);
    expect(result.hasErrors).toBe(true);
    expect(result.issues.some(i => i.code === "OPERATOR_NAME_MISSING")).toBe(true);
  });

  it("passes with all required fields", () => {
    const result = validateConsent152({
      mode: "website_checkbox",
      operatorName: "ООО Тест",
      operatorAddress: "г. Москва, ул. Тестовая, д. 1",
      purposes: ["Обработка заявок"],
      pdnCategories: ["ФИО", "Email"],
      processingActions: ["Сбор", "Хранение"],
      storagePeriod: "5 лет",
      withdrawalProcedure: "Отправить заявление на email@test.ru",
    });
    expect(result.isValid).toBe(true);
    expect(result.hasErrors).toBe(false);
  });

  it("adds warnings for recommended fields", () => {
    const result = validateConsent152({
      mode: "website_checkbox",
      operatorName: "ООО Тест",
      operatorAddress: "г. Москва",
      purposes: ["Обработка"],
      pdnCategories: ["ФИО"],
      processingActions: ["Сбор"],
      storagePeriod: "5 лет",
      withdrawalProcedure: "email@test.ru",
    });
    expect(result.isValid).toBe(true);
    expect(result.hasWarnings).toBe(true);
    expect(result.issues.some(i => i.code === "OPERATOR_INN_RECOMMENDED")).toBe(true);
  });

  it("requires signature for written mode", () => {
    const result = validateConsent152({
      mode: "written",
      operatorName: "ООО Тест",
      operatorAddress: "г. Москва",
      purposes: ["Обработка"],
      pdnCategories: ["ФИО"],
      processingActions: ["Сбор"],
      storagePeriod: "5 лет",
      withdrawalProcedure: "email@test.ru",
      subjectName: "Иванов Иван Иванович",
      subjectDocument: "Паспорт 1234 567890",
      hasSignature: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.issues.some(i => i.code === "SIGNATURE_MISSING")).toBe(true);
  });
});

describe("149-FZ Checks", () => {
  it("detects missing owner identification", () => {
    const result = runInfo149Checks({
      html: "<html><body>Просто страница без контактов</body></html>",
      url: "https://example.com",
    });
    
    const ownerCheck = result.checks.find(c => c.id === "149_OWNER_IDENTIFICATION");
    expect(ownerCheck).toBeDefined();
    expect(ownerCheck?.status).toBe("fail");
  });

  it("detects owner with INN", () => {
    const result = runInfo149Checks({
      html: "<html><body>ООО Рога и Копыта ИНН: 7707083893</body></html>",
      url: "https://example.com",
    });
    
    const ownerCheck = result.checks.find(c => c.id === "149_OWNER_IDENTIFICATION");
    expect(ownerCheck).toBeDefined();
    expect(ownerCheck?.status).toBe("ok");
    expect(ownerCheck?.evidence.length).toBeGreaterThan(0);
  });

  it("detects contact information", () => {
    const result = runInfo149Checks({
      html: "<html><body>ООО Тест info@test.ru +7 (999) 123-45-67</body></html>",
      url: "https://example.com",
    });
    
    const contactCheck = result.checks.find(c => c.id === "149_CONTACT_INFO");
    expect(contactCheck).toBeDefined();
    expect(contactCheck?.evidence.some(e => e.includes("Email"))).toBe(true);
  });

  it("warns about subscription without unsubscribe", () => {
    const result = runInfo149Checks({
      html: "<html><body>Подписаться на рассылку</body></html>",
      url: "https://example.com",
    });
    
    const unsubCheck = result.checks.find(c => c.id === "149_UNSUBSCRIBE_MECHANISM");
    expect(unsubCheck).toBeDefined();
    expect(unsubCheck?.status).toBe("warn");
  });
});
