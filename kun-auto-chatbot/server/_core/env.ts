export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? "***REDACTED_API_KEY***",
  isProduction: process.env.NODE_ENV === "production",
  appId: process.env.VITE_APP_ID ?? "kun-auto-chatbot",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  forgeApiUrl: process.env.FORGE_API_URL ?? "",
  forgeApiKey: process.env.FORGE_API_KEY ?? "",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
};
