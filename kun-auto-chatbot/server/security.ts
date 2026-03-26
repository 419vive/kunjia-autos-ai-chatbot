/**
 * 崑家汽車 AI 客服系統 — 資安防護模組
 * 
 * 遵循標準：
 * - OWASP Top 10 (2021) + OWASP Top 10 for LLM Applications
 * - NIST Cybersecurity Framework (CSF 2.0)
 * - ISO 27001:2022 Information Security Management
 * - 台灣個人資料保護法 (PDPA)
 * 
 * 防護層級：
 * 1. HTTP Security Headers (Helmet)
 * 2. Rate Limiting (DDoS / Brute Force Protection)
 * 3. Input Sanitization (XSS / Injection Prevention)
 * 4. PII Encryption at Rest (AES-256-GCM)
 * 5. PII Masking in Logs
 * 6. LINE Webhook Signature Enforcement
 * 7. Request Size Limiting
 * 8. Security Audit Logging
 */

import crypto from "crypto";
import { logger } from "./logger";

// ============================================================
// 1. PII ENCRYPTION (AES-256-GCM) — NIST SP 800-38D
// ============================================================

// Use JWT_SECRET as the base for deriving encryption key
// In production, this should be a separate ENCRYPTION_KEY env var
function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing required environment variable: JWT_SECRET");
  // Derive a 32-byte key using SHA-256 (NIST approved KDF)
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt PII data using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encryptPII(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM (NIST recommended)
  
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt PII data encrypted with AES-256-GCM
 */
export function decryptPII(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  
  // Check if it's actually encrypted (contains the : separator pattern)
  if (!ciphertext.includes(":") || ciphertext.split(":").length !== 3) {
    // Not encrypted, return as-is (backward compatibility for existing data)
    return ciphertext;
  }
  
  try {
    const key = getEncryptionKey();
    const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");
    
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedB64, "base64", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err) {
    // If decryption fails, the data might not be encrypted (legacy data)
    logger.warn("Security", "Decryption failed, returning raw value (may be unencrypted legacy data)");
    return ciphertext;
  }
}

/**
 * Check if a value is already encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value || !value.includes(":")) return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  // Check if parts look like base64
  const b64Pattern = /^[A-Za-z0-9+/=]+$/;
  return parts.every(p => b64Pattern.test(p));
}

// ============================================================
// 2. PII MASKING — ISO 27001 A.8.11 Data Masking
// ============================================================

/**
 * Mask phone number for display: 0912-345-678 → 0912-***-678
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  // Handle formatted: 0912-345-678
  const formatted = phone.replace(/[\s-]/g, "");
  if (formatted.length === 10 && formatted.startsWith("09")) {
    return `${formatted.slice(0, 4)}-***-${formatted.slice(7)}`;
  }
  // Generic masking: show first 3 and last 3
  if (formatted.length >= 6) {
    return formatted.slice(0, 3) + "*".repeat(formatted.length - 6) + formatted.slice(-3);
  }
  return "***";
}

/**
 * Mask name for display: 賴崑家 → 賴*家
 */
export function maskName(name: string): string {
  if (!name) return name;
  if (name.length <= 1) return "*";
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

/**
 * Mask email for display: user@example.com → u***@example.com
 */
export function maskEmail(email: string): string {
  if (!email) return email;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 5))}@${domain}`;
}

/**
 * Mask LINE userId for display: U5591c54539693c8b5d815e179e6f300d → U559...300d
 */
export function maskUserId(userId: string): string {
  if (!userId) return userId;
  if (userId.length <= 8) return "***";
  return `${userId.slice(0, 4)}...${userId.slice(-4)}`;
}

/**
 * Mask PII in a message string (for safe logging)
 * Detects and masks: phone numbers, email addresses, LINE IDs
 */
export function maskPIIInText(text: string): string {
  if (!text) return text;
  
  let masked = text;
  
  // Mask Taiwan phone numbers
  masked = masked.replace(/09\d{2}[\s-]?\d{3}[\s-]?\d{3}/g, (match) => maskPhone(match));
  masked = masked.replace(/(?:\+886|886)[\s-]?0?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g, (match) => maskPhone(match));
  
  // Mask landline numbers
  masked = masked.replace(/0[2-9][\s-]?\d{3,4}[\s-]?\d{4}/g, (match) => maskPhone(match));
  
  // Mask email addresses
  masked = masked.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => maskEmail(match));
  
  // Mask LINE User IDs (U followed by 32 hex chars)
  masked = masked.replace(/U[0-9a-f]{32}/g, (match) => maskUserId(match));
  
  return masked;
}

// ============================================================
// 3. INPUT SANITIZATION — OWASP Input Validation
// ============================================================

/**
 * Sanitize user input to prevent XSS attacks
 * Strips HTML tags and encodes special characters
 */
export function sanitizeInput(input: string): string {
  if (!input) return input;
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, "");
  
  // Encode common XSS vectors
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
  
  return sanitized;
}

/**
 * Validate and sanitize chat message input
 * - Max length enforcement
 * - Strip control characters
 * - Prevent prompt injection patterns
 */
export function sanitizeChatMessage(message: string, maxLength: number = 2000): string {
  if (!message) return message;
  
  // Enforce max length
  let sanitized = message.slice(0, maxLength);
  
  // Remove control characters (except newline and tab)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  
  // Basic prompt injection detection - log but don't block
  // (We want to detect attempts but not break legitimate messages)
  const promptInjectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /you\s+are\s+now\s+(?:a\s+)?(?:DAN|jailbreak)/i,
    /system\s*:\s*/i,
    /\[INST\]/i,
    /<<SYS>>/i,
  ];
  
  for (const pattern of promptInjectionPatterns) {
    if (pattern.test(sanitized)) {
      logger.warn("Security", `Potential prompt injection detected (pattern: ${pattern.source})`);
      // Don't block - just log. The system prompt should be robust enough.
      break;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize search query to prevent SQL injection via LIKE patterns
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return query;
  
  // Escape SQL LIKE special characters
  return query
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .slice(0, 200); // Max search query length
}

// ============================================================
// 4. SECURITY AUDIT LOGGING — ISO 27001 A.8.15
// ============================================================

export type SecurityEventType = 
  | "auth_success"
  | "auth_failure"
  | "pii_access"
  | "pii_export"
  | "admin_action"
  | "rate_limit_hit"
  | "webhook_signature_invalid"
  | "prompt_injection_attempt"
  | "suspicious_activity";

export interface SecurityEvent {
  timestamp: string;
  eventType: SecurityEventType;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  details: string;
  ip?: string;
  userId?: string;
}

// In-memory security event buffer (last 1000 events)
const securityEvents: SecurityEvent[] = [];
const MAX_SECURITY_EVENTS = 1000;

/**
 * Log a security event
 */
export function logSecurityEvent(event: Omit<SecurityEvent, "timestamp">): void {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  
  securityEvents.push(fullEvent);
  
  // Trim buffer
  if (securityEvents.length > MAX_SECURITY_EVENTS) {
    securityEvents.splice(0, securityEvents.length - MAX_SECURITY_EVENTS);
  }
  
  // Log high/critical events to console (masked)
  if (event.severity === "high" || event.severity === "critical") {
    logger.warn("Security", `[${event.severity.toUpperCase()}] ${event.eventType}: ${maskPIIInText(event.details)}`);
  }
}

/**
 * Get recent security events (for admin dashboard)
 */
export function getSecurityEvents(limit: number = 50): SecurityEvent[] {
  return securityEvents.slice(-limit).reverse();
}

// ============================================================
// 5. RATE LIMITING CONFIGURATION
// ============================================================

export const RATE_LIMIT_CONFIG = {
  // General API: 100 requests per 15 minutes per IP
  general: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "請求過於頻繁，請稍後再試。" },
  },
  // Chat API: 30 messages per 5 minutes per IP (prevent spam)
  chat: {
    windowMs: 5 * 60 * 1000,
    max: 30,
    message: { error: "訊息發送過於頻繁，請稍後再試。" },
  },
  // LINE Webhook: 200 per minute (LINE may send bursts)
  lineWebhook: {
    windowMs: 60 * 1000,
    max: 200,
    message: { error: "Too many requests" },
  },
  // Admin API: 60 per minute
  admin: {
    windowMs: 60 * 1000,
    max: 60,
    message: { error: "請求過於頻繁，請稍後再試。" },
  },
};

// ============================================================
// 6. WEBHOOK SIGNATURE VERIFICATION
// ============================================================

/**
 * Verify LINE webhook signature (HMAC-SHA256)
 * Returns true if signature is valid, false otherwise
 */
export function verifyLineWebhookSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  if (!signature || !channelSecret) return false;
  
  const hash = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

// ============================================================
// 7. SESSION ID SECURITY
// ============================================================

/**
 * Generate a secure session ID
 */
export function generateSecureSessionId(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validate session ID format (prevent injection)
 */
export function isValidSessionId(sessionId: string): boolean {
  // Allow alphanumeric, hyphens, and underscores only
  // Max 128 chars
  return /^[a-zA-Z0-9_-]{1,128}$/.test(sessionId);
}
