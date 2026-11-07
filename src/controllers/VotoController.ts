import type { Request, Response } from "express";
import { candidatoServices, usuarioServices } from "../services";
import type { CandidatoServices } from "../services/CandidatoServices";
import type { UsuarioServices } from "../services/UsuarioServices";

export class VotoController {
  constructor(
    private readonly usuarioServices: UsuarioServices,
    private readonly candidatoServices: CandidatoServices,
  ) {}

  async votar(req: Request, res: Response): Promise<void> {
    const { idUsuario, idCandidato } = req.body;

    const usuario = await this.usuarioServices.buscarPorUsuario(idUsuario);
    await this.usuarioServices.votar(usuario, idCandidato);

    const candidatos = await this.candidatoServices.listarCandidatos();
    res.status(201).json(
      candidatos.map((c) => ({ idCandidato: c.id, qtdVotosTotal: c.votosTotais })),
    );
  }
}

export const votoController = new VotoController(usuarioServices, candidatoServices);
