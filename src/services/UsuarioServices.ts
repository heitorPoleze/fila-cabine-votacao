import type { DispositivoIdentificado } from "../domain/dispositivo/Dispositivo";
import type { TipoFila } from "../domain/usuario/TipoFila";
import type { UsuarioJSON } from "../domain/usuario/Usuario";
import { NaoEncontradoError } from "../errors";
import type {
  FilaService,
  ResultadoVoto,
  UsuarioComChave,
  UsuarioNaFila,
} from "./FilaService";

/**
 * Regras do eleitor oficial para a API `/api/v1`.
 * Opera sobre o contexto real do FilaService, aplicando a proporção dinâmica
 * (GerenciadorFilas) e a trava de voto único por dispositivo.
 */
export class UsuarioServices {
  constructor(private readonly filaService: FilaService) {}

  /** Cadastra eleitor na fila real, vinculando dispositivo e retornando posição global (1-based). */
  salvar(
    nome: string,
    tipoFila: TipoFila,
    dispositivo?: DispositivoIdentificado,
    tempoRequisicaoMs?: number,
  ): Promise<UsuarioComChave> {
    return this.filaService.entrar(nome, tipoFila, dispositivo, tempoRequisicaoMs);
  }

  /** Busca o usuário aguardando (ou na cabine) na fila real com sua posição atual (começa em 1). */
  buscarPorUsuario(usuarioId: number): UsuarioNaFila {
    const usuario = this.filaService.buscarReal(usuarioId);
    if (!usuario) throw new NaoEncontradoError("Usuário na fila", usuarioId);
    return usuario;
  }

  /** Quem é o próximo a votar segundo o GerenciadorFilas. */
  proximoAVotar(): UsuarioJSON | null {
    return this.filaService.proximoDaVez();
  }

  /** Registra o voto validando candidato, duplicidade de usuário/dispositivo e vez na fila. */
  votar(
    usuarioId: number,
    candidatoId: number,
    dispositivo?: DispositivoIdentificado,
    tempoRequisicaoMs?: number,
  ): Promise<ResultadoVoto> {
    return this.filaService.votarPelaApi(
      usuarioId,
      candidatoId,
      dispositivo,
      tempoRequisicaoMs,
    );
  }

  /** Permite ao usuário desistir/sair da fila antes de votar (logout). */
  sairDaFila(usuarioId: number, tempoRequisicaoMs?: number): Promise<UsuarioJSON> {
    const existente = this.filaService.buscarReal(usuarioId);
    if (!existente) throw new NaoEncontradoError("Usuário na fila", usuarioId);
    return this.filaService.remover(usuarioId, undefined, tempoRequisicaoMs);
  }
}
