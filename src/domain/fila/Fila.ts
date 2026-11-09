import { DoublyLinkedList } from "./DoublyLinkedList";
import type { IComparable } from "./IComparable";
import { type IFila } from "./IFila";

export class Fila<T extends IComparable> implements IFila<T> {
    private readonly lista = new DoublyLinkedList<T>();
    private _qtdVotosAnteriores: number;

    constructor(qtdVotosAnteriores: number = 0) {
        this._qtdVotosAnteriores = qtdVotosAnteriores;
    }

    public enfileirar(elemento: T): void {
        this.lista.push(elemento);
    }

    public desenfileirar(): T | undefined {
        return this.lista.shift();
    }

    public primeiro(): T | undefined {
        return this.lista.getElementAt(0);
    }

    public get tamanho(): number {
        return this.lista.length;
    }

    public estaVazia(): boolean {
        return this.lista.isEmpty();
    }

    public posicaoDe(elemento: T): number {
        return this.lista.findIndex(elemento);
    }

    public limpar(): void {
        this.lista.clear();
    }

    public inverter(): void {
        this.lista.reverse();
    }

    public exibir(): string {
        return this.lista.toString();
    }

    public get qtdVotosAnteriores(): number {
        return this._qtdVotosAnteriores;
    }

    public set qtdVotosAnteriores(qtdVotosAnteriores: number) {
        this._qtdVotosAnteriores = qtdVotosAnteriores;
    }
}