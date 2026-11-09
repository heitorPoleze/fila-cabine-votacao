import { TipoFila } from "../usuario/TipoFila";
import type { Usuario } from "../usuario/Usuario";
import type { Fila } from "./Fila";
import type { FilaComum } from "./FilaComum";
import type { FilaPreferencial } from "./FilaPreferencial";

export class FilaFactory {
    constructor(
        private readonly filaPreferencial: FilaPreferencial,
        private readonly filaComum: FilaComum,
    ) {}

    public filaPorTipo(tipo: TipoFila): Fila<Usuario> {
        switch (tipo) {
            case TipoFila.Preferencial:
                return this.filaPreferencial;
            case TipoFila.Comum:
                return this.filaComum;
            default:
                throw new TypeError(`Tipo de fila inválido: ${tipo}`);
        }
    }

    public filaDe(usuario: Usuario): Fila<Usuario> {
        return this.filaPorTipo(usuario.tipoFila);
    }

    public filaParalelaDe(usuario: Usuario): Fila<Usuario> {
        if(this.filaDe(usuario) === this.filaPreferencial) {
            return this.filaComum;
        }
        return this.filaPreferencial;
    }
}
