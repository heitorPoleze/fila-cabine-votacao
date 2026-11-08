import { Router } from "express";
import { filaPublicController } from "../controllers/FilaPublicController";
import { capturarDispositivo } from "../middlewares/capturarDispositivo";
import { exigirAdmin } from "../services/AuthService";

const fila = Router();

// ---- público (front / painel de exibição da fila em tempo real)

/** Estado completo das filas e da cabine (contexto ativo: mock ou real). */
fila.get("/", filaPublicController.estado.bind(filaPublicController));

/** Posição atual de todos que estão na fila e quem pode votar agora. */
fila.get("/posicoes", filaPublicController.posicoes.bind(filaPublicController));

/** Entrar na fila real (com trava de dispositivo único). */
fila.post("/", capturarDispositivo, filaPublicController.entrar.bind(filaPublicController));

// ---- administrador

/** Chama o próximo para a cabine respeitando a proporção calculada (proximoAVotar). */
fila.post("/proximo", exigirAdmin, filaPublicController.proximo.bind(filaPublicController));

/** Libera a cabine sem voto. */
fila.post("/liberar", exigirAdmin, filaPublicController.liberar.bind(filaPublicController));

/** Status do modo Mock vs Fila Real. */
fila.get("/mock", exigirAdmin, filaPublicController.statusMock.bind(filaPublicController));

/** Ativa e popula pessoas de demonstração na fila Mock (sem afetar a fila real). */
fila.post("/mock", exigirAdmin, filaPublicController.popularMock.bind(filaPublicController));

/** Desabilita o modo Mock sem afetar a fila real nem os votos reais. */
fila.post("/mock/desativar", exigirAdmin, filaPublicController.desativarMock.bind(filaPublicController));
fila.delete("/mock", exigirAdmin, filaPublicController.desativarMock.bind(filaPublicController));

/** Reinicia o contexto atual (`?escopo=real` reinicia a eleição oficial; padrão reinicia apenas o mock). */
fila.post("/reiniciar", exigirAdmin, filaPublicController.reiniciar.bind(filaPublicController));

/** Tira alguém da fila; quem estava atrás anda uma posição. */
fila.delete("/:id", exigirAdmin, filaPublicController.remover.bind(filaPublicController));

export default fila;
