import type { Request, Response } from "express";
import { obterDispositivo } from "../middlewares/capturarDispositivo";
import { obterTempoEsperaRequisicaoMs } from "../middlewares/tempoRequisicao";
import { filaService } from "../services";
import type { FilaService } from "../services/FilaService";

export class FilaPublicController {
  constructor(private readonly filaServiceInstance: FilaService = filaService) {}

  /**
   * GET /fila
   * Estado completo das filas e da cabine (contexto ativo: mock ou real).
   */
  estado(_req: Request, res: Response): void {
    res.status(200).json(this.filaServiceInstance.estado());
  }

  /**
   * GET /fila/posicoes
   * Posição atual de todos que estão na fila e quem pode votar agora.
   */
  posicoes(_req: Request, res: Response): void {
    res.status(200).json(this.filaServiceInstance.posicoes());
  }

  /**
   * POST /fila
   * Entrar na fila real com trava de dispositivo único.
   */
  async entrar(req: Request, res: Response): Promise<void> {
    res.status(201).json(
      await this.filaServiceInstance.entrar(
        req.body?.nome,
        req.body?.tipoFila,
        obterDispositivo(req),
        obterTempoEsperaRequisicaoMs(req),
      ),
    );
  }

  /**
   * POST /fila/proximo
   * Chama o próximo para a cabine respeitando a proporção calculada.
   */
  async proximo(_req: Request, res: Response): Promise<void> {
    res.status(200).json(await this.filaServiceInstance.proximoAVotar());
  }

  /**
   * POST /fila/liberar
   * Libera a cabine sem voto.
   */
  async liberar(_req: Request, res: Response): Promise<void> {
    await this.filaServiceInstance.liberarCabine();
    res.status(200).json(this.filaServiceInstance.estado());
  }

  /**
   * GET /fila/mock
   * Status do modo Mock vs Fila Real.
   */
  statusMock(_req: Request, res: Response): void {
    res.status(200).json(this.filaServiceInstance.statusMock());
  }

  /**
   * POST /fila/mock
   * Ativa e popula pessoas de demonstração na fila Mock.
   */
  async popularMock(req: Request, res: Response): Promise<void> {
    const { qtd, qtdPreferencial, qtdComum, limparAntes } = req.body ?? {};
    const opcoes: {
      qtd?: number;
      qtdPreferencial?: number;
      qtdComum?: number;
      limparAntes?: boolean;
    } = {
      limparAntes: Boolean(limparAntes),
    };
    if (qtd !== undefined) opcoes.qtd = Number(qtd);
    if (qtdPreferencial !== undefined) opcoes.qtdPreferencial = Number(qtdPreferencial);
    if (qtdComum !== undefined) opcoes.qtdComum = Number(qtdComum);

    res.status(201).json(await this.filaServiceInstance.popularMock(opcoes));
  }

  /**
   * POST /fila/mock/desativar e DELETE /fila/mock
   * Desabilita o modo Mock sem afetar a fila real nem os votos reais.
   */
  async desativarMock(_req: Request, res: Response): Promise<void> {
    res.status(200).json(await this.filaServiceInstance.desativarMock());
  }

  /**
   * POST /fila/reiniciar
   * Reinicia o contexto atual (mock ou real).
   */
  async reiniciar(req: Request, res: Response): Promise<void> {
    const escopo = req.query.escopo === "real" || req.body?.escopo === "real" ? "real" : "mock";
    res.status(200).json(await this.filaServiceInstance.reiniciar(undefined, escopo));
  }

  /**
   * DELETE /fila/:id
   * Tira alguém da fila; quem estava atrás anda uma posição.
   */
  async remover(req: Request, res: Response): Promise<void> {
    res.status(200).json(
      await this.filaServiceInstance.remover(
        Number(req.params.id),
        undefined,
        obterTempoEsperaRequisicaoMs(req),
      ),
    );
  }
}

export const filaPublicController = new FilaPublicController(filaService);
