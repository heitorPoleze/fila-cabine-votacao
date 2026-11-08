import { AppError } from "./AppError";

export class JaVotouError extends AppError {
  readonly statusCode = 409;
  readonly code = "JA_VOTOU";

  constructor(public readonly usuarioId?: number, mensagemCustomizada?: string) {
    super(
      mensagemCustomizada ??
        (usuarioId !== undefined
          ? `O usuário ${usuarioId} já votou`
          : "Este dispositivo/usuário já registrou um voto"),
    );
  }
}
