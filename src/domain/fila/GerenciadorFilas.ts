import { TipoFila } from "../usuario/TipoFila";
import type { Usuario } from "../usuario/Usuario";
import { CondicaoFila } from "./CondicaoFila";
import type { Fila } from "./Fila";
import type { FilaFactory } from "./FilaFactory";


export class GerenciadorFilas {
    private static readonly LIMITE_PREFERENCIAIS: Record<CondicaoFila, number> = {
        [CondicaoFila.PreferencialAte25]: 1,
        [CondicaoFila.PreferencialAte50]: 3,
        [CondicaoFila.PreferencialMaisQue50]: 5,
    };

    private readonly filaPreferencial: Fila<Usuario>;
    private readonly filaComum: Fila<Usuario>;

    constructor(filaFactory: FilaFactory) {
        this.filaPreferencial = filaFactory.filaPorTipo(TipoFila.Preferencial);
        this.filaComum = filaFactory.filaPorTipo(TipoFila.Comum);
    }

    condicao(): CondicaoFila {
        const p = this.filaPreferencial.tamanho;
        const c = this.filaComum.tamanho;

        if (p * 4 <= c) return CondicaoFila.PreferencialAte25;
        if (p * 2 <= c) return CondicaoFila.PreferencialAte50;
        return CondicaoFila.PreferencialMaisQue50;
    }

    proximoAVotar(): Usuario | undefined {
        const filaPreferencialVazia = this.filaPreferencial.estaVazia();
        const filaComumVazia = this.filaComum.estaVazia();

        if (filaPreferencialVazia) {
            return this.filaComum.primeiro();
        }
        if (filaComumVazia) {
            return this.filaPreferencial.primeiro();
        }

        const condicaoAtual = this.condicao();
        const limiteDePreferenciaisSeguidos = GerenciadorFilas.LIMITE_PREFERENCIAIS[condicaoAtual];

        const preferenciaisQueJaVotaramSeguidos = this.filaPreferencial.qtdVotosAnteriores;

        if (preferenciaisQueJaVotaramSeguidos < limiteDePreferenciaisSeguidos) {
            return this.filaPreferencial.primeiro();
        }

        return this.filaComum.primeiro();
    }
}
