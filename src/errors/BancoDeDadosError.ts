import { AppError } from "./AppError";

export class BancoDeDadosError extends AppError {
  readonly statusCode = 500;
  readonly code = "ERRO_BANCO_DE_DADOS";

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
  }
}
