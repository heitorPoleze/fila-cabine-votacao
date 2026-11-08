import type { Request, Response } from "express";
import { obterDispositivo } from "../middlewares/capturarDispositivo";
import { obterTempoEsperaRequisicaoMs } from "../middlewares/tempoRequisicao";
import { usuarioServices } from "../services";
import type { UsuarioServices } from "../services/UsuarioServices";

export class UsuarioController {
  constructor(private readonly usuarioServices: UsuarioServices) {}

  /**
   * POST /api/v1/usuarios
   * Cadastra um novo usuário eleitor na fila oficial e retorna seu id e posição ordinal (1-based).
   */
  async criar(req: Request, res: Response): Promise<void> {
    const { nome, tipoFila } = req.body;

    const usuario = await this.usuarioServices.salvar(
      nome,
      tipoFila,
      obterDispositivo(req),
      obterTempoEsperaRequisicaoMs(req),
    );

    res.status(201).json({
      idUsuario: usuario.id,
      posicaoFila: usuario.posicaoGlobal,
    });
  }

  /**
   * GET /api/v1/usuarios/posicao-na-fila?idUsuario=int e GET /api/v1/usuarios/:idUsuario/posicao
   * Retorna a posição atual do eleitor na fila (1-based).
   */
  async lugarNaFila(req: Request, res: Response): Promise<void> {
    const idUsuario = Number(req.params.idUsuario ?? req.query.idUsuario);

    const usuario = this.usuarioServices.buscarPorUsuario(idUsuario);

    res.status(200).json({
      idUsuario,
      posicaoFila: usuario.posicaoGlobal,
    });
  }

  /**
   * DELETE /api/v1/usuarios/:idUsuario e POST /api/v1/usuarios/logout
   * Remove o usuário da fila antes da votação (desistência voluntária).
   */
  async logout(req: Request, res: Response): Promise<void> {
    const idUsuario = Number(req.params.idUsuario ?? req.body?.idUsuario);
    const removido = await this.usuarioServices.sairDaFila(
      idUsuario,
      obterTempoEsperaRequisicaoMs(req),
    );
    res.status(200).json({
      idUsuario: removido.id,
      removido,
    });
  }
}

export const usuarioController = new UsuarioController(usuarioServices);
