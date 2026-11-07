import type { DoublyLinkedList } from "../domain/fila/DoublyLinkedList";
import type { Usuario } from "../domain/usuario/Usuario";
import type { VotoResultado } from "../domain/voto/VotoResultado";
import { ProibidoError } from "../errors";
import type { UsuarioRepository } from "../repository/UsuarioRepository";

export class UsuarioServices {
    constructor(
        private readonly usuarioRepository: UsuarioRepository,
        private readonly fila: DoublyLinkedList<Usuario>,
    ) {}

    async salvar(usuario: Usuario): Promise<Usuario> {
        const usuarioSalvo = await this.usuarioRepository.salvar(usuario);
        this.fila.push(usuarioSalvo);
        usuarioSalvo.posicaoNaFila = this.fila.length;
        return usuarioSalvo;
    }

    async excluir(usuario: Usuario): Promise<boolean> {
        const sucesso = await this.usuarioRepository.excluir(usuario.id!);
        this.fila.remove(usuario);
        return sucesso;
    }

    async buscarPorUsuario(usuarioId: number): Promise<Usuario> {
        const usuario = await this.usuarioRepository.buscarPorId(usuarioId);
        const lugarNaFila =  this.fila.findIndex(usuario);
        usuario.posicaoNaFila = lugarNaFila;
        return usuario;
    }

    async votar(usuario: Usuario, candidatoId: number): Promise<VotoResultado>{
        if(this.fila.findIndex(usuario) !== 0) {
            throw new ProibidoError("Usuário deve ser o primeiro lugar da fila para votar");
        }
        
        const usuarioId = usuario.id!;
        const voto = await this.usuarioRepository.votar(usuarioId, candidatoId);
        
        this.fila.remove(usuario);
      
        return voto;
    }
}