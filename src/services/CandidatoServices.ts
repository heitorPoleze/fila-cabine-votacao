import type { Candidato } from "../domain/candidato/Candidato";
import type { CandidatoRepository } from "../repository/CandidatoRepository";

export class CandidatoServices {
    constructor(private readonly candidatoRepository: CandidatoRepository) {}

    async listarCandidatos(): Promise<Candidato[]> {
        return await this.candidatoRepository.listarCandidatos();
    }
}