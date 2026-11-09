import type { RowDataPacket } from "mysql2/promise";
import type { TipoFila } from "../usuario/TipoFila";
import { formatarDuracaoMs } from "./LogRequisicao";

export type OperacaoAuditoria =
  | "CADASTRO_FILA"
  | "CHAMADA_CABINE"
  | "VOTO_COMPUTADO"
  | "BLOQUEIO_DUPLICIDADE"
  | "SAIDA_FILA";

export interface LogAuditoriaRow extends RowDataPacket {
  id: number;
  operacao: OperacaoAuditoria;
  data_hora: Date;
  usuario_id: number | null;
  eleitor_nome: string | null;
  tipo_fila: TipoFila | null;
  entrou_na_fila_em: Date | null;
  chamado_em: Date | null;
  votou_em: Date | null;
  tempo_na_fila_ms: number | string | null;
  tempo_para_votar_ms: number | string | null;
  tempo_requisicao_ms: number | string | null;
  ip: string | null;
  mac: string | null;
  nome_dispositivo: string | null;
  fingerprint: string | null;
  dispositivo_id: string | null;
  candidato_id: number | null;
  candidato_nome: string | null;
  mock: number | boolean;
  detalhes: string | null;
}

export interface LogAuditoriaJSON {
  id?: number;
  operacao: OperacaoAuditoria;
  timestamp: string;
  usuarioId: number | null;
  nomeEleitor: string | null;
  filaEscolhida: TipoFila | null;
  entrouNaFilaEm: string | null;
  chamadoEm: string | null;
  votouEm: string | null;
  /** Quanto tempo levou desde que entrou na fila até chegar na cabine (ms). */
  tempoNaFilaAteCabineMs: number | null;
  tempoNaFilaAteCabineFormatado: string | null;
  /** Quanto tempo levou na cabine para concluir o voto (ms). */
  tempoParaVotarMs: number | null;
  tempoParaVotarFormatado: string | null;
  /** Tempo de espera/processamento da requisição HTTP associada (ms). */
  tempoEsperaRequisicaoMs: number | null;
  tempoEsperaRequisicaoFormatado: string | null;
  dispositivo: {
    dispositivoId: string | null;
    ip: string | null;
    mac: string | null;
    nomeDispositivo: string | null;
    fingerprint: string | null;
  };
  candidatoVotado: {
    id: number;
    nome: string | null;
  } | null;
  mock: boolean;
  detalhes: string | null;
}

export class LogAuditoria {
  constructor(
    public readonly operacao: OperacaoAuditoria,
    public readonly dataHora: Date,
    public readonly usuarioId: number | null,
    public readonly eleitorNome: string | null,
    public readonly tipoFila: TipoFila | null,
    public readonly ip: string | null,
    public readonly mac: string | null,
    public readonly nomeDispositivo: string | null,
    public readonly fingerprint: string | null,
    public readonly dispositivoId: string | null,
    public readonly candidatoId: number | null = null,
    public readonly candidatoNome: string | null = null,
    public readonly detalhes: string | null = null,
    public readonly entrouNaFilaEm: Date | null = null,
    public readonly chamadoEm: Date | null = null,
    public readonly votouEm: Date | null = null,
    public readonly tempoNaFilaMs: number | null = null,
    public readonly tempoParaVotarMs: number | null = null,
    public readonly tempoRequisicaoMs: number | null = null,
    public readonly mock: boolean = false,
    public id?: number,
  ) {}

  public static fromRow(row: LogAuditoriaRow): LogAuditoria {
    return new LogAuditoria(
      row.operacao,
      new Date(row.data_hora),
      row.usuario_id,
      row.eleitor_nome,
      row.tipo_fila,
      row.ip,
      row.mac,
      row.nome_dispositivo,
      row.fingerprint,
      row.dispositivo_id,
      row.candidato_id,
      row.candidato_nome,
      row.detalhes,
      row.entrou_na_fila_em ? new Date(row.entrou_na_fila_em) : null,
      row.chamado_em ? new Date(row.chamado_em) : null,
      row.votou_em ? new Date(row.votou_em) : null,
      row.tempo_na_fila_ms !== null && row.tempo_na_fila_ms !== undefined
        ? Number(row.tempo_na_fila_ms)
        : null,
      row.tempo_para_votar_ms !== null && row.tempo_para_votar_ms !== undefined
        ? Number(row.tempo_para_votar_ms)
        : null,
      row.tempo_requisicao_ms !== null && row.tempo_requisicao_ms !== undefined
        ? Number(row.tempo_requisicao_ms)
        : null,
      Boolean(row.mock),
      row.id,
    );
  }

  public toJSON(): LogAuditoriaJSON {
    return {
      id: this.id,
      operacao: this.operacao,
      timestamp: this.dataHora.toISOString(),
      usuarioId: this.usuarioId,
      nomeEleitor: this.eleitorNome,
      filaEscolhida: this.tipoFila,
      entrouNaFilaEm: this.entrouNaFilaEm?.toISOString() ?? null,
      chamadoEm: this.chamadoEm?.toISOString() ?? null,
      votouEm: this.votouEm?.toISOString() ?? null,
      tempoNaFilaAteCabineMs: this.tempoNaFilaMs,
      tempoNaFilaAteCabineFormatado: formatarDuracaoMs(this.tempoNaFilaMs),
      tempoParaVotarMs: this.tempoParaVotarMs,
      tempoParaVotarFormatado: formatarDuracaoMs(this.tempoParaVotarMs),
      tempoEsperaRequisicaoMs: this.tempoRequisicaoMs,
      tempoEsperaRequisicaoFormatado: formatarDuracaoMs(this.tempoRequisicaoMs),
      dispositivo: {
        dispositivoId: this.dispositivoId,
        ip: this.ip,
        mac: this.mac,
        nomeDispositivo: this.nomeDispositivo,
        fingerprint: this.fingerprint,
      },
      candidatoVotado:
        this.candidatoId !== null
          ? { id: this.candidatoId, nome: this.candidatoNome }
          : null,
      mock: this.mock,
      detalhes: this.detalhes,
    };
  }
}
