import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database";
import { Voto, type VotoRow } from "../domain/voto/Voto";

export interface ContagemCandidato {
  candidatoId: number;
  nome: string;
  partido: { nome: string; digito: string };
  urlFoto: string;
  votos: number;
}

interface ContagemRow extends RowDataPacket {
  candidato_id: number;
  nome: string;
  url_foto: string;
  partido_nome: string;
  partido_digito: string;
  votos: number;
}

export class VotoRepository {
  async inserir(voto: Voto): Promise<Voto> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO voto (usuario_nome, senha, tipo_fila, candidato_id, entrou_na_fila_em, chamado_em, votou_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        voto.usuarioNome,
        voto.senha,
        voto.tipoFila,
        voto.candidatoId,
        voto.entrouNaFilaEm,
        voto.chamadoEm,
        voto.votouEm,
      ],
    );
    voto.id = result.insertId;
    return voto;
  }

  /** Apaga todos os votos (recomeçar a votação). */
  async limpar(): Promise<void> {
    await pool.query(`DELETE FROM voto`);
  }

  /** Relatório: todos os votos, do mais recente para o mais antigo. */
  async listar(): Promise<Voto[]> {
    const [rows] = await pool.query<VotoRow[]>(
      `SELECT v.id, v.usuario_nome, v.senha, v.tipo_fila, v.candidato_id, c.nome AS candidato_nome,
              v.entrou_na_fila_em, v.chamado_em, v.votou_em
         FROM voto v
         JOIN candidato c ON c.id = v.candidato_id
        ORDER BY v.votou_em DESC, v.id DESC`,
    );
    return rows.map(Voto.fromRow);
  }

  /** Quantidade absoluta de votos de cada candidato (inclusive quem tem 0). */
  async contagem(): Promise<ContagemCandidato[]> {
    const [rows] = await pool.query<ContagemRow[]>(
      `SELECT c.id AS candidato_id, c.nome, c.url_foto, p.nome AS partido_nome, p.digito AS partido_digito,
              COUNT(v.id) AS votos
         FROM candidato c
         JOIN partido p ON p.digito = c.partido_digito
         LEFT JOIN voto v ON v.candidato_id = c.id
        GROUP BY c.id, c.nome, c.url_foto, p.nome, p.digito
        ORDER BY c.id`,
    );
    return rows.map((r) => ({
      candidatoId: r.candidato_id,
      nome: r.nome,
      partido: { nome: r.partido_nome, digito: String(r.partido_digito) },
      urlFoto: r.url_foto,
      votos: Number(r.votos),
    }));
  }
}
