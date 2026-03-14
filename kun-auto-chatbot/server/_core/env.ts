function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";

export const ENV = {
  cookieSecret: isProduction ? requireEnv("JWT_SECRET") : (process.env.JWT_SECRET ?? "dev-only-secret"),
  databaseUrl: requireEnv("DATABASE_URL"),
  googleAiApiKey: requireEnv("GOOGLE_AI_API_KEY"),
  isProduction,
  appId: process.env.VITE_APP_ID ?? "kun-auto-chatbot",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  forgeApiUrl: process.env.FORGE_API_URL ?? "",
  forgeApiKey: process.env.FORGE_API_KEY ?? "",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: isProduction ? requireEnv("ADMIN_PASSWORD") : (process.env.ADMIN_PASSWORD ?? ""),
};
