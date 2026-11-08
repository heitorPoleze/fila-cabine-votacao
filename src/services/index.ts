import { CandidatoRepository } from "../repository/CandidatoRepository";
import { CandidatoServices } from "./CandidatoServices";
import { dispositivoService } from "./DispositivoService";
import { filaService } from "./FilaService";
import { UsuarioServices } from "./UsuarioServices";

export const usuarioServices = new UsuarioServices(filaService);
export const candidatoServices = new CandidatoServices(new CandidatoRepository());
export { dispositivoService, filaService };
