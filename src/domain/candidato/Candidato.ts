import type { RowDataPacket } from "mysql2/promise";
import { Partido, type PartidoJSON } from "./Partido";


export interface CandidatoRow extends RowDataPacket {
  id: number;
  nome: string;
  url_foto: string;
  partido_nome: string;
  partido_digito: string;
}

export interface CandidatoJSON {
  id: number;
  nome: string;
  partido: PartidoJSON;
  urlFoto: string;
}

export class Candidato {
  constructor(
    public readonly id: number,
    public readonly nome: string,
    public readonly partido: Partido,
    public readonly urlFoto: string,
  ) {}

  static fromRow(row: CandidatoRow): Candidato {
    return new Candidato(
      row.id,
      row.nome,
      new Partido(row.partido_nome, String(row.partido_digito)),
      row.url_foto,
    );
  }

  toJSON(): CandidatoJSON {
    return {
      id: this.id,
      nome: this.nome,
      partido: this.partido.toJSON(),
      urlFoto: this.urlFoto,
    };
  }
}
