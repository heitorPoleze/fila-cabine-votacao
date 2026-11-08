import { Router } from "express";
import { filaAdminController } from "../controllers/FilaAdminController";
import { capturarDispositivo } from "../middlewares/capturarDispositivo";

const router = Router();

/**
 * GET /api/v1/dispositivos/status e GET /dispositivo/status
 * RESTful canônico: Consulta do estado da trava de voto único para o dispositivo cliente conectado.
 * Inspeciona IP, MAC (quando em rede local), Nome/User-Agent e Token UUID,
 * retornando se o dispositivo já votou ou se está autorizado a prosseguir.
 */
router.get(
  ["/status", "/"],
  capturarDispositivo,
  filaAdminController.statusDispositivo.bind(filaAdminController),
);

export default router;
