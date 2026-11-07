import type { FilaFactory } from "../domain/fila/FilaFactory";
import type { GerenciadorFilas } from "../domain/fila/GerenciadorFilas";
import type { Usuario } from "../domain/usuario/Usuario";
import type { VotoResultado } from "../domain/voto/VotoResultado";
import { ProibidoError } from "../errors";
import type { UsuarioRepository } from "../repository/UsuarioRepository";

export class UsuarioServices {
    constructor(
        private readonly usuarioRepository: UsuarioRepository,
        private readonly filaFactory: FilaFactory,
        private readonly gerenciadorFilas: GerenciadorFilas,
    ) {}

    async salvar(usuario: Usuario): Promise<Usuario> {
        const usuarioSalvo = await this.usuarioRepository.salvar(usuario);

        const fila = this.filaFactory.filaDe(usuarioSalvo);
        fila.enfileirar(usuarioSalvo);

        usuarioSalvo.posicaoNaFila = fila.posicaoDe(usuarioSalvo) + 1;

        return usuarioSalvo;
    }

    async buscarPorUsuario(usuarioId: number): Promise<Usuario> {
        const usuario = await this.usuarioRepository.buscarPorId(usuarioId);
        usuario.posicaoNaFila = this.filaFactory.filaDe(usuario).posicaoDe(usuario);
        return usuario;
    }

    proximoAVotar(): Usuario | undefined {
        return this.gerenciadorFilas.proximoAVotar();
    }

    async votar(usuario: Usuario, candidatoId: number): Promise<VotoResultado> {
        if (!this.proximoAVotar()?.equals(usuario)) {
            throw new ProibidoError("Ainda não é a vez deste usuário votar");
        }
        const fila = this.filaFactory.filaDe(usuario);
        const voto = await this.usuarioRepository.votar(usuario.id!, candidatoId);
        fila.qtdVotosAnteriores++;
        this.filaFactory.filaParalelaDe(usuario).qtdVotosAnteriores = 0;
        fila.desenfileirar();

        return voto;
    }
}