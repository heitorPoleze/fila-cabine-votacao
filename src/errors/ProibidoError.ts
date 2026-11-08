import { AppError } from "./AppError";

export class ProibidoError extends AppError {
  readonly statusCode = 403;
  readonly code = "PROIBIDO";
}
