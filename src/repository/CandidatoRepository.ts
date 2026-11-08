import {
  pool,
  sanitizarBoolean,
  sanitizarInteiro,
} from "../config/database";
import { Candidato, type CandidatoRow } from "../domain/candidato/Candidato";

export class CandidatoRepository {
  /**
   * Lista todos os candidatos com total de votos correspondente ao escopo,
   * utilizando boolean estrito no placeholder parametrizado '?'.
   */
  async listarCandidatos(mock = false): Promise<Candidato[]> {
    const [rows] = await pool.query<CandidatoRow[]>(
      `SELECT c.id, c.nome, c.url_foto,
              p.nome AS partido_nome, p.digito AS partido_digito,
              (SELECT COUNT(*) FROM voto v WHERE v.candidato_id = c.id AND v.mock = ?) AS votos_totais
         FROM candidato c
         LEFT JOIN partido p ON p.digito = c.partido_digito
        ORDER BY c.id`,
      [sanitizarBoolean(mock)],
    );
    return rows.map((row) =>
      Candidato.fromRow({ ...row, votos_totais: Number(row.votos_totais) } as CandidatoRow),
    );
  }

  /**
   * Busca candidato individual por ID com validação de inteiro positivo e query parametrizada.
   */
  async buscarPorId(id: number, mock = false): Promise<Candidato | null> {
    const idValido = sanitizarInteiro(id, 1);
    if (!idValido) return null;

    const [rows] = await pool.query<CandidatoRow[]>(
      `SELECT c.id, c.nome, c.url_foto,
              p.nome AS partido_nome, p.digito AS partido_digito,
              (SELECT COUNT(*) FROM voto v WHERE v.candidato_id = c.id AND v.mock = ?) AS votos_totais
         FROM candidato c
         LEFT JOIN partido p ON p.digito = c.partido_digito
        WHERE c.id = ?
        LIMIT 1`,
      [sanitizarBoolean(mock), idValido],
    );
    if (!rows[0]) return null;
    return Candidato.fromRow({ ...rows[0], votos_totais: Number(rows[0].votos_totais) } as CandidatoRow);
  }

  listar(mock = false): Promise<Candidato[]> {
    return this.listarCandidatos(mock);
  }
}
