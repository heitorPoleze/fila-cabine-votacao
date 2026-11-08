import type { RowDataPacket } from "mysql2/promise";
import type { TipoFila } from "../usuario/TipoFila";

export interface VotoRow extends RowDataPacket {
  id: number;
  usuario_nome: string;
  senha: number;
  tipo_fila: TipoFila;
  candidato_id: number;
  candidato_nome?: string;
  entrou_na_fila_em: Date;
  chamado_em: Date;
  votou_em: Date;
}

export interface VotoJSON {
  id?: number;
  usuarioNome: string;
  senha: number;
  tipoFila: TipoFila;
  candidatoId: number;
  candidatoNome?: string;
  entrouNaFilaEm: string;
  chamadoEm: string;
  votouEm: string;
  /** Desde que entrou na fila até chegar na cabine. */
  tempoNaFilaMs: number;
  /** Desde que chegou na cabine até votar. */
  tempoParaVotarMs: number;
}

export class Voto {
  constructor(
    public readonly usuarioNome: string,
    public readonly senha: number,
    public readonly tipoFila: TipoFila,
    public readonly candidatoId: number,
    public readonly entrouNaFilaEm: Date,
    public readonly chamadoEm: Date,
    public readonly votouEm: Date,
    public id?: number,
    public candidatoNome?: string,
  ) {}

  static fromRow(row: VotoRow): Voto {
    return new Voto(
      row.usuario_nome,
      row.senha,
      row.tipo_fila,
      row.candidato_id,
      new Date(row.entrou_na_fila_em),
      new Date(row.chamado_em),
      new Date(row.votou_em),
      row.id,
      row.candidato_nome,
    );
  }

  get tempoNaFilaMs(): number {
    return this.chamadoEm.getTime() - this.entrouNaFilaEm.getTime();
  }

  get tempoParaVotarMs(): number {
    return this.votouEm.getTime() - this.chamadoEm.getTime();
  }

  toJSON(): VotoJSON {
    return {
      id: this.id,
      usuarioNome: this.usuarioNome,
      senha: this.senha,
      tipoFila: this.tipoFila,
      candidatoId: this.candidatoId,
      candidatoNome: this.candidatoNome,
      entrouNaFilaEm: this.entrouNaFilaEm.toISOString(),
      chamadoEm: this.chamadoEm.toISOString(),
      votouEm: this.votouEm.toISOString(),
      tempoNaFilaMs: this.tempoNaFilaMs,
      tempoParaVotarMs: this.tempoParaVotarMs,
    };
  }
}
