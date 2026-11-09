import type { RowDataPacket } from "mysql2/promise";
import type { TipoFila } from "../usuario/TipoFila";

/** Dados coletados do cliente HTTP/WebSocket para identificação única do dispositivo. */
export interface DispositivoIdentificado {
  dispositivoId: string;
  tokenUuid: string | null;
  ip: string;
  mac: string | null;
  nomeDispositivo: string;
  userAgent: string | null;
  fingerprint: string;
}

export interface DispositivoVotanteRow extends RowDataPacket {
  id: number;
  dispositivo_id: string;
  token_uuid: string | null;
  ip: string;
  mac: string | null;
  nome_dispositivo: string;
  user_agent: string | null;
  fingerprint: string;
  ultimo_nome: string | null;
  ultima_fila: TipoFila | null;
  voto_concluido: number | boolean;
  usuario_votante_id: number | null;
  votou_em: Date | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface DispositivoVotanteJSON {
  id?: number;
  dispositivoId: string;
  tokenUuid: string | null;
  ip: string;
  mac: string | null;
  nomeDispositivo: string;
  fingerprint: string;
  ultimoNome: string | null;
  ultimaFila: TipoFila | null;
  votoConcluido: boolean;
  usuarioVotanteId: number | null;
  votouEm: string | null;
}

export class DispositivoVotante {
  constructor(
    public readonly dispositivoId: string,
    public readonly tokenUuid: string | null,
    public readonly ip: string,
    public readonly mac: string | null,
    public readonly nomeDispositivo: string,
    public readonly userAgent: string | null,
    public readonly fingerprint: string,
    public ultimoNome: string | null = null,
    public ultimaFila: TipoFila | null = null,
    public votoConcluido: boolean = false,
    public usuarioVotanteId: number | null = null,
    public votouEm: Date | null = null,
    public id?: number,
  ) {}

  public static fromRow(row: DispositivoVotanteRow): DispositivoVotante {
    return new DispositivoVotante(
      row.dispositivo_id,
      row.token_uuid,
      row.ip,
      row.mac,
      row.nome_dispositivo,
      row.user_agent,
      row.fingerprint,
      row.ultimo_nome,
      row.ultima_fila,
      Boolean(row.voto_concluido),
      row.usuario_votante_id,
      row.votou_em ? new Date(row.votou_em) : null,
      row.id,
    );
  }

  public toJSON(): DispositivoVotanteJSON {
    return {
      id: this.id,
      dispositivoId: this.dispositivoId,
      tokenUuid: this.tokenUuid,
      ip: this.ip,
      mac: this.mac,
      nomeDispositivo: this.nomeDispositivo,
      fingerprint: this.fingerprint,
      ultimoNome: this.ultimoNome,
      ultimaFila: this.ultimaFila,
      votoConcluido: this.votoConcluido,
      usuarioVotanteId: this.usuarioVotanteId,
      votouEm: this.votouEm?.toISOString() ?? null,
    };
  }
}
