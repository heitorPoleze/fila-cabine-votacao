import { pool } from "../config/database";
import { Candidato, type CandidatoRow } from "../domain/candidato/Candidato";

export class CandidatoRepository {
  /**
   * Candidatos com o total de votos (votos_totais vem da contagem da tabela voto).
   * LEFT JOIN em partido: um candidato pode não ter partido (ex.: "Anular").
   */
  async listarCandidatos(): Promise<Candidato[]> {
    const [rows] = await pool.query<CandidatoRow[]>(
      `SELECT c.id, c.nome, c.url_foto,
              p.nome AS partido_nome, p.digito AS partido_digito,
              (SELECT COUNT(*) FROM voto v WHERE v.candidato_id = c.id) AS votos_totais
         FROM candidato c
         LEFT JOIN partido p ON p.digito = c.partido_digito
        ORDER BY c.id`,
    );
    return rows.map((row) => Candidato.fromRow({ ...row, votos_totais: Number(row.votos_totais) } as CandidatoRow));
  }

  /** Mesmo que listarCandidatos (nome usado pelo FilaService e por GET /candidatos). */
  listar(): Promise<Candidato[]> {
    return this.listarCandidatos();
  }
}
