/**
 * Structured logger for server-side code.
 *
 * Development: human-readable colored console output (same as before).
 * Production:  structured JSON lines (timestamp, level, prefix, message).
 */

const IS_PROD = process.env.NODE_ENV === "production";

// ANSI color codes (dev only)
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const GREY = "\x1b[90m";

function devFormat(
  level: "INFO" | "WARN" | "ERROR",
  prefix: string,
  msg: string
): string {
  const color = level === "INFO" ? CYAN : level === "WARN" ? YELLOW : RED;
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  return `${GREY}${ts}${RESET} ${color}${BOLD}${level}${RESET} ${DIM}[${prefix}]${RESET} ${msg}`;
}

function prodLine(
  level: "info" | "warn" | "error",
  prefix: string,
  msg: string,
  err?: unknown
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    prefix,
    message: msg,
  };
  if (err !== undefined) {
    if (err instanceof Error) {
      entry.error = { name: err.name, message: err.message, stack: err.stack };
    } else {
      entry.error = err;
    }
  }
  return JSON.stringify(entry);
}

export const logger = {
  info(prefix: string, msg: string): void {
    if (IS_PROD) {
      process.stdout.write(prodLine("info", prefix, msg) + "\n");
    } else {
      console.log(devFormat("INFO", prefix, msg));
    }
  },

  warn(prefix: string, msg: string, err?: unknown): void {
    if (IS_PROD) {
      process.stderr.write(prodLine("warn", prefix, msg, err) + "\n");
    } else {
      if (err !== undefined) {
        console.warn(devFormat("WARN", prefix, msg), err);
      } else {
        console.warn(devFormat("WARN", prefix, msg));
      }
    }
  },

  error(prefix: string, msg: string, err?: unknown): void {
    if (IS_PROD) {
      process.stderr.write(prodLine("error", prefix, msg, err) + "\n");
    } else {
      if (err !== undefined) {
        console.error(devFormat("ERROR", prefix, msg), err);
      } else {
        console.error(devFormat("ERROR", prefix, msg));
      }
    }
  },
};
