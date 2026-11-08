import type { Server } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { FilaError, filaService } from "../services/FilaService";

/**
 * Protocolo (JSON):
 *
 * cliente -> servidor
 *   { type: "fila:entrar",   requestId, payload: { nome, tipoFila } }
 *   { type: "fila:remover",  requestId, payload: { id, chave } }   // o próprio eleitor sai
 *   { type: "fila:estado",   requestId }            // pede o estado atual
 *
 * As ações de administrador (chamar, liberar, remover qualquer um) ficam na API REST (/fila).
 *
 * servidor -> cliente
 *   { type: "fila:estado",  payload: FilaEstado }   // broadcast a cada mudança (posição de todos)
 *   { type: "fila:proximo", payload: Usuario }      // broadcast: quem pode votar agora
 *   { type: "voto:novo",    payload: Voto }         // broadcast: alguém votou (resultado mudou)
 *   { type: "resposta", requestId, ok: true, data } // resposta a um pedido
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
  // Erros do servidor HTTP (ex.: porta ocupada) são tratados em server.ts; sem este
  // ouvinte o ws os repassa como "Unhandled 'error' event".
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

  // Toda mudança na fila (venha do WebSocket, da API REST ou do voto de um mock)
  // é avisada para todos: posição atual de cada um e quem pode votar.
  const aoMudar = (estado: unknown) => broadcast("fila:estado", estado);
  const aoChamar = (usuario: unknown) => broadcast("fila:proximo", usuario);
  const aoVotar = (voto: unknown) => broadcast("voto:novo", voto);
  filaService.on("mudou", aoMudar);
  filaService.on("proximo", aoChamar);
  filaService.on("voto", aoVotar);

  async function executar(msg: Mensagem): Promise<unknown> {
    const p = msg.payload ?? {};
    switch (msg.type) {
      case "fila:estado":
        return filaService.estado();
      case "fila:entrar":
        return filaService.entrar(p.nome, p.tipoFila);
      case "fila:remover":
        if (typeof p.chave !== "string") throw new FilaError("Ticket inválido");
        return filaService.remover(p.id, p.chave);
      default:
        throw new FilaError(`Mensagem desconhecida: ${msg.type}`);
    }
  }

  wss.on("connection", (ws) => {
    vivos.add(ws);
    ws.on("pong", () => vivos.add(ws));

    // Assim que conecta, o cliente recebe o estado completo.
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
        // O estado novo sai (pelo evento "mudou") antes da resposta: quando o
        // cliente recebe a resposta, a fila que ele tem já inclui a mudança.
        const data = await executar(msg);
        enviar(ws, { type: "resposta", requestId: msg.requestId, ok: true, data });
      } catch (err) {
        if (!(err instanceof FilaError)) console.error(err);
        const erro = err instanceof FilaError ? err.message : "Erro interno do servidor";
        enviar(ws, { type: "resposta", requestId: msg.requestId, ok: false, erro });
      }
    });
  });

  // Derruba conexões mortas (aba fechada sem aviso, rede caiu etc.).
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
