import type { ResultSetHeader } from "mysql2/promise";
import { pool, sanitizarTexto } from "../config/database";
import { Administrador, type AdministradorRow } from "../domain/administrador/Administrador";

export class AdministradorRepository {
  async buscarPorLogin(login: string): Promise<Administrador | null> {
    const loginSanitizado = sanitizarTexto(login, 50);
    if (!loginSanitizado) return null;

    const [rows] = await pool.query<AdministradorRow[]>(
      `SELECT id, login, senha_hash FROM administrador WHERE login = ? LIMIT 1`,
      [loginSanitizado],
    );
    return rows[0] ? Administrador.fromRow(rows[0]) : null;
  }

  async inserir(admin: Administrador): Promise<Administrador> {
    const loginSanitizado = sanitizarTexto(admin.login, 50);
    const senhaHashSanitizada = sanitizarTexto(admin.senhaHash, 255);
    if (!loginSanitizado || !senhaHashSanitizada) {
      throw new Error("Credenciais de administrador inválidas para persistência no banco");
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO administrador (login, senha_hash) VALUES (?, ?)`,
      [loginSanitizado, senhaHashSanitizada],
    );
    admin.id = result.insertId;
    return admin;
  }
}
