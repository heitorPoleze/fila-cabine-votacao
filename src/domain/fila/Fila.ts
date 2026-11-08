import { DoublyLinkedList } from "./DoublyLinkedList";
import type { IComparable } from "./IComparable";
import {
    MEMBROS_PERMITIDOS_FILA,
    type IFila,
} from "./IFila";

/**
 * Valida em tempo de execução que nenhuma classe na hierarquia de Fila
 * declarou métodos que não existem no TAD Fila (como acesso/remoção por índice,
 * ordenação ou operações LIFO da DoublyLinkedList).
 */
function validarBarreiraDeMetodosFila(construtorAlvo: Function): void {
    let protoAtual: object | null = construtorAlvo.prototype;

    while (protoAtual && protoAtual !== Object.prototype) {
        for (const nomePropriedade of Object.getOwnPropertyNames(protoAtual)) {
            if (!MEMBROS_PERMITIDOS_FILA.has(nomePropriedade)) {
                throw new TypeError(
                    `Violação do TAD Fila: o método/propriedade "${nomePropriedade}" na classe "${construtorAlvo.name}" não é permitido para uma estrutura de dados Fila.`
                );
            }
        }
        if (protoAtual === Fila.prototype) break;
        protoAtual = Object.getPrototypeOf(protoAtual);
    }
}

export class Fila<T extends IComparable> implements IFila<T> {
    private readonly lista = new DoublyLinkedList<T>();
    private _qtdVotosAnteriores: number;

    constructor(qtdVotosAnteriores: number = 0) {
        validarBarreiraDeMetodosFila(new.target);
        this._qtdVotosAnteriores = qtdVotosAnteriores;
    }

    enfileirar(elemento: T): void {
        this.lista.push(elemento);
    }

    desenfileirar(): T | undefined {
        return this.lista.shift();
    }

    primeiro(): T | undefined {
        return this.lista.getElementAt(0);
    }

    get tamanho(): number {
        return this.lista.length;
    }

    estaVazia(): boolean {
        return this.lista.isEmpty();
    }

    posicaoDe(elemento: T): number {
        return this.lista.findIndex(elemento);
    }

    limpar(): void {
        this.lista.clear();
    }

    inverter(): void {
        this.lista.reverse();
    }

    exibir(): string {
        return this.lista.toString();
    }

    get qtdVotosAnteriores(): number {
        return this._qtdVotosAnteriores;
    }

    set qtdVotosAnteriores(qtdVotosAnteriores: number) {
        this._qtdVotosAnteriores = qtdVotosAnteriores;
    }
}

Object.freeze(Fila.prototype);
