import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../config/env";

async function migrate(): Promise<void> {
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

    const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
    await connection.query(schema);

    console.log(`Tabelas criadas no banco "${env.DB_NAME}"`);
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error("Falha ao criar as tabelas:", err);
  process.exit(1);
});
