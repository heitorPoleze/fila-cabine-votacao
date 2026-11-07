import type { RowDataPacket } from "mysql2/promise";
import { TipoFila } from "./TipoFila";
import type { IComparable } from "../fila/IComparable";

export interface UsuarioRow extends RowDataPacket {
  id: number;
  nome: string;
  tipo_fila: TipoFila;
  id_candidato_votado: number | null;
}

export interface UsuarioJSON {
  id?: number;
  nome: string;
  posicaoNaFila: number;
  tipoFila: TipoFila;
  candidatoVotado: number | null;
}

export class Usuario implements IComparable {
  private _nome: string;
  private _tipoFila: TipoFila;
  private _posicaoNaFila?: number;
  private _id?: number;
  private _candidatoVotado: number | null;

  constructor(
    nome: string,
    tipoFila: TipoFila,
    posicaoNaFila?: number,
    id?: number,
    candidatoVotado: number | null = null,
  ) {
    this._nome = nome;
    this._tipoFila = tipoFila;
    this._posicaoNaFila = posicaoNaFila;
    this._id = id;
    this._candidatoVotado = candidatoVotado;
  }

  get nome(): string {
    return this._nome;
  }

  set nome(nome: string) {
    this._nome = nome;
  }

  get tipoFila(): TipoFila {
    return this._tipoFila;
  }

  set tipoFila(tipoFila: TipoFila) {
    this._tipoFila = tipoFila;
  }

  get posicaoNaFila(): number | undefined {
    return this._posicaoNaFila;
  }

  set posicaoNaFila(posicaoNaFila: number | undefined) {
    this._posicaoNaFila = posicaoNaFila;
  }

  get id(): number | undefined {
    return this._id;
  }

  set id(id: number | undefined) {
    this._id = id;
  }

  get candidatoVotado(): number | null {
    return this._candidatoVotado;
  }

  set candidatoVotado(candidatoVotado: number | null) {
    this._candidatoVotado = candidatoVotado;
  }

  get jaVotou(): boolean {
    return this._candidatoVotado !== null;
  }

  static fromRow(row: UsuarioRow): Usuario {
    return new Usuario(
      row.nome,
      row.tipo_fila,
      undefined, // a posição não fica no banco: vem da fila em memória
      row.id,
      row.id_candidato_votado ?? null,
    );
  }

  equals(other: IComparable): boolean {
    if (!(other instanceof Usuario)) return false;
    if (this.id !== undefined && other.id !== undefined) {
      return this.id === other.id;
    }
    return this.nome === other.nome && this.tipoFila === other.tipoFila;
  }


  compareTo(other: IComparable): number {
    if (!(other instanceof Usuario)) {
      throw new TypeError("Só é possível comparar Usuario com Usuario");
    }
    if (this.tipoFila !== other.tipoFila) {
      return this.tipoFila === TipoFila.Preferencial ? -1 : 1;
    }
    const a = this.posicaoNaFila ?? Number.MAX_SAFE_INTEGER;
    const b = other.posicaoNaFila ?? Number.MAX_SAFE_INTEGER;
    return a - b;
  }

  toString(): string {
    return `#${this.id} ${this.nome} (${this.tipoFila})`;
  }

  toJSON(): UsuarioJSON {
    return {
      id: this.id,
      nome: this.nome,
      posicaoNaFila: this.posicaoNaFila!,
      tipoFila: this.tipoFila,
      candidatoVotado: this.candidatoVotado,
    };
  }

}
