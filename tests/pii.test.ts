/**
 * Unit tests for PII masking and redaction utilities
 * 152-ФЗ Compliance Tests
 */

import { describe, it, expect } from "vitest";
import { maskEmail, redactObject, DEFAULT_PII_KEYS, containsPotentialPii } from "../server/utils/pii";

describe("maskEmail", () => {
  it("masks a standard email address", () => {
    expect(maskEmail("ivan.petrov@example.com")).toBe("iv***@example.com");
  });

  it("masks email with short local part", () => {
    expect(maskEmail("ab@example.com")).toBe("***@example.com");
  });

  it("masks email with single character local", () => {
    expect(maskEmail("a@example.com")).toBe("***@example.com");
  });

  it("returns [redacted] for empty string", () => {
    expect(maskEmail("")).toBe("[redacted]");
  });

  it("returns [redacted] for null/undefined", () => {
    expect(maskEmail(null as any)).toBe("[redacted]");
    expect(maskEmail(undefined as any)).toBe("[redacted]");
  });

  it("returns [redacted] for invalid email (no @)", () => {
    expect(maskEmail("notanemail")).toBe("[redacted]");
  });

  it("handles email with spaces (trims)", () => {
    expect(maskEmail("  test@example.com  ")).toBe("te***@example.com");
  });

  it("preserves domain completely", () => {
    const masked = maskEmail("user@subdomain.example.co.uk");
    expect(masked).toBe("us***@subdomain.example.co.uk");
  });
});

describe("redactObject", () => {
  it("redacts simple object with PII keys", () => {
    const input = {
      name: "Ivan",
      email: "ivan@example.com",
      operatorInn: "1234567890",
    };
    const result = redactObject(input);
    expect(result).toEqual({
      name: "Ivan",
      email: "[redacted]",
      operatorInn: "[redacted]",
    });
  });

  it("handles nested objects recursively", () => {
    const input = {
      user: {
        email: "test@example.com",
        profile: {
          phone: "+79991234567",
        },
      },
    };
    const result = redactObject(input);
    expect(result).toEqual({
      user: {
        email: "[redacted]",
        profile: {
          phone: "[redacted]",
        },
      },
    });
  });

  it("handles arrays with objects", () => {
    const input = {
      users: [
        { email: "a@example.com", name: "A" },
        { email: "b@example.com", name: "B" },
      ],
    };
    const result = redactObject(input);
    expect(result).toEqual({
      users: [
        { email: "[redacted]", name: "A" },
        { email: "[redacted]", name: "B" },
      ],
    });
  });

  it("returns null for null input", () => {
    expect(redactObject(null)).toBe(null);
  });

  it("returns undefined for undefined input", () => {
    expect(redactObject(undefined)).toBe(undefined);
  });

  it("returns primitives unchanged", () => {
    expect(redactObject("string")).toBe("string");
    expect(redactObject(123)).toBe(123);
    expect(redactObject(true)).toBe(true);
  });

  it("redacts sessionId and sessionID", () => {
    const input = {
      sessionId: "abc123",
      sessionID: "xyz789",
      data: "keep",
    };
    const result = redactObject(input);
    expect(result).toEqual({
      sessionId: "[redacted]",
      sessionID: "[redacted]",
      data: "keep",
    });
  });

  it("works with custom keys list", () => {
    const input = {
      customField: "secret",
      normalField: "visible",
    };
    const result = redactObject(input, ["customField"]);
    expect(result).toEqual({
      customField: "[redacted]",
      normalField: "visible",
    });
  });

  it("handles deeply nested arrays", () => {
    const input = {
      level1: {
        level2: [
          {
            level3: {
              email: "deep@example.com",
            },
          },
        ],
      },
    };
    const result = redactObject(input);
    expect((result as any).level1.level2[0].level3.email).toBe("[redacted]");
  });
});

describe("DEFAULT_PII_KEYS", () => {
  it("contains expected PII field names", () => {
    expect(DEFAULT_PII_KEYS).toContain("operatorEmail");
    expect(DEFAULT_PII_KEYS).toContain("operatorAddress");
    expect(DEFAULT_PII_KEYS).toContain("operatorInn");
    expect(DEFAULT_PII_KEYS).toContain("email");
    expect(DEFAULT_PII_KEYS).toContain("inn");
    expect(DEFAULT_PII_KEYS).toContain("subjectName");
    expect(DEFAULT_PII_KEYS).toContain("subjectDocument");
    expect(DEFAULT_PII_KEYS).toContain("sessionId");
    expect(DEFAULT_PII_KEYS).toContain("sessionID");
  });
});

describe("containsPotentialPii", () => {
  it("detects email patterns", () => {
    expect(containsPotentialPii("Contact: test@example.com")).toBe(true);
  });

  it("detects sessionID keyword", () => {
    expect(containsPotentialPii("Logging sessionID: abc123")).toBe(true);
  });

  it("returns false for safe text", () => {
    expect(containsPotentialPii("User logged in successfully")).toBe(false);
  });
});
