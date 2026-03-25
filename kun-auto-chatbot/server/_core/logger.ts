const isProd = process.env.NODE_ENV === "production";

type Meta = Record<string, unknown>;
type LogFn = (message: string, meta?: Meta) => void;
type Logger = { debug: LogFn; info: LogFn; warn: LogFn; error: LogFn };

const LEVELS = { debug: "DEBUG", info: "INFO", warn: "WARN", error: "ERROR" } as const;
const COLORS = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" };
const RESET = "\x1b[0m";

function formatJson(level: string, message: string, meta?: Meta) {
  return JSON.stringify({ level, timestamp: new Date().toISOString(), message, ...(meta && { meta }) });
}

function formatDev(level: keyof typeof LEVELS, message: string, meta?: Meta) {
  const tag = `${COLORS[level]}[${LEVELS[level]}]${RESET}`;
  const ts = `[${new Date().toISOString()}]`;
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  return `${tag} ${ts} ${message}${suffix}`;
}

function makeLogger(prefix?: string): Logger {
  const fmt = (msg: string) => (prefix ? `[${prefix}] ${msg}` : msg);

  const log = (level: keyof typeof LEVELS, consoleFn: (...a: unknown[]) => void): LogFn => {
    return (message, meta) => {
      if (level === "debug" && isProd) return;
      const msg = fmt(message);
      consoleFn(isProd ? formatJson(level, msg, meta) : formatDev(level, msg, meta));
    };
  };

  return {
    debug: log("debug", console.debug),
    info: log("info", console.log),
    warn: log("warn", console.warn),
    error: log("error", console.error),
  };
}

export const logger = makeLogger();

export function createLogger(prefix: string): Logger {
  return makeLogger(prefix);
}
