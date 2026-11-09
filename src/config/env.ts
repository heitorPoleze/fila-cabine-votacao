import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  DB_HOST: required("DB_HOST"),
  DB_PORT: Number(process.env.DB_PORT ?? 3306),
  DB_USER: required("DB_USER"),
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: required("DB_NAME"),
  ADMIN_USER: process.env.ADMIN_USER ?? "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "segredo-de-desenvolvimento",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  SEED_MOCK: (process.env.SEED_MOCK ?? "true") !== "false",
  MOCK_QTD: Number(process.env.MOCK_QTD ?? 30),
  MOCK_VOTO_MS: Number(process.env.MOCK_VOTO_MS ?? 3000),
  CHAMADA_AUTOMATICA: process.env.CHAMADA_AUTOMATICA === "true",
};
