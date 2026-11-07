import { AppError } from "./AppError";

export class JaVotouError extends AppError {
  readonly statusCode = 409;
  readonly code = "JA_VOTOU";

  constructor(public readonly usuarioId: number) {
    super(`O usuário ${usuarioId} já votou`);
  }
}
