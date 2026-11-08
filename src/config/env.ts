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
  /** Admin padrão do sistema, criado no banco ao subir se ainda não existir. */
  ADMIN_USER: process.env.ADMIN_USER ?? "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin",
  /** Assina os tokens do admin. Troque em produção. */
  AUTH_SECRET: process.env.AUTH_SECRET ?? "segredo-de-desenvolvimento",
  /** Origem do front liberada no CORS ("*" libera todas). */
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  /** Enche a fila com pessoas de demonstração quando o servidor sobe com a fila vazia. */
  SEED_MOCK: (process.env.SEED_MOCK ?? "true") !== "false",
  /** Quantas pessoas de demonstração entram de uma vez ("fila cheia"). */
  MOCK_QTD: Number(process.env.MOCK_QTD ?? 30),
  /** Quanto tempo (ms, em média) cada pessoa de demonstração leva para votar depois de chamada. */
  MOCK_VOTO_MS: Number(process.env.MOCK_VOTO_MS ?? 3000),
  /**
   * false (padrão): o administrador chama cada pessoa para a cabine.
   * true: quando a cabine fica livre o próximo é chamado sozinho.
   */
  CHAMADA_AUTOMATICA: process.env.CHAMADA_AUTOMATICA === "true",
};
