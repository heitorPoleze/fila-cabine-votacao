import { Router } from "express";
import { exigirAdmin } from "../services/AuthService";
import { filaService } from "../services/FilaService";

const fila = Router();

// ---- público

/** Estado completo das filas e da cabine. */
fila.get("/", (_req, res) => {
  res.json(filaService.estado());
});

/** Posição atual de todos que estão na fila e quem pode votar agora. */
fila.get("/posicoes", (_req, res) => {
  res.json(filaService.posicoes());
});

/** Entrar na fila (o front usa o WebSocket, mas a rota fica disponível). */
fila.post("/", async (req, res) => {
  res.status(201).json(await filaService.entrar(req.body?.nome, req.body?.tipoFila));
});

// ---- administrador

/** Chama o próximo para a cabine (proximoAVotar). */
fila.post("/proximo", exigirAdmin, async (_req, res) => {
  res.json(await filaService.proximoAVotar());
});

/** Libera a cabine sem voto; o próximo é chamado automaticamente. */
fila.post("/liberar", exigirAdmin, async (_req, res) => {
  await filaService.liberarCabine();
  res.json(filaService.estado());
});

/** Coloca 10 pessoas de demonstração na fila. */
fila.post("/mock", exigirAdmin, async (_req, res) => {
  res.status(201).json(await filaService.popularMock());
});

/** Recomeça do zero: filas, cabine, votos e senhas zerados; fila cheia de novo. */
fila.post("/reiniciar", exigirAdmin, async (_req, res) => {
  res.json(await filaService.reiniciar());
});

/** Tira alguém da fila; quem estava atrás anda uma posição. */
fila.delete("/:id", exigirAdmin, async (req, res) => {
  res.json(await filaService.remover(Number(req.params.id)));
});

export default fila;
