import type { Request, Response } from "express";
import { obterDispositivo } from "../middlewares/capturarDispositivo";
import { obterTempoEsperaRequisicaoMs } from "../middlewares/tempoRequisicao";
import { candidatoServices, filaService, usuarioServices } from "../services";
import type { CandidatoServices } from "../services/CandidatoServices";
import type { FilaService } from "../services/FilaService";
import type { UsuarioServices } from "../services/UsuarioServices";

export class VotoController {
  constructor(
    private readonly usuarioServices: UsuarioServices,
    private readonly _candidatoServices?: CandidatoServices,
    private readonly filaServiceInstance: FilaService = filaService,
  ) {}

  /**
   * POST /api/v1/voto e POST /api/v1/votos
   * Recebe `{ idUsuario, idCandidato }`, registra o voto oficial de quem é o 1º da fila,
   * retira o eleitor da fila, trava o dispositivo e devolve Status 201 com
   * `[{ idCandidato: int, qtdVotosTotal: int }, ...]`.
   */
  async votar(req: Request, res: Response): Promise<void> {
    const idUsuario = Number(req.body?.idUsuario);
    const idCandidato = Number(req.body?.idCandidato);

    const { resultado } = await this.usuarioServices.votar(
      idUsuario,
      idCandidato,
      obterDispositivo(req),
      obterTempoEsperaRequisicaoMs(req),
    );

    res.status(201).json(
      resultado.map((c) => ({
        idCandidato: c.candidatoId,
        qtdVotosTotal: c.votos,
      })),
    );
  }

  /**
   * POST /votos
   * Registra voto via ticket/chave emitido pelo painel de cabine.
   */
  async votarLegacy(req: Request, res: Response): Promise<void> {
    const { usuarioId, chave, candidatoId } = req.body ?? {};
    res.status(201).json(
      await this.filaServiceInstance.votar(
        usuarioId,
        chave,
        candidatoId,
        obterDispositivo(req),
        obterTempoEsperaRequisicaoMs(req),
      ),
    );
  }

  /**
   * GET /votos/resultado
   * Retorna a contagem de votos do contexto ativo.
   */
  async contagem(_req: Request, res: Response): Promise<void> {
    res.status(200).json(await this.filaServiceInstance.resultado());
  }

  /**
   * GET /votos e GET /api/v1/votos
   * Relatório de votos para auditoria administrativa (quem votou, horário, tempos e dispositivo).
   */
  async relatorio(req: Request, res: Response): Promise<void> {
    const escopo =
      req.query.escopo === "mock" ? "mock" : req.query.escopo === "real" ? "real" : undefined;
    res.status(200).json(await this.filaServiceInstance.relatorio(escopo));
  }
}

export const votoController = new VotoController(usuarioServices, candidatoServices, filaService);
