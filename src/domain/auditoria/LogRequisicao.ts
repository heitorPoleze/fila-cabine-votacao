import type { RowDataPacket } from "mysql2/promise";

export interface LogRequisicaoRow extends RowDataPacket {
  id: number;
  metodo: string;
  rota: string;
  status_code: number;
  tempo_espera_ms: number | string;
  ip: string | null;
  nome_dispositivo: string | null;
  dispositivo_id: string | null;
  data_hora: Date;
}

export interface LogRequisicaoJSON {
  id?: number;
  metodo: string;
  rota: string;
  statusCode: number;
  /** Tempo de espera/processamento da requisição HTTP em milissegundos. */
  tempoEsperaMs: number;
  tempoEsperaFormatado: string;
  ip: string | null;
  nomeDispositivo: string | null;
  dispositivoId: string | null;
  horario: string;
}

export function formatarDuracaoMs(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return null;
  const seguro = Math.max(0, ms);
  if (seguro < 1000) return `${seguro.toFixed(2).replace(/\.00$/, "")}ms`;
  const totalSegundos = seguro / 1000;
  if (totalSegundos < 60) return `${totalSegundos.toFixed(3)}s`;
  const minutos = Math.floor(totalSegundos / 60);
  const restoSegundos = (totalSegundos % 60).toFixed(3);
  return `${minutos}m ${restoSegundos}s`;
}

export class LogRequisicao {
  constructor(
    public readonly metodo: string,
    public readonly rota: string,
    public readonly statusCode: number,
    public readonly tempoEsperaMs: number,
    public readonly ip: string | null = null,
    public readonly nomeDispositivo: string | null = null,
    public readonly dispositivoId: string | null = null,
    public readonly dataHora: Date = new Date(),
    public id?: number,
  ) {}

  static fromRow(row: LogRequisicaoRow): LogRequisicao {
    return new LogRequisicao(
      row.metodo,
      row.rota,
      Number(row.status_code),
      Number(row.tempo_espera_ms),
      row.ip ?? null,
      row.nome_dispositivo ?? null,
      row.dispositivo_id ?? null,
      new Date(row.data_hora),
      row.id,
    );
  }

  toJSON(): LogRequisicaoJSON {
    return {
      id: this.id,
      metodo: this.metodo,
      rota: this.rota,
      statusCode: this.statusCode,
      tempoEsperaMs: this.tempoEsperaMs,
      tempoEsperaFormatado: formatarDuracaoMs(this.tempoEsperaMs) ?? "0ms",
      ip: this.ip,
      nomeDispositivo: this.nomeDispositivo,
      dispositivoId: this.dispositivoId,
      horario: this.dataHora.toISOString(),
    };
  }
}
