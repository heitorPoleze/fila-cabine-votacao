import type { NextFunction, Request, Response } from "express";
import { LogRequisicao } from "../domain/auditoria/LogRequisicao";
import { LogRequisicaoRepository } from "../repository/LogRequisicaoRepository";
import { extrairIpRequisicao } from "../services/DispositivoService";

declare global {
  namespace Express {
    interface Request {
      inicioRequisicaoMs?: number;
    }
  }
}

const logRequisicaoRepo = new LogRequisicaoRepository();

/**
 * Retorna o tempo decorrido (espera/processamento em ms) desde a chegada da requisição HTTP.
 */
export function obterTempoEsperaRequisicaoMs(req: Request): number | undefined {
  if (typeof req.inicioRequisicaoMs !== "number") return undefined;
  return Math.round((performance.now() - req.inicioRequisicaoMs) * 100) / 100;
}

/**
 * Middleware que cronometra o tempo de espera/processamento de cada requisição HTTP:
 * 1. Anexa `req.inicioRequisicaoMs`;
 * 2. Define o cabeçalho `X-Tempo-Processamento` (em ms) antes do envio da resposta;
 * 3. Persiste o registro em `log_requisicao` ao concluir a resposta (`finish`).
 */
export function medirTempoRequisicao(req: Request, res: Response, next: NextFunction): void {
  const inicio = performance.now();
  req.inicioRequisicaoMs = inicio;

  const writeHead = res.writeHead.bind(res);
  res.writeHead = ((...args: Parameters<Response["writeHead"]>) => {
    const duracaoMs = (performance.now() - inicio).toFixed(2);
    res.setHeader("X-Tempo-Processamento", duracaoMs);
    return writeHead(...args);
  }) as Response["writeHead"];

  res.on("finish", () => {
    if (req.method === "OPTIONS") return;
    const duracaoMs = Math.round((performance.now() - inicio) * 100) / 100;
    const rota = (req.originalUrl || req.url || "/").slice(0, 255);
    const ip = req.dispositivo?.ip ?? extrairIpRequisicao(req);
    const nomeDispositivo = req.dispositivo?.nomeDispositivo ?? null;
    const dispositivoId = req.dispositivo?.dispositivoId ?? null;

    const registro = new LogRequisicao(
      req.method,
      rota,
      res.statusCode,
      duracaoMs,
      ip,
      nomeDispositivo,
      dispositivoId,
      new Date(),
    );
    logRequisicaoRepo.registrar(registro).catch(() => undefined);
  });

  next();
}
