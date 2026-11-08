import type { RowDataPacket } from "mysql2/promise";
import { formatarDuracaoMs } from "../auditoria/LogRequisicao";
import type { TipoFila } from "../usuario/TipoFila";

export interface VotoRow extends RowDataPacket {
  id: number;
  usuario_id: number | null;
  usuario_nome: string;
  senha: number;
  tipo_fila: TipoFila;
  candidato_id: number;
  candidato_nome?: string;
  entrou_na_fila_em: Date;
  chamado_em: Date;
  votou_em: Date;
  tempo_na_fila_ms: number | string;
  tempo_para_votar_ms: number | string;
  tempo_requisicao_ms: number | string | null;
  ip: string | null;
  mac: string | null;
  nome_dispositivo: string | null;
  fingerprint: string | null;
  dispositivo_id: string | null;
  mock: number | boolean;
}

export interface VotoJSON {
  id?: number;
  usuarioId: number | null;
  usuarioNome: string;
  senha: number;
  tipoFila: TipoFila;
  candidatoId: number;
  candidatoNome?: string;
  entrouNaFilaEm: string;
  chamadoEm: string;
  votouEm: string;
  /** Quanto tempo levou desde que entrou na fila até chegar na cabine (ms). */
  tempoNaFilaMs: number;
  tempoNaFilaFormatado: string;
  /** Quanto tempo levou desde que chegou na cabine até confirmar o voto (ms). */
  tempoParaVotarMs: number;
  tempoParaVotarFormatado: string;
  /** Tempo de espera/processamento da requisição HTTP do voto (ms). */
  tempoRequisicaoMs: number | null;
  tempoRequisicaoFormatado: string | null;
  ip: string | null;
  mac: string | null;
  nomeDispositivo: string | null;
  fingerprint: string | null;
  dispositivoId: string | null;
  mock: boolean;
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
    public readonly usuarioId: number | null = null,
    public readonly ip: string | null = null,
    public readonly mac: string | null = null,
    public readonly nomeDispositivo: string | null = null,
    public readonly fingerprint: string | null = null,
    public readonly dispositivoId: string | null = null,
    public readonly mock: boolean = false,
    public readonly tempoRequisicaoMs: number | null = null,
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
      row.usuario_id ?? null,
      row.ip ?? null,
      row.mac ?? null,
      row.nome_dispositivo ?? null,
      row.fingerprint ?? null,
      row.dispositivo_id ?? null,
      Boolean(row.mock),
      row.tempo_requisicao_ms !== null && row.tempo_requisicao_ms !== undefined
        ? Number(row.tempo_requisicao_ms)
        : null,
    );
  }

  /** Quanto tempo levou desde que entrou na fila até chegar na cabine. */
  get tempoNaFilaMs(): number {
    return Math.max(0, this.chamadoEm.getTime() - this.entrouNaFilaEm.getTime());
  }

  /** Quanto tempo levou na cabine até confirmar o voto. */
  get tempoParaVotarMs(): number {
    return Math.max(0, this.votouEm.getTime() - this.chamadoEm.getTime());
  }

  toJSON(): VotoJSON {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      usuarioNome: this.usuarioNome,
      senha: this.senha,
      tipoFila: this.tipoFila,
      candidatoId: this.candidatoId,
      candidatoNome: this.candidatoNome,
      entrouNaFilaEm: this.entrouNaFilaEm.toISOString(),
      chamadoEm: this.chamadoEm.toISOString(),
      votouEm: this.votouEm.toISOString(),
      tempoNaFilaMs: this.tempoNaFilaMs,
      tempoNaFilaFormatado: formatarDuracaoMs(this.tempoNaFilaMs) ?? "0ms",
      tempoParaVotarMs: this.tempoParaVotarMs,
      tempoParaVotarFormatado: formatarDuracaoMs(this.tempoParaVotarMs) ?? "0ms",
      tempoRequisicaoMs: this.tempoRequisicaoMs,
      tempoRequisicaoFormatado: formatarDuracaoMs(this.tempoRequisicaoMs),
      ip: this.ip,
      mac: this.mac,
      nomeDispositivo: this.nomeDispositivo,
      fingerprint: this.fingerprint,
      dispositivoId: this.dispositivoId,
      mock: this.mock,
    };
  }
}
