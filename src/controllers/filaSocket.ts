import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { AppError } from "../errors";
import { dispositivoService } from "../services/DispositivoService";
import { FilaError, filaService } from "../services/FilaService";

/**
 * Protocolo WebSocket (JSON):
 *
 * cliente -> servidor
 *   { type: "fila:entrar",   requestId, payload: { nome, tipoFila, dispositivoToken?, fingerprint?, nomeDispositivo?, mac? } }
 *   { type: "fila:remover",  requestId, payload: { id, chave } }
 *   { type: "fila:estado",   requestId }
 *
 * servidor -> cliente
 *   { type: "fila:estado",  payload: FilaEstado }
 *   { type: "fila:proximo", payload: Usuario }
 *   { type: "voto:novo",    payload: Voto }
 *   { type: "resposta", requestId, ok: true, data }
 *   { type: "resposta", requestId, ok: false, erro }
 */

interface Mensagem {
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
}

const HEARTBEAT_MS = 30_000;

export function attachFilaSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("error", () => undefined);
  const vivos = new WeakSet<WebSocket>();

  const enviar = (ws: WebSocket, msg: unknown) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  const broadcast = (type: string, payload: unknown) => {
    const msg = JSON.stringify({ type, payload });
    for (const cliente of wss.clients) {
      if (cliente.readyState === WebSocket.OPEN) cliente.send(msg);
    }
  };

  const aoMudar = (estado: unknown) => broadcast("fila:estado", estado);
  const aoChamar = (usuario: unknown) => broadcast("fila:proximo", usuario);
  const aoVotar = (voto: unknown) => broadcast("voto:novo", voto);
  filaService.on("mudou", aoMudar);
  filaService.on("proximo", aoChamar);
  filaService.on("voto", aoVotar);

  async function executar(msg: Mensagem, reqUpgrade: IncomingMessage): Promise<unknown> {
    const p = msg.payload ?? {};
    switch (msg.type) {
      case "fila:estado":
        return filaService.estado();
      case "fila:entrar": {
        const disp = await dispositivoService.identificarUpgradeWs(reqUpgrade, {
          tokenUuid: p.dispositivoToken ?? p.tokenDispositivo,
          fingerprint: p.fingerprint,
          nomeDispositivo: p.nomeDispositivo,
          mac: p.mac,
        });
        return filaService.entrar(p.nome, p.tipoFila, disp);
      }
      case "fila:remover":
        if (typeof p.chave !== "string") throw new FilaError("Ticket inválido");
        return filaService.remover(p.id, p.chave);
      default:
        throw new FilaError(`Mensagem desconhecida: ${msg.type}`);
    }
  }

  wss.on("connection", (ws: WebSocket, reqUpgrade: IncomingMessage) => {
    vivos.add(ws);
    ws.on("pong", () => vivos.add(ws));

    enviar(ws, { type: "fila:estado", payload: filaService.estado() });

    ws.on("message", async (raw: RawData) => {
      let msg: Mensagem;
      try {
        msg = JSON.parse(raw.toString());
        if (typeof msg?.type !== "string") throw new Error();
      } catch {
        enviar(ws, { type: "resposta", ok: false, erro: "Mensagem inválida" });
        return;
      }

      try {
        const data = await executar(msg, reqUpgrade);
        enviar(ws, { type: "resposta", requestId: msg.requestId, ok: true, data });
      } catch (err) {
        if (!(err instanceof AppError)) console.error(err);
        const erro = err instanceof AppError ? err.message : "Erro interno do servidor";
        enviar(ws, { type: "resposta", requestId: msg.requestId, ok: false, erro });
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!vivos.has(ws)) {
        ws.terminate();
        continue;
      }
      vivos.delete(ws);
      ws.ping();
    }
  }, HEARTBEAT_MS);
  wss.on("close", () => {
    clearInterval(heartbeat);
    filaService.off("mudou", aoMudar);
    filaService.off("proximo", aoChamar);
    filaService.off("voto", aoVotar);
  });

  return wss;
}
