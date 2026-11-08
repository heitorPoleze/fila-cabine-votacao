import { Router } from "express";
import { body, query } from "express-validator";
import { filaAdminController } from "../controllers/FilaAdminController";
import { validarRequisicao } from "../middlewares/validarRequisicao";
import { exigirAdmin } from "../services/AuthService";

const router = Router();

router.use(exigirAdmin);

/**
 * GET /api/v1/admin/mock
 * RESTful canônico: Consulta o estado da sessão de demonstração mock comparada com a fila real.
 */
router.get("/mock", filaAdminController.statusMock.bind(filaAdminController));

/**
 * POST /api/v1/admin/mock e POST /api/v1/admin/mock/ativar
 * RESTful canônico: Criação / ativação de uma sessão de demonstração mock, populando as filas de teste
 * sem interferir na fila real nem nas contagens de votos oficiais.
 */
router.post(
  ["/mock", "/mock/ativar"],
  [
    body("qtd").optional().isInt({ min: 0, max: 500 }).withMessage("qtd deve ser entre 0 e 500"),
    body("qtdPreferencial")
      .optional()
      .isInt({ min: 0, max: 500 })
      .withMessage("qtdPreferencial deve ser entre 0 e 500"),
    body("qtdComum")
      .optional()
      .isInt({ min: 0, max: 500 })
      .withMessage("qtdComum deve ser entre 0 e 500"),
    body("limparAntes").optional().isBoolean().withMessage("limparAntes deve ser booleano"),
  ],
  validarRequisicao,
  filaAdminController.ativarMock.bind(filaAdminController),
);

/**
 * DELETE /api/v1/admin/mock e POST /api/v1/admin/mock/desativar
 * RESTful canônico: DELETE /api/v1/admin/mock encerra a sessão mock de demonstração,
 * liberando recursos e restaurando o foco na fila oficial.
 */
router.delete("/mock", filaAdminController.desativarMock.bind(filaAdminController));
router.post("/mock/desativar", filaAdminController.desativarMock.bind(filaAdminController));

/**
 * POST /api/v1/admin/mock/chamadas, POST /api/v1/admin/chamadas e POST /api/v1/admin/mock/chamar-proximo
 * RESTful canônico: Criação de um evento de chamada para a cabine de votação segundo a proporção dinâmica.
 */
router.post(
  ["/mock/chamadas", "/chamadas", "/mock/chamar-proximo"],
  filaAdminController.chamarProximo.bind(filaAdminController),
);

/**
 * GET /api/v1/admin/dispositivos
 * RESTful canônico: Lista a coleção de dispositivos clientes identificados e seus status de votação.
 */
router.get("/dispositivos", filaAdminController.listarDispositivos.bind(filaAdminController));

/**
 * GET /api/v1/admin/logs
 * RESTful canônico: Relatório acadêmico consolidado de logs de auditoria e métricas de desempenho:
 * - Quantidade absoluta de votos por candidato;
 * - Em quem cada usuário votou, horário e tempo que levou para votar;
 * - Tempo de espera em cada requisição HTTP (ms);
 * - Tempo desde que entrou na fila até chegar na cabine (ms).
 */
router.get(
  "/logs",
  [
    query("limite").optional().isInt({ min: 1, max: 1000 }).withMessage("limite inválido"),
    query("escopo").optional().isIn(["real", "mock"]).withMessage("escopo deve ser 'real' ou 'mock'"),
  ],
  validarRequisicao,
  filaAdminController.listarLogs.bind(filaAdminController),
);

export default router;
