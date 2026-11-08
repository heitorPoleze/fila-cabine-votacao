import type { DispositivoIdentificado } from "../domain/dispositivo/Dispositivo";

declare global {
  namespace Express {
    interface Request {
      dispositivo?: DispositivoIdentificado;
      inicioRequisicaoMs?: number;
    }
  }
}

export {};
