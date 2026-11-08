import { readFile } from "node:fs/promises";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { env } from "../config/env";

async function obterColunas(connection: mysql.Connection, tabela: string): Promise<Set<string>> {
  const [colunas] = await connection.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [env.DB_NAME, tabela],
  );
  return new Set(colunas.map((c) => String(c.COLUMN_NAME)));
}

/**
 * Cria o banco e todas as tabelas que ainda não existem (schema.sql é idempotente),
 * além de sincronizar automaticamente tabelas de versões anteriores com os models atuais.
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
    if (!/^[a-zA-Z0-9_]+$/.test(env.DB_NAME)) {
      throw new Error(`Nome de banco de dados inválido e inseguro na variável DB_NAME: ${env.DB_NAME}`);
    }

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${env.DB_NAME}\``);

    // 1. Sincroniza tabela usuario com Usuario.ts
    const colunasUsuario = await obterColunas(connection, "usuario");
    if (
      colunasUsuario.size > 0 &&
      ![
        "senha",
        "chave",
        "entrou_em",
        "chamado_em",
        "mock",
        "ip",
        "mac",
        "nome_dispositivo",
        "fingerprint",
        "dispositivo_id",
      ].every((c) => colunasUsuario.has(c))
    ) {
      await connection.query(`DROP TABLE usuario`);
      console.log("Tabela usuario sincronizada com o model Usuario");
    }

    // 2. Sincroniza tabela voto com Voto.ts
    const colunasVoto = await obterColunas(connection, "voto");
    if (
      colunasVoto.size > 0 &&
      ![
        "usuario_id",
        "tempo_na_fila_ms",
        "tempo_para_votar_ms",
        "tempo_requisicao_ms",
        "mock",
        "ip",
        "mac",
        "nome_dispositivo",
        "fingerprint",
        "dispositivo_id",
      ].every((c) => colunasVoto.has(c))
    ) {
      await connection.query(`DROP TABLE voto`);
      console.log("Tabela voto sincronizada com o model Voto");
    }

    // 3. Sincroniza tabela log_auditoria com LogAuditoria.ts
    const colunasLog = await obterColunas(connection, "log_auditoria");
    if (
      colunasLog.size > 0 &&
      ![
        "entrou_na_fila_em",
        "chamado_em",
        "votou_em",
        "tempo_na_fila_ms",
        "tempo_para_votar_ms",
        "tempo_requisicao_ms",
        "mock",
      ].every((c) => colunasLog.has(c))
    ) {
      await connection.query(`DROP TABLE log_auditoria`);
      console.log("Tabela log_auditoria sincronizada com o model LogAuditoria");
    }

    // 4. Sincroniza tabela log_requisicao com LogRequisicao.ts
    const colunasLogReq = await obterColunas(connection, "log_requisicao");
    if (
      colunasLogReq.size > 0 &&
      ![
        "metodo",
        "rota",
        "status_code",
        "tempo_espera_ms",
        "ip",
        "nome_dispositivo",
        "dispositivo_id",
        "data_hora",
      ].every((c) => colunasLogReq.has(c))
    ) {
      await connection.query(`DROP TABLE log_requisicao`);
      console.log("Tabela log_requisicao sincronizada com o model LogRequisicao");
    }

    // 5. Garante que candidato aceite NULL em url_foto/partido_digito e possua id 1 = "Anular"
    const colunasCandidato = await obterColunas(connection, "candidato");
    if (colunasCandidato.size > 0) {
      await connection.query(`
        ALTER TABLE candidato
          MODIFY COLUMN url_foto VARCHAR(500) NULL DEFAULT NULL,
          MODIFY COLUMN partido_digito CHAR(2) NULL DEFAULT NULL
      `);
      const [cand1] = await connection.query<RowDataPacket[]>(
        `SELECT id, nome, partido_digito FROM candidato WHERE id = 1`,
      );
      const primeiro = cand1[0];
      if (primeiro && (primeiro.nome !== "Anular" || primeiro.partido_digito !== null)) {
        await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);
        if ((await obterColunas(connection, "voto")).size > 0) {
          await connection.query(`TRUNCATE TABLE voto`);
        }
        await connection.query(`TRUNCATE TABLE candidato`);
        await connection.query(`TRUNCATE TABLE partido`);
        await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);
        console.log('Tabela candidato readequada para incluir "Anular" (id 1, partido: null, urlFoto: null)');
      }
    }

    const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
    await connection.query(schema);
  } finally {
    await connection.end();
  }
}
