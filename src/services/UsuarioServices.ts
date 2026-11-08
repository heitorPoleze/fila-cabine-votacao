import type { UsuarioJSON } from "../domain/usuario/Usuario";
import type { TipoFila } from "../domain/usuario/TipoFila";
import { NaoEncontradoError } from "../errors";
import type { FilaService, ResultadoVoto, UsuarioNaFila } from "./FilaService";

/**
 * Regras do eleitor para a API /api/v1. Usa a mesma fila do FilaService
 * (a que o front e o WebSocket usam), então tudo fica em um só lugar:
 * a sequência entre preferencial e comum vem do GerenciadorFilas.
 */
export class UsuarioServices {
  constructor(private readonly filaService: FilaService) {}

  /** Entra na fila. Devolve o usuário com a posição dentro da fila dele. */
  salvar(nome: string, tipoFila: TipoFila): Promise<UsuarioJSON & { chave: string }> {
    return this.filaService.entrar(nome, tipoFila);
  }

  /** Usuário que está aguardando (ou na cabine), com a posição atual. */
  buscarPorUsuario(usuarioId: number): UsuarioNaFila {
    const usuario = this.filaService.buscar(usuarioId);
    if (!usuario) throw new NaoEncontradoError("Usuário na fila", usuarioId);
    return usuario;
  }

  /** Quem é o próximo a votar segundo o GerenciadorFilas. */
  proximoAVotar(): UsuarioJSON | null {
    return this.filaService.proximoDaVez();
  }

  /** Só vota quem está na cabine ou, com a cabine livre, quem é o próximo da vez. */
  votar(usuarioId: number, candidatoId: number): Promise<ResultadoVoto> {
    return this.filaService.votarPelaApi(usuarioId, candidatoId);
  }
}
