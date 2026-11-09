import mysql, { type RowDataPacket } from "mysql2/promise";
import { env } from "../config/env";
import { aplicarSchema } from "./schema";
import { authService } from "../services/AuthService";

/**
 * Script para resetar o banco de dados:
 * 1. Remove o banco ou todas as tabelas existentes;
 * 2. Recria as tabelas aplicando o schema e os dados iniciais existentes sem substituir nenhum arquivo de seed;
 * 3. Garante a criação do administrador padrão.
 */
export async function resetarBanco(): Promise<void> {
  if (!/^[a-zA-Z0-9_]+$/.test(env.DB_NAME)) {
    throw new Error(`Nome de banco de dados inválido na variável DB_NAME: ${env.DB_NAME}`);
  }

  console.log(`[db:reset] Conectando ao MySQL em ${env.DB_HOST}:${env.DB_PORT}...`);

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    console.log(`[db:reset] Limpando banco de dados "${env.DB_NAME}"...`);

    let dropDbSucesso = false;
    try {
      await connection.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
      dropDbSucesso = true;
      console.log(`[db:reset] Banco "${env.DB_NAME}" excluído com sucesso.`);
    } catch (dropErr) {
      console.warn(
        `[db:reset] Aviso: DROP DATABASE falhou (${(dropErr as Error).message}). Tentando remover tabelas individualmente...`,
      );
    }

    if (!dropDbSucesso) {
      await connection.query(`USE \`${env.DB_NAME}\``);
      await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);

      const [tabelas] = await connection.query<RowDataPacket[]>(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
        [env.DB_NAME],
      );

      for (const row of tabelas) {
        const nomeTabela = String(row.TABLE_NAME);
        await connection.query(`DROP TABLE IF EXISTS \`${nomeTabela}\``);
      }

      await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);
      console.log(`[db:reset] Todas as tabelas de "${env.DB_NAME}" foram removidas.`);
    }
  } finally {
    await connection.end();
  }

  console.log(`[db:reset] Recriando tabelas e aplicando dados iniciais...`);
  await aplicarSchema();

  if (await authService.garantirAdminPadrao()) {
    console.log(`[db:reset] Administrador padrão garantido (login: "${env.ADMIN_USER}").`);
  }

  console.log(`[db:reset] Banco de dados "${env.DB_NAME}" resetado com sucesso!`);
}

// Execução direta via CLI
resetarBanco()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("[db:reset] Falha ao resetar o banco de dados:", err);
    process.exit(1);
  });
