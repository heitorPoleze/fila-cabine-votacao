import { TipoFila } from "../usuario/TipoFila";
import type { Usuario } from "../usuario/Usuario";
import { Fila } from "./Fila";

export class FilaPreferencial extends Fila<Usuario> {
    override enfileirar(usuario: Usuario): void {
        if (usuario.tipoFila !== TipoFila.Preferencial) {
            throw new TypeError("Fila Preferencial só aceita usuários do tipo PREFERENCIAL");
        }
        super.enfileirar(usuario);
    }
}

Object.freeze(FilaPreferencial.prototype);
