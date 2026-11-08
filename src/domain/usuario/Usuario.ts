import type { RowDataPacket } from "mysql2/promise";
import type { DispositivoIdentificado } from "../dispositivo/Dispositivo";
import type { IComparable } from "../fila/IComparable";
import type { TipoFila } from "./TipoFila";

export interface UsuarioRow extends RowDataPacket {
  id: number;
  nome: string;
  senha: number;
  posicao_na_fila: number;
  tipo_fila: TipoFila;
  entrou_em: Date;
  chamado_em: Date | null;
  chave: string;
  mock: number | boolean;
  ip: string | null;
  mac: string | null;
  nome_dispositivo: string | null;
  fingerprint: string | null;
  dispositivo_id: string | null;
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
  ip: string | null;
  mac: string | null;
  nomeDispositivo: string | null;
  fingerprint: string | null;
  dispositivoId: string | null;
}

export class Usuario implements IComparable {
  public chamadoEm: Date | null;
  public ip: string | null;
  public mac: string | null;
  public nomeDispositivo: string | null;
  public fingerprint: string | null;
  public dispositivoId: string | null;

  constructor(
    public nome: string,
    public senha: number,
    public posicaoNaFila: number,
    public tipoFila: TipoFila,
    public entrouEm: Date,
    public chave: string,
    public mock = false,
    public id?: number,
    dispositivo?: Partial<DispositivoIdentificado> | null,
    chamadoEm: Date | null = null,
  ) {
    this.chamadoEm = chamadoEm;
    this.ip = dispositivo?.ip ?? null;
    this.mac = dispositivo?.mac ?? null;
    this.nomeDispositivo = dispositivo?.nomeDispositivo ?? null;
    this.fingerprint = dispositivo?.fingerprint ?? null;
    this.dispositivoId = dispositivo?.dispositivoId ?? null;
  }

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
      {
        ip: row.ip ?? undefined,
        mac: row.mac ?? null,
        nomeDispositivo: row.nome_dispositivo ?? undefined,
        fingerprint: row.fingerprint ?? undefined,
        dispositivoId: row.dispositivo_id ?? undefined,
      },
      row.chamado_em ? new Date(row.chamado_em) : null,
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
      ip: this.ip,
      mac: this.mac,
      nomeDispositivo: this.nomeDispositivo,
      fingerprint: this.fingerprint,
      dispositivoId: this.dispositivoId,
    };
  }

  toString(): string {
    return `#${this.id ?? "?"} [${this.tipoFila === "PREFERENCIAL" ? "P" : "C"}${String(this.senha).padStart(3, "0")}] ${this.nome} (${this.tipoFila})`;
  }
}
