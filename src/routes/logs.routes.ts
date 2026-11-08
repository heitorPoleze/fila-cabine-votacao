import { Router } from "express";
import { query } from "express-validator";
import { filaAdminController } from "../controllers/FilaAdminController";
import { validarRequisicao } from "../middlewares/validarRequisicao";
import { exigirAdmin } from "../services/AuthService";

const router = Router();

/**
 * GET /api/logs e GET /api/v1/logs
 * RESTful canônico: Relatório acadêmico unificado e auditável de eventos:
 * 1. Quantidade absoluta de votos de cada um dos candidatos;
 * 2. Em quem o usuário votou, horário do voto e tempo que levou para votar;
 * 3. Tempo de espera em cada requisição HTTP (em milissegundos);
 * 4. Quanto tempo levou desde a entrada na fila até chegar na cabine de votação.
 */
router.get(
  "/",
  exigirAdmin,
  [
    query("limite")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("limite deve estar entre 1 e 1000"),
    query("escopo")
      .optional()
      .isIn(["real", "mock"])
      .withMessage("escopo opcional deve ser 'real' ou 'mock'"),
  ],
  validarRequisicao,
  filaAdminController.listarLogs.bind(filaAdminController),
);

export default router;
