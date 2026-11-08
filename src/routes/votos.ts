import { Router } from "express";
import { exigirAdmin } from "../services/AuthService";
import { filaService } from "../services/FilaService";

const votos = Router();

/**
 * Registra o voto de quem está na cabine: tira o eleitor da cabine,
 * a fila anda e o próximo é chamado (avisado pelo WebSocket).
 */
votos.post("/", async (req, res) => {
  const { usuarioId, chave, candidatoId } = req.body ?? {};
  res.status(201).json(await filaService.votar(usuarioId, chave, candidatoId));
});

/** Quantidade absoluta de votos de cada candidato. */
votos.get("/resultado", async (_req, res) => {
  res.json(await filaService.resultado());
});

/** Relatório: quem votou em quem, horário, tempo para votar e tempo na fila. */
votos.get("/", exigirAdmin, async (_req, res) => {
  res.json(await filaService.relatorio());
});

export default votos;
