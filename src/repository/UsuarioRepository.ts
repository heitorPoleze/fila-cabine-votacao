import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { pool } from "../config/database";
import { Usuario, type UsuarioRow } from "../domain/usuario/Usuario";
import { Candidato, type CandidatoRow } from "../domain/candidato/Candidato";
import { BancoDeDadosError, JaVotouError, NaoEncontradoError } from "../errors";
import type { VotoResultado } from "../domain/voto/VotoResultado";

export class UsuarioRepository {
    async salvar(usuario: Usuario): Promise<Usuario> {
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO usuarios (nome, tipo_fila) VALUES (?, ?)",
            [usuario.nome, usuario.tipoFila]
        );

        if (result.affectedRows === 0) {
            throw new BancoDeDadosError("Nenhuma linha inserida ao salvar o usuário");
        }

        return new Usuario(usuario.nome, usuario.tipoFila, undefined, result.insertId);
    }

    async excluir(usuarioId: number): Promise<boolean> {
        const [result] = await pool.query<ResultSetHeader>("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
        if (result.affectedRows === 0) {
            throw new NaoEncontradoError("Usuário", usuarioId);
        }
        return true;
    }

    async votar(usuarioId: number, candidatoId: number): Promise<VotoResultado> {
        let connection: PoolConnection | undefined;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [usuarioRows] = await connection.query<UsuarioRow[]>(
                "SELECT * FROM usuarios WHERE id = ? FOR UPDATE",
                [usuarioId]
            );

            if (usuarioRows.length === 0) {
                throw new NaoEncontradoError("Usuário", usuarioId);
            }

            const usuario = Usuario.fromRow(usuarioRows[0]);
            if (usuario.jaVotou) {
                throw new JaVotouError(usuarioId);
            }

            const [update] = await connection.query<ResultSetHeader>(
                "UPDATE candidatos SET votos_totais = votos_totais + 1 WHERE id = ?",
                [candidatoId]
            );
            if (update.affectedRows === 0) {
                throw new NaoEncontradoError("Candidato", candidatoId);
            }

            await connection.query<ResultSetHeader>(
                "UPDATE usuarios SET id_candidato_votado = ? WHERE id = ?",
                [candidatoId, usuarioId]
            );
            usuario.candidatoVotado = candidatoId;

            const [candidatoRows] = await connection.query<CandidatoRow[]>(
                `SELECT c.id, c.nome, c.url_foto, c.votos_totais,
                        p.nome AS partido_nome, p.digito AS partido_digito
                   FROM candidatos c
                   LEFT JOIN partidos p ON p.digito = c.partido_digito
                  WHERE c.id = ?`,
                [candidatoId]
            );

            await connection.commit();

            return {
                usuario,
                candidato: Candidato.fromRow(candidatoRows[0]),
            };
        } catch (err) {
            await connection?.rollback().catch(() => {});
            throw err;
        } finally {
            connection?.release();
        }
    }

    async listarUsuarios(): Promise<Usuario[]> {
        const [rows] = await pool.query<UsuarioRow[]>("SELECT * FROM usuarios");
        return rows.map(Usuario.fromRow);
    }

    async buscarPorId(idUsuario: number): Promise<Usuario> {
        const [rows] = await pool.query<UsuarioRow[]>("SELECT * FROM usuarios WHERE id = ?", [idUsuario]);

        if (rows.length === 0) {
            throw new NaoEncontradoError("Usuário", idUsuario);
        }

        return Usuario.fromRow(rows[0]);
    }
}
