import type { Request, Response } from "express";
import { NaoEncontradoError } from "../errors";
import { candidatoServices, filaService } from "../services";
import type { CandidatoServices } from "../services/CandidatoServices";

/** `?escopo=mock|real` força o escopo; sem ele, segue o modo ativo (igual ao relatório de votos). */
function extrairMock(req: Request): boolean {
  if (req.query.escopo === "mock") return true;
  if (req.query.escopo === "real") return false;
  return filaService.modoMock;
}

export class CandidatoController {
  constructor(private readonly candidatoServices: CandidatoServices) {}

  /**
   * GET /api/v1/candidatos
   * Retorna lista de candidatos SEM totalização de votos.
   */
  async listar(req: Request, res: Response): Promise<void> {
    const candidatos = await this.candidatoServices.listarCandidatos(extrairMock(req));

    res.status(200).json(
      candidatos.map((candidato) => {
        const { votosTotais: _votosTotais, ...semVotos } = candidato.toJSON();
        return semVotos;
      }),
    );
  }

  /**
   * GET /api/v1/candidatos/:id
   * Retorna os detalhes de um candidato específico por ID.
   */
  async buscarPorId(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const candidato = await this.candidatoServices.buscarPorId(id, extrairMock(req));
    if (!candidato) {
      throw new NaoEncontradoError("Candidato", id);
    }

    const { votosTotais: _votosTotais, ...semVotos } = candidato.toJSON();
    res.status(200).json(semVotos);
  }

  /**
   * GET /api/v1/resultado e GET /api/v1/resultados
   * Retorna lista de candidatos COM totalização de votos (qtdVotosTotal).
   */
  async resultado(req: Request, res: Response): Promise<void> {
    const candidatos = await this.candidatoServices.listarCandidatos(extrairMock(req));

    res.status(200).json(
      candidatos.map((candidato) => {
        const { votosTotais, ...semVotos } = candidato.toJSON();
        return { ...semVotos, qtdVotosTotal: votosTotais };
      }),
    );
  }
}

export const candidatoController = new CandidatoController(candidatoServices);
