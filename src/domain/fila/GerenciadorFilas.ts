import { TipoFila } from "../usuario/TipoFila";
import type { Usuario } from "../usuario/Usuario";
import { CondicaoFila } from "./CondicaoFila";
import type { Fila } from "./Fila";
import type { FilaFactory } from "./FilaFactory";
import type { IComparable } from "./IComparable";

export interface ResumoProporcaoFila {
    condicao: CondicaoFila;
    limitePreferenciaisSeguidos: number;
    preferenciaisChamadosSeguidos: number;
    razaoAtendimento: string;
    comportamento: string;
    qtdPreferencial: number;
    qtdComum: number;
    percentualPreferencialSobreComum: number | null;
}

/**
 * Percorre todos os elementos de uma Fila utilizando EXCLUSIVAMENTE
 * operações FIFO do TAD Fila (desenfileirar + enfileirar), preservando
 * integralmente a ordem original em O(n) sem violar o encapsulamento.
 */
export function listarElementosFifo<T extends IComparable>(fila: Fila<T>): T[] {
    const total = fila.tamanho;
    const elementos: T[] = [];
    for (let i = 0; i < total; i++) {
        const elemento = fila.desenfileirar()!;
        elementos.push(elemento);
        fila.enfileirar(elemento);
    }
    return elementos;
}

/**
 * Decide dinamicamente a sequência de chamada entre a fila preferencial e a comum
 * conforme a Seção 1.3 do documento de especificação:
 *   - preferencial ≤ 25% da comum → 1 Prioritário / 1 Normal (alternância 1 a 1);
 *   - preferencial ≤ 50% da comum → 3 Prioritários / 1 Normal;
 *   - preferencial  > 50% da comum → 5 Prioritários / 1 Normal.
 * Se uma das filas estiver vazia, atende imediatamente a outra.
 */
export class GerenciadorFilas {
    private static readonly LIMITE_PREFERENCIAIS: Record<CondicaoFila, number> = {
        [CondicaoFila.PreferencialAte25]: 1,
        [CondicaoFila.PreferencialAte50]: 3,
        [CondicaoFila.PreferencialMaisQue50]: 5,
    };

    private static readonly COMPORTAMENTO: Record<CondicaoFila, string> = {
        [CondicaoFila.PreferencialAte25]: "Alternância simples um a um (≤ 25% dos comuns)",
        [CondicaoFila.PreferencialAte50]: "Atende 3 preferenciais para cada 1 normal (≤ 50% dos comuns)",
        [CondicaoFila.PreferencialMaisQue50]: "Prioridade alta: 5 preferenciais para cada 1 normal (> 50% dos comuns)",
    };

    private readonly filaPreferencial: Fila<Usuario>;
    private readonly filaComum: Fila<Usuario>;

    constructor(private readonly filaFactory: FilaFactory) {
        this.filaPreferencial = filaFactory.filaPorTipo(TipoFila.Preferencial);
        this.filaComum = filaFactory.filaPorTipo(TipoFila.Comum);
    }

    static condicaoPara(preferenciais: number, comuns: number): CondicaoFila {
        if (preferenciais * 4 <= comuns) return CondicaoFila.PreferencialAte25;
        if (preferenciais * 2 <= comuns) return CondicaoFila.PreferencialAte50;
        return CondicaoFila.PreferencialMaisQue50;
    }

    /** Escolhe a fila preferencial considerando o estado atual e os atendimentos seguidos. */
    private static vezDaPreferencial(
        preferenciais: number,
        comuns: number,
        preferenciaisSeguidos: number,
    ): boolean {
        if (preferenciais === 0) return false;
        if (comuns === 0) return true;
        const limite =
            GerenciadorFilas.LIMITE_PREFERENCIAIS[
                GerenciadorFilas.condicaoPara(preferenciais, comuns)
            ];
        return preferenciaisSeguidos < limite;
    }

    condicao(): CondicaoFila {
        return GerenciadorFilas.condicaoPara(
            this.filaPreferencial.tamanho,
            this.filaComum.tamanho,
        );
    }

    /** Quantos preferenciais podem ser chamados seguidos na condição atual. */
    limiteAtual(): number {
        return GerenciadorFilas.LIMITE_PREFERENCIAIS[this.condicao()];
    }

    resumoProporcao(): ResumoProporcaoFila {
        const qtdPreferencial = this.filaPreferencial.tamanho;
        const qtdComum = this.filaComum.tamanho;
        const condicao = this.condicao();
        const limite = GerenciadorFilas.LIMITE_PREFERENCIAIS[condicao];
        return {
            condicao,
            limitePreferenciaisSeguidos: limite,
            preferenciaisChamadosSeguidos: this.filaPreferencial.qtdVotosAnteriores,
            razaoAtendimento: `${limite} Prioritário(s) / 1 Normal`,
            comportamento: GerenciadorFilas.COMPORTAMENTO[condicao],
            qtdPreferencial,
            qtdComum,
            percentualPreferencialSobreComum:
                qtdComum > 0 ? Math.round((qtdPreferencial / qtdComum) * 1000) / 10 : null,
        };
    }

    /** Quem é o próximo a ser chamado para a cabine (acessa a frente sem remover). */
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

    /** Atualiza a contagem de chamadas seguidas: a fila atendida soma 1 e a paralela zera. */
    registrarChamada(usuario: Usuario): void {
        this.filaFactory.filaDe(usuario).qtdVotosAnteriores++;
        this.filaFactory.filaParalelaDe(usuario).qtdVotosAnteriores = 0;
    }

    /** Zera a contagem de atendimentos seguidos. */
    zerarContagem(): void {
        this.filaPreferencial.qtdVotosAnteriores = 0;
        this.filaComum.qtdVotosAnteriores = 0;
    }

    /**
     * Calcula a ordem global dinâmica de chamada simulando passo a passo a regra
     * de proporção (1:1, 3:1 ou 5:1) sem alterar o estado das filas.
     */
    ordemDeChamada(): Usuario[] {
        const pref = listarElementosFifo(this.filaPreferencial);
        const comum = listarElementosFifo(this.filaComum);
        let ip = 0;
        let ic = 0;
        let preferenciaisSeguidos = this.filaPreferencial.qtdVotosAnteriores;
        const ordem: Usuario[] = [];

        while (ip < pref.length || ic < comum.length) {
            if (
                GerenciadorFilas.vezDaPreferencial(
                    pref.length - ip,
                    comum.length - ic,
                    preferenciaisSeguidos,
                )
            ) {
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
