import { AppError } from "./AppError";

export class NaoEncontradoError extends AppError {
  readonly statusCode = 404;
  readonly code = "NAO_ENCONTRADO";

  constructor(
    public readonly recurso: string,
    public readonly id: number | string,
  ) {
    super(`${recurso} inexistente (id: ${id})`);
  }
}
