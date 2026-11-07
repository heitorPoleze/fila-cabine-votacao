import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { RequisicaoInvalidaError } from "../errors";

export function validarRequisicao(req: Request, _res: Response, next: NextFunction): void {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    throw new RequisicaoInvalidaError(erros.array().map((erro) => erro.msg).join("; "));
  }
  next();
}
