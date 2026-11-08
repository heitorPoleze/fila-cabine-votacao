import { TipoFila } from "../usuario/TipoFila";
import type { Usuario } from "../usuario/Usuario";
import { Fila } from "./Fila";

export class FilaComum extends Fila<Usuario> {
    override enfileirar(usuario: Usuario): void {
        if (usuario.tipoFila !== TipoFila.Comum) {
            throw new TypeError("Fila Comum só aceita usuários do tipo COMUM");
        }
        super.enfileirar(usuario);
    }
}

Object.freeze(FilaComum.prototype);
