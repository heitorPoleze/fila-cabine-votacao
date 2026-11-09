import type { Request, Response } from "express";
import { TipoFila } from "../domain/usuario/TipoFila";
import { RequisicaoInvalidaError } from "../errors";
import { obterDispositivo } from "../middlewares/capturarDispositivo";
import { dispositivoService, filaService } from "../services";
import type { DispositivoService } from "../services/DispositivoService";
import type { FilaService } from "../services/FilaService";

function parsearTipoFilaParam(valor: unknown): TipoFila {
  if (typeof valor !== "string") {
    throw new RequisicaoInvalidaError("Parâmetro tipoFila inválido (use comum ou preferencial)");
  }
  const normalizado = valor.trim().toUpperCase();
  if (normalizado === TipoFila.Comum) return TipoFila.Comum;
  if (normalizado === TipoFila.Preferencial) return TipoFila.Preferencial;
  throw new RequisicaoInvalidaError("Parâmetro tipoFila inválido (use comum ou preferencial)");
}

function extrairEscopo(req: Request): string | undefined {
  return typeof req.query.escopo === "string" ? req.query.escopo.trim().toLowerCase() : undefined;
}

export class FilaAdminController {
  constructor(
    private readonly filaService: FilaService,
    private readonly dispositivoService: DispositivoService,
  ) {}

  // ---- Demonstração dos 8 métodos do TAD Fila (isolado na fila Mock nas mutações)

  exibir(req: Request, res: Response): void {
    const tipoFila = parsearTipoFilaParam(req.params.tipoFila);
    res.status(200).json(this.filaService.demoExibir(tipoFila, extrairEscopo(req)));
  }

  public async enfileirar(req: Request, res: Response): Promise<void> {
    const tipoFila = parsearTipoFilaParam(req.params.tipoFila);
    const { nome, idUsuario } = req.body ?? {};
    const opcoes: { nome?: string; idUsuario?: number; escopo?: string } = {};
    if (typeof nome === "string") opcoes.nome = nome;
    if (idUsuario !== undefined) opcoes.idUsuario = Number(idUsuario);
    const escopo = extrairEscopo(req);
    if (escopo !== undefined) opcoes.escopo = escopo;

    const resultado = await this.filaService.demoEnfileirar(tipoFila, opcoes);
    res.status(201).json(resultado);
  }

  public async desenfileirar(req: Request, res: Response): Promise<void> {
    const tipoFila = parsearTipoFilaParam(req.params.tipoFila);
    const resultado = await this.filaService.demoDesenfileirar(tipoFila, extrairEscopo(req));
    res.status(200).json(resultado);
  }

  primeiro(req: Request, res: Response): void {
    const tipoFila = parsearTipoFilaParam(req.params.tipoFila);
    res.status(200).json(this.filaService.demoPrimeiro(tipoFila, extrairEscopo(req)));
  }

  estaVazia(req: Request, res: Response): void {
    const tipoFila = parsearTipoFilaParam(req.params.tipoFila);
    res.status(200).json(this.filaService.demoEstaVazia(tipoFila, extrairEscopo(req)));
  }

  posicaoDe(req: Request, res: Response): void {
    const tipoFila = parsearTipoFilaParam(req.params.tipoFila);
    const idUsuario = Number(req.params.idUsuario ?? req.query.idUsuario);
    res.status(200).json(this.filaService.demoPosicaoDe(tipoFila, idUsuario, extrairEscopo(req)));
  }

  public async inverter(req: Request, res: Response): Promise<void> {
    const tipoFila = parsearTipoFilaParam(req.params.tipoFila);
    const resultado = await this.filaService.demoInverter(tipoFila, extrairEscopo(req));
    res.status(200).json(resultado);
  }

  public async limpar(req: Request, res: Response): Promise<void> {
    const tipoFila = parsearTipoFilaParam(req.params.tipoFila);
    const resultado = await this.filaService.demoLimpar(tipoFila, extrairEscopo(req));
    res.status(200).json(resultado);
  }

  proporcao(req: Request, res: Response): void {
    res.status(200).json(this.filaService.consultarProporcao(extrairEscopo(req)));
  }

  // ---- Controles administrativos do Modo Mock e Auditoria

  statusMock(_req: Request, res: Response): void {
    res.status(200).json(this.filaService.statusMock());
  }

  public async ativarMock(req: Request, res: Response): Promise<void> {
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

    const inseridos = await this.filaService.popularMock(opcoes);
    res.status(201).json({
      modoMock: this.filaService.modoMock,
      inseridosQtd: inseridos.length,
      proporcao: this.filaService.consultarProporcao("mock").proporcao,
      inseridos,
    });
  }

  public async desativarMock(_req: Request, res: Response): Promise<void> {
    const resultado = await this.filaService.desativarMock();
    res.status(200).json(resultado);
  }

  public async chamarProximo(_req: Request, res: Response): Promise<void> {
    const chamado = await this.filaService.proximoAVotar();
    res.status(200).json({
      modoMock: this.filaService.modoMock,
      chamado: chamado.toJSON(),
      proporcaoAtual: this.filaService.consultarProporcao().proporcao,
    });
  }

  public async statusDispositivo(req: Request, res: Response): Promise<void> {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    const info = obterDispositivo(req) ?? (await this.dispositivoService.identificarRequisicao(req));
    res.status(200).json(await this.dispositivoService.consultarStatus(info));
  }

  public async listarDispositivos(_req: Request, res: Response): Promise<void> {
    const lista = await this.dispositivoService.listarDispositivos();
    res.status(200).json(lista.map((d) => d.toJSON()));
  }

  public async listarLogs(req: Request, res: Response): Promise<void> {
    const limite = req.query.limite !== undefined ? Number(req.query.limite) : 200;
    const escopoBruto = extrairEscopo(req);
    const escopo: "real" | "mock" = escopoBruto === "mock" ? "mock" : "real";
    res.status(200).json(await this.filaService.listarLogsAuditoria(limite, escopo));
  }
}

export const filaAdminController = new FilaAdminController(filaService, dispositivoService);
