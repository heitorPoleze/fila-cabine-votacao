import { DoublyLinkedList } from "./DoublyLinkedList";
import type { IComparable } from "./IComparable";

export class Fila<T extends IComparable> {
    private readonly lista = new DoublyLinkedList<T>();
    private _qtdVotosAnteriores: number;
    constructor(qtdVotosAnteriores: number = 0) {
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

    /** Elemento na posição `indice` (0 = o primeiro da fila). */
    elementoEm(indice: number): T | undefined {
        return this.lista.getElementAt(indice);
    }

    /** Tira da fila quem está na posição `indice` (desistência ou remoção pelo admin). */
    removerEm(indice: number): T | undefined {
        return this.lista.removeAt(indice);
    }

    /** Ordena pelo compareTo dos elementos (usado ao recarregar a fila do banco). */
    ordenar(): void {
        this.lista.sort();
    }

    paraArray(): T[] {
        const itens: T[] = [];
        for (let i = 0; i < this.lista.length; i++) itens.push(this.lista.getElementAt(i)!);
        return itens;
    }

    get qtdVotosAnteriores(): number {
        return this._qtdVotosAnteriores;
    }

    set qtdVotosAnteriores(qtdVotosAnteriores: number) {
        this._qtdVotosAnteriores = qtdVotosAnteriores;
    }
}
