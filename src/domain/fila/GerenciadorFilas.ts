import { TipoFila } from "../usuario/TipoFila";
import type { Usuario } from "../usuario/Usuario";
import { CondicaoFila } from "./CondicaoFila";
import type { Fila } from "./Fila";
import type { FilaFactory } from "./FilaFactory";

/**
 * Decide a sequência de chamada entre a fila preferencial e a comum.
 *
 * Com as duas filas com gente, a preferencial pode passar na frente algumas vezes
 * seguidas, conforme o tamanho dela em relação à comum (CondicaoFila):
 *   - preferencial ≤ 25% da comum → 1 preferencial seguido;
 *   - preferencial ≤ 50% da comum → 3 seguidos;
 *   - preferencial  > 50% da comum → 5 seguidos.
 * Atingido o limite, chama 1 da comum. Se uma fila está vazia, chama da outra.
 */
export class GerenciadorFilas {
    private static readonly LIMITE_PREFERENCIAIS: Record<CondicaoFila, number> = {
        [CondicaoFila.PreferencialAte25]: 1,
        [CondicaoFila.PreferencialAte50]: 3,
        [CondicaoFila.PreferencialMaisQue50]: 5,
    };

    private readonly filaPreferencial: Fila<Usuario>;
    private readonly filaComum: Fila<Usuario>;

    constructor(private readonly filaFactory: FilaFactory) {
        this.filaPreferencial = filaFactory.filaPorTipo(TipoFila.Preferencial);
        this.filaComum = filaFactory.filaPorTipo(TipoFila.Comum);
    }

    private static condicaoPara(preferenciais: number, comuns: number): CondicaoFila {
        if (preferenciais * 4 <= comuns) return CondicaoFila.PreferencialAte25;
        if (preferenciais * 2 <= comuns) return CondicaoFila.PreferencialAte50;
        return CondicaoFila.PreferencialMaisQue50;
    }

    /** Escolhe a preferencial? (as duas filas com gente) */
    private static vezDaPreferencial(preferenciais: number, comuns: number, preferenciaisSeguidos: number): boolean {
        if (preferenciais === 0) return false;
        if (comuns === 0) return true;
        const limite = GerenciadorFilas.LIMITE_PREFERENCIAIS[GerenciadorFilas.condicaoPara(preferenciais, comuns)];
        return preferenciaisSeguidos < limite;
    }

    condicao(): CondicaoFila {
        return GerenciadorFilas.condicaoPara(this.filaPreferencial.tamanho, this.filaComum.tamanho);
    }

    /** Quantos preferenciais podem ser chamados seguidos na condição atual. */
    limiteAtual(): number {
        return GerenciadorFilas.LIMITE_PREFERENCIAIS[this.condicao()];
    }

    /** Quem é o próximo a ser chamado para a cabine (não tira da fila). */
    proximoAVotar(): Usuario | undefined {
        if (this.filaPreferencial.estaVazia()) return this.filaComum.primeiro();
        if (this.filaComum.estaVazia()) return this.filaPreferencial.primeiro();

        return GerenciadorFilas.vezDaPreferencial(
            this.filaPreferencial.tamanho,
            this.filaComum.tamanho,
            this.filaPreferencial.qtdVotosAnteriores,
        )
            ? this.filaPreferencial.primeiro()
            : this.filaComum.primeiro();
    }

    /** Atualiza a contagem de "seguidos": a fila do chamado soma 1 e a outra zera. */
    registrarChamada(usuario: Usuario): void {
        this.filaFactory.filaDe(usuario).qtdVotosAnteriores++;
        this.filaFactory.filaParalelaDe(usuario).qtdVotosAnteriores = 0;
    }

    /** Zera a contagem de "seguidos" (fila reiniciada). */
    zerarContagem(): void {
        this.filaPreferencial.qtdVotosAnteriores = 0;
        this.filaComum.qtdVotosAnteriores = 0;
    }

    /**
     * Ordem em que todos que estão aguardando serão chamados, aplicando a mesma regra
     * de proximoAVotar() passo a passo (sem mexer nas filas). Serve para dizer a cada
     * um quantas pessoas tem à frente.
     */
    ordemDeChamada(): Usuario[] {
        const pref = this.filaPreferencial.paraArray();
        const comum = this.filaComum.paraArray();
        let ip = 0;
        let ic = 0;
        let preferenciaisSeguidos = this.filaPreferencial.qtdVotosAnteriores;
        const ordem: Usuario[] = [];

        while (ip < pref.length || ic < comum.length) {
            if (GerenciadorFilas.vezDaPreferencial(pref.length - ip, comum.length - ic, preferenciaisSeguidos)) {
                ordem.push(pref[ip++]);
                preferenciaisSeguidos++;
            } else {
                ordem.push(comum[ic++]);
                preferenciaisSeguidos = 0;
            }
        }
        return ordem;
    }
}
