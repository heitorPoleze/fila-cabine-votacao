import type { Request, Response } from "express";
import { usuarioServices } from "../services";
import type { UsuarioServices } from "../services/UsuarioServices";

export class UsuarioController {
  constructor(private readonly usuarioServices: UsuarioServices) {}

  async criar(req: Request, res: Response): Promise<void> {
    const { nome, tipoFila } = req.body;

    const usuario = await this.usuarioServices.salvar(nome, tipoFila);

    res.status(201).json({ idUsuario: usuario.id, posicaoFila: usuario.posicaoNaFila });
  }

  async lugarNaFila(req: Request, res: Response): Promise<void> {
    const idUsuario = Number(req.query.idUsuario);

    const usuario = this.usuarioServices.buscarPorUsuario(idUsuario);
    // posicaoFila: posição dentro da fila dele (0 = na cabine).
    // aFrente: quantas pessoas votam antes dele, na sequência do GerenciadorFilas.
    res.status(200).json({ idUsuario, posicaoFila: usuario.posicaoNaFila, aFrente: usuario.aFrente });
  }
}

export const usuarioController = new UsuarioController(usuarioServices);
