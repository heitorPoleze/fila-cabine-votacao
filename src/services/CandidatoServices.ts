import type { Candidato } from "../domain/candidato/Candidato";
import type { CandidatoRepository } from "../repository/CandidatoRepository";

export class CandidatoServices {
  constructor(private readonly candidatoRepository: CandidatoRepository) {}

  async listarCandidatos(mock?: boolean): Promise<Candidato[]> {
    return await this.candidatoRepository.listarCandidatos(mock);
  }

  async buscarPorId(id: number, mock?: boolean): Promise<Candidato | null> {
    return await this.candidatoRepository.buscarPorId(id, mock);
  }
}
