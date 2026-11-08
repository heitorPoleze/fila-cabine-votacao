import type { ResultSetHeader } from "mysql2/promise";
import {
  pool,
  sanitizarBoolean,
  sanitizarInteiro,
  sanitizarTexto,
} from "../config/database";
import type { TipoFila } from "../domain/usuario/TipoFila";
import { Usuario, type UsuarioRow } from "../domain/usuario/Usuario";

export class UsuarioRepository {
  /** Todos os usuários que ainda estão aguardando no escopo informado (real ou mock). */
  async listarPorMock(mock: boolean): Promise<Usuario[]> {
    const [rows] = await pool.query<UsuarioRow[]>(
      `SELECT id, nome, senha, posicao_na_fila, tipo_fila, entrou_em, chamado_em, chave, mock,
              ip, mac, nome_dispositivo, fingerprint, dispositivo_id
         FROM usuario
        WHERE mock = ?
        ORDER BY tipo_fila, posicao_na_fila`,
      [sanitizarBoolean(mock)],
    );
    return rows.map(Usuario.fromRow);
  }

  async listarTodos(): Promise<Usuario[]> {
    const [rows] = await pool.query<UsuarioRow[]>(
      `SELECT id, nome, senha, posicao_na_fila, tipo_fila, entrou_em, chamado_em, chave, mock,
              ip, mac, nome_dispositivo, fingerprint, dispositivo_id
         FROM usuario
        ORDER BY mock, tipo_fila, posicao_na_fila`,
    );
    return rows.map(Usuario.fromRow);
  }

  /**
   * Insere um eleitor na fila persistida usando prepared statement com sanitização estrita de strings.
   */
  async inserir(usuario: Usuario): Promise<Usuario> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO usuario (
         nome, senha, posicao_na_fila, tipo_fila, entrou_em, chamado_em, chave, mock,
         ip, mac, nome_dispositivo, fingerprint, dispositivo_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizarTexto(usuario.nome, 100),
        sanitizarTexto(usuario.senha, 120),
        sanitizarInteiro(usuario.posicaoNaFila, 1, 100000, 1),
        sanitizarTexto(usuario.tipoFila, 20),
        usuario.entrouEm,
        usuario.chamadoEm,
        sanitizarTexto(usuario.chave, 64),
        sanitizarBoolean(usuario.mock),
        sanitizarTexto(usuario.ip, 45),
        sanitizarTexto(usuario.mac, 20),
        sanitizarTexto(usuario.nomeDispositivo, 120),
        sanitizarTexto(usuario.fingerprint, 64),
        sanitizarTexto(usuario.dispositivoId, 64),
      ],
    );
    usuario.id = result.insertId;
    return usuario;
  }

  async remover(id: number): Promise<void> {
    const idValido = sanitizarInteiro(id, 1);
    if (!idValido) return;
    await pool.execute(`DELETE FROM usuario WHERE id = ?`, [idValido]);
  }

  /** Esvazia apenas as filas do escopo indicado (mock = true ou mock = false). */
  async limparPorMock(mock: boolean): Promise<void> {
    await pool.execute(`DELETE FROM usuario WHERE mock = ?`, [sanitizarBoolean(mock)]);
  }

  /** Esvazia todas as filas (real e mock). */
  async limpar(): Promise<void> {
    await pool.execute(`DELETE FROM usuario`);
  }

  /** Quem estava atrás de `posicao` no mesmo escopo/tipo anda uma posição para a frente. */
  async decrementarPosicoes(tipoFila: TipoFila, posicao: number, mock: boolean): Promise<void> {
    const pos = sanitizarInteiro(posicao, 0);
    if (pos === null) return;
    await pool.execute(
      `UPDATE usuario
          SET posicao_na_fila = posicao_na_fila - 1
        WHERE mock = ? AND tipo_fila = ? AND posicao_na_fila > ?`,
      [sanitizarBoolean(mock), sanitizarTexto(tipoFila, 20), pos],
    );
  }

  /**
   * Atualiza as posições persistidas em transação atômica,
   * evitando corrupção de estado se houver falha intermediária.
   */
  async sincronizarPosicoes(usuariosOrdenados: Usuario[]): Promise<void> {
    if (!Array.isArray(usuariosOrdenados) || usuariosOrdenados.length === 0) return;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (let i = 0; i < usuariosOrdenados.length; i++) {
        const u = usuariosOrdenados[i];
        const idValido = sanitizarInteiro(u?.id, 1);
        if (idValido) {
          await connection.execute(`UPDATE usuario SET posicao_na_fila = ? WHERE id = ?`, [
            i + 1,
            idValido,
          ]);
        }
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /** Persiste o horário em que o primeiro da fila chegou à vez de votar. */
  async atualizarChamadoEm(id: number, chamadoEm: Date | null): Promise<void> {
    const idValido = sanitizarInteiro(id, 1);
    if (!idValido) return;
    await pool.execute(`UPDATE usuario SET chamado_em = ? WHERE id = ?`, [chamadoEm, idValido]);
  }
}
