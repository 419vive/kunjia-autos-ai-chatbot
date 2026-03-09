export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? "AIzaSyCA4sDQ76-iWbWHbd1dHhSC--nclzG_c4c",
  isProduction: process.env.NODE_ENV === "production",
};
