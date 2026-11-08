import type { NextFunction, Request, Response } from "express";
import type { DispositivoIdentificado } from "../domain/dispositivo/Dispositivo";
import { dispositivoService } from "../services/DispositivoService";

declare global {
  namespace Express {
    interface Request {
      dispositivo?: DispositivoIdentificado;
    }
  }
}

/**
 * Extrai de forma tipada os metadados do dispositivo anexados à requisição HTTP.
 */
export function obterDispositivo(req: Request): DispositivoIdentificado | undefined {
  return req.dispositivo;
}

/**
 * Middleware que extrai e anexa em `req.dispositivo` os dados do cliente
 * (IP normalizado, MAC na rede local quando disponível, nome do dispositivo,
 * fingerprint e token UUID).
 */
export async function capturarDispositivo(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.dispositivo = await dispositivoService.identificarRequisicao(req);
  next();
}
