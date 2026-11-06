import type { RowDataPacket } from "mysql2/promise";
import type { TipoFila } from "./TipoFila";

export interface UsuarioRow extends RowDataPacket {
  id: number;
  nome: string;
  posicao_na_fila: number;
  tipo_fila: TipoFila;
}

export interface UsuarioJSON {
  id?: number;
  nome: string;
  posicaoNaFila: number;
  tipoFila: TipoFila;
}

export class Usuario {
  constructor(
    public nome: string,
    public posicaoNaFila: number,
    public tipoFila: TipoFila,
    public id?: number,
  ) {}

  static fromRow(row: UsuarioRow): Usuario {
    return new Usuario(row.nome, row.posicao_na_fila, row.tipo_fila, row.id);
  }

  toJSON(): UsuarioJSON {
    return {
      id: this.id,
      nome: this.nome,
      posicaoNaFila: this.posicaoNaFila,
      tipoFila: this.tipoFila,
    };
  }

}
