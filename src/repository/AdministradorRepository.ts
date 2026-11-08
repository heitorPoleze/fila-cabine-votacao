import type { ResultSetHeader } from "mysql2/promise";
import { pool } from "../config/database";
import { Administrador, type AdministradorRow } from "../domain/administrador/Administrador";

export class AdministradorRepository {
  async buscarPorLogin(login: string): Promise<Administrador | null> {
    const [rows] = await pool.query<AdministradorRow[]>(
      `SELECT id, login, senha_hash FROM administrador WHERE login = ?`,
      [login],
    );
    return rows[0] ? Administrador.fromRow(rows[0]) : null;
  }

  async inserir(admin: Administrador): Promise<Administrador> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO administrador (login, senha_hash) VALUES (?, ?)`,
      [admin.login, admin.senhaHash],
    );
    admin.id = result.insertId;
    return admin;
  }
}
