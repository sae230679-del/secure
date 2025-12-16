/**
 * PII Masking and Redaction Utilities
 * 152-ФЗ Compliance Module
 */

/**
 * Masks an email address for logging purposes
 * Example: ivan.petrov@example.com → iv***@example.com
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "[redacted]";
  }
  
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  
  if (atIndex <= 0) {
    return "[redacted]";
  }
  
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  
  if (local.length <= 2) {
    return `***${domain}`;
  }
  
  return `${local.slice(0, 2)}***${domain}`;
}

/**
 * Default list of PII field names to redact
 */
export const DEFAULT_PII_KEYS = [
  "operatorEmail",
  "operatorAddress", 
  "operatorInn",
  "email",
  "inn",
  "subjectName",
  "subjectDocument",
  "phone",
  "passport",
  "snils",
  "birthDate",
  "address",
  "sessionId",
  "sessionID",
];

/**
 * Recursively redacts specified keys in an object
 * @param obj - The object to redact
 * @param keysToRedact - Array of key names to redact (case-sensitive)
 * @returns A new object with redacted values
 */
export function redactObject(
  obj: unknown,
  keysToRedact: string[] = DEFAULT_PII_KEYS
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, keysToRedact));
  }
  
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (keysToRedact.includes(key)) {
        result[key] = "[redacted]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = redactObject(value, keysToRedact);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  return obj;
}

/**
 * Checks if a string contains potential PII patterns
 * Used for validation/testing purposes
 */
export function containsPotentialPii(text: string): boolean {
  const patterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{10,12}\b/, // INN (10-12 digits)
    /\bsessionID\b/i,
    /\bsession_id\b/i,
  ];
  
  return patterns.some((pattern) => pattern.test(text));
}
