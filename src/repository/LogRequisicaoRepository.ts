import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  pool,
  sanitizarInteiro,
  sanitizarTexto,
} from "../config/database";
import { LogRequisicao, type LogRequisicaoRow } from "../domain/auditoria/LogRequisicao";

interface ResumoRequisicaoRow extends RowDataPacket {
  total: number;
  media_ms: number | string | null;
  maior_ms: number | string | null;
}

export interface ResumoTempoRequisicoes {
  totalRequisicoesRegistradas: number;
  mediaTempoEsperaMs: number;
  maiorTempoEsperaMs: number;
}

export class LogRequisicaoRepository {
  /**
   * Registra log de requisição utilizando prepared statements e sanitização de tamanho/caracteres.
   */
  async registrar(log: LogRequisicao): Promise<LogRequisicao> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO log_requisicao (
         metodo, rota, status_code, tempo_espera_ms,
         ip, nome_dispositivo, dispositivo_id, data_hora
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizarTexto(log.metodo, 10),
        sanitizarTexto(log.rota, 255),
        sanitizarInteiro(log.statusCode, 100, 599, 200),
        log.tempoEsperaMs !== undefined ? Math.max(0, Number(log.tempoEsperaMs)) : 0,
        sanitizarTexto(log.ip, 45),
        sanitizarTexto(log.nomeDispositivo, 120),
        sanitizarTexto(log.dispositivoId, 64),
        log.dataHora,
      ],
    );
    log.id = result.insertId;
    return log;
  }

  /**
   * Consulta os logs de requisição com LIMIT parametrizado via '?' (sem concatenação de strings).
   */
  async listar(limite = 100): Promise<LogRequisicao[]> {
    const lim = sanitizarInteiro(limite, 1, 1000, 100)!;
    const [rows] = await pool.query<LogRequisicaoRow[]>(
      `SELECT * FROM log_requisicao ORDER BY data_hora DESC, id DESC LIMIT ?`,
      [lim],
    );
    return rows.map(LogRequisicao.fromRow);
  }

  async resumo(): Promise<ResumoTempoRequisicoes> {
    const [rows] = await pool.query<ResumoRequisicaoRow[]>(
      `SELECT COUNT(*) AS total,
              AVG(tempo_espera_ms) AS media_ms,
              MAX(tempo_espera_ms) AS maior_ms
         FROM log_requisicao`,
    );
    const r = rows[0];
    return {
      totalRequisicoesRegistradas: Number(r?.total ?? 0),
      mediaTempoEsperaMs:
        r?.media_ms !== null && r?.media_ms !== undefined
          ? Math.round(Number(r.media_ms) * 100) / 100
          : 0,
      maiorTempoEsperaMs:
        r?.maior_ms !== null && r?.maior_ms !== undefined
          ? Math.round(Number(r.maior_ms) * 100) / 100
          : 0,
    };
  }

  async limpar(): Promise<void> {
    await pool.execute(`DELETE FROM log_requisicao`);
  }
}
