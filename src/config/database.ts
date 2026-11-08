import mysql from "mysql2/promise";
import { env } from "./env";

/**
 * Pool de conexões MySQL seguro e endurecido contra ataques:
 * - multipleStatements: false impede stacked queries (injeções concatenadas com ';');
 * - timezone: "Z" garante datas consistentes em UTC sem manipulação de fuso;
 * - connectTimeout e queueLimit protegem o processo contra DoS por esgotamento de pool;
 * - enableKeepAlive evita sockets zumbis na rede local/banco.
 */
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 200,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  multipleStatements: false,
  timezone: "Z",
  decimalNumbers: true,
});

/**
 * Remove caracteres nulos (\0) e espaços extras de strings,
 * prevenindo envenenamento de queries e truncamento malicioso no MySQL.
 */
export function sanitizarTexto(valor: unknown, maxLen = 255): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).replace(/\0/g, "").trim();
  return maxLen > 0 ? texto.slice(0, maxLen) : texto;
}

/**
 * Valida e converte para número inteiro seguro dentro de limites pré-definidos.
 */
export function sanitizarInteiro(
  valor: unknown,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
  padrao?: number,
): number | null {
  if (valor === null || valor === undefined) return padrao ?? null;
  const num = Number(valor);
  if (!Number.isFinite(num) || isNaN(num)) return padrao ?? null;
  const inteiro = Math.trunc(num);
  if (inteiro < min || inteiro > max) return padrao ?? null;
  return inteiro;
}

/**
 * Converte estritamente para booleano seguro (0 ou 1 no MySQL).
 */
export function sanitizarBoolean(valor: unknown): boolean {
  return valor === true || valor === 1 || valor === "1" || valor === "true";
}

export async function testConnection(): Promise<void> {
  const [rows] = await pool.query("SELECT 1 AS ok");
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Falha na consulta de teste do MySQL");
  }
}
