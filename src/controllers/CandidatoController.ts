import type { Request, Response } from "express";
import { candidatoServices } from "../services";
import type { CandidatoServices } from "../services/CandidatoServices";

export class CandidatoController {
  constructor(private readonly candidatoServices: CandidatoServices) {}

  async listar(_req: Request, res: Response): Promise<void> {
    const candidatos = await this.candidatoServices.listarCandidatos();

    res.status(200).json(
      candidatos.map((candidato) => {
        const { votosTotais: _votosTotais, ...semVotos } = candidato.toJSON();
        return semVotos;
      }),
    );
  }

  async resultado(_req: Request, res: Response): Promise<void> {
    const candidatos = await this.candidatoServices.listarCandidatos();

    res.status(200).json(
      candidatos.map((candidato) => {
        const { votosTotais, ...semVotos } = candidato.toJSON();
        return { ...semVotos, qtdVotosTotal: votosTotais };
      }),
    );
  }
}

export const candidatoController = new CandidatoController(candidatoServices);
