import type { ResultSetHeader } from "mysql2/promise";
import {
  pool,
  sanitizarBoolean,
  sanitizarInteiro,
  sanitizarTexto,
} from "../config/database";
import { LogAuditoria, type LogAuditoriaRow } from "../domain/auditoria/LogAuditoria";

export class LogAuditoriaRepository {
  /**
   * Registra evento de auditoria usando prepared statement (pool.execute)
   * e sanitização estrita de entradas contra injeção e truncamento malicioso.
   */
  async registrar(log: LogAuditoria): Promise<LogAuditoria> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO log_auditoria (
         operacao, data_hora, usuario_id, eleitor_nome, tipo_fila,
         entrou_na_fila_em, chamado_em, votou_em,
         tempo_na_fila_ms, tempo_para_votar_ms, tempo_requisicao_ms,
         ip, mac, nome_dispositivo, fingerprint, dispositivo_id,
         candidato_id, candidato_nome, mock, detalhes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizarTexto(log.operacao, 50),
        log.dataHora,
        sanitizarInteiro(log.usuarioId, 1),
        sanitizarTexto(log.eleitorNome, 100),
        sanitizarTexto(log.tipoFila, 20),
        log.entrouNaFilaEm,
        log.chamadoEm,
        log.votouEm,
        log.tempoNaFilaMs !== undefined ? Number(log.tempoNaFilaMs) : null,
        log.tempoParaVotarMs !== undefined ? Number(log.tempoParaVotarMs) : null,
        log.tempoRequisicaoMs !== undefined ? Number(log.tempoRequisicaoMs) : null,
        sanitizarTexto(log.ip, 45),
        sanitizarTexto(log.mac, 20),
        sanitizarTexto(log.nomeDispositivo, 120),
        sanitizarTexto(log.fingerprint, 64),
        sanitizarTexto(log.dispositivoId, 64),
        sanitizarInteiro(log.candidatoId, 1),
        sanitizarTexto(log.candidatoNome, 100),
        sanitizarBoolean(log.mock),
        sanitizarTexto(log.detalhes, 1000),
      ],
    );
    log.id = result.insertId;
    return log;
  }

  /**
   * Consulta logs de auditoria usando LIMIT parametrizado com '?',
   * eliminando qualquer concatenação direta na query SQL.
   */
  async listar(limite = 200, mock = false): Promise<LogAuditoria[]> {
    const lim = sanitizarInteiro(limite, 1, 1000, 200)!;
    const [rows] = await pool.query<LogAuditoriaRow[]>(
      `SELECT * FROM log_auditoria WHERE mock = ? ORDER BY data_hora DESC, id DESC LIMIT ?`,
      [sanitizarBoolean(mock), lim],
    );
    return rows.map(LogAuditoria.fromRow);
  }

  async limparPorMock(mock: boolean): Promise<void> {
    await pool.execute(`DELETE FROM log_auditoria WHERE mock = ?`, [sanitizarBoolean(mock)]);
  }

  async limpar(): Promise<void> {
    await pool.execute(`DELETE FROM log_auditoria`);
  }
}
