import { AppError } from "./AppError";

export class NaoAutorizadoError extends AppError {
  readonly statusCode = 401;
  readonly code = "NAO_AUTORIZADO";
}
