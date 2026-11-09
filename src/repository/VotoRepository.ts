import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  pool,
  sanitizarBoolean,
  sanitizarInteiro,
  sanitizarTexto,
} from "../config/database";
import type { PartidoJSON } from "../domain/candidato/Partido";
import { Voto, type VotoRow } from "../domain/voto/Voto";

export interface ContagemCandidato {
  candidatoId: number;
  nome: string;
  partido: PartidoJSON | null;
  urlFoto: string | null;
  votos: number;
}

interface ContagemRow extends RowDataPacket {
  candidato_id: number;
  nome: string;
  url_foto: string | null;
  partido_nome: string | null;
  partido_digito: string | null;
  votos: number;
}

export class VotoRepository {
  /**
   * Insere o voto oficial utilizando prepared statement parametrizado (pool.execute).
   */
  public async inserir(voto: Voto): Promise<Voto> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO voto (
         usuario_id, usuario_nome, senha, tipo_fila, candidato_id,
         entrou_na_fila_em, chamado_em, votou_em,
         tempo_na_fila_ms, tempo_para_votar_ms, tempo_requisicao_ms,
         ip, mac, nome_dispositivo, fingerprint, dispositivo_id, mock
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizarInteiro(voto.usuarioId, 1),
        sanitizarTexto(voto.usuarioNome, 100),
        sanitizarTexto(voto.senha, 120),
        sanitizarTexto(voto.tipoFila, 20),
        sanitizarInteiro(voto.candidatoId, 1),
        voto.entrouNaFilaEm,
        voto.chamadoEm,
        voto.votouEm,
        voto.tempoNaFilaMs !== undefined ? Number(voto.tempoNaFilaMs) : null,
        voto.tempoParaVotarMs !== undefined ? Number(voto.tempoParaVotarMs) : null,
        voto.tempoRequisicaoMs !== undefined ? Number(voto.tempoRequisicaoMs) : null,
        sanitizarTexto(voto.ip, 45),
        sanitizarTexto(voto.mac, 20),
        sanitizarTexto(voto.nomeDispositivo, 120),
        sanitizarTexto(voto.fingerprint, 64),
        sanitizarTexto(voto.dispositivoId, 64),
        sanitizarBoolean(voto.mock),
      ],
    );
    voto.id = result.insertId;
    return voto;
  }

  /**
   * Verifica se o usuário (idUsuario) já registrou um voto anteriormente com validação de tipo.
   */
  public async usuarioJaVotou(usuarioId: number): Promise<boolean> {
    const id = sanitizarInteiro(usuarioId, 1);
    if (!id) return false;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM voto WHERE usuario_id = ? LIMIT 1`,
      [id],
    );
    return rows.length > 0;
  }

  /** Apaga apenas os votos do escopo indicado (mock = true ou mock = false). */
  public async limparPorMock(mock: boolean): Promise<void> {
    await pool.execute(`DELETE FROM voto WHERE mock = ?`, [sanitizarBoolean(mock)]);
  }

  /** Apaga todos os votos (recomeçar a eleição). */
  public async limpar(): Promise<void> {
    await pool.execute(`DELETE FROM voto`);
  }

  /**
   * Relatório de votos com LIMIT 100% parametrizado via '?' para proteção contra SQL Injection.
   */
  public async listar(mock = false, limite?: number): Promise<Voto[]> {
    const params: unknown[] = [sanitizarBoolean(mock)];
    let sql = `SELECT v.id, v.usuario_id, v.usuario_nome, v.senha, v.tipo_fila, v.candidato_id,
              c.nome AS candidato_nome, v.entrou_na_fila_em, v.chamado_em, v.votou_em,
              v.tempo_na_fila_ms, v.tempo_para_votar_ms, v.tempo_requisicao_ms,
              v.ip, v.mac, v.nome_dispositivo, v.fingerprint, v.dispositivo_id, v.mock
         FROM voto v
         JOIN candidato c ON c.id = v.candidato_id
        WHERE v.mock = ?
        ORDER BY v.votou_em DESC, v.id DESC`;

    if (limite !== undefined) {
      const lim = sanitizarInteiro(limite, 1, 1000);
      if (lim !== null) {
        sql += ` LIMIT ?`;
        params.push(lim);
      }
    }

    const [rows] = await pool.query<VotoRow[]>(sql, params);
    return rows.map(Voto.fromRow);
  }

  /** Quantidade absoluta de votos de cada candidato (incluindo "Anular" com partido/foto null). */
  public async contagem(mock = false): Promise<ContagemCandidato[]> {
    const [rows] = await pool.query<ContagemRow[]>(
      `SELECT c.id AS candidato_id, c.nome, c.url_foto,
              p.nome AS partido_nome, p.digito AS partido_digito,
              COUNT(v.id) AS votos
         FROM candidato c
         LEFT JOIN partido p ON p.digito = c.partido_digito
         LEFT JOIN voto v ON v.candidato_id = c.id AND v.mock = ?
        GROUP BY c.id, c.nome, c.url_foto, p.nome, p.digito
        ORDER BY c.id`,
      [sanitizarBoolean(mock)],
    );

    return rows.map((r) => ({
      candidatoId: r.candidato_id,
      nome: r.nome,
      partido:
        r.partido_nome && r.partido_digito
          ? { nome: r.partido_nome, digito: String(r.partido_digito) }
          : null,
      urlFoto: r.url_foto,
      votos: Number(r.votos),
    }));
  }
}
