import { AppError } from "./AppError";

export class RequisicaoInvalidaError extends AppError {
  readonly statusCode = 400;
  readonly code = "REQUISICAO_INVALIDA";
}
