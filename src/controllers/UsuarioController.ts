import type { Request, Response } from "express";
import { Usuario } from "../domain/usuario/Usuario";
import { NaoEncontradoError } from "../errors";
import { usuarioServices } from "../services";
import type { UsuarioServices } from "../services/UsuarioServices";

export class UsuarioController {
  constructor(private readonly usuarioServices: UsuarioServices) {}

  async criar(req: Request, res: Response): Promise<void> {
    const { nome, tipoFila } = req.body;

    const usuario = await this.usuarioServices.salvar(new Usuario(nome, tipoFila));

    res.status(201).json({ idUsuario: usuario.id, posicaoFila: usuario.posicaoNaFila });
  }

  async lugarNaFila(req: Request, res: Response): Promise<void> {
    const idUsuario = Number(req.query.idUsuario);

    const usuario = await this.usuarioServices.buscarPorUsuario(idUsuario);
    const indice = usuario.posicaoNaFila ?? -1;
    if (indice < 0) {
      throw new NaoEncontradoError("Usuário na fila", idUsuario);
    }
    res.status(200).json({ idUsuario, posicaoFila: indice + 1 }); //findIndex devolve a posição num array. Ou seja, 1o lugar = 0
  }
}

export const usuarioController = new UsuarioController(usuarioServices);
