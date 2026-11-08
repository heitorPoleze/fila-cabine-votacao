import type { RowDataPacket } from "mysql2/promise";
import type { IComparable } from "../fila/IComparable";
import type { TipoFila } from "./TipoFila";

export interface UsuarioRow extends RowDataPacket {
  id: number;
  nome: string;
  senha: number;
  posicao_na_fila: number;
  tipo_fila: TipoFila;
  entrou_em: Date;
  chave: string;
  mock: number | boolean;
}

export interface UsuarioJSON {
  id?: number;
  nome: string;
  senha: number;
  posicaoNaFila: number;
  tipoFila: TipoFila;
  entrouEm: string;
  chamadoEm: string | null;
  mock: boolean;
}

export class Usuario implements IComparable {
  public chamadoEm: Date | null = null;

  constructor(
    public nome: string,
    public senha: number,
    public posicaoNaFila: number,
    public tipoFila: TipoFila,
    public entrouEm: Date,
    public chave: string,
    public mock = false,
    public id?: number,
  ) {}

  static fromRow(row: UsuarioRow): Usuario {
    return new Usuario(
      row.nome,
      row.senha,
      row.posicao_na_fila,
      row.tipo_fila,
      new Date(row.entrou_em),
      row.chave,
      Boolean(row.mock),
      row.id,
    );
  }

  equals(other: IComparable): boolean {
    return other instanceof Usuario && other.id !== undefined && other.id === this.id;
  }

  compareTo(other: IComparable): number {
    if (!(other instanceof Usuario)) {
      throw new Error("Usuario só pode ser comparado com outro Usuario");
    }
    return this.posicaoNaFila - other.posicaoNaFila;
  }

  toJSON(): UsuarioJSON {
    return {
      id: this.id,
      nome: this.nome,
      senha: this.senha,
      posicaoNaFila: this.posicaoNaFila,
      tipoFila: this.tipoFila,
      entrouEm: this.entrouEm.toISOString(),
      chamadoEm: this.chamadoEm?.toISOString() ?? null,
      mock: this.mock,
    };
  }

  toString(): string {
    return `${this.tipoFila === "PREFERENCIAL" ? "P" : "C"}${String(this.senha).padStart(3, "0")} ${this.nome}`;
  }
}
