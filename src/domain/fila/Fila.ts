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

    get qtdVotosAnteriores(): number {
        return this._qtdVotosAnteriores;
    }

    set qtdVotosAnteriores(qtdVotosAnteriores: number) {
        this._qtdVotosAnteriores = qtdVotosAnteriores;
    }
}
