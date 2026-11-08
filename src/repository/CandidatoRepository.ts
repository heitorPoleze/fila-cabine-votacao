import { pool } from "../config/database";
import { Candidato, type CandidatoRow } from "../domain/candidato/Candidato";

export class CandidatoRepository {
  async listar(): Promise<Candidato[]> {
    const [rows] = await pool.query<CandidatoRow[]>(
      `SELECT c.id, c.nome, c.url_foto, p.nome AS partido_nome, p.digito AS partido_digito
         FROM candidato c
         JOIN partido p ON p.digito = c.partido_digito
        ORDER BY c.id`,
    );
    return rows.map(Candidato.fromRow);
  }
}
