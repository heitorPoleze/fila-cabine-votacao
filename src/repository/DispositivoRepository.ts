import type { ResultSetHeader } from "mysql2/promise";
import {
  pool,
  sanitizarInteiro,
  sanitizarTexto,
} from "../config/database";
import {
  DispositivoVotante,
  type DispositivoIdentificado,
  type DispositivoVotanteRow,
} from "../domain/dispositivo/Dispositivo";
import type { TipoFila } from "../domain/usuario/TipoFila";

export class DispositivoRepository {
  /**
   * Busca um dispositivo votante com query 100% parametrizada e sanitização de strings:
   * - Identifica por `dispositivo_id`, `token_uuid` ou `mac` físico;
   * - Caso sem `tokenUuid`, identifica por `dispositivo_id`, `mac` ou `(ip + fingerprint)`.
   */
  async buscarPorIdentificacao(info: DispositivoIdentificado): Promise<DispositivoVotante | null> {
    const dispId = sanitizarTexto(info.dispositivoId, 64);
    if (!dispId) return null;

    const condicoes: string[] = ["dispositivo_id = ?"];
    const params: unknown[] = [dispId];

    const tokenUuid = sanitizarTexto(info.tokenUuid, 64);
    if (tokenUuid) {
      condicoes.push("token_uuid = ?");
      params.push(tokenUuid);
    }

    const ip = sanitizarTexto(info.ip, 45);
    const fingerprint = sanitizarTexto(info.fingerprint, 64);
    if (ip && fingerprint) {
      condicoes.push("(ip = ? AND fingerprint = ?)");
      params.push(ip, fingerprint);
    }

    const mac = sanitizarTexto(info.mac, 20);
    if (mac) {
      condicoes.push("mac = ?");
      params.push(mac);
    }

    // Se é um dispositivo com IP e nome de dispositivo conhecidos (ex: desktop local)
    if (ip && ip !== "0.0.0.0") {
      const nomeDisp = sanitizarTexto(info.nomeDispositivo, 200);
      if (nomeDisp) {
        condicoes.push("(ip = ? AND nome_dispositivo = ?)");
        params.push(ip, nomeDisp);
      }
    }

    const [rows] = await pool.query<DispositivoVotanteRow[]>(
      `SELECT * FROM dispositivos_votantes
        WHERE ${condicoes.join(" OR ")}
        ORDER BY voto_concluido DESC, id ASC
        LIMIT 1`,
      params,
    );
    return rows[0] ? DispositivoVotante.fromRow(rows[0]) : null;
  }

  async buscarPorDispositivoId(dispositivoId: string): Promise<DispositivoVotante | null> {
    const dispId = sanitizarTexto(dispositivoId, 64);
    if (!dispId) return null;
    const [rows] = await pool.query<DispositivoVotanteRow[]>(
      `SELECT * FROM dispositivos_votantes WHERE dispositivo_id = ? LIMIT 1`,
      [dispId],
    );
    return rows[0] ? DispositivoVotante.fromRow(rows[0]) : null;
  }

  async registrarOuAtualizarAcesso(
    info: DispositivoIdentificado,
    nomeEleitor: string,
    tipoFila: TipoFila,
  ): Promise<DispositivoVotante> {
    const dispId = sanitizarTexto(info.dispositivoId, 64)!;
    const tokenUuid = sanitizarTexto(info.tokenUuid, 64);
    const ip = sanitizarTexto(info.ip, 45)!;
    const mac = sanitizarTexto(info.mac, 20);
    const nomeDispositivo = sanitizarTexto(info.nomeDispositivo, 120)!;
    const userAgent = sanitizarTexto(info.userAgent, 500);
    const fingerprint = sanitizarTexto(info.fingerprint, 64)!;
    const nome = sanitizarTexto(nomeEleitor, 100)!;
    const fila = sanitizarTexto(tipoFila, 20)!;

    const existente = await this.buscarPorIdentificacao(info);
    if (existente) {
      await pool.execute<ResultSetHeader>(
        `UPDATE dispositivos_votantes
            SET ip = ?,
                mac = COALESCE(?, mac),
                token_uuid = COALESCE(?, token_uuid),
                nome_dispositivo = ?,
                user_agent = COALESCE(?, user_agent),
                fingerprint = ?,
                ultimo_nome = ?,
                ultima_fila = ?
          WHERE id = ?`,
        [
          ip,
          mac,
          tokenUuid,
          nomeDispositivo,
          userAgent,
          fingerprint,
          nome,
          fila,
          existente.id!,
        ],
      );
      return (await this.buscarPorDispositivoId(existente.dispositivoId)) ?? existente;
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO dispositivos_votantes (
         dispositivo_id, token_uuid, ip, mac, nome_dispositivo,
         user_agent, fingerprint, ultimo_nome, ultima_fila, voto_concluido
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        dispId,
        tokenUuid,
        ip,
        mac,
        nomeDispositivo,
        userAgent,
        fingerprint,
        nome,
        fila,
      ],
    );

    return new DispositivoVotante(
      dispId,
      tokenUuid,
      ip,
      mac,
      nomeDispositivo,
      userAgent,
      fingerprint,
      nome,
      tipoFila,
      false,
      null,
      null,
      result.insertId,
    );
  }

  async marcarVotoConcluido(
    dispositivoId: string,
    usuarioId: number,
    votouEm: Date,
    tokenUuid?: string | null,
  ): Promise<void> {
    const dispId = sanitizarTexto(dispositivoId, 64);
    const uId = sanitizarInteiro(usuarioId, 1);
    const tUuid = sanitizarTexto(tokenUuid, 64);
    const dataVoto = votouEm instanceof Date && !isNaN(votouEm.getTime()) ? votouEm : new Date();

    if (tUuid) {
      await pool.execute(
        `UPDATE dispositivos_votantes
            SET voto_concluido = TRUE,
                usuario_votante_id = ?,
                votou_em = ?
          WHERE dispositivo_id = ? OR token_uuid = ?`,
        [uId, dataVoto, dispId, tUuid],
      );
      return;
    }

    await pool.execute(
      `UPDATE dispositivos_votantes
          SET voto_concluido = TRUE,
              usuario_votante_id = ?,
              votou_em = ?
        WHERE dispositivo_id = ?`,
      [uId, dataVoto, dispId],
    );
  }

  async listarTodos(): Promise<DispositivoVotante[]> {
    const [rows] = await pool.query<DispositivoVotanteRow[]>(
      `SELECT * FROM dispositivos_votantes ORDER BY atualizado_em DESC, id DESC`,
    );
    return rows.map(DispositivoVotante.fromRow);
  }

  async limpar(): Promise<void> {
    await pool.execute(`DELETE FROM dispositivos_votantes`);
  }
}
