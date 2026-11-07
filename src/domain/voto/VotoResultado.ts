import type { Candidato } from "../candidato/Candidato";
import type { Usuario } from "../usuario/Usuario";

export interface VotoResultado {
    usuario: Usuario;
    candidato: Candidato;
}
