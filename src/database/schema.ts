import { readFile } from "node:fs/promises";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { env } from "../config/env";

/**
 * Cria o banco e todas as tabelas que ainda não existem (schema.sql é idempotente).
 * Roda no `npm run db:migrate` e também toda vez que o servidor sobe,
 * então uma tabela nova no schema nunca derruba o servidor.
 */
export async function aplicarSchema(): Promise<void> {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${env.DB_NAME}\``);

    // A tabela usuario do formato antigo (sem senha/chave) não tem como ser migrada:
    // ela só guarda quem está aguardando, então é recriada.
    const [colunas] = await connection.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuario'`,
      [env.DB_NAME],
    );
    const nomes = new Set(colunas.map((c) => String(c.COLUMN_NAME)));
    if (nomes.size > 0 && !["senha", "chave", "entrou_em", "mock"].every((c) => nomes.has(c))) {
      await connection.query(`DROP TABLE usuario`);
      console.log("Tabela usuario estava no formato antigo e foi recriada");
    }

    const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
    await connection.query(schema);
  } finally {
    await connection.end();
  }
}
