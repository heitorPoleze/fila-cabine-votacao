import type { ResultSetHeader } from "mysql2/promise";
import { pool } from "../config/database";
import type { TipoFila } from "../domain/usuario/TipoFila";
import { Usuario, type UsuarioRow } from "../domain/usuario/Usuario";

export class UsuarioRepository {
  /** Todos os usuários que ainda estão aguardando, na ordem da fila. */
  async listarTodos(): Promise<Usuario[]> {
    const [rows] = await pool.query<UsuarioRow[]>(
      `SELECT id, nome, senha, posicao_na_fila, tipo_fila, entrou_em, chave, mock
         FROM usuario
        ORDER BY tipo_fila, posicao_na_fila`,
    );
    return rows.map(Usuario.fromRow);
  }

  async inserir(usuario: Usuario): Promise<Usuario> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO usuario (nome, senha, posicao_na_fila, tipo_fila, entrou_em, chave, mock)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.nome,
        usuario.senha,
        usuario.posicaoNaFila,
        usuario.tipoFila,
        usuario.entrouEm,
        usuario.chave,
        usuario.mock,
      ],
    );
    usuario.id = result.insertId;
    return usuario;
  }

  async remover(id: number): Promise<void> {
    await pool.execute(`DELETE FROM usuario WHERE id = ?`, [id]);
  }

  /** Esvazia as duas filas. */
  async limpar(): Promise<void> {
    await pool.query(`DELETE FROM usuario`);
  }

  /** Quem estava atrás de `posicao` anda uma posição para a frente. */
  async decrementarPosicoes(tipoFila: TipoFila, posicao: number): Promise<void> {
    await pool.execute(
      `UPDATE usuario
          SET posicao_na_fila = posicao_na_fila - 1
        WHERE tipo_fila = ? AND posicao_na_fila > ?`,
      [tipoFila, posicao],
    );
  }
}
