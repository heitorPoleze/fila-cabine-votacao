import { pool } from "../config/database";
import { Candidato, type CandidatoRow } from "../domain/candidato/Candidato";

export class CandidatoRepository {
    async listarCandidatos(): Promise<Candidato[]> {
        const [rows] = await pool.query<CandidatoRow[]>(
            `SELECT c.id, c.nome, c.url_foto, c.votos_totais,
                    p.nome AS partido_nome, p.digito AS partido_digito
               FROM candidatos c
               LEFT JOIN partidos p ON p.digito = c.partido_digito
              ORDER BY c.id`
        );

        return rows.map(Candidato.fromRow);
    }
}
