import { CandidatoRepository } from "../repository/CandidatoRepository";
import { CandidatoServices } from "./CandidatoServices";
import { filaService } from "./FilaService";
import { UsuarioServices } from "./UsuarioServices";

// As filas (FilaPreferencial, FilaComum, FilaFactory e GerenciadorFilas) vivem dentro
// do filaService; os serviços da API /api/v1 usam essa mesma instância.
export const usuarioServices = new UsuarioServices(filaService);
export const candidatoServices = new CandidatoServices(new CandidatoRepository());
