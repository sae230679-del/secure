/**
 * Валидатор согласия на обработку персональных данных по ст. 9 ФЗ-152
 * Проверяет обязательные элементы согласия субъекта ПДн
 */

export type ConsentMode = "website_checkbox" | "written";

export interface ConsentValidationIssue {
  severity: "fail" | "warn";
  code: string;
  message: string;
  evidence: string[];
  lawRef: string;
}

export interface ConsentInput {
  mode: ConsentMode;
  operatorName?: string;
  operatorInn?: string;
  operatorAddress?: string;
  operatorContact?: string;
  purposes?: string[];
  pdnCategories?: string[];
  processingActions?: string[];
  thirdParties?: string[];
  storagePeriod?: string;
  terminationConditions?: string;
  withdrawalProcedure?: string;
  subjectName?: string;
  subjectDocument?: string;
  hasSignature?: boolean;
}

export interface ConsentValidationResult {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  issues: ConsentValidationIssue[];
}

const REQUIRED_FIELDS_COMMON = [
  { field: "operatorName", code: "OPERATOR_NAME_MISSING", message: "Не указано наименование оператора ПДн", lawRef: "п.1 ч.4 ст.9 152-ФЗ" },
  { field: "operatorAddress", code: "OPERATOR_ADDRESS_MISSING", message: "Не указан адрес оператора ПДн", lawRef: "п.1 ч.4 ст.9 152-ФЗ" },
  { field: "purposes", code: "PURPOSES_MISSING", message: "Не указаны цели обработки ПДн", lawRef: "п.2 ч.4 ст.9 152-ФЗ", isArray: true },
  { field: "pdnCategories", code: "PDN_CATEGORIES_MISSING", message: "Не указан перечень категорий ПДн", lawRef: "п.4 ч.4 ст.9 152-ФЗ", isArray: true },
  { field: "processingActions", code: "ACTIONS_MISSING", message: "Не указан перечень действий с ПДн", lawRef: "п.5 ч.4 ст.9 152-ФЗ", isArray: true },
  { field: "storagePeriod", code: "STORAGE_PERIOD_MISSING", message: "Не указан срок обработки ПДн", lawRef: "п.6 ч.4 ст.9 152-ФЗ" },
  { field: "withdrawalProcedure", code: "WITHDRAWAL_MISSING", message: "Не указан порядок отзыва согласия", lawRef: "п.7 ч.4 ст.9 152-ФЗ" },
];

const REQUIRED_FIELDS_WRITTEN = [
  { field: "subjectName", code: "SUBJECT_NAME_MISSING", message: "Не указаны ФИО субъекта ПДн", lawRef: "п.1 ч.4 ст.9 152-ФЗ" },
  { field: "subjectDocument", code: "SUBJECT_DOCUMENT_MISSING", message: "Не указаны реквизиты документа субъекта", lawRef: "п.2 ч.4 ст.9 152-ФЗ" },
];

export function validateConsent152(input: ConsentInput): ConsentValidationResult {
  const issues: ConsentValidationIssue[] = [];
  
  // Check common required fields
  for (const req of REQUIRED_FIELDS_COMMON) {
    const value = (input as any)[req.field];
    const isEmpty = req.isArray 
      ? !value || !Array.isArray(value) || value.length === 0
      : !value || (typeof value === "string" && value.trim() === "");
    
    if (isEmpty) {
      issues.push({
        severity: "fail",
        code: req.code,
        message: req.message,
        evidence: [`Поле "${req.field}" не заполнено или пустое`],
        lawRef: req.lawRef,
      });
    }
  }
  
  // Check written mode specific fields
  if (input.mode === "written") {
    for (const req of REQUIRED_FIELDS_WRITTEN) {
      const value = (input as any)[req.field];
      if (!value || (typeof value === "string" && value.trim() === "")) {
        issues.push({
          severity: "fail",
          code: req.code,
          message: req.message,
          evidence: [`Поле "${req.field}" обязательно для письменной формы согласия`],
          lawRef: req.lawRef,
        });
      }
    }
    
    // Check signature for written consent
    if (!input.hasSignature) {
      issues.push({
        severity: "fail",
        code: "SIGNATURE_MISSING",
        message: "Письменное согласие должно быть подписано субъектом ПДн",
        evidence: ["Отсутствует подпись или ЭП"],
        lawRef: "ч.1 ст.9 152-ФЗ",
      });
    }
  }
  
  // Warnings for recommended fields
  if (!input.operatorInn) {
    issues.push({
      severity: "warn",
      code: "OPERATOR_INN_RECOMMENDED",
      message: "Рекомендуется указать ИНН оператора для однозначной идентификации",
      evidence: ["ИНН не указан"],
      lawRef: "Рекомендация",
    });
  }
  
  if (!input.operatorContact) {
    issues.push({
      severity: "warn",
      code: "OPERATOR_CONTACT_RECOMMENDED",
      message: "Рекомендуется указать контактные данные для отзыва согласия",
      evidence: ["Контактные данные оператора не указаны"],
      lawRef: "Рекомендация",
    });
  }
  
  if (input.thirdParties && input.thirdParties.length > 0 && !input.purposes?.some(p => p.toLowerCase().includes("передач"))) {
    issues.push({
      severity: "warn",
      code: "THIRD_PARTY_PURPOSE_MISMATCH",
      message: "Указаны третьи лица, но в целях нет явного указания на передачу",
      evidence: ["Третьи лица: " + input.thirdParties.join(", ")],
      lawRef: "п.3 ч.4 ст.9 152-ФЗ",
    });
  }
  
  if (!input.terminationConditions) {
    issues.push({
      severity: "warn",
      code: "TERMINATION_CONDITIONS_RECOMMENDED",
      message: "Рекомендуется указать условия прекращения обработки ПДн",
      evidence: ["Условия прекращения не указаны"],
      lawRef: "п.6 ч.4 ст.9 152-ФЗ",
    });
  }
  
  const hasErrors = issues.some(i => i.severity === "fail");
  const hasWarnings = issues.some(i => i.severity === "warn");
  
  return {
    isValid: !hasErrors,
    hasErrors,
    hasWarnings,
    issues,
  };
}

export function generateConsentText(input: ConsentInput): string | null {
  const validation = validateConsent152(input);
  if (!validation.isValid) {
    return null;
  }
  
  const text = `СОГЛАСИЕ
на обработку персональных данных

${input.mode === "written" ? `Я, ${input.subjectName}, документ: ${input.subjectDocument},` : "Я,"}

даю согласие ${input.operatorName}${input.operatorInn ? ` (ИНН: ${input.operatorInn})` : ""}, расположенному по адресу: ${input.operatorAddress}${input.operatorContact ? `, контакт: ${input.operatorContact}` : ""}, на обработку моих персональных данных на следующих условиях:

1. Цели обработки:
${input.purposes?.map(p => `   - ${p}`).join("\n")}

2. Категории персональных данных:
${input.pdnCategories?.map(c => `   - ${c}`).join("\n")}

3. Действия с персональными данными:
${input.processingActions?.map(a => `   - ${a}`).join("\n")}

${input.thirdParties && input.thirdParties.length > 0 ? `4. Третьи лица, которым могут передаваться данные:
${input.thirdParties.map(t => `   - ${t}`).join("\n")}

5.` : "4."} Срок обработки: ${input.storagePeriod}
${input.terminationConditions ? `\nУсловия прекращения: ${input.terminationConditions}` : ""}

${input.thirdParties && input.thirdParties.length > 0 ? "6." : "5."} Порядок отзыва согласия:
${input.withdrawalProcedure}

Настоящее согласие действует с момента его предоставления до момента отзыва.

${input.mode === "written" ? "\n___________________ / ___________________\n      (подпись)            (расшифровка)\n\nДата: «___» ____________ 20__ г." : ""}`;

  return text;
}

export function generateCheckboxHtml(input: ConsentInput): string | null {
  const validation = validateConsent152(input);
  if (!validation.isValid) {
    return null;
  }
  
  const consentId = `consent_${Date.now()}`;
  const versionHash = Buffer.from(JSON.stringify(input)).toString("base64").slice(0, 16);
  
  return `<div class="consent-wrapper" data-consent-version="${versionHash}">
  <label class="consent-label">
    <input type="checkbox" id="${consentId}" name="pdn_consent" required data-testid="checkbox-pdn-consent" />
    <span>
      Я даю согласие на обработку моих персональных данных в соответствии с
      <a href="#consent-text" class="consent-link" data-testid="link-consent-text">условиями обработки ПДн</a>
    </span>
  </label>
</div>

<div id="consent-text" class="consent-full-text" style="display:none;">
  <h3>Согласие на обработку персональных данных</h3>
  <p><strong>Оператор:</strong> ${input.operatorName}${input.operatorInn ? ` (ИНН: ${input.operatorInn})` : ""}</p>
  <p><strong>Адрес:</strong> ${input.operatorAddress}</p>
  ${input.operatorContact ? `<p><strong>Контакт:</strong> ${input.operatorContact}</p>` : ""}
  
  <h4>Цели обработки:</h4>
  <ul>${input.purposes?.map(p => `<li>${p}</li>`).join("")}</ul>
  
  <h4>Категории персональных данных:</h4>
  <ul>${input.pdnCategories?.map(c => `<li>${c}</li>`).join("")}</ul>
  
  <h4>Действия с персональными данными:</h4>
  <ul>${input.processingActions?.map(a => `<li>${a}</li>`).join("")}</ul>
  
  ${input.thirdParties && input.thirdParties.length > 0 ? `<h4>Третьи лица:</h4><ul>${input.thirdParties.map(t => `<li>${t}</li>`).join("")}</ul>` : ""}
  
  <p><strong>Срок обработки:</strong> ${input.storagePeriod}</p>
  ${input.terminationConditions ? `<p><strong>Условия прекращения:</strong> ${input.terminationConditions}</p>` : ""}
  <p><strong>Порядок отзыва:</strong> ${input.withdrawalProcedure}</p>
</div>`;
}

export function generateConsentJs(): string {
  return `// Скрипт фиксации согласия на обработку ПДн
(function() {
  function maskIp(ip) {
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return parts[0] + '.' + parts[1] + '.xxx.xxx';
    }
    return null;
  }
  
  function recordConsent(consentElement) {
    const wrapper = consentElement.closest('.consent-wrapper');
    const versionHash = wrapper ? wrapper.dataset.consentVersion : null;
    
    const consentData = {
      timestamp: new Date().toISOString(),
      consentVersionHash: versionHash,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent.substring(0, 200),
      screenResolution: window.screen.width + 'x' + window.screen.height
    };
    
    // Отправить на сервер для сохранения
    fetch('/api/consent/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consentData)
    }).catch(function(err) {
      console.warn('Не удалось записать согласие:', err);
    });
    
    return consentData;
  }
  
  document.addEventListener('change', function(e) {
    if (e.target.name === 'pdn_consent' && e.target.checked) {
      recordConsent(e.target);
    }
  });
})();`;
}
