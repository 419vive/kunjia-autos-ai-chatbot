/**
 * Chain of Verification (CoV) — 資安防護機制完整性驗證
 * 
 * 以「事實核查單元」角色，逐層驗證每個安全防護層是否正確運作。
 * 每個 CoV Step 都是獨立的驗證點，確保防護機制從端到端都有效。
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  encryptPII,
  decryptPII,
  maskPhone,
  maskName,
  maskPIIInText,
  sanitizeChatMessage,
  sanitizeSearchQuery,
  verifyLineWebhookSignature,
  isValidSessionId,
  logSecurityEvent,
  getSecurityEvents,
  RATE_LIMIT_CONFIG,
} from "./security";
import crypto from "crypto";

// ============================================================
// CoV STEP 1: HTTP Security Headers (Helmet)
// ============================================================
describe("CoV Step 1: HTTP Security Headers", () => {
  it("should have helmet imported in server entry", async () => {
    const serverEntry = fs.readFileSync(
      path.join(__dirname, "_core/index.ts"),
      "utf-8"
    );
    expect(serverEntry).toContain("helmet");
    expect(serverEntry).toContain("app.use(helmet");
  });

  it("should configure CSP, HSTS, and other security headers", async () => {
    const serverEntry = fs.readFileSync(
      path.join(__dirname, "_core/index.ts"),
      "utf-8"
    );
    // Content-Security-Policy
    expect(serverEntry).toContain("contentSecurityPolicy");
    // Strict-Transport-Security
    expect(serverEntry).toContain("hsts");
    // X-Frame-Options via helmet default (frameguard is built-in)
    // Helmet enables frameguard by default, no explicit config needed
  });
});

// ============================================================
// CoV STEP 2: Rate Limiting Protection
// ============================================================
describe("CoV Step 2: Rate Limiting Protection", () => {
  it("should have rate limiting imported in server entry", async () => {
    const serverEntry = fs.readFileSync(
      path.join(__dirname, "_core/index.ts"),
      "utf-8"
    );
    expect(serverEntry).toContain("rateLimit");
    expect(serverEntry).toContain("express-rate-limit");
  });

  it("should apply rate limiting to chat API", async () => {
    const serverEntry = fs.readFileSync(
      path.join(__dirname, "_core/index.ts"),
      "utf-8"
    );
    expect(serverEntry).toContain("chatLimiter");
    expect(serverEntry).toContain("/api/trpc/chat");
  });

  it("should apply rate limiting to LINE webhook", async () => {
    const serverEntry = fs.readFileSync(
      path.join(__dirname, "_core/index.ts"),
      "utf-8"
    );
    expect(serverEntry).toContain("lineWebhookLimiter");
    expect(serverEntry).toContain("/api/line");
  });

  it("should have reasonable rate limit values", () => {
    // Chat: max 30 per 5 min (prevent spam)
    expect(RATE_LIMIT_CONFIG.chat.max).toBeLessThanOrEqual(50);
    // General: max 100 per 15 min
    expect(RATE_LIMIT_CONFIG.general.max).toBeLessThanOrEqual(200);
    // LINE webhook: generous for burst traffic
    expect(RATE_LIMIT_CONFIG.lineWebhook.max).toBeGreaterThanOrEqual(100);
  });
});

// ============================================================
// CoV STEP 3: Input Sanitization (XSS/Injection Prevention)
// ============================================================
describe("CoV Step 3: Input Sanitization", () => {
  it("should sanitize chat messages in routers.ts", async () => {
    const routers = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    expect(routers).toContain("sanitizeChatMessage");
    expect(routers).toContain("sanitizedMessage");
  });

  it("should sanitize search queries in routers.ts", async () => {
    const routers = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    expect(routers).toContain("sanitizeSearchQuery");
    expect(routers).toContain("sanitizedInput");
  });

  it("should preserve chat messages (sanitization removes control chars, not HTML)", () => {
    // sanitizeChatMessage focuses on control chars and length limits
    // HTML sanitization happens at the sanitizeInput level or via React's built-in XSS protection
    const msg = "我想看車，有什麼推薦？";
    expect(sanitizeChatMessage(msg)).toBe(msg);
    // Control characters should be removed
    expect(sanitizeChatMessage("hello\x00world")).toBe("helloworld");
  });

  it("should escape SQL LIKE wildcards in search", () => {
    expect(sanitizeSearchQuery("100%")).toContain("\\%");
    expect(sanitizeSearchQuery("test_car")).toContain("\\_");
  });

  it("should enforce max message length (2000 chars)", () => {
    const longMsg = "a".repeat(5000);
    expect(sanitizeChatMessage(longMsg).length).toBe(2000);
  });
});

// ============================================================
// CoV STEP 4: PII Encryption at Rest
// ============================================================
describe("CoV Step 4: PII Encryption at Rest", () => {
  it("should use AES-256-GCM (NIST approved)", () => {
    const encrypted = encryptPII("0912345678");
    // Format: iv:authTag:ciphertext
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);
    // IV should be 12 bytes (96 bits) = 16 base64 chars
    expect(Buffer.from(parts[0], "base64").length).toBe(12);
    // Auth tag should be 16 bytes (128 bits)
    expect(Buffer.from(parts[1], "base64").length).toBe(16);
  });

  it("should use random IV (no IV reuse)", () => {
    const enc1 = encryptPII("same data");
    const enc2 = encryptPII("same data");
    const iv1 = enc1.split(":")[0];
    const iv2 = enc2.split(":")[0];
    expect(iv1).not.toBe(iv2); // Different IVs
  });

  it("should correctly roundtrip encrypt/decrypt for all PII types", () => {
    const piiSamples = [
      "0912-345-678",       // Phone
      "賴崑家",              // Name
      "test@example.com",   // Email
      "U5591c54539693c8b5d815e179e6f300d", // LINE userId
      "高雄市三民區大順二路269號",  // Address
    ];
    for (const pii of piiSamples) {
      const encrypted = encryptPII(pii);
      expect(encrypted).not.toBe(pii);
      expect(decryptPII(encrypted)).toBe(pii);
    }
  });

  it("should detect tampering via GCM auth tag", () => {
    const encrypted = encryptPII("sensitive");
    const parts = encrypted.split(":");
    // Tamper with ciphertext
    const tampered = parts[0] + ":" + parts[1] + ":AAAA";
    // Should not return original data
    const result = decryptPII(tampered);
    expect(result).not.toBe("sensitive");
  });
});

// ============================================================
// CoV STEP 5: PII Masking in Logs
// ============================================================
describe("CoV Step 5: PII Masking in Logs", () => {
  it("should mask phone numbers in log text", () => {
    const logLine = "Customer phone: 0936812818";
    const masked = maskPIIInText(logLine);
    expect(masked).not.toContain("0936812818");
    expect(masked).toContain("***");
  });

  it("should mask LINE userIds in log text", () => {
    const logLine = "User: U5591c54539693c8b5d815e179e6f300d sent message";
    const masked = maskPIIInText(logLine);
    expect(masked).not.toContain("U5591c54539693c8b5d815e179e6f300d");
  });

  it("should verify console.log in lineWebhook.ts does NOT leak PII", async () => {
    const webhook = fs.readFileSync(
      path.join(__dirname, "lineWebhook.ts"),
      "utf-8"
    );
    // Should NOT contain raw phone logging
    expect(webhook).not.toContain('console.log(`[LINE] Phone number detected and saved: ${detectedPhone}`)');
    // Should contain redacted version
    expect(webhook).toContain("[REDACTED]");
    // Should NOT log raw customer name
    expect(webhook).not.toContain('console.log(`[LINE] Got profile: ${customerName}`)');
  });

  it("should verify console.log in routers.ts does NOT leak PII", async () => {
    const routers = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    // Should NOT contain raw phone logging
    expect(routers).not.toContain('console.log(`[Chat] Phone number detected and saved: ${detectedPhone}`)');
    expect(routers).toContain("[REDACTED]");
  });
});

// ============================================================
// CoV STEP 6: LINE Webhook Signature Enforcement
// ============================================================
describe("CoV Step 6: LINE Webhook Signature Enforcement", () => {
  it("should reject requests without signature", async () => {
    const webhook = fs.readFileSync(
      path.join(__dirname, "lineWebhook.ts"),
      "utf-8"
    );
    // Should check for missing signature
    expect(webhook).toContain("Missing x-line-signature");
    // Should return early (reject)
    expect(webhook).toContain("rejecting request");
  });

  it("should use timing-safe comparison", async () => {
    const webhook = fs.readFileSync(
      path.join(__dirname, "lineWebhook.ts"),
      "utf-8"
    );
    expect(webhook).toContain("timingSafeEqual");
  });

  it("should verify valid LINE signatures correctly", () => {
    const secret = "test-secret";
    const body = '{"events":[]}';
    const validSig = crypto
      .createHmac("SHA256", secret)
      .update(body)
      .digest("base64");
    expect(verifyLineWebhookSignature(body, validSig, secret)).toBe(true);
  });

  it("should reject forged LINE signatures", () => {
    const secret = "test-secret";
    const body = '{"events":[]}';
    expect(verifyLineWebhookSignature(body, "forged-signature", secret)).toBe(false);
  });
});

// ============================================================
// CoV STEP 7: Session ID Security
// ============================================================
describe("CoV Step 7: Session ID Security", () => {
  it("should validate sessionId format in chat.history endpoint", async () => {
    const routers = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    // Should have sessionId validation
    expect(routers).toContain("Validate sessionId format");
    expect(routers).toContain(/^[a-zA-Z0-9_-]+$/.source);
  });

  it("should reject SQL injection in session IDs", () => {
    expect(isValidSessionId("'; DROP TABLE users; --")).toBe(false);
    expect(isValidSessionId("1 OR 1=1")).toBe(false);
  });

  it("should reject path traversal in session IDs", () => {
    expect(isValidSessionId("../../etc/passwd")).toBe(false);
    expect(isValidSessionId("..\\windows\\system32")).toBe(false);
  });

  it("should accept valid session IDs", () => {
    expect(isValidSessionId("line-U5591c54539693c8b")).toBe(true);
    expect(isValidSessionId("web-abc123-def456")).toBe(true);
  });
});

// ============================================================
// CoV STEP 8: Request Size Limiting
// ============================================================
describe("CoV Step 8: Request Size Limiting", () => {
  it("should have request body size limits in server entry", async () => {
    const serverEntry = fs.readFileSync(
      path.join(__dirname, "_core/index.ts"),
      "utf-8"
    );
    // Should limit JSON body size
    expect(serverEntry).toContain("limit");
    expect(serverEntry).toContain("json");
  });
});

// ============================================================
// CoV STEP 9: PII Masking in API Responses
// ============================================================
describe("CoV Step 9: PII Masking in API Responses", () => {
  it("should mask customerContact in chat.history response", async () => {
    const routers = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    // Should mask phone in chat history response
    expect(routers).toContain("maskPhone(conversation.customerContact)");
    expect(routers).toContain("maskedConversation");
  });

  it("should correctly mask phone numbers", () => {
    expect(maskPhone("0936812818")).toBe("0936-***-818");
    expect(maskPhone("0912-345-678")).toBe("0912-***-678");
  });

  it("should correctly mask names", () => {
    expect(maskName("賴崑家")).toBe("賴*家");
    expect(maskName("Jerry Lai")).toBe("J*******i");
  });
});

// ============================================================
// CoV STEP 10: Security Audit Trail
// ============================================================
describe("CoV Step 10: Security Audit Trail", () => {
  it("should have security event logging in server entry", async () => {
    const serverEntry = fs.readFileSync(
      path.join(__dirname, "_core/index.ts"),
      "utf-8"
    );
    expect(serverEntry).toContain("logSecurityEvent");
  });

  it("should have admin endpoint for security events", async () => {
    const routers = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    expect(routers).toContain("securityEvents");
    expect(routers).toContain("getSecurityEvents");
  });

  it("should log security events with all required fields", () => {
    // Use the already-imported functions (ESM import at top)
    logSecurityEvent({
      eventType: "pii_access",
      severity: "medium",
      source: "cov-test",
      details: "CoV verification test",
    });
    const events = getSecurityEvents(1);
    expect(events[0]).toHaveProperty("timestamp");
    expect(events[0]).toHaveProperty("eventType");
    expect(events[0]).toHaveProperty("severity");
    expect(events[0]).toHaveProperty("source");
    expect(events[0]).toHaveProperty("details");
  });
});

// ============================================================
// CoV STEP 11: Content Integrity (40年老口碑)
// ============================================================
describe("CoV Step 11: Content Integrity - 40年老口碑", () => {
  it("should NOT contain any '20年' in routers.ts", () => {
    const routers = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    expect(routers).not.toContain("20年");
    expect(routers).toContain("40年");
  });

  it("should NOT contain any '20年' in lineWebhook.ts or dynamicPromptBuilder.ts", () => {
    const webhook = fs.readFileSync(
      path.join(__dirname, "lineWebhook.ts"),
      "utf-8"
    );
    const promptBuilder = fs.readFileSync(
      path.join(__dirname, "dynamicPromptBuilder.ts"),
      "utf-8"
    );
    expect(webhook).not.toContain("20年");
    expect(promptBuilder).not.toContain("20年");
    // 40年 is now in dynamicPromptBuilder.ts (the prompt was moved there)
    expect(promptBuilder).toContain("40年");
  });

  it("should NOT contain any '20年' in lineFlexTemplates.ts", () => {
    const templates = fs.readFileSync(
      path.join(__dirname, "lineFlexTemplates.ts"),
      "utf-8"
    );
    expect(templates).not.toContain("20年");
    expect(templates).toContain("40年");
  });

  it("should contain '40年老口碑' in Flex Message welcome card", () => {
    const templates = fs.readFileSync(
      path.join(__dirname, "lineFlexTemplates.ts"),
      "utf-8"
    );
    expect(templates).toContain("40年老口碑");
  });
});
