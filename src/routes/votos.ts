import { Router } from "express";
import { votoController } from "../controllers/VotoController";
import { capturarDispositivo } from "../middlewares/capturarDispositivo";
import { exigirAdmin } from "../services/AuthService";

const votos = Router();

/**
 * Registra o voto de quem está na cabine (com ticket/chave): tira o eleitor da cabine,
 * trava o dispositivo (se real) e notifica o WebSocket.
 */
votos.post("/", capturarDispositivo, votoController.votarLegacy.bind(votoController));

/** Quantidade absoluta de votos de cada candidato no contexto ativo. */
votos.get("/resultado", votoController.contagem.bind(votoController));

/** Relatório: quem votou em quem, horário, dispositivo, tempo para votar e tempo na fila. */
votos.get("/", exigirAdmin, votoController.relatorio.bind(votoController));

export default votos;
