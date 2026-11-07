import type { RowDataPacket } from "mysql2/promise";
import { Partido, type PartidoJSON } from "./Partido";


export interface CandidatoRow extends RowDataPacket {
  id: number;
  nome: string;
  url_foto: string | null;
  partido_nome: string | null;
  votos_totais: number;
  partido_digito: string | null;
}

export interface CandidatoJSON {
  id: number;
  nome: string;
  partido: PartidoJSON | null;
  votosTotais: number;
  urlFoto: string | null;
}

export class Candidato {
  private _votosTotais: number;

  constructor(
    public readonly id: number,
    public readonly nome: string,
    public readonly partido: Partido | null,
    public readonly urlFoto: string | null,
    votosTotais: number = 0,
  ) {
    if (!Number.isInteger(votosTotais) || votosTotais < 0) {
      throw new Error(`Quantidade de votos inválida: ${votosTotais}`);
    }
    this._votosTotais = votosTotais;
  }

  get votosTotais(): number {
    return this._votosTotais;
  }

  static fromRow(row: CandidatoRow): Candidato {
    return new Candidato(
      row.id,
      row.nome,
      row.partido_digito !== null && row.partido_nome !== null
        ? new Partido(row.partido_nome, String(row.partido_digito))
        : null,
      row.url_foto,
      row.votos_totais
    );
  }

  toJSON(): CandidatoJSON {
    return {
      id: this.id,
      nome: this.nome,
      partido: this.partido?.toJSON() ?? null,
      votosTotais: this.votosTotais,
      urlFoto: this.urlFoto,
    };
  }
}
